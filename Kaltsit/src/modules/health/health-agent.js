/**
 * Kaltsit Health Agent
 *
 * Local-first health supervision for sleep, hydration, movement and mental
 * health signals. This module does not read external accounts directly; source
 * adapters provide a stable ingestion boundary for Gmail, Outlook, app chat and
 * chat exports from WeChat, QQ and Telegram.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { buildHealthSkills } = require('./health-skills');

const HEALTH_FILE = 'kaltsit-health-data.json';
const CHECK_INTERVAL_MS = 60 * 1000;

const SOURCE_TYPES = [
    'app-chat',
    'gmail',
    'outlook',
    'wechat',
    'qq',
    'telegram'
];

const defaultSettings = {
    enabled: true,
    storeRawText: false,
    sleep: {
        enabled: true,
        bedtimeHour: 23,
        wakeHour: 7,
        cooldownMinutes: 60
    },
    hydration: {
        enabled: true,
        frequencyMinutes: 60
    },
    movement: {
        enabled: true,
        frequencyMinutes: 45
    },
    dailyExercise: {
        enabled: true,
        time: '18:30'
    },
    mentalHealth: {
        enabled: true,
        respondToLowRisk: false,
        cooldownMinutes: 20
    },
    sources: Object.fromEntries(SOURCE_TYPES.map((type) => [
        type,
        {
            enabled: true,
            status: type === 'app-chat' ? 'active' : 'manual-import',
            lastImportedAt: null
        }
    ]))
};

const defaultData = {
    settings: defaultSettings,
    observations: [],
    events: [],
    counters: {
        analyzedMessages: 0,
        highRiskSignals: 0,
        crisisSignals: 0
    },
    lastReminders: {
        sleep: null,
        hydration: null,
        movement: null,
        dailyExercise: null,
        mentalHealth: null
    },
    lastUpdated: new Date().toISOString()
};

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function deepMerge(base, updates) {
    const output = Array.isArray(base) ? [...base] : { ...base };
    for (const [key, value] of Object.entries(updates || {})) {
        if (
            value &&
            typeof value === 'object' &&
            !Array.isArray(value) &&
            base &&
            typeof base[key] === 'object' &&
            !Array.isArray(base[key])
        ) {
            output[key] = deepMerge(base[key], value);
        } else {
            output[key] = value;
        }
    }
    return output;
}

function minutesBetween(previousIso, now = new Date()) {
    if (!previousIso) return Infinity;
    const previous = new Date(previousIso).getTime();
    if (!Number.isFinite(previous)) return Infinity;
    return (now.getTime() - previous) / 60000;
}

function normalizeText(value) {
    return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function buildUrl(baseUrl, params) {
    const url = new URL(baseUrl);
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && String(value).trim()) {
            url.searchParams.set(key, String(value).trim());
        }
    }
    return url.toString();
}

class KaltsitHealthAgent {
    constructor(appDataPath, options = {}) {
        this.appDataPath = appDataPath;
        this.dataPath = path.join(appDataPath, HEALTH_FILE);
        this.onResponse = options.onResponse || (() => {});
        this.data = this.loadData();
        this.timer = null;
    }

    loadData() {
        try {
            if (fs.existsSync(this.dataPath)) {
                const parsed = JSON.parse(fs.readFileSync(this.dataPath, 'utf8'));
                return deepMerge(clone(defaultData), parsed);
            }
        } catch (error) {
            console.warn('[KaltsitHealthAgent] Failed to load health data:', error.message);
        }
        return clone(defaultData);
    }

    saveData() {
        fs.mkdirSync(path.dirname(this.dataPath), { recursive: true });
        this.data.lastUpdated = new Date().toISOString();
        fs.writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2));
    }

    start() {
        if (this.timer) return;
        this.checkDueReminders();
        this.timer = setInterval(() => this.checkDueReminders(), CHECK_INTERVAL_MS);
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    getStatus() {
        return {
            settings: clone(this.data.settings),
            counters: clone(this.data.counters),
            lastReminders: clone(this.data.lastReminders),
            sources: this.getSources(),
            recentObservations: this.data.observations.slice(-10)
        };
    }

    getSources() {
        return Object.entries(this.data.settings.sources).map(([type, state]) => ({
            type,
            enabled: Boolean(state.enabled),
            status: state.status,
            lastImportedAt: state.lastImportedAt
        }));
    }

    getSkills() {
        return buildHealthSkills(this.data.settings);
    }

    updateSettings(updates) {
        this.data.settings = deepMerge(this.data.settings, updates || {});
        this.saveData();
        return this.getStatus();
    }

    connectSource(sourceType, metadata = {}) {
        const type = this.normalizeSource(sourceType);
        const source = this.data.settings.sources[type];
        source.enabled = true;
        source.status = type === 'app-chat' ? 'active' : 'manual-import';
        source.lastImportedAt = metadata.importedAt || new Date().toISOString();
        this.saveData();
        return {
            type,
            status: source.status,
            note: type === 'app-chat'
                ? '\u5e94\u7528\u5185\u804a\u5929\u6b63\u5728\u672c\u5730\u89c2\u6d4b\u3002'
                : '\u5916\u90e8\u8d26\u6237\u76ee\u524d\u4f5c\u4e3a\u624b\u52a8\u5bfc\u5165\u6765\u6e90\uff0c\u7b49\u5f85\u540e\u7eed OAuth \u6216\u5e73\u53f0\u9002\u914d\u5668\u63a5\u5165\u3002'
        };
    }

    normalizeSource(sourceType) {
        const type = String(sourceType || 'app-chat').toLowerCase();
        if (!SOURCE_TYPES.includes(type)) {
            throw new Error(`Unsupported health source: ${sourceType}`);
        }
        return type;
    }

    analyzeBatch(items = []) {
        return items.map((item) => this.analyzeMessage(item));
    }

    analyzeMessage(message = {}) {
        if (!this.data.settings.enabled || !this.data.settings.mentalHealth.enabled) {
            return { success: true, skipped: true, reason: 'health-agent-disabled' };
        }

        const source = this.normalizeSource(message.source || 'app-chat');
        const sourceSettings = this.data.settings.sources[source];
        if (!sourceSettings || sourceSettings.enabled === false) {
            return { success: true, skipped: true, reason: 'source-disabled', source };
        }

        const text = String(message.text || message.body || '').trim();
        const subject = String(message.subject || '').trim();
        const combinedText = `${subject}\n${text}`.trim();
        if (!combinedText) {
            return { success: true, skipped: true, reason: 'empty-message', source };
        }

        const assessment = this.assessMentalHealth(combinedText);
        const now = new Date(message.timestamp || Date.now());
        const shouldRespond = this.shouldRespondToAssessment(assessment, now);
        const response = shouldRespond ? this.buildMentalHealthResponse(assessment, source) : null;

        const observation = {
            id: crypto.randomUUID(),
            source,
            timestamp: now.toISOString(),
            subject: subject || null,
            riskLevel: assessment.riskLevel,
            signals: assessment.signals,
            summary: assessment.summary,
            response,
            text: this.data.settings.storeRawText ? combinedText : undefined
        };

        this.data.observations.push(observation);
        this.data.observations = this.data.observations.slice(-200);
        this.data.counters.analyzedMessages++;
        if (assessment.riskLevel === 'high') this.data.counters.highRiskSignals++;
        if (assessment.riskLevel === 'crisis') this.data.counters.crisisSignals++;
        if (shouldRespond) this.data.lastReminders.mentalHealth = now.toISOString();

        sourceSettings.lastImportedAt = now.toISOString();
        this.saveData();

        const result = {
            success: true,
            source,
            assessment,
            response,
            observationId: observation.id
        };

        if (response) {
            this.emitResponse({
                type: 'mental-health',
                source,
                severity: assessment.riskLevel,
                message: response,
                observationId: observation.id
            });
        }

        return result;
    }

    runSkill(skillId, input = {}) {
        const id = String(skillId || '').trim();
        const now = new Date(input.timestamp || Date.now());

        switch (id) {
            case 'sleep-supervision':
                return this.emitImmediateSkillReminder(
                    id,
                    'sleep',
                    "Kal'tsit\uff1a\u73b0\u5728\u8fdb\u5165\u7761\u7720\u76d1\u7763\u3002\u4fdd\u5b58\u5de5\u4f5c\uff0c\u5173\u95ed\u523a\u6fc0\u6e90\uff0c\u4e0d\u8981\u518d\u628a\u75b2\u52b3\u5f53\u6210\u610f\u5fd7\u529b\u3002",
                    now
                );
            case 'hydration-reminder':
                return this.emitImmediateSkillReminder(
                    id,
                    'hydration',
                    "Kal'tsit\uff1a\u996e\u6c34\u3002\u4e0d\u662f\u7b49\u4e0b\uff0c\u662f\u73b0\u5728\u3002",
                    now
                );
            case 'movement-break':
                return this.emitImmediateSkillReminder(
                    id,
                    'movement',
                    "Kal'tsit\uff1a\u8d77\u8eab\u6d3b\u52a8\u4e24\u5206\u949f\u3002\u80a9\u9888\u3001\u624b\u8155\u548c\u773c\u775b\u90fd\u9700\u8981\u6062\u590d\u3002",
                    now
                );
            case 'daily-exercise':
                return this.emitImmediateSkillReminder(
                    id,
                    'dailyExercise',
                    "Kal'tsit\uff1a\u4eca\u5929\u7684\u8fd0\u52a8\u4e0d\u9700\u8981\u5b8c\u7f8e\uff0c\u4f46\u9700\u8981\u53d1\u751f\u3002\u77ed\u65f6\u6563\u6b65\u6216\u62c9\u4f38\u5c31\u591f\u3002",
                    now
                );
            case 'mental-health-check':
                if (input.message || input.text || input.body || input.subject) {
                    return {
                        skillId: id,
                        ...this.analyzeMessage({
                            source: input.source || 'app-chat',
                            subject: input.subject,
                            text: input.message || input.text || input.body,
                            timestamp: now.toISOString()
                        })
                    };
                }
                return {
                    skillId: id,
                    success: true,
                    message: "Kal'tsit\uff1a\u5fc3\u7406\u72b6\u6001\u5de1\u68c0\u5df2\u5c31\u7eea\u3002\u53d1\u73b0\u538b\u529b\u3001\u5931\u7720\u6216\u5371\u673a\u4fe1\u53f7\u65f6\uff0c\u6211\u4f1a\u4ecb\u5165\u3002"
                };
            case 'crisis-support':
                return this.emitImmediateSkillReminder(
                    id,
                    'mentalHealth',
                    "Kal'tsit\uff1a\u5982\u679c\u4f60\u6709\u4f24\u5bb3\u81ea\u5df1\u7684\u51b2\u52a8\uff0c\u7acb\u523b\u79bb\u5f00\u5371\u9669\u7269\u54c1\uff0c\u8054\u7cfb\u5f53\u5730\u7d27\u6025\u670d\u52a1\u6216\u4e00\u4f4d\u53ef\u4fe1\u4efb\u7684\u4eba\u3002\u8fd9\u4e0d\u662f\u9700\u8981\u72ec\u81ea\u627f\u62c5\u7684\u60c5\u51b5\u3002",
                    now,
                    'crisis'
                );
            case 'source-review':
                return {
                    skillId: id,
                    success: true,
                    sources: this.getSources(),
                    message: this.buildSourceSummary()
                };
            case 'privacy-guard':
                return {
                    skillId: id,
                    success: true,
                    storeRawText: Boolean(this.data.settings.storeRawText),
                    message: this.data.settings.storeRawText
                        ? "Kal'tsit\uff1a\u6ce8\u610f\uff0c\u5f53\u524d\u914d\u7f6e\u4f1a\u4fdd\u5b58\u539f\u6587\u3002\u5982\u679c\u4e0d\u5fc5\u8981\uff0c\u5efa\u8bae\u5173\u95ed\u3002"
                        : "Kal'tsit\uff1a\u9690\u79c1\u5b88\u536b\u5df2\u542f\u7528\u3002\u9ed8\u8ba4\u4e0d\u4fdd\u5b58\u539f\u6587\uff0c\u53ea\u4fdd\u7559\u5fc5\u8981\u7684\u5065\u5eb7\u4fe1\u53f7\u3002"
                };
            case 'medical-web-search':
                return this.buildMedicalWebSearch(input);
            case 'nearby-hospital-search':
                return this.buildNearbyHospitalSearch(input);
            case 'medicine-prep-assist':
                return this.buildMedicinePrepAssist(input);
            default:
                throw new Error(`Unsupported health skill: ${skillId}`);
        }
    }

    buildMedicalWebSearch(input = {}) {
        const query = String(input.query || input.symptom || input.message || '').trim();
        const safeQuery = query || '\u5e38\u89c1\u5065\u5eb7\u95ee\u9898 \u4f55\u65f6\u5c31\u533b';
        const searchUrl = buildUrl('https://www.google.com/search', {
            q: `${safeQuery} medical advice when to see a doctor`
        });
        return {
            skillId: 'medical-web-search',
            success: true,
            openUrl: searchUrl,
            searchUrl,
            message: "Kal'tsit\uff1a\u6211\u53ef\u4ee5\u4e3a\u4f60\u6253\u5f00\u8054\u7f51\u641c\u7d22\u5165\u53e3\u3002\u8bb0\u4f4f\uff0c\u7f51\u7edc\u4fe1\u606f\u53ea\u80fd\u4f5c\u4e3a\u53c2\u8003\uff0c\u4e0d\u80fd\u66ff\u4ee3\u533b\u751f\u8bca\u65ad\u3002\u5982\u679c\u51fa\u73b0\u80f8\u75db\u3001\u547c\u5438\u56f0\u96be\u3001\u610f\u8bc6\u6a21\u7cca\u3001\u4e25\u91cd\u8fc7\u654f\u6216\u81ea\u4f24\u98ce\u9669\uff0c\u8bf7\u7acb\u5373\u8054\u7cfb\u5f53\u5730\u7d27\u6025\u670d\u52a1\u3002"
        };
    }

    buildNearbyHospitalSearch(input = {}) {
        const location = String(input.location || input.city || '').trim();
        const query = location
            ? `hospital emergency room near ${location}`
            : 'hospital emergency room near me';
        const mapsUrl = buildUrl('https://www.google.com/maps/search/', { api: '1', query });
        return {
            skillId: 'nearby-hospital-search',
            success: true,
            openUrl: mapsUrl,
            mapsUrl,
            requiresLocation: !location,
            message: location
                ? "Kal'tsit\uff1a\u6211\u4f1a\u6253\u5f00\u9644\u8fd1\u533b\u9662\u641c\u7d22\u3002\u5982\u679c\u662f\u6025\u75c7\uff0c\u4e0d\u8981\u7b49\u5f85\u7ebf\u4e0a\u641c\u7d22\u7ed3\u679c\uff0c\u8bf7\u76f4\u63a5\u8054\u7cfb\u5f53\u5730\u7d27\u6025\u670d\u52a1\u3002"
                : "Kal'tsit\uff1a\u6211\u4f1a\u6253\u5f00\u201c\u9644\u8fd1\u533b\u9662\u201d\u5730\u56fe\u641c\u7d22\u3002\u5982\u679c\u4f60\u613f\u610f\u63d0\u4f9b\u57ce\u5e02\u6216\u533a\u57df\uff0c\u7ed3\u679c\u4f1a\u66f4\u51c6\u786e\u3002\u6025\u75c7\u65f6\u8bf7\u4f18\u5148\u62e8\u6253\u5f53\u5730\u7d27\u6025\u7535\u8bdd\u3002"
        };
    }

    buildMedicinePrepAssist(input = {}) {
        const medicine = String(input.medicine || input.query || input.symptom || '').trim();
        const query = medicine
            ? `${medicine} pharmacy near me`
            : 'pharmacy near me pharmacist consultation';
        const pharmacyUrl = buildUrl('https://www.google.com/maps/search/', { api: '1', query });
        return {
            skillId: 'medicine-prep-assist',
            success: true,
            openUrl: pharmacyUrl,
            pharmacyUrl,
            canAutoPurchase: false,
            message: "Kal'tsit\uff1a\u6211\u53ef\u4ee5\u5e2e\u4f60\u6253\u5f00\u836f\u5e97\u6216\u836f\u54c1\u641c\u7d22\u5165\u53e3\uff0c\u4f46\u4e0d\u4f1a\u81ea\u52a8\u4e0b\u5355\u6216\u4ee3\u4e70\u836f\u54c1\u3002\u5904\u65b9\u836f\u5fc5\u987b\u9075\u5faa\u533b\u5631\uff0c\u975e\u5904\u65b9\u836f\u4e5f\u5e94\u6838\u5bf9\u7981\u5fcc\u3001\u8fc7\u654f\u53f2\u548c\u836f\u7269\u76f8\u4e92\u4f5c\u7528\uff0c\u5fc5\u8981\u65f6\u8bf7\u54a8\u8be2\u836f\u5e08\u6216\u533b\u751f\u3002"
        };
    }

    assessMentalHealth(text) {
        const normalized = normalizeText(text);
        const signals = [];

        const matchAny = (name, patterns) => {
            const matched = patterns.some((pattern) => normalized.includes(pattern));
            if (matched) signals.push(name);
            return matched;
        };

        const crisis = matchAny('self-harm-or-immediate-risk', [
            'kill myself',
            'end my life',
            'suicide',
            'self harm',
            '\u60f3\u6b7b',
            '\u4e0d\u60f3\u6d3b',
            '\u81ea\u6740',
            '\u81ea\u6b8b'
        ]);

        const high = matchAny('severe-distress', [
            'hopeless',
            'worthless',
            'cannot go on',
            'panic attack',
            'breaking down',
            '\u7edd\u671b',
            '\u5d29\u6e83',
            '\u6491\u4e0d\u4f4f',
            '\u6d3b\u4e0d\u4e0b\u53bb'
        ]);

        const moderate = matchAny('stress-or-burnout', [
            'burned out',
            'burnt out',
            'exhausted',
            'overwhelmed',
            'anxious',
            'depressed',
            'insomnia',
            '\u592a\u7d2f',
            '\u7126\u8651',
            '\u6291\u90c1',
            '\u5931\u7720',
            '\u538b\u529b\u5927'
        ]);

        const sleep = matchAny('sleep-risk', [
            'cant sleep',
            "can't sleep",
            'no sleep',
            'stayed up',
            '\u7761\u4e0d\u7740',
            '\u71ac\u591c',
            '\u6ca1\u7761'
        ]);

        let riskLevel = 'low';
        if (crisis) riskLevel = 'crisis';
        else if (high) riskLevel = 'high';
        else if (moderate || sleep) riskLevel = 'moderate';

        return {
            riskLevel,
            signals,
            summary: signals.length > 0
                ? `\u68c0\u6d4b\u5230 ${signals.join(', ')} \u4fe1\u53f7\u3002`
                : '\u672a\u68c0\u6d4b\u5230\u660e\u663e\u5065\u5eb7\u98ce\u9669\u4fe1\u53f7\u3002'
        };
    }

    shouldRespondToAssessment(assessment, now) {
        if (assessment.riskLevel === 'low') {
            return this.data.settings.mentalHealth.respondToLowRisk;
        }
        if (assessment.riskLevel === 'crisis' || assessment.riskLevel === 'high') {
            return true;
        }
        return minutesBetween(
            this.data.lastReminders.mentalHealth,
            now
        ) >= this.data.settings.mentalHealth.cooldownMinutes;
    }

    buildMentalHealthResponse(assessment, source) {
        const sourceLabel = source === 'app-chat' ? '\u8fd9\u6bb5\u5bf9\u8bdd' : source;
        if (assessment.riskLevel === 'crisis') {
            return "Kal'tsit\uff1a\u8fd9\u4e0d\u662f\u666e\u901a\u75b2\u52b3\u3002\u4f60\u7684\u8868\u8ff0\u663e\u793a\u53ef\u80fd\u5b58\u5728\u7acb\u5373\u98ce\u9669\u3002\u8bf7\u9a6c\u4e0a\u8fdc\u79bb\u4efb\u4f55\u53ef\u80fd\u4f24\u5bb3\u81ea\u5df1\u7684\u7269\u54c1\uff0c\u8054\u7cfb\u5f53\u5730\u7d27\u6025\u670d\u52a1\uff0c\u5e76\u544a\u8bc9\u4e00\u4f4d\u53ef\u4fe1\u4efb\u7684\u4eba\u7559\u5728\u4f60\u8eab\u8fb9\u3002\u6211\u4f1a\u7ee7\u7eed\u5728\u8fd9\u91cc\uff0c\u4f46\u8fd9\u9700\u8981\u73b0\u5b9e\u4e2d\u7684\u4eba\u7acb\u523b\u4ecb\u5165\u3002";
        }
        if (assessment.riskLevel === 'high') {
            return `Kal'tsit\uff1a\u6211\u5728${sourceLabel}\u91cc\u6ce8\u610f\u5230\u4e25\u91cd\u538b\u529b\u4fe1\u53f7\u3002\u5148\u505c\u4e0b\u624b\u4e0a\u7684\u4e8b\uff0c\u559d\u6c34\uff0c\u5750\u5230\u5b89\u5168\u7684\u5730\u65b9\uff0c\u8054\u7cfb\u4e00\u4f4d\u4f60\u4fe1\u4efb\u7684\u4eba\u3002\u5982\u679c\u72b6\u6001\u6b63\u5728\u5347\u7ea7\uff0c\u4e0d\u8981\u72ec\u81ea\u5904\u7406\uff0c\u8bf7\u5bfb\u6c42\u4e13\u4e1a\u6216\u7d27\u6025\u652f\u6301\u3002`;
        }
        if (assessment.signals.includes('sleep-risk')) {
            return "Kal'tsit\uff1a\u4f60\u7684\u7761\u7720\u8d1f\u503a\u5df2\u7ecf\u5f00\u59cb\u5f71\u54cd\u72b6\u6001\u3002\u53ea\u5b8c\u6210\u6700\u5fc5\u8981\u7684\u4e8b\uff0c\u964d\u4f4e\u5149\u7ebf\u523a\u6fc0\uff0c\u51c6\u5907\u7761\u89c9\u3002\u5982\u679c\u4f60\u5ffd\u89c6\u8fd9\u70b9\uff0c\u6211\u4f1a\u518d\u6b21\u63d0\u9192\u3002";
        }
        return `Kal'tsit\uff1a\u6211\u5728${sourceLabel}\u91cc\u6ce8\u610f\u5230\u538b\u529b\u4fe1\u53f7\u3002\u77ed\u6682\u4f11\u606f\uff0c\u653e\u6162\u547c\u5438\uff0c\u559d\u6c34\uff0c\u4e0d\u8981\u8ba9\u8fd9\u79cd\u72b6\u6001\u53d8\u6210\u65b0\u7684\u57fa\u51c6\u7ebf\u3002`;
    }

    checkDueReminders(now = new Date()) {
        if (!this.data.settings.enabled) return [];

        const due = [];
        const settings = this.data.settings;

        if (settings.sleep.enabled && this.isSleepWindow(now)) {
            due.push(this.buildDueReminder('sleep', "Kal'tsit\uff1a\u5df2\u7ecf\u8fdb\u5165\u4f60\u8bbe\u5b9a\u7684\u7761\u7720\u65f6\u6bb5\u3002\u505c\u6b62\u5ef6\u957f\u4eca\u5929\uff0c\u4fdd\u5b58\u5de5\u4f5c\uff0c\u53bb\u7761\u89c9\u3002", settings.sleep.cooldownMinutes, now));
        }

        if (settings.hydration.enabled) {
            due.push(this.buildDueReminder('hydration', "Kal'tsit\uff1a\u996e\u6c34\u63d0\u9192\u3002\u73b0\u5728\u559d\u6c34\uff0c\u4e0d\u662f\u7b49\u4e0b\u4e00\u4ef6\u4e8b\u7ed3\u675f\u3002", settings.hydration.frequencyMinutes, now));
        }

        if (settings.movement.enabled) {
            due.push(this.buildDueReminder('movement', "Kal'tsit\uff1a\u4f60\u9759\u6b62\u592a\u4e45\u4e86\u3002\u7ad9\u8d77\u6765\uff0c\u6d3b\u52a8\u80a9\u90e8\uff0c\u8d70\u4e24\u5206\u949f\u3002", settings.movement.frequencyMinutes, now));
        }

        if (settings.dailyExercise.enabled && this.isDailyExerciseDue(now)) {
            due.push(this.buildDueReminder('dailyExercise', "Kal'tsit\uff1a\u4eca\u5929\u7684\u8fd0\u52a8\u8fd8\u6ca1\u6709\u5b8c\u6210\u3002\u77ed\u65f6\u6563\u6b65\u6216\u57fa\u7840\u62c9\u4f38\u5c31\u591f\uff1b\u4ec0\u4e48\u90fd\u4e0d\u505a\u4e0d\u884c\u3002", 24 * 60, now));
        }

        const activeDue = due.filter(Boolean);
        if (activeDue.length > 0) {
            this.saveData();
            for (const item of activeDue) {
                this.emitResponse(item);
            }
        }
        return activeDue;
    }

    buildDueReminder(type, message, cooldownMinutes, now) {
        if (minutesBetween(this.data.lastReminders[type], now) < cooldownMinutes) {
            return null;
        }
        this.data.lastReminders[type] = now.toISOString();
        const event = {
            id: crypto.randomUUID(),
            type,
            timestamp: now.toISOString(),
            message
        };
        this.data.events.push(event);
        this.data.events = this.data.events.slice(-200);
        return {
            type,
            severity: type === 'sleep' ? 'high' : 'normal',
            message,
            eventId: event.id
        };
    }

    isSleepWindow(date) {
        const hour = date.getHours();
        const { bedtimeHour, wakeHour } = this.data.settings.sleep;
        if (bedtimeHour > wakeHour) {
            return hour >= bedtimeHour || hour < wakeHour;
        }
        return hour >= bedtimeHour && hour < wakeHour;
    }

    isDailyExerciseDue(date) {
        const [hour, minute] = String(this.data.settings.dailyExercise.time || '18:30')
            .split(':')
            .map((part) => Number(part));
        if (date.getHours() < hour || (date.getHours() === hour && date.getMinutes() < minute)) {
            return false;
        }

        const last = this.data.lastReminders.dailyExercise;
        if (!last) return true;
        return new Date(last).toDateString() !== date.toDateString();
    }

    recordAction(actionType, now = new Date()) {
        const type = String(actionType || '').trim();
        if (!type) throw new Error('Action type is required.');

        if (type === 'drink-water') this.data.lastReminders.hydration = now.toISOString();
        if (type === 'move') this.data.lastReminders.movement = now.toISOString();
        if (type === 'exercise') this.data.lastReminders.dailyExercise = now.toISOString();
        if (type === 'sleep-dismissed') this.data.lastReminders.sleep = now.toISOString();

        const event = {
            id: crypto.randomUUID(),
            type: `action:${type}`,
            timestamp: now.toISOString()
        };
        this.data.events.push(event);
        this.data.events = this.data.events.slice(-200);
        this.saveData();
        return event;
    }

    emitImmediateSkillReminder(skillId, type, message, now, severity = null) {
        const event = {
            id: crypto.randomUUID(),
            type: `skill:${skillId}`,
            timestamp: now.toISOString(),
            message
        };
        this.data.events.push(event);
        this.data.events = this.data.events.slice(-200);
        if (this.data.lastReminders[type] !== undefined) {
            this.data.lastReminders[type] = now.toISOString();
        }
        this.saveData();
        const payload = {
            type,
            skillId,
            severity: severity || (type === 'sleep' ? 'high' : 'normal'),
            message,
            eventId: event.id
        };
        this.emitResponse(payload);
        return { success: true, ...payload };
    }

    buildSourceSummary() {
        return this.getSources()
            .map((source) => {
                const enabled = source.enabled ? '\u542f\u7528' : '\u505c\u7528';
                const imported = source.lastImportedAt || '\u5c1a\u672a\u5bfc\u5165';
                return `${source.type}: ${enabled}, ${source.status}, ${imported}`;
            })
            .join('\n');
    }

    emitResponse(payload) {
        this.onResponse({
            ...payload,
            agent: 'kaltsit',
            timestamp: new Date().toISOString()
        });
    }
}

module.exports = { KaltsitHealthAgent, SOURCE_TYPES };

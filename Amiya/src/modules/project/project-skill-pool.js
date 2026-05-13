/**
 * Project Skill Pool
 *
 * Maintains a reusable catalog of project-level skills and recommends a small
 * working stack from project type, lifecycle stage, progress and risk signals.
 */

const fs = require('fs');
const path = require('path');

const PROGRESS_BANDS = [
    { id: 'seed', min: 0, max: 15 },
    { id: 'build', min: 16, max: 60 },
    { id: 'stabilize', min: 61, max: 85 },
    { id: 'release', min: 86, max: 95 },
    { id: 'operate', min: 96, max: 100 }
];

const DEFAULT_SKILLS = [
    {
        id: 'project-intake',
        name: '\u9879\u76ee\u6444\u5165',
        category: 'analysis',
        description: '\u68b3\u7406\u9879\u76ee\u76ee\u6807\u3001\u7ea6\u675f\u3001\u73b0\u72b6\u548c\u4e0b\u4e00\u6b65\u9a8c\u6536\u6807\u51c6\u3002',
        projectTypes: ['any'],
        stages: ['discovery', 'setup', 'implementation', 'testing', 'release', 'maintenance', 'incident'],
        progressBands: ['seed', 'build'],
        triggers: ['unknown-scope', 'new-project', 'unclear-goal'],
        outputs: ['project-brief', 'acceptance-criteria']
    },
    {
        id: 'architecture-map',
        name: '\u67b6\u6784\u5730\u56fe',
        category: 'analysis',
        description: '\u8bc6\u522b\u5165\u53e3\u3001\u6a21\u5757\u8fb9\u754c\u3001\u6570\u636e\u6d41\u548c\u9ad8\u98ce\u9669\u8026\u5408\u70b9\u3002',
        projectTypes: ['any'],
        stages: ['discovery', 'setup', 'implementation', 'maintenance'],
        progressBands: ['seed', 'build', 'stabilize'],
        triggers: ['large-diff', 'unknown-architecture', 'cross-module-change'],
        outputs: ['module-map', 'data-flow', 'risk-list']
    },
    {
        id: 'dependency-map',
        name: '\u4f9d\u8d56\u5730\u56fe',
        category: 'analysis',
        description: '\u68c0\u67e5 package\u3001\u811a\u672c\u3001\u8fd0\u884c\u65f6\u4f9d\u8d56\u548c\u5b89\u5168\u5ba1\u8ba1\u8f93\u51fa\u3002',
        projectTypes: ['node-app', 'electron-desktop', 'frontend-app', 'tooling'],
        stages: ['setup', 'testing', 'release', 'maintenance', 'incident'],
        progressBands: ['seed', 'build', 'stabilize', 'release', 'operate'],
        triggers: ['dependency-change', 'audit-warning', 'install-failure'],
        outputs: ['dependency-summary', 'audit-notes']
    },
    {
        id: 'implementation-slice',
        name: '\u5b9e\u73b0\u5207\u7247',
        category: 'execution',
        description: '\u5c06\u9700\u6c42\u5206\u89e3\u6210\u53ef\u9a8c\u8bc1\u7684\u5c0f\u6b65\u4ee3\u7801\u6539\u52a8\u3002',
        projectTypes: ['any'],
        stages: ['implementation'],
        progressBands: ['build'],
        triggers: ['feature-request', 'missing-module', 'integration-needed'],
        outputs: ['implementation-plan', 'changed-files']
    },
    {
        id: 'test-strategy',
        name: '\u6d4b\u8bd5\u7b56\u7565',
        category: 'verification',
        description: '\u9009\u62e9\u5355\u6d4b\u3001\u5192\u70df\u3001\u8bed\u6cd5\u68c0\u67e5\u3001\u6253\u5305\u548c\u56de\u5f52\u6d4b\u8bd5\u7684\u6700\u5c0f\u7ec4\u5408\u3002',
        projectTypes: ['any'],
        stages: ['implementation', 'testing', 'release', 'maintenance'],
        progressBands: ['build', 'stabilize', 'release'],
        triggers: ['new-code', 'bug-fix', 'before-commit'],
        outputs: ['test-plan', 'verification-evidence']
    },
    {
        id: 'electron-runtime-smoke',
        name: 'Electron \u8fd0\u884c\u5192\u70df',
        category: 'verification',
        description: '\u542f\u52a8 Electron \u4e3b\u7a0b\u5e8f\uff0c\u6293\u53d6 stdout/stderr\uff0c\u9a8c\u8bc1\u7a97\u53e3\u8fdb\u7a0b\u80fd\u7a33\u5b9a\u5b58\u6d3b\u3002',
        projectTypes: ['electron-desktop'],
        stages: ['testing', 'release', 'incident'],
        progressBands: ['stabilize', 'release', 'operate'],
        triggers: ['electron', 'desktop-app', 'startup-risk'],
        outputs: ['startup-evidence', 'runtime-log']
    },
    {
        id: 'ui-interaction-review',
        name: 'UI \u4ea4\u4e92\u5ba1\u67e5',
        category: 'verification',
        description: '\u68c0\u67e5\u83dc\u5355\u3001\u89d2\u8272\u6c14\u6ce1\u3001\u900f\u660e\u7a97\u53e3\u548c\u7528\u6237\u53ef\u89c1\u72b6\u6001\u662f\u5426\u53ef\u8fbe\u3002',
        projectTypes: ['electron-desktop', 'frontend-app', 'game'],
        stages: ['implementation', 'testing', 'release'],
        progressBands: ['build', 'stabilize', 'release'],
        triggers: ['renderer-change', 'menu-change', 'visual-change'],
        outputs: ['interaction-checklist', 'ui-risk-list']
    },
    {
        id: 'local-data-governance',
        name: '\u672c\u5730\u6570\u636e\u6cbb\u7406',
        category: 'safety',
        description: '\u68c0\u67e5\u672c\u5730\u5b58\u50a8\u3001\u9690\u79c1\u9ed8\u8ba4\u503c\u3001\u5220\u6539\u64cd\u4f5c\u548c\u7528\u6237\u660e\u793a\u6388\u6743\u8fb9\u754c\u3002',
        projectTypes: ['electron-desktop', 'node-app', 'frontend-app'],
        stages: ['implementation', 'testing', 'release', 'maintenance'],
        progressBands: ['build', 'stabilize', 'release', 'operate'],
        triggers: ['local-storage', 'privacy', 'health-data', 'destructive-action'],
        outputs: ['privacy-notes', 'storage-policy']
    },
    {
        id: 'agent-skill-routing',
        name: '\u667a\u80fd\u4f53\u6280\u80fd\u8def\u7531',
        category: 'orchestration',
        description: '\u6839\u636e\u9879\u76ee\u7c7b\u578b\u3001\u9636\u6bb5\u3001\u8fdb\u5ea6\u548c\u98ce\u9669\u9009\u62e9\u5c11\u91cf\u9ad8\u4fe1\u53f7 skills\u3002',
        projectTypes: ['any'],
        stages: ['discovery', 'setup', 'implementation', 'testing', 'release', 'maintenance', 'incident'],
        progressBands: ['seed', 'build', 'stabilize', 'release', 'operate'],
        triggers: ['skill-request', 'route-skills', 'multi-agent'],
        outputs: ['recommended-skills', 'rejected-skills']
    },
    {
        id: 'release-packaging',
        name: '\u53d1\u7248\u6253\u5305',
        category: 'release',
        description: '\u6267\u884c\u6253\u5305\u3001\u4ea7\u7269\u68c0\u67e5\u3001\u7248\u672c\u53f7\u548c\u53d1\u5e03\u524d\u98ce\u9669\u6838\u5bf9\u3002',
        projectTypes: ['electron-desktop', 'frontend-app', 'node-app'],
        stages: ['release'],
        progressBands: ['release'],
        triggers: ['dist', 'build-artifact', 'release-candidate'],
        outputs: ['artifact-list', 'release-risk']
    },
    {
        id: 'git-pr-readiness',
        name: 'Git/PR \u51c6\u5907',
        category: 'release',
        description: '\u68c0\u67e5\u5206\u652f\u3001diff\u8303\u56f4\u3001\u672a\u8ddf\u8e2a\u6587\u4ef6\u3001\u63d0\u4ea4\u4fe1\u606f\u548c PR \u8bf4\u660e\u3002',
        projectTypes: ['any'],
        stages: ['testing', 'release', 'maintenance'],
        progressBands: ['stabilize', 'release', 'operate'],
        triggers: ['commit', 'push', 'pull-request', 'dirty-worktree'],
        outputs: ['commit-scope', 'pr-summary']
    },
    {
        id: 'incident-debugging',
        name: '\u6545\u969c\u8bca\u65ad',
        category: 'debugging',
        description: '\u4ece\u590d\u73b0\u8def\u5f84\u3001\u65e5\u5fd7\u3001\u6700\u8fd1\u53d8\u66f4\u548c\u53ef\u56de\u6eda\u8fb9\u754c\u5b9a\u4f4d\u6545\u969c\u3002',
        projectTypes: ['any'],
        stages: ['incident'],
        progressBands: ['build', 'stabilize', 'release', 'operate'],
        triggers: ['crash', 'test-failure', 'startup-failure', 'regression'],
        outputs: ['root-cause', 'fix-plan']
    }
];

function clampProgress(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return Math.max(0, Math.min(100, Math.round(numeric)));
}

function normalizeList(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(String).map((item) => item.toLowerCase());
    return String(value).split(/[,\s]+/).map((item) => item.toLowerCase()).filter(Boolean);
}

function includesAny(values, candidates) {
    return candidates.some((candidate) => values.includes(candidate));
}

class ProjectSkillPool {
    constructor(options = {}) {
        this.projectRoot = options.projectRoot || process.cwd();
        this.skills = (options.skills || DEFAULT_SKILLS).map((skill) => ({ ...skill }));
    }

    listSkills(filter = {}) {
        const type = String(filter.projectType || '').toLowerCase();
        const stage = String(filter.stage || '').toLowerCase();
        const category = String(filter.category || '').toLowerCase();

        return this.skills.filter((skill) => {
            if (category && skill.category !== category) return false;
            if (type && !this.matchesType(skill, type)) return false;
            if (stage && !skill.stages.includes(stage)) return false;
            return true;
        }).map((skill) => ({ ...skill }));
    }

    analyzeProject(input = {}) {
        const context = this.buildContext(input);
        const projectType = this.inferProjectType(context);
        const progress = this.inferProgress(context);
        const stage = this.inferStage(context, progress);
        const progressBand = this.getProgressBand(progress);
        const signals = this.collectSignals(context, projectType, stage);
        const risks = this.collectRisks(context, signals);

        return {
            name: context.name,
            projectType,
            stage,
            progress,
            progressBand,
            signals,
            risks,
            summary: this.buildSummary(context.name, projectType, stage, progressBand)
        };
    }

    recommendSkills(input = {}, options = {}) {
        const analysis = input.analysis || this.analyzeProject(input);
        const limit = Math.max(1, Number(options.limit || input.limit || 6));
        const requestedSignals = normalizeList(input.signals || []);
        const signals = [...new Set([...normalizeList(analysis.signals), ...requestedSignals])];

        const ranked = this.skills.map((skill) => {
            const score = this.scoreSkill(skill, analysis, signals);
            return {
                ...skill,
                score,
                reason: this.buildReason(skill, analysis, signals)
            };
        }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

        const selected = ranked.filter((skill) => skill.score > 0).slice(0, limit);
        const rejected = ranked
            .filter((skill) => !selected.some((item) => item.id === skill.id))
            .slice(0, Math.max(3, Math.min(8, ranked.length - selected.length)))
            .map((skill) => ({
                id: skill.id,
                name: skill.name,
                reason: skill.score > 0
                    ? '\u4f18\u5148\u7ea7\u4f4e\u4e8e\u5f53\u524d\u9009\u4e2d\u6280\u80fd\u3002'
                    : '\u5f53\u524d\u9879\u76ee\u7c7b\u578b\u3001\u9636\u6bb5\u6216\u8fdb\u5ea6\u4e0d\u5339\u914d\u3002'
            }));

        return {
            analysis,
            selected,
            rejected
        };
    }

    buildContext(input) {
        const packageJson = input.packageJson || this.readPackageJson();
        const files = input.files || this.readProjectFileHints();
        return {
            name: input.name || packageJson.name || path.basename(this.projectRoot),
            explicitType: input.projectType,
            explicitStage: input.stage,
            explicitProgress: input.progress ?? input.progressPercent,
            packageJson,
            files,
            goals: normalizeList(input.goals || input.goal),
            blockers: normalizeList(input.blockers || input.blocker),
            signals: normalizeList(input.signals)
        };
    }

    readPackageJson() {
        try {
            const packagePath = path.join(this.projectRoot, 'package.json');
            if (fs.existsSync(packagePath)) {
                return JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            }
        } catch {
            return {};
        }
        return {};
    }

    readProjectFileHints() {
        const names = ['package.json', 'scripts', 'Amiya', 'Kaltsit', 'Texas', 'models', 'dist'];
        return names.filter((name) => fs.existsSync(path.join(this.projectRoot, name)));
    }

    inferProjectType(context) {
        const explicit = String(context.explicitType || '').toLowerCase();
        if (explicit) return explicit;

        const deps = {
            ...context.packageJson.dependencies,
            ...context.packageJson.devDependencies
        };
        const depNames = Object.keys(deps).map((name) => name.toLowerCase());
        const files = normalizeList(context.files);

        if (depNames.includes('electron') || context.packageJson.main || files.includes('scripts')) {
            return 'electron-desktop';
        }
        if (depNames.some((name) => ['react', 'vue', 'next', 'vite'].includes(name))) {
            return 'frontend-app';
        }
        if (depNames.some((name) => ['pixi.js', 'phaser', 'three'].includes(name))) {
            return 'game';
        }
        if (context.packageJson.name) return 'node-app';
        return 'unknown';
    }

    inferProgress(context) {
        const explicit = clampProgress(context.explicitProgress);
        if (explicit !== null) return explicit;

        const scripts = context.packageJson.scripts || {};
        let progress = 20;
        if (scripts.test) progress += 25;
        if (scripts.start || scripts.dev) progress += 15;
        if (scripts.build || scripts.dist) progress += 20;
        if (normalizeList(context.files).includes('dist')) progress += 10;
        if (context.blockers.length > 0) progress -= 20;
        return Math.max(0, Math.min(95, progress));
    }

    inferStage(context, progress) {
        const explicit = String(context.explicitStage || '').toLowerCase();
        if (explicit) return explicit;
        if (includesAny(context.blockers, ['crash', 'failure', 'bug', 'regression'])) return 'incident';
        if (progress <= 15) return 'discovery';
        if (progress <= 35) return 'setup';
        if (progress <= 60) return 'implementation';
        if (progress <= 85) return 'testing';
        if (progress <= 95) return 'release';
        return 'maintenance';
    }

    getProgressBand(progress) {
        const band = PROGRESS_BANDS.find((item) => progress >= item.min && progress <= item.max);
        return band ? band.id : 'seed';
    }

    collectSignals(context, projectType, stage) {
        const signals = new Set(context.signals);
        signals.add(projectType);
        signals.add(stage);

        const scripts = context.packageJson.scripts || {};
        if (scripts.test) signals.add('test-script');
        if (scripts.dist || scripts.build) signals.add('dist');
        if (projectType === 'electron-desktop') signals.add('electron');
        if (context.packageJson.dependencies || context.packageJson.devDependencies) signals.add('dependency-change');
        if (normalizeList(context.files).includes('dist')) signals.add('build-artifact');
        for (const blocker of context.blockers) signals.add(blocker);
        return [...signals];
    }

    collectRisks(context, signals) {
        const risks = [];
        if (signals.includes('electron')) risks.push('\u9700\u8981 Electron \u542f\u52a8\u5192\u70df\u8bc1\u660e\u4e3b\u8fdb\u7a0b\u548c\u6e32\u67d3\u8fdb\u7a0b\u53ef\u7528\u3002');
        if (signals.includes('dependency-change')) risks.push('\u4f9d\u8d56\u53d8\u52a8\u9700\u8981\u914d\u5408\u5ba1\u8ba1\u548c lockfile \u68c0\u67e5\u3002');
        if (context.blockers.length > 0) risks.push('\u5b58\u5728\u963b\u585e\u4fe1\u53f7\uff0c\u4f18\u5148\u505a\u590d\u73b0\u548c\u6839\u56e0\u5b9a\u4f4d\u3002');
        return risks;
    }

    scoreSkill(skill, analysis, signals) {
        let score = 0;
        if (this.matchesType(skill, analysis.projectType)) score += 3;
        if (skill.stages.includes(analysis.stage)) score += 3;
        if (skill.progressBands.includes(analysis.progressBand)) score += 2;
        score += skill.triggers.filter((trigger) => signals.includes(trigger)).length * 2;
        if (skill.id === 'agent-skill-routing') score += 1;
        return score;
    }

    matchesType(skill, projectType) {
        return skill.projectTypes.includes('any') || skill.projectTypes.includes(projectType);
    }

    buildReason(skill, analysis, signals) {
        const hits = [];
        if (this.matchesType(skill, analysis.projectType)) hits.push(`\u5339\u914d\u7c7b\u578b ${analysis.projectType}`);
        if (skill.stages.includes(analysis.stage)) hits.push(`\u5339\u914d\u9636\u6bb5 ${analysis.stage}`);
        if (skill.progressBands.includes(analysis.progressBand)) hits.push(`\u5339\u914d\u8fdb\u5ea6 ${analysis.progressBand}`);
        const triggerHits = skill.triggers.filter((trigger) => signals.includes(trigger));
        if (triggerHits.length > 0) hits.push(`\u547d\u4e2d\u4fe1\u53f7 ${triggerHits.join(', ')}`);
        return hits.join('\uff1b') || '\u4f5c\u4e3a\u901a\u7528\u540e\u5907\u80fd\u529b\u4fdd\u7559\u3002';
    }

    buildSummary(name, projectType, stage, progressBand) {
        return `${name}: ${projectType} / ${stage} / ${progressBand}`;
    }
}

module.exports = {
    ProjectSkillPool,
    DEFAULT_SKILLS,
    PROGRESS_BANDS
};

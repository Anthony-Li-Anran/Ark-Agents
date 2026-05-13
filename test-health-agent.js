/**
 * Kaltsit Health Agent Test
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { KaltsitHealthAgent, SOURCE_TYPES } = require('./Kaltsit/src/modules/health/health-agent');

function makeTempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'ark-health-agent-'));
}

function makeAgent(options = {}) {
    const responses = [];
    const agent = new KaltsitHealthAgent(makeTempDir(), {
        onResponse: (payload) => responses.push(payload),
        ...options
    });
    return { agent, responses };
}

function testSources() {
    const { agent } = makeAgent();
    const sources = agent.getSources().map((source) => source.type);
    for (const type of SOURCE_TYPES) {
        assert.ok(sources.includes(type), `Missing source: ${type}`);
    }

    const connected = agent.connectSource('gmail');
    assert.strictEqual(connected.type, 'gmail');
    assert.strictEqual(connected.status, 'manual-import');
}

function testSkills() {
    const { agent, responses } = makeAgent();
    const skills = agent.getSkills();
    const skillIds = skills.map((skill) => skill.id);

    assert.ok(skillIds.includes('sleep-supervision'));
    assert.ok(skillIds.includes('hydration-reminder'));
    assert.ok(skillIds.includes('mental-health-check'));
    assert.ok(skillIds.includes('privacy-guard'));
    assert.ok(skills.every((skill) => skill.name && skill.description));

    const reminder = agent.runSkill('hydration-reminder', {
        timestamp: '2026-05-13T10:00:00'
    });
    assert.strictEqual(reminder.success, true);
    assert.strictEqual(reminder.skillId, 'hydration-reminder');
    assert.ok(reminder.message.includes('\u996e\u6c34'));
    assert.ok(responses.some((payload) => payload.skillId === 'hydration-reminder'));

    const privacy = agent.runSkill('privacy-guard');
    assert.strictEqual(privacy.storeRawText, false);
    assert.ok(privacy.message.includes('\u9690\u79c1'));
}

function testMentalHealthAnalysis() {
    const { agent, responses } = makeAgent();

    const moderate = agent.analyzeMessage({
        source: 'telegram',
        text: 'I am exhausted and anxious after work.'
    });
    assert.strictEqual(moderate.assessment.riskLevel, 'moderate');
    assert.ok(moderate.response.includes("Kal'tsit"));

    const crisis = agent.analyzeMessage({
        source: 'app-chat',
        text: 'I want to kill myself.'
    });
    assert.strictEqual(crisis.assessment.riskLevel, 'crisis');
    assert.ok(crisis.response.includes('\u7d27\u6025\u670d\u52a1'));
    assert.ok(responses.some((payload) => payload.severity === 'crisis'));
}

function testBatchAndPrivacy() {
    const { agent } = makeAgent();
    const results = agent.analyzeBatch([
        { source: 'gmail', subject: 'Work', text: 'I feel overwhelmed.' },
        { source: 'outlook', subject: 'Routine', text: 'Lunch at noon.' }
    ]);

    assert.strictEqual(results.length, 2);
    assert.strictEqual(agent.getStatus().counters.analyzedMessages, 2);
    assert.strictEqual(agent.getStatus().recentObservations[0].text, undefined);
}

function testDueReminders() {
    const { agent, responses } = makeAgent();
    agent.updateSettings({
        hydration: { frequencyMinutes: 1 },
        movement: { frequencyMinutes: 1 },
        sleep: { bedtimeHour: 23, wakeHour: 7, cooldownMinutes: 1 },
        dailyExercise: { time: '00:00' }
    });

    const due = agent.checkDueReminders(new Date('2026-05-13T23:30:00'));
    const types = due.map((item) => item.type);
    assert.ok(types.includes('sleep'));
    assert.ok(types.includes('hydration'));
    assert.ok(types.includes('movement'));
    assert.ok(types.includes('dailyExercise'));
    assert.ok(responses.length >= 4);
}

function main() {
    testSources();
    testSkills();
    testMentalHealthAnalysis();
    testBatchAndPrivacy();
    testDueReminders();
    console.log('Kaltsit health agent test passed.');
}

main();

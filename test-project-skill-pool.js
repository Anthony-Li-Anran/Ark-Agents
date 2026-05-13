/**
 * Project Skill Pool Test
 */

const assert = require('assert');
const path = require('path');

const { AIToolRegistry } = require('./Amiya/src/modules/ai/ai-tools');
const { ProjectSkillPool } = require('./Amiya/src/modules/project/project-skill-pool');

function makePool() {
    return new ProjectSkillPool({
        projectRoot: __dirname
    });
}

function testAnalyzeCurrentProject() {
    const pool = makePool();
    const analysis = pool.analyzeProject();

    assert.strictEqual(analysis.name, 'ark-agents');
    assert.strictEqual(analysis.projectType, 'electron-desktop');
    assert.ok(['testing', 'release'].includes(analysis.stage), `Unexpected stage: ${analysis.stage}`);
    assert.ok(analysis.progress >= 60, 'Current project should be beyond setup.');
    assert.ok(analysis.signals.includes('electron'));
}

function testRecommendByStage() {
    const pool = makePool();
    const recommendation = pool.recommendSkills({
        projectType: 'electron-desktop',
        stage: 'release',
        progress: 90,
        signals: ['dist', 'electron', 'pull-request'],
        limit: 5
    });

    const selectedIds = recommendation.selected.map((skill) => skill.id);
    assert.ok(selectedIds.includes('release-packaging'));
    assert.ok(selectedIds.includes('electron-runtime-smoke'));
    assert.ok(selectedIds.includes('git-pr-readiness'));
    assert.ok(recommendation.rejected.length > 0);
}

function testRecommendIncident() {
    const pool = makePool();
    const recommendation = pool.recommendSkills({
        projectType: 'electron-desktop',
        stage: 'incident',
        progress: 70,
        blockers: ['crash'],
        signals: ['startup-failure'],
        limit: 4
    });

    const selectedIds = recommendation.selected.map((skill) => skill.id);
    assert.ok(selectedIds.includes('incident-debugging'));
    assert.ok(selectedIds.includes('electron-runtime-smoke'));
}

function testAIToolRegistryProjectTools() {
    const pool = makePool();
    const registry = new AIToolRegistry({
        scheduleManager: {},
        memoManager: {},
        reminderManager: {},
        projectSkillPool: pool
    });

    const prompt = registry.getToolPrompt();
    assert.ok(prompt.includes('project.skills.recommend'));

    const parsed = registry.parseToolCall('{"tool":"project.skills.recommend","args":{"projectType":"electron-desktop","stage":"testing","progress":80}}');
    const result = registry.execute(parsed);

    assert.strictEqual(result.analysis.projectType, 'electron-desktop');
    assert.ok(result.selected.length > 0);
    assert.ok(result.selected.some((skill) => skill.id === 'test-strategy'));
}

function testSkillFiltering() {
    const pool = makePool();
    const verificationSkills = pool.listSkills({
        projectType: 'electron-desktop',
        category: 'verification'
    });

    const ids = verificationSkills.map((skill) => skill.id);
    assert.ok(ids.includes('test-strategy'));
    assert.ok(ids.includes('electron-runtime-smoke'));
}

function main() {
    testAnalyzeCurrentProject();
    testRecommendByStage();
    testRecommendIncident();
    testAIToolRegistryProjectTools();
    testSkillFiltering();
    console.log('Project skill pool test passed.');
}

main();

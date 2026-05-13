/**
 * Kaltsit Agent Smoke Test
 *
 * Verifies the Kaltsit agent contract without requiring Electron/Pixi runtime
 * dependencies to be installed.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = __dirname;

function readText(relativePath) {
    return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assertExists(relativePath) {
    const fullPath = path.join(root, relativePath);
    assert.ok(fs.existsSync(fullPath), `Expected file to exist: ${relativePath}`);
    return fullPath;
}

function parseConstants() {
    const constantsText = readText('scripts/shared/constants.js');
    assert.match(constantsText, /kalts:\s*'build_char_003_kalts'/, 'Kaltsit model name must be registered.');
    assert.match(constantsText, /id:\s*'kalts'/, 'Kaltsit character id must be registered.');
    assert.match(constantsText, /name:\s*"Kal'tsit"/, 'Kaltsit display name must be registered.');
    assert.match(constantsText, /modelFolder:\s*'003_kalts'/, 'Kaltsit model folder must be registered.');
}

function verifyModelAssets() {
    const modelBase = 'models/003_kalts';
    assertExists(`${modelBase}/build_char_003_kalts.skel`);
    assertExists(`${modelBase}/build_char_003_kalts.atlas`);
    assertExists(`${modelBase}/build_char_003_kalts.png`);
    assertExists(`${modelBase}/ANIMATIONS.md`);
}

function verifyCharacterWiring() {
    const kaltsitModule = readText('scripts/characters/kaltsit.js');
    assert.match(kaltsitModule, /class KaltsitCharacter extends CharacterBase/, 'Kaltsit must extend CharacterBase.');
    assert.match(kaltsitModule, /CHARACTER_CONFIGS\.kalts/, 'Kaltsit must use the shared kalts config.');

    const characterIndex = readText('scripts/characters/index.js');
    assert.match(characterIndex, /KaltsitCharacter/, 'Kaltsit must be exported from scripts/characters.');

    const renderer = readText('scripts/renderer/index.js');
    assert.match(renderer, /case 'kalts':\s*[\s\S]*?CharacterClass = KaltsitCharacter;/, 'Renderer must instantiate Kaltsit.');
    assert.match(renderer, /\{ id: 'kalts', name: "Kal'tsit"/, 'Operator panel must expose Kaltsit.');
}

function verifyDialogResources() {
    const talkPath = assertExists('Kaltsit/talk/Kaltsit_say.json');
    const talk = JSON.parse(fs.readFileSync(talkPath, 'utf8'));
    assert.strictEqual(talk.character, 'Kaltsit');
    assert.ok(talk.dialogues.amiya, 'Kaltsit must have Amiya dialogues.');
    assert.ok(talk.dialogues.texas, 'Kaltsit must have Texas dialogues.');
    assert.ok(Object.keys(talk.dialogues.amiya).length >= 3, 'Kaltsit/Amiya dialog set is too small.');
    assert.ok(Object.keys(talk.dialogues.texas).length >= 3, 'Kaltsit/Texas dialog set is too small.');
}

function verifyHealthAgentWiring() {
    assertExists('Kaltsit/src/modules/health/health-agent.js');

    const main = readText('scripts/main.js');
    assert.match(main, /KaltsitHealthAgent/, 'Main process must initialize Kaltsit health agent.');
    assert.match(main, /health-analyze-message/, 'Main process must expose health analysis IPC.');
    assert.match(main, /health-get-skills/, 'Main process must expose health skill listing IPC.');
    assert.match(main, /health-run-skill/, 'Main process must expose health skill execution IPC.');
    assert.match(main, /kaltsit-health-response/, 'Main process must emit health responses to renderer.');

    const renderer = readText('scripts/renderer/index.js');
    assert.match(renderer, /health-check/, 'Renderer must expose Kaltsit health check action.');
    assert.match(renderer, /health-sources/, 'Renderer must expose Kaltsit health sources action.');
    assert.match(renderer, /health-skills/, 'Renderer must expose Kaltsit health skills action.');
    assert.match(renderer, /kaltsit-health-response/, 'Renderer must listen for Kaltsit health responses.');
    assert.match(renderer, /let aiBubbles = new Map\(\)/, 'Renderer must maintain one AI bubble per agent.');
    assert.match(renderer, /interruptAgentDialogForUser/, 'Renderer must interrupt agent dialogs during user interaction.');
    assert.match(renderer, /dialogIntegration\.interruptForUserInteraction/, 'Renderer must route user interruption into dialog integration.');

    const healthSkills = readText('Kaltsit/src/modules/health/health-skills.js');
    assert.match(healthSkills, /sleep-supervision/, 'Health skills must include sleep supervision.');
    assert.match(healthSkills, /hydration-reminder/, 'Health skills must include hydration reminders.');
    assert.match(healthSkills, /mental-health-check/, 'Health skills must include mental health checks.');
    assert.match(healthSkills, /privacy-guard/, 'Health skills must include privacy guard.');
    assert.match(healthSkills, /medical-web-search/, 'Health skills must include web search assistance.');
    assert.match(healthSkills, /nearby-hospital-search/, 'Health skills must include nearby hospital search.');
    assert.match(healthSkills, /medicine-prep-assist/, 'Health skills must include safe medicine preparation.');
}

async function verifyDialogSystem() {
    const { DialogSystem } = require('./scripts/dialog');
    const dialogSystem = new DialogSystem({
        basePath: root,
        checkInterval: 3000,
        baseTriggerProbability: 0.2,
        bubbleOptions: { typingSpeed: 1 }
    });

    await dialogSystem.initialize();
    dialogSystem.registerOperator('amiya', { x: 500, y: 800 });
    dialogSystem.registerOperator('kaltsit', { x: 800, y: 800 });
    dialogSystem.registerOperator('texas', { x: 1100, y: 800 });

    assert.ok(dialogSystem.contentManager.hasDialogs('kaltsit'), 'Dialog system must load Kaltsit dialogs.');
    assert.ok(dialogSystem.contentManager.hasDialogs('kalts'), 'Dialog system must normalize kalts to kaltsit.');
    assert.ok(dialogSystem.contentManager.getDialogCount('kaltsit', 'amiya') >= 3, 'Kaltsit/Amiya dialog pairs missing.');
    assert.ok(dialogSystem.contentManager.getDialogCount('kaltsit', 'texas') >= 3, 'Kaltsit/Texas dialog pairs missing.');
    assert.ok(dialogSystem.relationConfig.getRelation('amiya', 'kaltsit'), 'Amiya/Kaltsit relation missing.');
    assert.ok(dialogSystem.relationConfig.getRelation('kaltsit', 'texas'), 'Kaltsit/Texas relation missing.');

    const stats = dialogSystem.getStats();
    assert.ok(stats.operators.includes('kaltsit'), 'Kaltsit must be registered in dialog stats.');

    dialogSystem.destroy();
}

async function main() {
    parseConstants();
    verifyModelAssets();
    verifyCharacterWiring();
    verifyDialogResources();
    verifyHealthAgentWiring();
    await verifyDialogSystem();
    console.log('Kaltsit agent smoke test passed.');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

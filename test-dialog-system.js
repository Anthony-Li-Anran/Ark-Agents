/**
 * Dialog System Test
 * Simple test to verify the dialog system works correctly
 */

const path = require('path');
const assert = require('assert');
const { DialogSystem } = require('./scripts/dialog');

async function testDialogSystem() {
    console.log('=== Dialog System Test ===\n');

    try {
        const dialogSystem = new DialogSystem({
            basePath: path.join(__dirname),
            checkInterval: 3000,
            baseTriggerProbability: 0.2,
            bubbleOptions: {
                typingSpeed: 50
            }
        });

        console.log('1. Initializing dialog system...');
        await dialogSystem.initialize();
        console.log('   ✓ Initialized successfully\n');

        console.log('2. Registering operators...');
        dialogSystem.registerOperator('amiya', { x: 500, y: 800 });
        dialogSystem.registerOperator('kaltsit', { x: 800, y: 800 });
        dialogSystem.registerOperator('texas', { x: 1100, y: 800 });
        console.log('   ✓ Operators registered\n');

        console.log('3. Checking dialog content...');
        const stats = dialogSystem.getStats();
        console.log('   System stats:', JSON.stringify(stats, null, 2));
        console.log('   ✓ Stats retrieved\n');

        console.log('4. Testing dialog relations...');
        const relations = dialogSystem.relationConfig.getAvailableRelations();
        console.log(`   Found ${relations.length} relations:`);
        relations.forEach(rel => {
            console.log(`   - ${rel.operators[0]} <-> ${rel.operators[1]} (probability: ${rel.probability}, cooldown: ${rel.cooldown}ms)`);
        });
        console.log('   ✓ Relations checked\n');

        console.log('5. Testing dialog content manager...');
        const operators = dialogSystem.contentManager.getAvailableOperators();
        console.log(`   Available operators: ${operators.join(', ')}`);
        
        operators.forEach(op => {
            const dialogCount = dialogSystem.contentManager.getDialogCount(op, 'amiya');
            console.log(`   - ${op} has ${dialogCount} dialogs with amiya`);
        });
        console.log('   ✓ Content manager tested\n');

        console.log('6. Testing single bubble per operator...');
        const bubble1 = dialogSystem.bubbleManager.createBubble('amiya', 'first', { x: 100, y: 100 });
        const bubble2 = dialogSystem.bubbleManager.createBubble('amiya', 'second', { x: 200, y: 200 });
        assert.strictEqual(bubble1.id, bubble2.id, 'A single operator must reuse one dialog bubble.');
        assert.strictEqual(dialogSystem.bubbleManager.bubbles.size, 1, 'Only one bubble should exist for Amiya.');
        dialogSystem.bubbleManager.hideAllBubbles(true);
        console.log('   Single-bubble rule verified\n');

        console.log('7. Testing dialog interruption...');
        const dialogPair = dialogSystem.contentManager.getRandomDialogPair('amiya', 'kaltsit');
        assert.ok(dialogPair, 'Expected Amiya/Kaltsit dialog pair.');
        dialogSystem.stateManager.startDialog({
            operator1: 'amiya',
            operator2: 'kaltsit',
            dialogPair
        });
        dialogSystem.handleDialogTriggered({
            operator1: 'amiya',
            operator2: 'kaltsit',
            dialogPair
        });
        assert.strictEqual(dialogSystem.stateManager.isActive(), true, 'Dialog should be active before interruption.');
        dialogSystem.interruptCurrentDialog('test-user-interaction');
        assert.strictEqual(dialogSystem.stateManager.isActive(), false, 'Dialog should stop after user interruption.');
        assert.strictEqual(dialogSystem.bubbleManager.getActiveBubbles().length, 0, 'Dialog bubbles should hide after interruption.');
        console.log('   Dialog interruption verified\n');

        console.log('8. Cleaning up...');
        dialogSystem.destroy();
        console.log('   ✓ System destroyed\n');

        console.log('=== All Tests Passed ===\n');
    } catch (error) {
        console.error('Test failed:', error);
        console.error(error.stack);
    }
}

testDialogSystem();

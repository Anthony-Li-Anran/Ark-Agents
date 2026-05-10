/**
 * Dialog System Test
 * Simple test to verify the dialog system works correctly
 */

const path = require('path');
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

        console.log('6. Cleaning up...');
        dialogSystem.destroy();
        console.log('   ✓ System destroyed\n');

        console.log('=== All Tests Passed ===\n');
    } catch (error) {
        console.error('Test failed:', error);
        console.error(error.stack);
    }
}

testDialogSystem();

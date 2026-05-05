/**
 * Animation Test Script
 * Tests Spine model animations and outputs available animations
 * Usage: node animation_test.js <model_path>
 */

const path = require('path');
const fs = require('fs');

// Check if model path is provided
const modelPathArg = process.argv[2];
if (!modelPathArg) {
    console.log('Usage: node animation_test.js <model_path>');
    console.log('Example: node animation_test.js ../Models/003_kalts');
    process.exit(1);
}

// Resolve model path
const modelPath = path.resolve(__dirname, modelPathArg);
console.log(`\n=== Testing Model: ${modelPath} ===\n`);

// Find model files
const files = fs.readdirSync(modelPath);
const skelFile = files.find(f => f.endsWith('.skel'));
const atlasFile = files.find(f => f.endsWith('.atlas'));
const pngFile = files.find(f => f.endsWith('.png'));

if (!skelFile || !atlasFile || !pngFile) {
    console.error('Error: Missing model files!');
    console.error(`  skel: ${skelFile || 'NOT FOUND'}`);
    console.error(`  atlas: ${atlasFile || 'NOT FOUND'}`);
    console.error(`  png: ${pngFile || 'NOT FOUND'}`);
    process.exit(1);
}

console.log('Model files found:');
console.log(`  skel: ${skelFile}`);
console.log(`  atlas: ${atlasFile}`);
console.log(`  png: ${pngFile}`);

const modelName = skelFile.replace('.skel', '');
console.log(`\nModel name: ${modelName}`);

// Read skeleton data
const skelPath = path.join(modelPath, skelFile);
const atlasPath = path.join(modelPath, atlasFile);

try {
    const skeletonData = fs.readFileSync(skelPath);
    const atlasData = fs.readFileSync(atlasPath, 'utf-8');
    
    // Parse skeleton binary to find animations
    // The skeleton binary format contains animation names
    // We'll use a simple approach to extract strings that look like animation names
    
    const data = new Uint8Array(skeletonData);
    const decoder = new TextDecoder('utf-8');
    
    // Find all readable strings in the binary
    const strings = [];
    let currentString = '';
    
    for (let i = 0; i < data.length; i++) {
        const char = data[i];
        // Printable ASCII range (32-126)
        if (char >= 32 && char <= 126) {
            currentString += String.fromCharCode(char);
        } else {
            if (currentString.length >= 3) {
                strings.push(currentString);
            }
            currentString = '';
        }
    }
    
    // Filter strings that look like animation names
    const animationKeywords = ['Relax', 'Move', 'Sit', 'Sleep', 'Interact', 'Idle', 'Default', 'Walk', 'Run', 'Stand', 'Attack', 'Die', 'Skill'];
    const possibleAnimations = new Set();
    
    for (const str of strings) {
        // Check if string matches animation naming pattern
        if (/^[A-Z][a-zA-Z0-9_]*$/.test(str) && str.length >= 3 && str.length <= 30) {
            // Check if it contains known animation keywords or follows naming pattern
            const hasKeyword = animationKeywords.some(kw => 
                str.toLowerCase().includes(kw.toLowerCase())
            );
            const looksLikeAnimation = /^[A-Z][a-z]+([A-Z][a-z]+)*$/.test(str) || // PascalCase
                                        /^[A-Z][a-z]+_[A-Z][a-z]+$/.test(str) ||   // Pascal_Case
                                        /^[A-Z][a-z]+\d*$/.test(str);              // Pascal with optional number
            
            if (hasKeyword || looksLikeAnimation) {
                possibleAnimations.add(str);
            }
        }
    }
    
    console.log('\n=== Possible Animations Found ===\n');
    
    if (possibleAnimations.size > 0) {
        const sortedAnimations = Array.from(possibleAnimations).sort();
        sortedAnimations.forEach(anim => console.log(`  - ${anim}`));
        
        console.log(`\nTotal: ${sortedAnimations.length} possible animations`);
        
        // Generate ANIMATIONS.md content
        console.log('\n=== ANIMATIONS.md Content ===\n');
        console.log(`# ${modelName.split('_').pop().charAt(0).toUpperCase() + modelName.split('_').pop().slice(1)} Animation Table`);
        console.log('');
        console.log('| Animation | Description |');
        console.log('|-----------|-------------|');
        sortedAnimations.forEach(anim => {
            console.log(`| ${anim} | ${anim} animation |`);
        });
    } else {
        console.log('No animations found. The model might use different naming conventions.');
        console.log('\nAll readable strings found:');
        strings.slice(0, 50).forEach(s => console.log(`  - ${s}`));
        if (strings.length > 50) {
            console.log(`  ... and ${strings.length - 50} more strings`);
        }
    }
    
} catch (error) {
    console.error('Error reading model files:', error.message);
}

console.log('\n=== Test Complete ===\n');

/**
 * Kaltsit Character Module
 */

const path = require('path');
const { CharacterBase } = require(path.join(__dirname, 'character-base'));
const { CHARACTER_CONFIGS } = require(path.join(__dirname, '..', 'shared', 'constants'));

class KaltsitCharacter extends CharacterBase {
    constructor(options = {}) {
        super(CHARACTER_CONFIGS.kalts, options);
    }

    getDefaultIdleAnimation() {
        if (this.isSleepTime()) return 'Sleep';
        return Math.random() < 0.5 ? 'Relax' : 'Relax_Idle';
    }
}

module.exports = { KaltsitCharacter };

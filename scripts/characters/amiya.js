/**
 * Amiya Character Module
 */

const path = require('path');
const { CharacterBase } = require(path.join(__dirname, 'character-base'));
const { CHARACTER_CONFIGS } = require(path.join(__dirname, '..', 'shared', 'constants'));

class AmiyaCharacter extends CharacterBase {
    constructor(options = {}) {
        super(CHARACTER_CONFIGS.amiya, options);
    }
}

module.exports = { AmiyaCharacter };

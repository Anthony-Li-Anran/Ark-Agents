/**
 * Character Modules Index
 */

const path = require('path');
const { CharacterBase } = require(path.join(__dirname, 'character-base'));
const { AmiyaCharacter } = require(path.join(__dirname, 'amiya'));
const { TexasCharacter } = require(path.join(__dirname, 'texas'));
const { KaltsitCharacter } = require(path.join(__dirname, 'kaltsit'));

module.exports = {
    CharacterBase,
    AmiyaCharacter,
    TexasCharacter,
    KaltsitCharacter
};

/**
 * Character Modules Index
 */

const path = require('path');
const { CharacterBase } = require(path.join(__dirname, 'character-base'));
const { AmiyaCharacter } = require(path.join(__dirname, 'amiya'));
const { TexasCharacter } = require(path.join(__dirname, 'texas'));
const { KaltsitCharacter } = require(path.join(__dirname, 'kaltsit'));
const { MuelsyseCharacter } = require(path.join(__dirname, 'muelsyse'));
const { SvrashCharacter } = require(path.join(__dirname, 'svrash'));

module.exports = {
    CharacterBase,
    AmiyaCharacter,
    TexasCharacter,
    KaltsitCharacter,
    MuelsyseCharacter,
    SvrashCharacter
};

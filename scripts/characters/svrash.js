/**
 * Svrash Character Module
 * Re-exports from Svrash folder to maintain compatibility
 */

const path = require('path');
const { SvrashCharacter } = require(path.join(__dirname, '..', '..', 'Svrash', 'src', 'renderer', 'svrash-character'));

module.exports = { SvrashCharacter };

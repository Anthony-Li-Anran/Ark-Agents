/**
 * Svrash Animations Configuration
 * Animation state machines for Svrash character
 */

const SVRASH_ANIMATIONS = {
    'Default': { next: ['Default'], weight: [1] }
};

const SVRASH_SLEEP_ANIMATIONS = {
    'Default': { next: ['Default'], weight: [1] }
};

module.exports = {
    SVRASH_ANIMATIONS,
    SVRASH_SLEEP_ANIMATIONS
};

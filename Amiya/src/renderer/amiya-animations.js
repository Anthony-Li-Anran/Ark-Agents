/**
 * Amiya Animations Configuration
 * Animation state machines for Amiya character
 */

const DAY_ANIMATIONS = {
    'Relax': { next: ['MoveLeft', 'MoveRight', 'Sit'], weight: [0.3, 0.3, 0.4] },
    'Sit': { next: ['Relax', 'MoveLeft', 'MoveRight'], weight: [0.5, 0.25, 0.25] },
    'MoveLeft': { next: ['Relax', 'MoveRight', 'Sit'], weight: [0.4, 0.3, 0.3] },
    'MoveRight': { next: ['Relax', 'MoveLeft', 'Sit'], weight: [0.4, 0.3, 0.3] }
};

const SLEEP_ANIMATIONS = {
    'Relax': { next: ['Sleep'], weight: [1] },
    'Sleep': { next: ['Sleep'], weight: [1] }
};

module.exports = {
    DAY_ANIMATIONS,
    SLEEP_ANIMATIONS
};

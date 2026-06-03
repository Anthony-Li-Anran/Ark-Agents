/**
 * Muelsyse Animations Configuration
 * Animation state machines for Muelsyse character
 */

const MUELSYSE_ANIMATIONS = {
    'Relax': { next: ['Relax_Idle', 'Move', 'Sit'], weight: [0.3, 0.3, 0.4] },
    'Relax_Idle': { next: ['Relax', 'Move', 'Sit'], weight: [0.3, 0.3, 0.4] },
    'Sit': { next: ['Relax', 'Relax_Idle', 'Move'], weight: [0.35, 0.35, 0.3] },
    'Move': { next: ['Relax', 'Relax_Idle', 'Sit'], weight: [0.35, 0.35, 0.3] }
};

const MUELSYSE_SLEEP_ANIMATIONS = {
    'Relax': { next: ['Sleep'], weight: [1] },
    'Relax_Idle': { next: ['Sleep'], weight: [1] },
    'Sleep': { next: ['Sleep'], weight: [1] }
};

module.exports = {
    MUELSYSE_ANIMATIONS,
    MUELSYSE_SLEEP_ANIMATIONS
};

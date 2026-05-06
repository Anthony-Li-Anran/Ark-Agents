/**
 * Texas Animations Configuration
 * Animation state machines for Texas character
 */

const TEXAS_ANIMATIONS = {
    'Relax2': { next: ['MoveLeft2', 'MoveRight2', 'Sit2'], weight: [0.3, 0.3, 0.4] },
    'Sit2': { next: ['Relax2', 'MoveLeft2', 'MoveRight2'], weight: [0.5, 0.25, 0.25] },
    'MoveLeft2': { next: ['Relax2', 'MoveRight2', 'Sit2'], weight: [0.4, 0.3, 0.3] },
    'MoveRight2': { next: ['Relax2', 'MoveLeft2', 'Sit2'], weight: [0.4, 0.3, 0.3] }
};

module.exports = {
    TEXAS_ANIMATIONS
};

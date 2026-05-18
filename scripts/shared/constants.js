/**
 * Shared Constants
 * Constants shared across renderer components
 */

// Movement and display constants
const MOVING_SPEED = 80;
const MODEL_WIDTH = 150;
const GREETING_BUBBLE_DURATION_MS = 2000;
const CHAT_BUBBLE_DURATION_MS = 8000;

// Character model names
const MODEL_NAMES = {
    amiya: 'build_char_002_amiya',
    texas: 'build_char_102_texas',
    kalts: 'build_char_003_kalts'
};

// Legacy exports for backward compatibility
const MODEL_NAME = MODEL_NAMES.amiya;
const TEXAS_MODEL_NAME = MODEL_NAMES.texas;
const TEXAS_MODEL_WIDTH = MODEL_WIDTH;

// Animation matrices for Amiya
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

// Animation matrices for Texas (and other characters with similar animations)
const TEXAS_DAY_ANIMATIONS = {
    'Relax': { next: ['Relax_Idle', 'Move', 'Sit'], weight: [0.3, 0.3, 0.4] },
    'Relax_Idle': { next: ['Relax', 'Move', 'Sit'], weight: [0.3, 0.3, 0.4] },
    'Sit': { next: ['Relax', 'Relax_Idle', 'Move'], weight: [0.35, 0.35, 0.3] },
    'Move': { next: ['Relax', 'Relax_Idle', 'Sit'], weight: [0.35, 0.35, 0.3] }
};

const TEXAS_SLEEP_ANIMATIONS = {
    'Relax': { next: ['Sleep'], weight: [1] },
    'Relax_Idle': { next: ['Sleep'], weight: [1] },
    'Sleep': { next: ['Sleep'], weight: [1] }
};

// Character configurations
const CHARACTER_CONFIGS = {
    amiya: {
        id: 'amiya',
        name: 'Amiya',
        modelFolder: '002_Amiya',
        modelName: MODEL_NAMES.amiya,
        width: MODEL_WIDTH,
        animations: {
            day: DAY_ANIMATIONS,
            sleep: SLEEP_ANIMATIONS
        },
        moveAnimation: 'Move',
        interactAnimation: 'Interact'
    },
    texas: {
        id: 'texas',
        name: 'Texas',
        modelFolder: '102_Texas',
        modelName: MODEL_NAMES.texas,
        width: MODEL_WIDTH,
        animations: {
            day: TEXAS_DAY_ANIMATIONS,
            sleep: TEXAS_SLEEP_ANIMATIONS
        },
        moveAnimation: 'Move',
        interactAnimation: 'Interact'
    },
    kalts: {
        id: 'kalts',
        name: "Kal'tsit",
        modelFolder: '003_kalts',
        modelName: MODEL_NAMES.kalts,
        width: MODEL_WIDTH,
        animations: {
            day: TEXAS_DAY_ANIMATIONS,
            sleep: TEXAS_SLEEP_ANIMATIONS
        },
        moveAnimation: 'Move',
        interactAnimation: 'Interact'
    }
};

// Context menu items for Amiya
const CONTEXT_MENU_ITEMS = [
    { id: 'chat', label: 'Chat' },
    { id: 'schedule', label: 'Schedule' },
    { id: 'memo', label: 'Memo' },
    { id: 'reminder', label: 'Reminder' },
    { id: 'operators', label: 'Operators' },
    { id: 'exit', label: 'Exit' }
];

// Context menu items for Kaltsit (medical consultation)
const KALTSIT_CONTEXT_MENU_ITEMS = [
    { id: 'medical-consult', label: 'Medical Consult' },
    { id: 'exit', label: 'Exit' }
];

// Legacy export for compatibility
const TEXAS_ANIMATIONS = TEXAS_DAY_ANIMATIONS;

module.exports = {
    MODEL_NAME,
    TEXAS_MODEL_NAME,
    TEXAS_MODEL_WIDTH,
    MODEL_NAMES,
    MODEL_WIDTH,
    MOVING_SPEED,
    GREETING_BUBBLE_DURATION_MS,
    CHAT_BUBBLE_DURATION_MS,
    DAY_ANIMATIONS,
    SLEEP_ANIMATIONS,
    TEXAS_DAY_ANIMATIONS,
    TEXAS_SLEEP_ANIMATIONS,
    TEXAS_ANIMATIONS,
    CHARACTER_CONFIGS,
    CONTEXT_MENU_ITEMS,
    KALTSIT_CONTEXT_MENU_ITEMS
};

/**
 * Dialog System Module Index
 */

const { DialogSystem } = require('./dialog-system');
const { DialogContentManager } = require('./dialog-content-manager');
const { OperatorRelationConfig } = require('./operator-relation-config');
const { DialogStateManager } = require('./dialog-state-manager');
const { DialogBubbleManager } = require('./dialog-bubble-manager');
const { DialogScheduler } = require('./dialog-scheduler');

module.exports = {
    DialogSystem,
    DialogContentManager,
    OperatorRelationConfig,
    DialogStateManager,
    DialogBubbleManager,
    DialogScheduler
};

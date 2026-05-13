/**
 * Dialog System
 * Main entry point for the operator dialog scheduling system
 */

const { DialogContentManager } = require('./dialog-content-manager');
const { OperatorRelationConfig } = require('./operator-relation-config');
const { DialogStateManager } = require('./dialog-state-manager');
const { DialogBubbleManager } = require('./dialog-bubble-manager');
const { DialogScheduler } = require('./dialog-scheduler');

class DialogSystem {
    constructor(options = {}) {
        this.contentManager = new DialogContentManager(options.basePath);
        this.relationConfig = new OperatorRelationConfig();
        this.stateManager = new DialogStateManager();
        this.bubbleManager = new DialogBubbleManager(options.bubbleOptions);
        this.scheduler = new DialogScheduler({
            contentManager: this.contentManager,
            relationConfig: this.relationConfig,
            stateManager: this.stateManager,
            checkInterval: options.checkInterval || 5000,
            baseTriggerProbability: options.baseTriggerProbability || 0.1
        });

        this.operatorPositions = new Map();
        this.isInitialized = false;
        this.listeners = new Map();
        this.pendingTimers = new Set();

        this.setupEventHandlers();
    }

    setupEventHandlers() {
        this.scheduler.on('dialogTriggered', (dialogInfo) => {
            this.handleDialogTriggered(dialogInfo);
        });

        this.stateManager.on('dialogEnded', (dialogInfo) => {
            this.handleDialogEnded(dialogInfo);
        });

        this.bubbleManager.on('typingComplete', (data) => {
            this.handleTypingComplete(data);
        });
    }

    async initialize() {
        if (this.isInitialized) {
            console.warn('[DialogSystem] Already initialized');
            return;
        }

        try {
            await this.contentManager.loadAllDialogs();
            this.isInitialized = true;
            console.log('[DialogSystem] Initialized successfully');
        } catch (error) {
            console.error('[DialogSystem] Initialization failed:', error);
            throw error;
        }
    }

    start() {
        if (!this.isInitialized) {
            console.warn('[DialogSystem] Cannot start: not initialized');
            return;
        }

        this.scheduler.start();
        console.log('[DialogSystem] Started');
    }

    stop() {
        this.scheduler.stop();
        this.clearPendingTimers();
        this.bubbleManager.hideAllBubbles(true);
        this.stateManager.clear();
        console.log('[DialogSystem] Stopped');
    }

    registerOperator(operatorId, position = null) {
        const opId = this.contentManager.normalizeOperatorId(operatorId);
        this.scheduler.registerOperator(opId);
        
        if (position) {
            this.updateOperatorPosition(opId, position);
        }
    }

    unregisterOperator(operatorId) {
        const opId = this.contentManager.normalizeOperatorId(operatorId);
        this.scheduler.unregisterOperator(opId);
        this.operatorPositions.delete(opId);
    }

    updateOperatorPosition(operatorId, position) {
        const opId = this.contentManager.normalizeOperatorId(operatorId);
        this.operatorPositions.set(opId, position);
    }

    handleDialogTriggered(dialogInfo) {
        const { operator1, operator2, dialogPair } = dialogInfo;

        this.emit('dialogStarting', dialogInfo);

        this.stateManager.updateDialogPhase('first');

        this.showDialogBubble(
            dialogPair.first.speaker,
            dialogPair.first.content,
            this.getBubblePosition(dialogPair.first.speaker)
        );
    }

    handleTypingComplete(data) {
        const currentDialog = this.stateManager.getCurrentDialog();
        if (!currentDialog) return;

        if (currentDialog.currentPhase === 'first') {
            this.scheduleDialogStep(() => {
                if (this.stateManager.getCurrentDialog() !== currentDialog) return;
                this.stateManager.updateDialogPhase('second');
                
                this.showDialogBubble(
                    currentDialog.dialogPair.second.speaker,
                    currentDialog.dialogPair.second.content,
                    this.getBubblePosition(currentDialog.dialogPair.second.speaker)
                );
            }, 500);
        } else if (currentDialog.currentPhase === 'second') {
            this.scheduleDialogStep(() => {
                if (this.stateManager.getCurrentDialog() !== currentDialog) return;
                this.endCurrentDialog();
            }, 2000);
        }
    }

    handleDialogEnded(dialogInfo) {
        this.bubbleManager.hideAllBubbles();
    }

    showDialogBubble(operatorId, content, position) {
        const bubbleId = `dialog_${operatorId}_${Date.now()}`;
        const bubble = this.bubbleManager.createBubble(operatorId, content, position);
        this.bubbleManager.showBubble(bubble.id, content, position, { typing: true });
    }

    getBubblePosition(operatorId) {
        const position = this.operatorPositions.get(operatorId);
        
        if (position) {
            return {
                x: position.x,
                y: position.y - 100,
                align: 'center'
            };
        }

        return {
            x: 200,
            y: 200,
            align: 'center'
        };
    }

    endCurrentDialog() {
        this.clearPendingTimers();
        this.stateManager.endDialog();
    }

    interruptCurrentDialog(reason = 'user-interaction') {
        this.clearPendingTimers();
        this.bubbleManager.hideAllBubbles(true);
        return this.stateManager.cancelDialog(reason);
    }

    scheduleDialogStep(callback, delayMs) {
        const timer = setTimeout(() => {
            this.pendingTimers.delete(timer);
            callback();
        }, delayMs);
        this.pendingTimers.add(timer);
        return timer;
    }

    clearPendingTimers() {
        for (const timer of this.pendingTimers) {
            clearTimeout(timer);
        }
        this.pendingTimers.clear();
    }

    addOperatorRelation(operator1, operator2, config = {}) {
        this.relationConfig.addRelation(operator1, operator2, config);
    }

    removeOperatorRelation(operator1, operator2) {
        this.relationConfig.removeRelation(operator1, operator2);
    }

    setDialogProbability(operator1, operator2, probability) {
        this.relationConfig.setProbability(operator1, operator2, probability);
    }

    setDialogCooldown(operator1, operator2, cooldownMs) {
        this.relationConfig.setCooldown(operator1, operator2, cooldownMs);
    }

    setCheckInterval(intervalMs) {
        this.scheduler.setCheckInterval(intervalMs);
    }

    setTypingSpeed(speedMs) {
        this.bubbleManager.setTypingSpeed(speedMs);
    }

    getStats() {
        return {
            isInitialized: this.isInitialized,
            scheduler: this.scheduler.getStats(),
            state: this.stateManager.getStats(),
            relations: this.relationConfig.getStats(),
            operators: Array.from(this.operatorPositions.keys())
        };
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    off(event, callback) {
        if (!this.listeners.has(event)) return;
        
        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
            callbacks.splice(index, 1);
        }
    }

    emit(event, data) {
        if (!this.listeners.has(event)) return;
        
        for (const callback of this.listeners.get(event)) {
            try {
                callback(data);
            } catch (error) {
                console.error(`[DialogSystem] Error in listener for ${event}:`, error);
            }
        }
    }

    destroy() {
        this.stop();
        this.clearPendingTimers();
        this.bubbleManager.destroy();
        this.stateManager.reset();
        this.scheduler.reset();
        this.listeners.clear();
        this.isInitialized = false;
    }
}

module.exports = { DialogSystem };

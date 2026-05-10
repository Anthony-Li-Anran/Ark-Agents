/**
 * Dialog Scheduler
 * Handles probability-based dialog triggering logic
 */

class DialogScheduler {
    constructor(options = {}) {
        this.contentManager = options.contentManager;
        this.relationConfig = options.relationConfig;
        this.stateManager = options.stateManager;
        
        this.checkInterval = options.checkInterval || 5000;
        this.baseTriggerProbability = options.baseTriggerProbability || 0.1;
        this.schedulerTimer = null;
        this.isEnabled = false;
        this.listeners = new Map();
        
        this.activeOperators = new Set();
        this.lastCheckTime = 0;
        this.checkCount = 0;
    }

    start() {
        if (this.isEnabled) {
            console.warn('[DialogScheduler] Scheduler already running');
            return;
        }

        this.isEnabled = true;
        this.scheduleNextCheck();
        console.log('[DialogScheduler] Scheduler started');
    }

    stop() {
        if (!this.isEnabled) return;

        this.isEnabled = false;
        if (this.schedulerTimer) {
            clearTimeout(this.schedulerTimer);
            this.schedulerTimer = null;
        }
        console.log('[DialogScheduler] Scheduler stopped');
    }

    scheduleNextCheck() {
        if (!this.isEnabled) return;

        const jitter = Math.random() * 2000;
        const interval = this.checkInterval + jitter;

        this.schedulerTimer = setTimeout(() => {
            this.performCheck();
            this.scheduleNextCheck();
        }, interval);
    }

    performCheck() {
        if (!this.stateManager.canStartDialog()) {
            return;
        }

        if (this.activeOperators.size < 2) {
            return;
        }

        this.lastCheckTime = Date.now();
        this.checkCount++;

        const candidatePairs = this.getCandidatePairs();
        
        if (candidatePairs.length === 0) {
            return;
        }

        const selectedPair = this.selectDialogPair(candidatePairs);
        
        if (selectedPair) {
            this.triggerDialog(selectedPair);
        }
    }

    getCandidatePairs() {
        const operators = Array.from(this.activeOperators);
        const pairs = [];

        for (let i = 0; i < operators.length; i++) {
            for (let j = i + 1; j < operators.length; j++) {
                const op1 = operators[i];
                const op2 = operators[j];

                if (this.relationConfig.canTrigger(op1, op2)) {
                    const relation = this.relationConfig.getRelation(op1, op2);
                    const dialogCount = this.contentManager.getDialogCount(op1, op2);
                    
                    if (dialogCount > 0) {
                        pairs.push({
                            operator1: op1,
                            operator2: op2,
                            probability: relation.probability,
                            priority: relation.priority,
                            dialogCount
                        });
                    }
                }
            }
        }

        return pairs.sort((a, b) => a.priority - b.priority);
    }

    selectDialogPair(candidatePairs) {
        for (const pair of candidatePairs) {
            if (Math.random() < pair.probability) {
                return pair;
            }
        }

        return null;
    }

    triggerDialog(pairInfo) {
        const { operator1, operator2 } = pairInfo;
        
        const dialogPair = this.contentManager.getRandomDialogPair(operator1, operator2);
        
        if (!dialogPair) {
            console.warn(`[DialogScheduler] No dialog content found for ${operator1} and ${operator2}`);
            return;
        }

        const dialogInfo = {
            operator1,
            operator2,
            dialogPair,
            triggeredAt: Date.now()
        };

        const started = this.stateManager.startDialog(dialogInfo);
        
        if (started) {
            this.relationConfig.markTriggered(operator1, operator2);
            this.emit('dialogTriggered', dialogInfo);
            console.log(`[DialogScheduler] Dialog triggered: ${operator1} <-> ${operator2}`);
        }
    }

    registerOperator(operatorId) {
        this.activeOperators.add(operatorId.toLowerCase());
        console.log(`[DialogScheduler] Operator registered: ${operatorId}`);
    }

    unregisterOperator(operatorId) {
        this.activeOperators.delete(operatorId.toLowerCase());
        console.log(`[DialogScheduler] Operator unregistered: ${operatorId}`);
    }

    setCheckInterval(intervalMs) {
        this.checkInterval = Math.max(1000, intervalMs);
    }

    setBaseProbability(probability) {
        this.baseTriggerProbability = Math.max(0, Math.min(1, probability));
    }

    getStats() {
        return {
            isEnabled: this.isEnabled,
            activeOperators: Array.from(this.activeOperators),
            checkCount: this.checkCount,
            lastCheckTime: this.lastCheckTime,
            checkInterval: this.checkInterval
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
                console.error(`[DialogScheduler] Error in listener for ${event}:`, error);
            }
        }
    }

    reset() {
        this.stop();
        this.activeOperators.clear();
        this.checkCount = 0;
        this.lastCheckTime = 0;
    }
}

module.exports = { DialogScheduler };

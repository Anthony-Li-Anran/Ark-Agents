/**
 * Dialog State Manager
 * Manages dialog state and ensures mutual exclusion
 */

class DialogStateManager {
    constructor() {
        this.currentDialog = null;
        this.dialogQueue = [];
        this.isDialogActive = false;
        this.dialogHistory = [];
        this.maxHistorySize = 50;
        this.listeners = new Map();
    }

    startDialog(dialogInfo) {
        if (this.isDialogActive) {
            console.warn('[DialogStateManager] Dialog already active, cannot start new dialog');
            return false;
        }

        this.currentDialog = {
            ...dialogInfo,
            startTime: Date.now(),
            status: 'active'
        };

        this.isDialogActive = true;
        this.emit('dialogStarted', this.currentDialog);
        
        console.log(`[DialogStateManager] Dialog started: ${dialogInfo.operator1} <-> ${dialogInfo.operator2}`);
        return true;
    }

    updateDialogPhase(phase) {
        if (!this.currentDialog) return;

        this.currentDialog.currentPhase = phase;
        this.emit('dialogPhaseChanged', {
            dialog: this.currentDialog,
            phase
        });
    }

    endDialog() {
        if (!this.currentDialog) return;

        this.currentDialog.endTime = Date.now();
        this.currentDialog.status = 'completed';
        this.currentDialog.duration = this.currentDialog.endTime - this.currentDialog.startTime;

        this.dialogHistory.push({ ...this.currentDialog });
        
        if (this.dialogHistory.length > this.maxHistorySize) {
            this.dialogHistory.shift();
        }

        const completedDialog = { ...this.currentDialog };
        this.currentDialog = null;
        this.isDialogActive = false;

        this.emit('dialogEnded', completedDialog);
        console.log('[DialogStateManager] Dialog ended');
    }

    cancelDialog(reason = 'cancelled') {
        if (!this.currentDialog) return null;

        this.currentDialog.endTime = Date.now();
        this.currentDialog.status = 'interrupted';
        this.currentDialog.reason = reason;
        this.currentDialog.duration = this.currentDialog.endTime - this.currentDialog.startTime;

        const interruptedDialog = { ...this.currentDialog };
        this.currentDialog = null;
        this.isDialogActive = false;

        this.emit('dialogInterrupted', interruptedDialog);
        this.emit('dialogEnded', interruptedDialog);
        console.log(`[DialogStateManager] Dialog interrupted: ${reason}`);
        return interruptedDialog;
    }

    canStartDialog() {
        return !this.isDialogActive;
    }

    isActive() {
        return this.isDialogActive;
    }

    getCurrentDialog() {
        return this.currentDialog;
    }

    getDialogHistory(limit = 10) {
        return this.dialogHistory.slice(-limit);
    }

    getStats() {
        const now = Date.now();
        const recentDialogs = this.dialogHistory.filter(d => now - d.startTime < 3600000);
        
        return {
            totalDialogs: this.dialogHistory.length,
            recentDialogs: recentDialogs.length,
            isCurrentlyActive: this.isDialogActive,
            averageDuration: recentDialogs.length > 0
                ? recentDialogs.reduce((sum, d) => sum + d.duration, 0) / recentDialogs.length
                : 0
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
                console.error(`[DialogStateManager] Error in listener for ${event}:`, error);
            }
        }
    }

    clear() {
        if (this.isDialogActive) {
            this.cancelDialog('clear');
        }
        this.dialogQueue = [];
    }

    reset() {
        this.clear();
        this.dialogHistory = [];
        this.listeners.clear();
    }
}

module.exports = { DialogStateManager };

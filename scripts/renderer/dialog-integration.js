/**
 * Dialog System Renderer Integration
 * Integrates dialog system with the main renderer process
 */

const path = require('path');

class DialogRendererIntegration {
    constructor() {
        this.dialogSystem = null;
        this.isInitialized = false;
        this.isEnabled = true;
        this.characters = new Map();
        this.preDialogStates = new Map();
    }

    async initialize(scriptDir) {
        if (this.isInitialized) {
            console.warn('[DialogRenderer] Already initialized');
            return;
        }

        try {
            const { DialogSystem } = require(path.join(scriptDir, '..', 'dialog', 'dialog-system'));
            
            const basePath = path.join(scriptDir, '..', '..');
            
            this.dialogSystem = new DialogSystem({
                basePath: basePath,
                checkInterval: 5000,
                baseTriggerProbability: 0.1,
                bubbleOptions: {
                    typingSpeed: 80,
                    container: document.body
                }
            });

            await this.dialogSystem.initialize();
            this.isInitialized = true;
            
            this.setupEventListeners();
            
            console.log('[DialogRenderer] Dialog system initialized');
        } catch (error) {
            console.error('[DialogRenderer] Failed to initialize dialog system:', error);
        }
    }

    setupEventListeners() {
        if (!this.dialogSystem) return;

        this.dialogSystem.on('dialogStarting', (dialogInfo) => {
            console.log(`[DialogRenderer] Dialog starting: ${dialogInfo.operator1} <-> ${dialogInfo.operator2}`);
            this.handleDialogStart(dialogInfo);
        });

        this.dialogSystem.on('dialogTriggered', (dialogInfo) => {
            console.log(`[DialogRenderer] Dialog triggered: ${dialogInfo.operator1} <-> ${dialogInfo.operator2}`);
        });

        this.dialogSystem.on('dialogEnded', (dialogInfo) => {
            console.log(`[DialogRenderer] Dialog ended`);
            this.handleDialogEnd(dialogInfo);
        });
    }

    handleDialogStart(dialogInfo) {
        const { operator1, operator2 } = dialogInfo;
        
        const char1 = this.characters.get(operator1);
        const char2 = this.characters.get(operator2);
        
        if (char1) {
            this.saveAndPauseCharacter(operator1, char1);
        }
        
        if (char2) {
            this.saveAndPauseCharacter(operator2, char2);
        }
    }

    saveAndPauseCharacter(operatorId, character) {
        const currentState = {
            currentAnimation: character.currentAnimation,
            moveDirection: character.moveDirection,
            wasMoving: false,
            wasUserInteracting: character.isUserInteracting
        };

        const isMoving = character.moveAnimationId !== null || 
                         character.currentAnimation === 'Move' ||
                         character.currentAnimation === 'MoveLeft' ||
                         character.currentAnimation === 'MoveRight';

        character.isUserInteracting = true;

        if (isMoving) {
            currentState.wasMoving = true;
            character.stopMoving();
        }

        if (character.animationTimer) {
            clearTimeout(character.animationTimer);
            character.animationTimer = null;
        }

        if (isMoving) {
            character.playAnimation('Relax', true);
        }

        this.preDialogStates.set(operatorId, currentState);
        console.log(`[DialogRenderer] Saved state for ${operatorId}: moving=${isMoving}, animation=${currentState.currentAnimation}`);
    }

    handleDialogEnd(dialogInfo) {
        const { operator1, operator2 } = dialogInfo;
        
        const char1 = this.characters.get(operator1);
        const char2 = this.characters.get(operator2);
        
        if (char1) {
            this.restoreCharacter(operator1, char1);
        }
        
        if (char2) {
            this.restoreCharacter(operator2, char2);
        }
    }

    restoreCharacter(operatorId, character) {
        const savedState = this.preDialogStates.get(operatorId);
        
        if (!savedState) {
            character.isUserInteracting = false;
            character.scheduleNextAnimation(false);
            return;
        }

        this.preDialogStates.delete(operatorId);

        character.isUserInteracting = savedState.wasUserInteracting || false;

        if (savedState.wasMoving) {
            character.scheduleNextAnimation(false);
        } else {
            character.playAnimation(savedState.currentAnimation || 'Relax', true);
            character.scheduleNextAnimation(false);
        }

        console.log(`[DialogRenderer] Restored state for ${operatorId}`);
    }

    isSleepTime(date = new Date()) {
        const hour = date.getHours();
        return hour >= 23 || hour < 7;
    }

    shouldTriggerDialog() {
        if (!this.isEnabled || !this.isInitialized) {
            return false;
        }

        if (this.isSleepTime()) {
            return false;
        }

        return true;
    }

    registerCharacter(characterId, characterInstance) {
        if (!this.isInitialized || !this.dialogSystem) return;

        const id = characterId.toLowerCase();
        this.characters.set(id, characterInstance);

        const position = this.getCharacterPosition(characterInstance);
        this.dialogSystem.registerOperator(id, position);

        console.log(`[DialogRenderer] Character registered: ${id}`);
    }

    unregisterCharacter(characterId) {
        if (!this.isInitialized || !this.dialogSystem) return;

        const id = characterId.toLowerCase();
        this.characters.delete(id);
        this.dialogSystem.unregisterOperator(id);

        console.log(`[DialogRenderer] Character unregistered: ${id}`);
    }

    updateCharacterPosition(characterId, characterInstance) {
        if (!this.isInitialized || !this.dialogSystem) return;

        const id = characterId.toLowerCase();
        const position = this.getCharacterPosition(characterInstance);
        this.dialogSystem.updateOperatorPosition(id, position);
    }

    getCharacterPosition(characterInstance) {
        if (!characterInstance || !characterInstance.spine) {
            return { x: 0, y: 0 };
        }

        const bounds = characterInstance.getBounds();
        if (!bounds) {
            return { x: 0, y: 0 };
        }

        return {
            x: bounds.x + bounds.width / 2,
            y: bounds.y
        };
    }

    start() {
        if (!this.isInitialized || !this.dialogSystem) {
            console.warn('[DialogRenderer] Cannot start: not initialized');
            return;
        }

        if (this.isSleepTime()) {
            console.log('[DialogRenderer] Sleep time detected, dialog system will not start');
            return;
        }

        this.dialogSystem.start();
        console.log('[DialogRenderer] Dialog system started');
    }

    stop() {
        if (this.dialogSystem) {
            this.dialogSystem.stop();
        }
        console.log('[DialogRenderer] Dialog system stopped');
    }

    enable() {
        this.isEnabled = true;
        if (this.isInitialized && !this.isSleepTime()) {
            this.start();
        }
        console.log('[DialogRenderer] Dialog system enabled');
    }

    disable() {
        this.isEnabled = false;
        this.stop();
        console.log('[DialogRenderer] Dialog system disabled');
    }

    checkTimeAndUpdate() {
        if (!this.isInitialized) return;

        const isSleep = this.isSleepTime();
        
        if (isSleep && this.dialogSystem.scheduler.isEnabled) {
            console.log('[DialogRenderer] Entering sleep time, stopping dialog system');
            this.stop();
        } else if (!isSleep && this.isEnabled && !this.dialogSystem.scheduler.isEnabled) {
            console.log('[DialogRenderer] Waking up, starting dialog system');
            this.start();
        }
    }

    getStats() {
        if (!this.isInitialized || !this.dialogSystem) {
            return null;
        }
        return this.dialogSystem.getStats();
    }

    destroy() {
        this.stop();
        if (this.dialogSystem) {
            this.dialogSystem.destroy();
        }
        this.characters.clear();
        this.preDialogStates.clear();
        this.isInitialized = false;
        console.log('[DialogRenderer] Dialog system destroyed');
    }
}

module.exports = { DialogRendererIntegration };

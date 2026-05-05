/**
 * Drag Handler Module
 * Handles drag interactions for character models
 */

const DRAG_THRESHOLD = 5;

class DragHandler {
    constructor(options = {}) {
        this.getCharacter = options.getCharacter;
        this.getCharacters = options.getCharacters;
        this.onDragStart = options.onDragStart;
        this.onDragMove = options.onDragMove;
        this.onDragEnd = options.onDragEnd;
        this.onClick = options.onClick;
        this.onUpdateMouseIgnore = options.onUpdateMouseIgnore;
        this.chatVisible = options.chatVisible || (() => false);
        this.focusChatInput = options.focusChatInput || (() => {});

        this.isDragging = false;
        this.isMouseDown = false;
        this.activeCharacterId = null;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.modelStartX = 0;
        this.modelStartY = 0;
        this.mouseDownX = 0;
        this.mouseDownY = 0;

        this.boundHandlers = {};
    }

    getPointerCharacterAt(x, y) {
        const characters = this.getCharacters ? this.getCharacters() : [];
        for (let i = characters.length - 1; i >= 0; i--) {
            const char = characters[i];
            if (char && (char.isPointInside?.(x, y) || char.isPointIn?.(x, y))) {
                return char;
            }
        }
        return null;
    }

    getCharacterId(char) {
        if (char.characterId) return char.characterId;
        if (char.config?.name) return char.config.name.toLowerCase();
        return 'unknown';
    }

    getCharacterSpine(char) {
        return char.spine || null;
    }

    handleMouseDown(e) {
        if (e.button !== 0) return;

        const char = this.getPointerCharacterAt(e.clientX, e.clientY);
        if (!char) return;

        this.activeCharacterId = this.getCharacterId(char);
        this.isMouseDown = true;
        this.mouseDownX = e.clientX;
        this.mouseDownY = e.clientY;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        const spine = this.getCharacterSpine(char);
        this.modelStartX = spine?.x || 0;
        this.modelStartY = spine?.y || 0;
    }

    handleMouseMove(e) {
        if (this.onUpdateMouseIgnore) {
            this.onUpdateMouseIgnore(e.clientX, e.clientY);
        }

        if (!this.isMouseDown || !this.activeCharacterId) return;

        const char = this.getCharacter ? this.getCharacter(this.activeCharacterId) : null;
        if (!char) return;

        const spine = this.getCharacterSpine(char);
        if (!spine) return;

        if (!this.isDragging) {
            const moveDistance = Math.sqrt(
                Math.pow(e.clientX - this.mouseDownX, 2) +
                Math.pow(e.clientY - this.mouseDownY, 2)
            );

            if (moveDistance >= DRAG_THRESHOLD) {
                this.isDragging = true;
                if (this.onDragStart) {
                    this.onDragStart(this.activeCharacterId, char);
                }
            }
        }

        if (this.isDragging) {
            const deltaX = e.clientX - this.dragStartX;
            const deltaY = e.clientY - this.dragStartY;

            spine.x = this.modelStartX + deltaX;
            spine.y = this.modelStartY + deltaY;

            char.constrainToScreen?.();

            if (this.onDragMove) {
                this.onDragMove(this.activeCharacterId, char);
            }
        }
    }

    handleMouseUp(e) {
        if (!this.isMouseDown) return;

        const char = this.getCharacter ? this.getCharacter(this.activeCharacterId) : null;

        if (!this.isDragging) {
            const moveDistance = Math.sqrt(
                Math.pow(e.clientX - this.mouseDownX, 2) +
                Math.pow(e.clientY - this.mouseDownY, 2)
            );

            if (moveDistance < DRAG_THRESHOLD && this.onClick) {
                this.onClick(this.activeCharacterId, char);
            }
        } else if (this.onDragEnd) {
            this.onDragEnd(this.activeCharacterId, char);
        }

        this.isDragging = false;
        this.isMouseDown = false;
        this.activeCharacterId = null;
    }

    attach(canvasContainer) {
        this.boundHandlers.mousemove = (e) => this.handleMouseMove(e);
        this.boundHandlers.mousedown = (e) => this.handleMouseDown(e);
        this.boundHandlers.mouseup = (e) => this.handleMouseUp(e);

        document.addEventListener('mousemove', this.boundHandlers.mousemove);
        canvasContainer.addEventListener('mousedown', this.boundHandlers.mousedown);
        document.addEventListener('mouseup', this.boundHandlers.mouseup);
    }

    detach(canvasContainer) {
        document.removeEventListener('mousemove', this.boundHandlers.mousemove);
        canvasContainer.removeEventListener('mousedown', this.boundHandlers.mousedown);
        document.removeEventListener('mouseup', this.boundHandlers.mouseup);
    }

    isActive() {
        return this.isDragging || this.isMouseDown;
    }

    getActiveCharacterId() {
        return this.activeCharacterId;
    }
}

module.exports = { DragHandler, DRAG_THRESHOLD };

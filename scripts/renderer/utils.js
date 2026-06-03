const { ipcRenderer } = require('electron');

// Drag state variables
let isDragging = false;
let isMouseDown = false;
let dragStartX = 0;
let dragStartY = 0;
let modelStartX = 0;
let modelStartY = 0;
let mouseDownX = 0;
let mouseDownY = 0;
let activePointerModel = null;

const DRAG_THRESHOLD = 5;

// Model references (will be set via setModelReferences)
let spineAnimation = null;
let texasAnimation = null;
let canvasContainer = null;

// Screen dimensions
let screenWidth = 1920;
let screenHeight = 1080;

// Model constants
const MODEL_WIDTH = 150;
const TEXAS_MODEL_WIDTH = 150;

// Callbacks (will be set via setCallbacks)
let callbacks = {
    stopMoving: null,
    stopTexasMoving: null,
    playAnimation: null,
    playTexasAnimation: null,
    scheduleNextAnimation: null,
    scheduleNextTexasAnimation: null,
    getDefaultIdleAnimation: null,
    showContextMenu: null,
    hideContextMenu: null,
    updateChatPosition: null,
    isChatVisible: null,
    isContextMenuVisible: null,
    isSubmenuVisible: null,
    getSubmenuElement: null,
    isUserInteracting: null,
    setUserInteracting: null,
    isTexasUserInteracting: null,
    setTexasUserInteracting: null,
    getAnimationTimer: null,
    clearAnimationTimer: null,
    getTexasAnimationTimer: null,
    clearTexasAnimationTimer: null,
    getMessageInput: null
};

/**
 * Set model references
 * @param {Object} refs - Object containing spineAnimation, texasAnimation, canvasContainer
 */
function setModelReferences(refs) {
    spineAnimation = refs.spineAnimation || spineAnimation;
    texasAnimation = refs.texasAnimation || texasAnimation;
    canvasContainer = refs.canvasContainer || canvasContainer;
}

/**
 * Set screen dimensions
 * @param {number} width - Screen width
 * @param {number} height - Screen height
 */
function setScreenDimensions(width, height) {
    screenWidth = width;
    screenHeight = height;
}

/**
 * Set callbacks for various actions
 * @param {Object} cb - Object containing callback functions
 */
function setCallbacks(cb) {
    callbacks = { ...callbacks, ...cb };
}

/**
 * Check if a point is within the Amiya model bounds
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {boolean} True if point is in model
 */
function isPointInModel(x, y) {
    if (!spineAnimation) return false;
    const bounds = spineAnimation.getBounds();
    return x >= bounds.x && x <= bounds.x + bounds.width &&
           y >= bounds.y && y <= bounds.y + bounds.height;
}

/**
 * Check if a point is within the Texas model bounds
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {boolean} True if point is in Texas model
 */
function isPointInTexas(x, y) {
    if (!texasAnimation || !texasAnimation.visible) return false;
    const bounds = texasAnimation.getBounds();
    return x >= bounds.x && x <= bounds.x + bounds.width &&
           y >= bounds.y && y <= bounds.y + bounds.height;
}

/**
 * Get which model is at the specified point
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {string|null} 'texas', 'amiya', or null
 */
function getPointerModelAt(x, y) {
    if (isPointInTexas(x, y)) return 'texas';
    if (isPointInModel(x, y)) return 'amiya';
    return null;
}

/**
 * Check if model is at left edge of screen
 * @param {Object} bounds - Model bounds object
 * @returns {boolean} True if at left edge
 */
function isAtLeftEdge(bounds) {
    return bounds.x <= 0;
}

/**
 * Check if model is at right edge of screen
 * @param {Object} bounds - Model bounds object
 * @returns {boolean} True if at right edge
 */
function isAtRightEdge(bounds) {
    return bounds.x + bounds.width >= screenWidth;
}

/**
 * Handle edge collision for Amiya model
 * @param {Object} bounds - Model bounds object
 */
function handleEdgeCollision(bounds) {
    // Don't change animation if in chat mode
    if (callbacks.isChatVisible && callbacks.isChatVisible()) {
        if (callbacks.stopMoving) callbacks.stopMoving();
        return;
    }

    const shouldRelax = Math.random() < 0.5;
    if (shouldRelax) {
        if (callbacks.playAnimation && callbacks.getDefaultIdleAnimation) {
            callbacks.playAnimation(callbacks.getDefaultIdleAnimation(), true);
        }
        if (callbacks.stopMoving) callbacks.stopMoving();
        return;
    }

    // Note: moveDirection and setDirection should be handled by the caller
    // This function now just signals that edge collision occurred
    // The caller should handle direction change
}

/**
 * Update mouse ignore state based on pointer position
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 */
function updateMouseIgnore(x, y) {
    if (!spineAnimation) return;
    // Don't change mouse ignore state when chat or context menu is visible
    if ((callbacks.isChatVisible && callbacks.isChatVisible()) ||
        (callbacks.isContextMenuVisible && callbacks.isContextMenuVisible())) {
        ipcRenderer.send('set-ignore-mouse-events', false);
        return;
    }
    const inModel = Boolean(getPointerModelAt(x, y));
    ipcRenderer.send('set-ignore-mouse-events', !inModel);
    if (canvasContainer) {
        if (inModel) {
            canvasContainer.classList.add('interactive');
        } else {
            canvasContainer.classList.remove('interactive');
        }
    }
}

/**
 * Initialize drag functionality
 */
function initDrag() {
    // Mouse move handler for dragging and mouse ignore
    document.addEventListener('mousemove', (e) => {
        if (!spineAnimation) return;
        updateMouseIgnore(e.clientX, e.clientY);

        if (!isDragging || !activePointerModel) return;

        const deltaX = e.clientX - dragStartX;
        const deltaY = e.clientY - dragStartY;

        const targetAnimation = activePointerModel === 'texas' ? texasAnimation : spineAnimation;
        const targetWidth = activePointerModel === 'texas' ? TEXAS_MODEL_WIDTH : MODEL_WIDTH;
        if (!targetAnimation) return;

        targetAnimation.x = modelStartX + deltaX;
        targetAnimation.y = modelStartY + deltaY;

        // Constrain to screen bounds
        if (targetAnimation.x < targetWidth) targetAnimation.x = targetWidth;
        if (targetAnimation.x > screenWidth - targetWidth) targetAnimation.x = screenWidth - targetWidth;
        if (targetAnimation.y < targetWidth) targetAnimation.y = targetWidth;
        if (targetAnimation.y > screenHeight - targetWidth) targetAnimation.y = screenHeight - targetWidth;

        // Update chat position when dragging
        if (callbacks.updateChatPosition) callbacks.updateChatPosition();
    });

    // Mouse down handler
    canvasContainer.addEventListener('mousedown', (e) => {
        if (!spineAnimation) return;
        if (e.button !== 0) return;

        if (callbacks.isContextMenuVisible && callbacks.isContextMenuVisible()) {
            if (callbacks.hideContextMenu) callbacks.hideContextMenu();
            return;
        }

        const pointerModel = getPointerModelAt(e.clientX, e.clientY);
        if (!pointerModel) {
            if (callbacks.hideContextMenu) callbacks.hideContextMenu();
            return;
        }

        activePointerModel = pointerModel;
        const targetAnimation = activePointerModel === 'texas' ? texasAnimation : spineAnimation;
        isMouseDown = true;
        mouseDownX = e.clientX;
        mouseDownY = e.clientY;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        modelStartX = targetAnimation.x;
        modelStartY = targetAnimation.y;
    });

    // Context menu handler
    canvasContainer.addEventListener('contextmenu', (e) => {
        if (!spineAnimation) return;
        if (isPointInModel(e.clientX, e.clientY)) {
            e.preventDefault();
            if (callbacks.showContextMenu) callbacks.showContextMenu(e.clientX, e.clientY);
        } else {
            if (callbacks.hideContextMenu) callbacks.hideContextMenu();
        }
    });

    // Global mousedown to hide context menu when clicking outside
    document.addEventListener('mousedown', (e) => {
        if (callbacks.isContextMenuVisible && callbacks.isContextMenuVisible() &&
            callbacks.getContextMenuElement) {
            const contextMenu = callbacks.getContextMenuElement();
            const inMainMenu = contextMenu && contextMenu.contains(e.target);
            const inSubmenu = callbacks.isSubmenuVisible && callbacks.isSubmenuVisible() &&
                callbacks.getSubmenuElement && callbacks.getSubmenuElement().contains(e.target);
            if (!inMainMenu && !inSubmenu) {
                if (callbacks.hideContextMenu) callbacks.hideContextMenu();
            }
        }
    });

    // Mouse up handler
    document.addEventListener('mouseup', (e) => {
        if (!isMouseDown) return;

        const moveDistance = Math.sqrt(
            Math.pow(e.clientX - mouseDownX, 2) +
            Math.pow(e.clientY - mouseDownY, 2)
        );

        if (!isDragging && moveDistance < DRAG_THRESHOLD) {
            // Click without drag - handle interaction
            handleModelClick();
        } else if (isDragging) {
            // Drag ended
            handleDragEnd();
        }

        isDragging = false;
        isMouseDown = false;
        activePointerModel = null;
    });

    // Global mousemove for drag detection
    document.addEventListener('mousemove', (e) => {
        if (!isMouseDown) return;

        const moveDistance = Math.sqrt(
            Math.pow(e.clientX - mouseDownX, 2) +
            Math.pow(e.clientY - mouseDownY, 2)
        );

        if (moveDistance >= DRAG_THRESHOLD && !isDragging) {
            isDragging = true;
            handleDragStart();
        }
    });
}

/**
 * Handle model click (without drag)
 */
function handleModelClick() {
    if (activePointerModel === 'texas') {
        if (callbacks.stopTexasMoving) callbacks.stopTexasMoving();
        if (callbacks.getTexasAnimationTimer && callbacks.clearTexasAnimationTimer) {
            const timer = callbacks.getTexasAnimationTimer();
            if (timer) {
                clearTimeout(timer);
                callbacks.clearTexasAnimationTimer();
            }
        }

        if (callbacks.setTexasUserInteracting) callbacks.setTexasUserInteracting(true);
        if (callbacks.playTexasAnimation) callbacks.playTexasAnimation('Interact2', false);

        // Set up completion listener
        if (texasAnimation && callbacks.playTexasAnimation && callbacks.setTexasUserInteracting &&
            callbacks.scheduleNextTexasAnimation) {
            texasAnimation.state.addListener({
                complete: (trackEntry) => {
                    if (trackEntry.animation.name === 'Interact2') {
                        callbacks.playTexasAnimation('Relax2', true);
                        callbacks.setTexasUserInteracting(false);
                        callbacks.scheduleNextTexasAnimation();
                    }
                }
            });
        }
    } else {
        // Amiya click
        if (callbacks.stopMoving) callbacks.stopMoving();
        if (callbacks.getAnimationTimer && callbacks.clearAnimationTimer) {
            const timer = callbacks.getAnimationTimer();
            if (timer) {
                clearTimeout(timer);
                callbacks.clearAnimationTimer();
            }
        }

        // If in chat mode, just focus input when Amiya is clicked
        if (callbacks.isChatVisible && callbacks.isChatVisible() && activePointerModel === 'amiya') {
            if (callbacks.getMessageInput) {
                const input = callbacks.getMessageInput();
                if (input) input.focus();
            }
        } else {
            // Left click: just play Interact animation once, don't enter chat
            if (callbacks.setUserInteracting) callbacks.setUserInteracting(true);
            if (callbacks.playAnimation) callbacks.playAnimation('Interact', false);

            if (spineAnimation && callbacks.playAnimation && callbacks.setUserInteracting &&
                callbacks.scheduleNextAnimation) {
                spineAnimation.state.addListener({
                    complete: (trackEntry) => {
                        if (trackEntry.animation.name === 'Interact') {
                            callbacks.playAnimation('Relax', true);
                            callbacks.setUserInteracting(false);
                            callbacks.scheduleNextAnimation();
                        }
                    }
                });
            }
        }
    }
}

/**
 * Handle drag start
 */
function handleDragStart() {
    if (activePointerModel === 'texas') {
        if (callbacks.setTexasUserInteracting) callbacks.setTexasUserInteracting(true);
        if (callbacks.stopTexasMoving) callbacks.stopTexasMoving();
        if (callbacks.getTexasAnimationTimer && callbacks.clearTexasAnimationTimer) {
            const timer = callbacks.getTexasAnimationTimer();
            if (timer) {
                clearTimeout(timer);
                callbacks.clearTexasAnimationTimer();
            }
        }
        if (callbacks.playTexasAnimation) callbacks.playTexasAnimation('Relax2', true);
    } else {
        if (callbacks.setUserInteracting) callbacks.setUserInteracting(true);
        if (callbacks.stopMoving) callbacks.stopMoving();
        if (callbacks.getAnimationTimer && callbacks.clearAnimationTimer) {
            const timer = callbacks.getAnimationTimer();
            if (timer) {
                clearTimeout(timer);
                callbacks.clearAnimationTimer();
            }
        }
        // Keep the current idle animation during drag
        if (callbacks.playAnimation && callbacks.getDefaultIdleAnimation) {
            callbacks.playAnimation(callbacks.getDefaultIdleAnimation(), true);
        }
    }
}

/**
 * Handle drag end
 */
function handleDragEnd() {
    if (activePointerModel === 'texas') {
        if (callbacks.stopTexasMoving) callbacks.stopTexasMoving();
        if (callbacks.playTexasAnimation) callbacks.playTexasAnimation('Relax2', true);
        if (callbacks.setTexasUserInteracting) callbacks.setTexasUserInteracting(false);
        if (callbacks.scheduleNextTexasAnimation) callbacks.scheduleNextTexasAnimation();
    } else {
        if (callbacks.stopMoving) callbacks.stopMoving();
        // Keep Relax animation if in chat mode
        if (!(callbacks.isChatVisible && callbacks.isChatVisible())) {
            if (callbacks.playAnimation && callbacks.getDefaultIdleAnimation) {
                callbacks.playAnimation(callbacks.getDefaultIdleAnimation(), true);
            }
            if (callbacks.setUserInteracting) callbacks.setUserInteracting(false);
            if (callbacks.scheduleNextAnimation) callbacks.scheduleNextAnimation();
        }
    }
}

/**
 * Get current drag state
 * @returns {Object} Current drag state
 */
function getDragState() {
    return {
        isDragging,
        isMouseDown,
        activePointerModel
    };
}

/**
 * Set drag state (for external control)
 * @param {Object} state - New drag state
 */
function setDragState(state) {
    if (state.isDragging !== undefined) isDragging = state.isDragging;
    if (state.isMouseDown !== undefined) isMouseDown = state.isMouseDown;
    if (state.activePointerModel !== undefined) activePointerModel = state.activePointerModel;
}

module.exports = {
    // Setup functions
    setModelReferences,
    setScreenDimensions,
    setCallbacks,

    // Model hit detection
    isPointInModel,
    isPointInTexas,
    getPointerModelAt,

    // Edge detection
    isAtLeftEdge,
    isAtRightEdge,
    handleEdgeCollision,

    // Mouse and drag
    initDrag,
    updateMouseIgnore,
    getDragState,
    setDragState,

    // Drag handlers (exposed for customization)
    handleModelClick,
    handleDragStart,
    handleDragEnd,

    // Constants
    DRAG_THRESHOLD,
    MODEL_WIDTH,
    TEXAS_MODEL_WIDTH
};

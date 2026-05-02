const originalWarn = console.warn;
console.warn = function(...args) {
    const msg = args[0];
    if (typeof msg === 'string' && msg.includes('PixiJS Deprecation Warning')) {
        return;
    }
    originalWarn.apply(console, args);
};

const { ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');
const PIXI = require('pixi.js');
const { Spine, TextureAtlas, AtlasAttachmentLoader, SkeletonBinary } = require('@pixi-spine/all-3.8');

// Add CSS styles for chat UI
const style = document.createElement('style');
style.textContent = `
/* Chat input box - attached below model */
.chat-input-wrapper {
  position: absolute;
  z-index: 1000;
  pointer-events: auto;
  display: none;
}
.chat-input-wrapper.visible {
  display: block;
}

/* From Uiverse.io by vinodjangid07 - keep original input style */
.messageBox {
  width: fit-content;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #2d2d2d;
  padding: 0 15px;
  border-radius: 10px;
  border: 1px solid rgb(63, 63, 63);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
.messageBox:focus-within {
  border: 1px solid rgb(110, 110, 110);
}
#messageInput {
  width: 200px;
  height: 100%;
  background-color: transparent;
  outline: none;
  border: none;
  padding-left: 10px;
  color: white;
  font-size: 14px;
}
#messageInput::placeholder {
  color: rgba(255, 255, 255, 0.6);
}
#sendButton {
  width: fit-content;
  height: 100%;
  background-color: transparent;
  outline: none;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s;
}
#sendButton svg {
  height: 18px;
  transition: all 0.3s;
}
#sendButton svg path {
  transition: all 0.3s;
}
#sendButton:hover svg path {
  fill: #3c3c3c;
  stroke: white;
}

/* Exit chat button - styled to match input box */
.exit-chat-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #2d2d2d;
  border-radius: 10px;
  border: 1px solid rgb(63, 63, 63);
  color: rgba(255, 255, 255, 0.8);
  font-size: 18px;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  margin-left: 8px;
  flex-shrink: 0;
}
.exit-chat-btn:hover {
  border: 1px solid rgb(110, 110, 110);
  color: #ffffff;
  background-color: #3d3d3d;
}

/* AI Speech Bubble - Minimalist Design */
.ai-bubble {
  position: absolute;
  max-width: 280px;
  min-width: 120px;
  background: #FFFFFF;
  color: #333333;
  padding: 14px 18px;
  border-radius: 20px;
  font-size: 14px;
  line-height: 1.6;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(0, 0, 0, 0.05);
  z-index: 999;
  pointer-events: none;
  opacity: 0;
  transform: translateY(10px) scale(0.95);
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.ai-bubble.visible {
  opacity: 1;
  transform: translateY(0) scale(1);
}
.ai-bubble::after {
  content: '';
  position: absolute;
  bottom: -10px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 10px solid transparent;
  border-right: 10px solid transparent;
  border-top: 10px solid #FFFFFF;
  filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.05));
}
.ai-bubble.error {
  background: #FFF5F5;
  border: 1px solid rgba(255, 100, 100, 0.2);
  color: #C53030;
}
.ai-bubble.error::after {
  border-top-color: #FFF5F5;
}
.bubble-text {
  word-wrap: break-word;
}

/* System Notification - separate from chat bubble */
.system-notification {
  position: absolute;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border: 1px solid rgba(102, 126, 234, 0.5);
  border-radius: 12px;
  padding: 10px 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4), 0 0 12px rgba(102, 126, 234, 0.2);
  z-index: 1003;
  pointer-events: none;
  opacity: 0;
  transform: translateY(10px) scale(0.95);
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.system-notification.visible {
  opacity: 1;
  transform: translateY(0) scale(1);
}
.notification-content {
  display: flex;
  align-items: center;
  gap: 10px;
}
.notification-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #64c864 0%, #4aa84a 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: white;
  flex-shrink: 0;
}
.notification-text {
  color: white;
}
.notification-subtitle {
  font-size: 13px;
  font-weight: 500;
}

/* Loading spinner - positioned at top-right of model */
/* From Uiverse.io by abrahamcalsin */
.ai-loading-spinner {
  position: absolute;
  --uib-size: 28px;
  --uib-speed: .9s;
  --uib-color: #ffffff;
  display: none;
  align-items: center;
  justify-content: flex-start;
  height: var(--uib-size);
  width: var(--uib-size);
  z-index: 1002;
  pointer-events: none;
}
.ai-loading-spinner.visible {
  display: flex;
}
.ai-loading-spinner .dot-spinner__dot {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  height: 100%;
  width: 100%;
}
.ai-loading-spinner .dot-spinner__dot::before {
  content: '';
  height: 20%;
  width: 20%;
  border-radius: 50%;
  background-color: var(--uib-color);
  transform: scale(0);
  opacity: 0.5;
  animation: pulse0112 calc(var(--uib-speed) * 1.111) ease-in-out infinite;
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
}
.ai-loading-spinner .dot-spinner__dot:nth-child(2) {
  transform: rotate(45deg);
}
.ai-loading-spinner .dot-spinner__dot:nth-child(2)::before {
  animation-delay: calc(var(--uib-speed) * -0.875);
}
.ai-loading-spinner .dot-spinner__dot:nth-child(3) {
  transform: rotate(90deg);
}
.ai-loading-spinner .dot-spinner__dot:nth-child(3)::before {
  animation-delay: calc(var(--uib-speed) * -0.75);
}
.ai-loading-spinner .dot-spinner__dot:nth-child(4) {
  transform: rotate(135deg);
}
.ai-loading-spinner .dot-spinner__dot:nth-child(4)::before {
  animation-delay: calc(var(--uib-speed) * -0.625);
}
.ai-loading-spinner .dot-spinner__dot:nth-child(5) {
  transform: rotate(180deg);
}
.ai-loading-spinner .dot-spinner__dot:nth-child(5)::before {
  animation-delay: calc(var(--uib-speed) * -0.5);
}
.ai-loading-spinner .dot-spinner__dot:nth-child(6) {
  transform: rotate(225deg);
}
.ai-loading-spinner .dot-spinner__dot:nth-child(6)::before {
  animation-delay: calc(var(--uib-speed) * -0.375);
}
.ai-loading-spinner .dot-spinner__dot:nth-child(7) {
  transform: rotate(270deg);
}
.ai-loading-spinner .dot-spinner__dot:nth-child(7)::before {
  animation-delay: calc(var(--uib-speed) * -0.25);
}
.ai-loading-spinner .dot-spinner__dot:nth-child(8) {
  transform: rotate(315deg);
}
.ai-loading-spinner .dot-spinner__dot:nth-child(8)::before {
  animation-delay: calc(var(--uib-speed) * -0.125);
}
@keyframes pulse0112 {
  0%, 100% {
    transform: scale(0);
    opacity: 0.5;
  }
  50% {
    transform: scale(1);
    opacity: 1;
  }
}
`;
document.head.appendChild(style);

const canvasContainer = document.getElementById('canvas-container');

const MODEL_PATH = path.join(__dirname, '..', 'models', '002_amiya');
const MODEL_NAME = 'build_char_002_amiya';

const MOVING_SPEED = 80;
const MODEL_WIDTH = 150;

const ANIMATIONS = {
    'Relax': { next: ['MoveLeft', 'MoveRight', 'Sit'], weight: [0.3, 0.3, 0.4] },
    'Sit': { next: ['Relax', 'MoveLeft', 'MoveRight'], weight: [0.5, 0.25, 0.25] },
    'MoveLeft': { next: ['Relax', 'MoveRight', 'Sit'], weight: [0.4, 0.3, 0.3] },
    'MoveRight': { next: ['Relax', 'MoveLeft', 'Sit'], weight: [0.4, 0.3, 0.3] }
};

let app = null;
let spineAnimation = null;
let debugBorder = null;
let windowBorder = null;
let chatContainer = null;
let chatMessages = null;
let messageInput = null;
let sendButton = null;
let chatVisible = false;
let currentScale = 0.4;
let isDragging = false;
let isMouseDown = false;
let dragStartX = 0;
let dragStartY = 0;
let modelStartX = 0;
let modelStartY = 0;
let mouseDownX = 0;
let mouseDownY = 0;
let isUserInteracting = false;
let moveDirection = 'right';
let lastFrameTime = 0;
let moveAnimationId = null;

// Chat UI elements
let chatInputWrapper = null;
let exitChatBtn = null;
let aiBubble = null;
let aiLoadingSpinner = null;
let pendingChatAfterSetup = false;
let chatActivationInProgress = false;
let screenWidth = 1920;
let screenHeight = 1080;
let currentAnimation = null;
let animationTimer = null;

const DRAG_THRESHOLD = 5;

const CONTEXT_MENU_ITEMS = [
    { id: 'chat', label: 'Chat' },
    { id: 'schedule', label: 'Schedule' },
    { id: 'memo', label: 'Memo' },
    { id: 'reminder', label: 'Reminder' },
    { id: 'exit', label: 'Exit' }
];

let contextMenu = null;
let contextMenuVisible = false;
let contextMenuInteraction = false;

function createContextMenu() {
    if (contextMenu) return;

    contextMenu = document.createElement('div');
    contextMenu.id = 'model-context-menu';
    /* From Uiverse.io by FH638 */
    Object.assign(contextMenu.style, {
        position: 'fixed',
        zIndex: '9999',
        display: 'flex',
        flexDirection: 'column',
        width: '200px',
        backgroundColor: '#0d1117',
        justifyContent: 'center',
        borderRadius: '10px',
        transition: '1s',
        padding: '10px',
        overflow: 'hidden',
        fontFamily: 'Arial, sans-serif',
        userSelect: 'none',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
    });

    CONTEXT_MENU_ITEMS.forEach((item, index) => {
        const row = document.createElement('button');
        row.className = 'context-menu-item';
        row.textContent = item.label;
        /* From Uiverse.io by FH638 - value class styles */
        Object.assign(row.style, {
            fontSize: '15px',
            backgroundColor: 'transparent',
            border: '2px solid transparent',
            padding: '10px',
            color: 'white',
            display: 'flex',
            position: 'relative',
            gap: '5px',
            cursor: 'pointer',
            borderRadius: '10px',
            transition: '1s',
            boxSizing: 'border-box',
            textAlign: 'left',
            width: '100%',
            marginBottom: index < CONTEXT_MENU_ITEMS.length - 1 ? '4px' : '0'
        });
        
        // Add before pseudo-element for the blue indicator
        const beforeStyle = document.createElement('style');
        beforeStyle.textContent = `
            .context-menu-item::before {
                content: "";
                position: absolute;
                top: 5px;
                left: -15px;
                width: 5px;
                height: 80%;
                background-color: #2f81f7;
                border-radius: 5px;
                opacity: 0;
                transition: 1s;
            }
            .context-menu-item:hover::before,
            .context-menu-item:focus::before {
                opacity: 1;
            }
        `;
        document.head.appendChild(beforeStyle);
        
        row.addEventListener('mouseenter', () => {
            row.style.border = '2px solid #1a1f24';
            row.style.color = '#637185';
        });
        row.addEventListener('mouseleave', () => {
            row.style.border = '2px solid transparent';
            row.style.color = 'white';
            row.style.backgroundColor = 'transparent';
            row.style.marginLeft = '0';
        });
        row.addEventListener('mousedown', () => {
            row.style.backgroundColor = '#1a1f24';
            row.style.outline = 'none';
            row.style.marginLeft = '17px';
        });
        row.addEventListener('click', () => {
            onContextMenuAction(item.id);
            hideContextMenu();
        });
        contextMenu.appendChild(row);
    });
    
    // Add hover effect for the container - blur non-hovered items
    contextMenu.addEventListener('mouseover', (e) => {
        if (e.target.classList.contains('context-menu-item')) {
            const items = contextMenu.querySelectorAll('.context-menu-item');
            items.forEach(item => {
                if (item !== e.target) {
                    item.style.transition = '300ms';
                    item.style.filter = 'blur(1.5px)';
                    item.style.transform = 'scale(0.95, 0.95)';
                }
            });
        }
    });
    
    contextMenu.addEventListener('mouseout', (e) => {
        const items = contextMenu.querySelectorAll('.context-menu-item');
        items.forEach(item => {
            item.style.filter = 'none';
            item.style.transform = 'scale(1, 1)';
        });
    });

    document.body.appendChild(contextMenu);
}

function showContextMenu(x, y) {
    createContextMenu();
    stopMoving();
    if (animationTimer) {
        clearTimeout(animationTimer);
    }
    isUserInteracting = true;
    contextMenuInteraction = true;
    playAnimation('Relax', true);

    // Position context menu紧贴模型右侧 (closely attached to model's right side)
    const bounds = spineAnimation.getBounds();
    const menuX = bounds.x + bounds.width + 10; // 10px gap from model
    const menuY = bounds.y + bounds.height / 2 - 100; // Center vertically relative to model

    contextMenu.style.left = `${menuX}px`;
    contextMenu.style.top = `${Math.max(10, menuY)}px`;
    contextMenu.style.display = 'flex';
    contextMenuVisible = true;

    // Adjust if goes off screen
    const rect = contextMenu.getBoundingClientRect();
    if (rect.right > screenWidth) {
        // If too far right, show on left side of model
        contextMenu.style.left = `${Math.max(10, bounds.x - rect.width - 10)}px`;
    }
    if (rect.bottom > screenHeight) {
        contextMenu.style.top = `${Math.max(10, screenHeight - rect.height - 10)}px`;
    }
}

function hideContextMenu() {
    if (!contextMenu) return;
    contextMenu.style.display = 'none';
    contextMenuVisible = false;
    if (contextMenuInteraction) {
        contextMenuInteraction = false;
        isUserInteracting = false;
        scheduleNextAnimation();
    }
}

async function onContextMenuAction(actionId) {
    console.log('Context menu action:', actionId);
    if (actionId === 'exit') {
        hideContextMenu();
        return;
    }
    if (actionId === 'chat') {
        await enterChatWhenAIReady();
        hideContextMenu();
        return;
    }
    if (actionId === 'schedule') {
        ipcRenderer.send('open-schedule-window');
        hideContextMenu();
        return;
    }
    if (actionId === 'memo') {
        ipcRenderer.send('open-memo-window');
        hideContextMenu();
        return;
    }
    if (actionId === 'reminder') {
        ipcRenderer.send('open-reminder-window');
        hideContextMenu();
        return;
    }
    // TODO: implement actual feature behavior for each action
}

async function enterChatWhenAIReady() {
    if (chatVisible || chatActivationInProgress) return;

    chatActivationInProgress = true;
    try {
        const configResult = await ipcRenderer.invoke('ai-get-config');
        if (configResult.isFirstRun || !configResult.isConfigured || !configResult.model) {
            pendingChatAfterSetup = true;
            ipcRenderer.send('show-setup-window');
            return;
        }

        const connectionResult = await ipcRenderer.invoke('ai-test-connection', configResult);
        if (!connectionResult.success) {
            pendingChatAfterSetup = true;
            showAIBubble(connectionResult.message || 'AI service is not ready.', true);
            ipcRenderer.send('show-setup-window');
            return;
        }

        pendingChatAfterSetup = false;
        showChatUI(true, true);
    } catch (error) {
        pendingChatAfterSetup = true;
        showAIBubble(error.message || 'AI service is not ready.', true);
        ipcRenderer.send('show-setup-window');
    } finally {
        chatActivationInProgress = false;
    }
}

ipcRenderer.on('ai-setup-complete', () => {
    if (pendingChatAfterSetup) {
        enterChatWhenAIReady();
    }
});

function showChatUI(playRelaxAnimation = true, showTakeoverMessage = false) {
    if (chatVisible) return;
    chatVisible = true;
    isUserInteracting = true;

    // Switch to Relax animation and keep it (unless specified otherwise)
    if (playRelaxAnimation) {
        playAnimation('Relax', true);
    }
    // Stop any animation scheduling while in chat
    if (animationTimer) {
        clearTimeout(animationTimer);
        animationTimer = null;
    }
    if (moveAnimationId) {
        stopMoving();
    }

    // Create chat UI if not exists
    if (!chatInputWrapper) {
        createChatUI();
    }

    // Show input wrapper
    chatInputWrapper.classList.add('visible');
    exitChatBtn.classList.add('visible');

    // Position input below model
    updateChatPosition();

    // Disable mouse ignore for chat UI
    ipcRenderer.send('set-ignore-mouse-events', false);

    // Focus input
    if (messageInput) {
        messageInput.focus();
    }

    // Show takeover message if first connect, otherwise show greeting
    if (showTakeoverMessage) {
        showSystemNotification();
        // Mark as connected
        ipcRenderer.invoke('ai-mark-connected');
    } else {
        showGreeting();
    }
}

function showGreeting() {
    // Get greeting from main process
    ipcRenderer.invoke('get-greeting').then(result => {
        if (result.success) {
            showAIBubble(result.greeting);
        }
    }).catch(error => {
        // Fallback greeting
        showAIBubble('欢迎回家，博士。');
    });
}

// System notification popup (separate from chat bubble)
let systemNotification = null;

function showSystemNotification() {
    // Create notification element if not exists
    if (!systemNotification) {
        systemNotification = document.createElement('div');
        systemNotification.className = 'system-notification';
        document.body.appendChild(systemNotification);
    }

    systemNotification.innerHTML = `
        <div class="notification-content">
            <div class="notification-icon">✓</div>
            <div class="notification-text">
                <div class="notification-subtitle">干员阿米娅已接管系统</div>
            </div>
        </div>
    `;

    const iconEl = systemNotification.querySelector('.notification-icon');
    const subtitleEl = systemNotification.querySelector('.notification-subtitle');
    if (iconEl) iconEl.textContent = '✓';
    if (subtitleEl) subtitleEl.textContent = '干员阿米娅已接管系统';

    // Position notification above the model
    updateNotificationPosition();

    // Show with animation
    requestAnimationFrame(() => {
        systemNotification.classList.add('visible');
    });

    // Auto-hide after 3 seconds and show greeting
    setTimeout(() => {
        hideSystemNotification();
        setTimeout(() => showGreeting(), 300);
    }, 3000);
}

function hideSystemNotification() {
    if (systemNotification) {
        systemNotification.classList.remove('visible');
    }
}

function updateNotificationPosition() {
    if (!systemNotification || !spineAnimation) return;

    const bounds = spineAnimation.getBounds();
    const notificationWidth = systemNotification.offsetWidth || 280;
    const notificationHeight = systemNotification.offsetHeight || 80;

    // Position above the model, centered
    const left = bounds.x + bounds.width / 2 - notificationWidth / 2;
    const top = bounds.y - notificationHeight - 20;

    systemNotification.style.left = `${Math.max(10, Math.min(screenWidth - notificationWidth - 10, left))}px`;
    systemNotification.style.top = `${Math.max(10, top)}px`;
}

function hideChatUI() {
    if (!chatVisible) return;
    chatVisible = false;
    isUserInteracting = false;

    // Hide input wrapper (contains exit button now)
    if (chatInputWrapper) {
        chatInputWrapper.classList.remove('visible');
    }

    // Hide AI bubble
    hideAIBubble();

    // Hide system notification
    hideSystemNotification();

    // Hide loading spinner
    hideLoadingSpinner();

    // Clear conversation history for next chat
    ipcRenderer.invoke('clear-conversation').catch(error => {
        console.warn('Failed to clear conversation:', error);
    });

    // Re-enable mouse ignore
    ipcRenderer.send('set-ignore-mouse-events', true);

    // Reset to default animation state (Relax)
    playAnimation('Relax', true);

    // Resume animation scheduling
    scheduleNextAnimation();
}

function showAIBubble(text, isError = false) {
    if (!aiBubble) {
        aiBubble = document.createElement('div');
        aiBubble.className = 'ai-bubble';
        document.body.appendChild(aiBubble);
    }

    aiBubble.innerHTML = `<div class="bubble-text">${text}</div>`;
    aiBubble.classList.remove('loading', 'error');
    if (isError) {
        aiBubble.classList.add('error');
    }

    updateAIBubblePosition();

    // Show with animation
    requestAnimationFrame(() => {
        aiBubble.classList.add('visible');
    });
}

function createLoadingSpinner() {
    if (aiLoadingSpinner) return;

    aiLoadingSpinner = document.createElement('div');
    aiLoadingSpinner.className = 'ai-loading-spinner';

    // Create 8 dots
    for (let i = 0; i < 8; i++) {
        const dot = document.createElement('div');
        dot.className = 'dot-spinner__dot';
        aiLoadingSpinner.appendChild(dot);
    }

    document.body.appendChild(aiLoadingSpinner);
}

function showLoadingSpinner() {
    createLoadingSpinner();
    updateLoadingSpinnerPosition();
    aiLoadingSpinner.classList.add('visible');
}

function hideLoadingSpinner() {
    if (aiLoadingSpinner) {
        aiLoadingSpinner.classList.remove('visible');
    }
}

function updateLoadingSpinnerPosition() {
    if (!aiLoadingSpinner || !spineAnimation) return;

    const bounds = spineAnimation.getBounds();
    const spinnerSize = 28;

    // Position at top-right of model
    const left = bounds.x + bounds.width - spinnerSize / 2;
    const top = bounds.y - spinnerSize / 2;

    aiLoadingSpinner.style.left = `${Math.max(10, left)}px`;
    aiLoadingSpinner.style.top = `${Math.max(10, top)}px`;
}

function hideAIBubble() {
    if (aiBubble) {
        aiBubble.classList.remove('visible');
    }
}

function updateAIBubblePosition() {
    if (!aiBubble || !spineAnimation) return;

    const bounds = spineAnimation.getBounds();
    const bubbleWidth = aiBubble.offsetWidth || 200;
    const bubbleHeight = aiBubble.offsetHeight || 60;

    // Position above the model, centered horizontally
    const left = bounds.x + bounds.width / 2 - bubbleWidth / 2;
    const top = bounds.y - bubbleHeight - 15;

    aiBubble.style.left = `${Math.max(10, Math.min(screenWidth - bubbleWidth - 10, left))}px`;
    aiBubble.style.top = `${Math.max(10, top)}px`;
}

function createChatUI() {
    // Create input wrapper (positioned below model)
    chatInputWrapper = document.createElement('div');
    chatInputWrapper.className = 'chat-input-wrapper';

    // Create container for input box and exit button (horizontal layout)
    const inputContainer = document.createElement('div');
    inputContainer.style.display = 'flex';
    inputContainer.style.alignItems = 'center';

    const messageBox = document.createElement('div');
    messageBox.className = 'messageBox';

    messageInput = document.createElement('input');
    messageInput.id = 'messageInput';
    messageInput.type = 'text';
    messageInput.placeholder = '输入消息...';

    sendButton = document.createElement('button');
    sendButton.id = 'sendButton';
    sendButton.innerHTML = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M11.5003 12H5.41872M5.24634 12.7972L4.24158 15.7986C3.69128 17.4424 3.41613 18.2643 3.61359 18.7704C3.78506 19.21 4.15335 19.5432 4.6078 19.6701C5.13111 19.8161 5.92151 19.4604 7.50231 18.7491L17.6367 14.1886C19.1797 13.4942 19.9512 13.1471 20.1896 12.6648C20.3968 12.2458 20.3968 11.7541 20.1896 11.3351C19.9512 10.8529 19.1797 10.5058 17.6367 9.81135L7.48483 5.24303C5.90879 4.53382 5.12078 4.17921 4.59799 4.32468C4.14397 4.45101 3.77572 4.78336 3.60365 5.22209C3.40551 5.72728 3.67772 6.54741 4.22215 8.18767L5.24829 11.2793C5.34179 11.561 5.38855 11.7019 5.407 11.8459C5.42333 11.9738 5.42321 12.1032 5.40651 12.231C5.38768 12.375 5.34057 12.5157 5.24634 12.7972Z" stroke="#9CA3AF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
    sendButton.onclick = sendUserMessage;

    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendUserMessage();
        }
    });

    messageBox.appendChild(messageInput);
    messageBox.appendChild(sendButton);

    // Create exit chat button (now styled like input box)
    exitChatBtn = document.createElement('button');
    exitChatBtn.className = 'exit-chat-btn';
    exitChatBtn.innerHTML = '✕';
    exitChatBtn.title = '退出聊天';
    exitChatBtn.onclick = hideChatUI;

    inputContainer.appendChild(messageBox);
    inputContainer.appendChild(exitChatBtn);
    chatInputWrapper.appendChild(inputContainer);

    document.body.appendChild(chatInputWrapper);
}

function updateChatPosition() {
    if (!chatVisible || !spineAnimation) return;

    const bounds = spineAnimation.getBounds();

    // Position input wrapper below model, centered
    if (chatInputWrapper) {
        const inputWidth = chatInputWrapper.offsetWidth || 310;
        const left = bounds.x + bounds.width / 2 - inputWidth / 2;
        const top = bounds.y + bounds.height + 15;

        chatInputWrapper.style.left = `${Math.max(10, Math.min(screenWidth - inputWidth - 10, left))}px`;
        chatInputWrapper.style.top = `${Math.min(screenHeight - 60, top)}px`;
    }

    // Update AI bubble position too
    updateAIBubblePosition();

    // Update loading spinner position
    updateLoadingSpinnerPosition();

    // Update system notification position
    updateNotificationPosition();
}

function sendUserMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    messageInput.value = '';

    sendMessageToAI(message);
}

function sendMessageToAI(message) {
    // Show loading spinner at top-right of model
    showLoadingSpinner();

    ipcRenderer.invoke('ollama-generate', message).then(result => {
        hideLoadingSpinner();
        if (result.success) {
            showAIBubble(result.response);
        } else {
            showAIBubble('抱歉，连接 AI 服务失败：' + result.error, true);
        }
    }).catch(error => {
        hideLoadingSpinner();
        showAIBubble('抱歉，发生了错误：' + error.message, true);
        console.error('Ollama error:', error);
    });
}



const MOVE_ANIMATION_NAME = 'Move';

function playAnimation(name, loop = true) {
    if (!spineAnimation) return;

    let animationName = name;
    if (name === 'MoveLeft' || name === 'MoveRight') {
        animationName = MOVE_ANIMATION_NAME;
    }

    spineAnimation.state.setAnimation(0, animationName, loop);
    currentAnimation = name;
}

function setDirection(dir) {
    moveDirection = dir;
    if (spineAnimation) {
        const scaleX = Math.abs(spineAnimation.scale.x);
        spineAnimation.scale.x = dir === 'left' ? -scaleX : scaleX;
    }
}

function isAtLeftEdge(bounds) {
    return bounds.x <= 0;
}

function isAtRightEdge(bounds) {
    return bounds.x + bounds.width >= screenWidth;
}

function handleEdgeCollision(bounds) {
    // Don't change animation if in chat mode
    if (chatVisible) {
        stopMoving();
        return;
    }

    const shouldRelax = Math.random() < 0.5;
    if (shouldRelax) {
        playAnimation('Relax', true);
        stopMoving();
        return;
    }

    const nextDirection = moveDirection === 'right' ? 'left' : 'right';
    setDirection(nextDirection);
    const nextAnimation = nextDirection === 'left' ? 'MoveLeft' : 'MoveRight';
    playAnimation(nextAnimation, true);
}

function updateDebugBorder() {
    if (!debugBorder || !spineAnimation) return;

    const bounds = spineAnimation.getBounds();
    debugBorder.clear();
    debugBorder.lineStyle(2, 0xff0000, 1);
    debugBorder.drawRect(bounds.x, bounds.y, bounds.width, bounds.height);
}

function getNextAnimation(current) {
    const transitions = ANIMATIONS[current];
    if (!transitions) {
        return 'Relax';
    }

    const rand = Math.random();
    let sum = 0;
    for (let i = 0; i < transitions.next.length; i++) {
        sum += transitions.weight[i];
        if (rand < sum) {
            return transitions.next[i];
        }
    }
    return transitions.next[0];
}

function scheduleNextAnimation() {
    if (animationTimer) {
        clearTimeout(animationTimer);
    }

    // Don't schedule next animation if in chat mode
    if (chatVisible) {
        return;
    }

    const duration = 3000 + Math.random() * 4000;
    animationTimer = setTimeout(() => {
        // Double check chatVisible and isUserInteracting
        if (chatVisible || isUserInteracting) {
            return;
        }

        const nextAnim = getNextAnimation(currentAnimation || 'Relax');

        if (nextAnim === 'MoveLeft') {
            setDirection('left');
            playAnimation('MoveLeft', true);
            startMoving();
        } else if (nextAnim === 'MoveRight') {
            setDirection('right');
            playAnimation('MoveRight', true);
            startMoving();
        } else {
            stopMoving();
            playAnimation(nextAnim, true);
        }

        scheduleNextAnimation();
    }, duration);
}

function startMoving() {
    if (moveAnimationId) return;

    lastFrameTime = Date.now();

    const moveStep = () => {
        // Stop moving if in chat mode or user interacting
        if (chatVisible || isUserInteracting) {
            moveAnimationId = null;
            return;
        }

        const now = Date.now();
        const delta = (now - lastFrameTime) / 1000;
        lastFrameTime = now;

        const movement = MOVING_SPEED * delta;

        const bounds = spineAnimation.getBounds();
        if (moveDirection === 'right') {
            spineAnimation.x += movement;
            const newBounds = spineAnimation.getBounds();
            if (isAtRightEdge(newBounds)) {
                spineAnimation.x -= Math.max(0, newBounds.x + newBounds.width - screenWidth);
                handleEdgeCollision(newBounds);
            }
        } else {
            spineAnimation.x -= movement;
            const newBounds = spineAnimation.getBounds();
            if (isAtLeftEdge(newBounds)) {
                spineAnimation.x += Math.max(0, 0 - newBounds.x);
                handleEdgeCollision(newBounds);
            }
        }

        if (currentAnimation !== 'MoveLeft' && currentAnimation !== 'MoveRight') {
            stopMoving();
            return;
        }

        moveAnimationId = requestAnimationFrame(moveStep);
        updateDebugBorder();
    };

    moveAnimationId = requestAnimationFrame(moveStep);
}

function stopMoving() {
    if (moveAnimationId) {
        cancelAnimationFrame(moveAnimationId);
        moveAnimationId = null;
    }
}

function isPointInModel(x, y) {
    if (!spineAnimation) return false;
    const bounds = spineAnimation.getBounds();
    return x >= bounds.x && x <= bounds.x + bounds.width &&
           y >= bounds.y && y <= bounds.y + bounds.height;
}

function updateMouseIgnore(x, y) {
    if (!spineAnimation) return;
    // Don't change mouse ignore state when chat or context menu is visible
    if (chatVisible || contextMenuVisible) {
        ipcRenderer.send('set-ignore-mouse-events', false);
        return;
    }
    const inModel = isPointInModel(x, y);
    ipcRenderer.send('set-ignore-mouse-events', !inModel);
    if (inModel) {
        canvasContainer.classList.add('interactive');
    } else {
        canvasContainer.classList.remove('interactive');
    }
}

function initDrag() {
    document.addEventListener('mousemove', (e) => {
        if (!spineAnimation) return;
        updateMouseIgnore(e.clientX, e.clientY);

        if (!isDragging) return;

        const deltaX = e.clientX - dragStartX;
        const deltaY = e.clientY - dragStartY;

        spineAnimation.x = modelStartX + deltaX;
        spineAnimation.y = modelStartY + deltaY;

        if (spineAnimation.x < MODEL_WIDTH) spineAnimation.x = MODEL_WIDTH;
        if (spineAnimation.x > screenWidth - MODEL_WIDTH) spineAnimation.x = screenWidth - MODEL_WIDTH;
        if (spineAnimation.y < MODEL_WIDTH) spineAnimation.y = MODEL_WIDTH;
        if (spineAnimation.y > screenHeight - MODEL_WIDTH) spineAnimation.y = screenHeight - MODEL_WIDTH;

        updateDebugBorder();
        updateChatPosition(); // Update chat position when dragging
    });

    canvasContainer.addEventListener('mousedown', (e) => {
        if (!spineAnimation) return;
        if (e.button !== 0) return;

        if (contextMenuVisible) {
            hideContextMenu();
            return;
        }

        if (!isPointInModel(e.clientX, e.clientY)) {
            hideContextMenu();
            return;
        }

        isMouseDown = true;
        mouseDownX = e.clientX;
        mouseDownY = e.clientY;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        modelStartX = spineAnimation.x;
        modelStartY = spineAnimation.y;
    });

    canvasContainer.addEventListener('contextmenu', (e) => {
        if (!spineAnimation) return;
        if (isPointInModel(e.clientX, e.clientY)) {
            e.preventDefault();
            showContextMenu(e.clientX, e.clientY);
        } else {
            hideContextMenu();
        }
    });

    document.addEventListener('mousedown', (e) => {
        if (contextMenuVisible && contextMenu && !contextMenu.contains(e.target)) {
            hideContextMenu();
        }
    });

    document.addEventListener('mouseup', (e) => {
        if (!isMouseDown) return;

        const moveDistance = Math.sqrt(
            Math.pow(e.clientX - mouseDownX, 2) +
            Math.pow(e.clientY - mouseDownY, 2)
        );

        if (!isDragging && moveDistance < DRAG_THRESHOLD) {
            stopMoving();
            if (animationTimer) {
                clearTimeout(animationTimer);
            }

            // If in chat mode, just focus input
            if (chatVisible) {
                if (messageInput) {
                    messageInput.focus();
                }
            } else {
                // Left click: just play Interact animation once, don't enter chat
                isUserInteracting = true;
                playAnimation('Interact', false);

                spineAnimation.state.addListener({
                    complete: (trackEntry) => {
                        if (trackEntry.animation.name === 'Interact') {
                            playAnimation('Relax', true);
                            isUserInteracting = false;
                            scheduleNextAnimation();
                        }
                    }
                });
            }
        } else if (isDragging) {
            stopMoving();
            // Keep Relax animation if in chat mode
            if (!chatVisible) {
                playAnimation('Relax', true);
                isUserInteracting = false;
                scheduleNextAnimation();
            }
        }

        isDragging = false;
        isMouseDown = false;
    });

    document.addEventListener('mousemove', (e) => {
        if (!isMouseDown) return;

        const moveDistance = Math.sqrt(
            Math.pow(e.clientX - mouseDownX, 2) +
            Math.pow(e.clientY - mouseDownY, 2)
        );

        if (moveDistance >= DRAG_THRESHOLD && !isDragging) {
            isDragging = true;
            isUserInteracting = true;
            stopMoving();
            if (animationTimer) {
                clearTimeout(animationTimer);
            }
            // Keep Relax animation during drag in chat mode
            playAnimation('Relax', true);
        }
    });
}

async function initPixi() {
    screenWidth = window.innerWidth;
    screenHeight = window.innerHeight;

    app = new PIXI.Application({
        width: screenWidth,
        height: screenHeight,
        backgroundColor: 0x000000,
        backgroundAlpha: 0,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        transparent: true
    });

    canvasContainer.appendChild(app.view);

    initDrag();
    await loadSpineModel();
}

async function loadSpineModel() {
    const skelPath = path.join(MODEL_PATH, `${MODEL_NAME}.skel`);
    const atlasPath = path.join(MODEL_PATH, `${MODEL_NAME}.atlas`);
    const pngPath = path.join(MODEL_PATH, `${MODEL_NAME}.png`);

    if (!fs.existsSync(skelPath)) {
        console.error(`Skeleton file not found: ${skelPath}`);
        return;
    }
    if (!fs.existsSync(atlasPath)) {
        console.error(`Atlas file not found: ${atlasPath}`);
        return;
    }
    if (!fs.existsSync(pngPath)) {
        console.error(`Texture file not found: ${pngPath}`);
        return;
    }

    try {
        const atlasData = fs.readFileSync(atlasPath, 'utf-8');
        const textureData = fs.readFileSync(pngPath);
        const skeletonData = fs.readFileSync(skelPath);

        const textureBase64 = textureData.toString('base64');
        const textureUrl = `data:image/png;base64,${textureBase64}`;

        const baseTexture = PIXI.BaseTexture.from(textureUrl);
        const texture = new PIXI.Texture(baseTexture);

        const textureAtlas = new TextureAtlas(atlasData, (line, callback) => {
            callback(texture.baseTexture);
        });

        const atlasLoader = new AtlasAttachmentLoader(textureAtlas);
        const skeletonBinary = new SkeletonBinary(atlasLoader);
        skeletonBinary.scale = currentScale;

        const skeletonDataParsed = skeletonBinary.readSkeletonData(new Uint8Array(skeletonData));

        spineAnimation = new Spine(skeletonDataParsed);

        spineAnimation.x = screenWidth / 2;
        spineAnimation.y = screenHeight - 80;

        spineAnimation.scale.set(1, 1);

        app.stage.addChild(spineAnimation);

        debugBorder = new PIXI.Graphics();
        app.stage.addChild(debugBorder);
        updateDebugBorder();

        windowBorder = new PIXI.Graphics();
        windowBorder.lineStyle(1, 0xffffff, 0.5);
        windowBorder.drawRect(0, 0, screenWidth, screenHeight);
        app.stage.addChild(windowBorder);

        playAnimation('Relax', true);
        setDirection(moveDirection);
        // Only start animation scheduling if not in chat mode
        if (!chatVisible) {
            scheduleNextAnimation();
        }

    } catch (error) {
        console.error(`Error loading model: ${error.message}`);
    }
}

document.addEventListener('DOMContentLoaded', initPixi);

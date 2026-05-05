/**
 * Renderer Entry Point
 * Main entry point for the renderer process
 */

// Fix __dirname for Electron renderer when loaded via <script src>
// When loaded via <script src>, __dirname points to HTML file location
// We need to get the actual script directory
const path = require('path');
const scriptUrl = document.currentScript ? document.currentScript.src : '';
let scriptDir;
if (scriptUrl && scriptUrl.startsWith('file://')) {
    // Handle Windows file:// URL format (file:///C:/... or file://C:/...)
    let scriptPath = scriptUrl.replace('file://', '');
    // Remove leading slash if it's a Windows path (e.g., /E:/...)
    if (scriptPath.match(/^\/[A-Za-z]:\//)) {
        scriptPath = scriptPath.substring(1);
    }
    scriptPath = decodeURIComponent(scriptPath);
    scriptDir = path.dirname(scriptPath);
    global.__dirname = scriptDir;
    console.log('[Renderer] Script directory:', scriptDir);
} else {
    scriptDir = __dirname;
    console.log('[Renderer] Using default __dirname:', scriptDir);
}

const originalWarn = console.warn;
console.warn = function(...args) {
    const msg = args[0];
    if (typeof msg === 'string' && msg.includes('PixiJS Deprecation Warning')) {
        return;
    }
    originalWarn.apply(console, args);
};

const { ipcRenderer } = require('electron');
const PIXI = require('pixi.js');

// Use absolute paths for module requires
const {
    GREETING_BUBBLE_DURATION_MS,
    CHAT_BUBBLE_DURATION_MS,
    CONTEXT_MENU_ITEMS,
    CHARACTER_CONFIGS
} = require(path.join(scriptDir, '..', 'shared', 'constants'));

const { AmiyaCharacter, TexasCharacter, KaltsitCharacter, Texas2Character } = require(path.join(scriptDir, '..', 'characters'));
const { DragHandler } = require(path.join(scriptDir, 'drag-handler'));
const chatUI = require(path.join(scriptDir, 'chat-ui'));
const contextMenu = require(path.join(scriptDir, 'context-menu'));
const operatorPanel = require(path.join(scriptDir, 'operator-panel'));
const notification = require(path.join(scriptDir, 'notification'));

const canvasContainer = document.getElementById('canvas-container');

let app = null;
let amiya = null;
let characters = {};
let screenWidth = 1920;
let screenHeight = 1080;
let startupGreetingShown = false;

let chatVisible = false;
let isUserInteracting = false;
let pendingChatAfterSetup = false;
let chatActivationInProgress = false;

let chatInputWrapper = null;
let exitChatBtn = null;
let aiBubble = null;
let aiBubbleHideTimer = null;
let aiLoadingSpinner = null;
let messageInput = null;
let sendButton = null;
let systemNotification = null;

let contextMenuVisible = false;
let contextMenuInteraction = false;
let selectedOperators = new Set();

// Use scriptDir for reliable path resolution in Electron renderer
// scriptDir points to scripts/renderer/, so we need to go up 2 levels to reach project root
const modelsBasePath = path.join(scriptDir, '..', '..', 'Models');

function initCSS() {
    const style = document.createElement('style');
    style.textContent = chatUI.getStyles();
    document.head.appendChild(style);
}

function isSleepTime(date = new Date()) {
    const hour = date.getHours();
    return hour >= 23 || hour < 7;
}

function getDefaultIdleAnimation() {
    return isSleepTime() ? 'Sleep' : 'Relax';
}

function getTimeGreeting(date = new Date()) {
    const hour = date.getHours();
    if (hour >= 23 || hour < 7) return '博士，夜深了，早点休息吧。';
    if (hour < 11) return '博士，早上好！';
    if (hour < 14) return '博士，中午好！';
    if (hour < 18) return '博士，下午好！';
    return '博士，晚上好！';
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

    await loadAmiya();
    initDragHandler();
}

async function loadAmiya() {
    console.log('[Renderer] Loading Amiya character...');
    console.log('[Renderer] Models base path:', modelsBasePath);
    
    try {
        amiya = new AmiyaCharacter({
            app,
            screenWidth,
            screenHeight,
            modelsBasePath,
            startX: screenWidth / 2,
            startY: screenHeight - 80
        });

        console.log('[Renderer] AmiyaCharacter instance created');
        await amiya.load();
        console.log('[Renderer] Amiya model loaded successfully');
        
        amiya.show();
        characters.amiya = amiya;

        showStartupGreeting();
        amiya.scheduleNextAnimation(chatVisible);
    } catch (error) {
        console.error('[Renderer] Failed to load Amiya:', error);
        console.error('[Renderer] Error stack:', error.stack);
    }
}

function initDragHandler() {
    const dragHandler = new DragHandler({
        getCharacter: (id) => characters[id],
        getCharacters: () => Object.values(characters).filter(c => c && c.isEnabled),
        chatVisible: () => chatVisible,
        focusChatInput: () => messageInput?.focus(),
        onUpdateMouseIgnore: updateMouseIgnore,
        onDragStart: (id, char) => {
            isUserInteracting = true;
            char.stopMoving();
            if (char.animationTimer) {
                clearTimeout(char.animationTimer);
                char.animationTimer = null;
            }
            char.playAnimation(chatVisible ? 'Relax' : getDefaultIdleAnimation(), true);
        },
        onDragMove: (id, char) => {
            updateChatPosition();
        },
        onDragEnd: (id, char) => {
            if (!chatVisible) {
                char.playAnimation(getDefaultIdleAnimation(), true);
                isUserInteracting = false;
                char.scheduleNextAnimation(chatVisible);
            }
        },
        onClick: (id, char) => {
            if (chatVisible && id === 'amiya') {
                messageInput?.focus();
            } else {
                char.stopMoving();
                if (char.animationTimer) {
                    clearTimeout(char.animationTimer);
                    char.animationTimer = null;
                }
                char.playInteract(() => {
                    char.scheduleNextAnimation(chatVisible);
                });
            }
        }
    });

    dragHandler.attach(canvasContainer);

    canvasContainer.addEventListener('contextmenu', (e) => {
        if (amiya && amiya.isPointInside(e.clientX, e.clientY)) {
            e.preventDefault();
            showContextMenu(e.clientX, e.clientY);
        } else {
            hideContextMenu();
        }
    });
}

function updateMouseIgnore(x, y) {
    if (!amiya) return;
    if (chatVisible || contextMenuVisible) {
        ipcRenderer.send('set-ignore-mouse-events', false);
        return;
    }
    const inModel = Object.values(characters).some(c => c && c.isPointInside && c.isPointInside(x, y));
    ipcRenderer.send('set-ignore-mouse-events', !inModel);
    if (inModel) {
        canvasContainer.classList.add('interactive');
    } else {
        canvasContainer.classList.remove('interactive');
    }
}

function showStartupGreeting() {
    if (startupGreetingShown || chatVisible) return;
    startupGreetingShown = true;
    setTimeout(() => {
        if (!chatVisible && amiya) {
            showAIBubble(getTimeGreeting(), false, GREETING_BUBBLE_DURATION_MS);
        }
    }, 700);
}

function showContextMenu(x, y) {
    if (!amiya) return;
    
    amiya.stopMoving();
    if (amiya.animationTimer) {
        clearTimeout(amiya.animationTimer);
    }
    isUserInteracting = true;
    contextMenuInteraction = true;
    amiya.playAnimation(getDefaultIdleAnimation(), true);

    const bounds = amiya.getBounds();
    const menuX = bounds.x + bounds.width + 10;
    const menuY = bounds.y + bounds.height / 2 - 100;

    contextMenu.show(menuX, menuY, {
        screenWidth,
        screenHeight,
        items: CONTEXT_MENU_ITEMS,
        onAction: onContextMenuAction,
        bounds: bounds
    });
    contextMenuVisible = true;
}

function hideContextMenu() {
    contextMenu.hide();
    contextMenuVisible = false;
    operatorPanel.hide();
    if (contextMenuInteraction) {
        contextMenuInteraction = false;
        isUserInteracting = false;
        amiya?.scheduleNextAnimation(chatVisible);
    }
}

async function onContextMenuAction(actionId) {
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
        ipcRenderer.send('open-schedule');
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
    if (actionId === 'operators') {
        showOperatorPanel();
        return;
    }
}

function showOperatorPanel() {
    const operators = [
        { id: 'texas', name: 'Texas', checked: selectedOperators.has('texas') },
        { id: 'kalts', name: "Kal'tsit", checked: selectedOperators.has('kalts') },
        { id: 'texas2', name: 'Texas the Omertosa', checked: selectedOperators.has('texas2') }
    ];

    operatorPanel.show({
        operators,
        onToggle: async (operatorId, checked) => {
            try {
                if (checked) {
                    await showOperatorCharacter(operatorId);
                } else {
                    hideOperatorCharacter(operatorId);
                }
            } catch (error) {
                console.error(`[Renderer] Error toggling operator ${operatorId}:`, error);
                operatorPanel.setSelectedOperator(operatorId, !checked);
            }
        },
        position: contextMenu.getElement()?.getBoundingClientRect(),
        screenWidth,
        screenHeight
    });
}

async function showOperatorCharacter(operatorId) {
    if (characters[operatorId]) {
        characters[operatorId].show();
        selectedOperators.add(operatorId);
        return true;
    }

    const config = CHARACTER_CONFIGS[operatorId];
    if (!config) {
        console.error(`[Renderer] Character config not found for: ${operatorId}`);
        return false;
    }

    let CharacterClass;
    switch (operatorId) {
        case 'texas':
            CharacterClass = TexasCharacter;
            break;
        case 'kalts':
            CharacterClass = KaltsitCharacter;
            break;
        case 'texas2':
            CharacterClass = Texas2Character;
            break;
        default:
            console.error(`[Renderer] Unknown character class for: ${operatorId}`);
            return false;
    }

    // 计算分散的位置
    const existingCount = Object.keys(characters).length;
    const spacing = 300;
    const totalWidth = existingCount * spacing;
    const startX = (screenWidth / 2) - (totalWidth / 2) + (existingCount * spacing) - spacing/2 + (Math.random() - 0.5) * 30;
    const startY = screenHeight - 80;

    console.log(`[Renderer] Creating ${operatorId} at position (${startX}, ${startY})`);

    const char = new CharacterClass({
        app,
        screenWidth,
        screenHeight,
        modelsBasePath,
        startX,
        startY
    });

    try {
        console.log(`[Renderer] Loading ${operatorId} model...`);
        await char.load();
        console.log(`[Renderer] ${operatorId} model loaded successfully`);

        char.show();
        characters[operatorId] = char;
        selectedOperators.add(operatorId);

        console.log(`[Renderer] ${operatorId} character shown successfully`);
        return true;
    } catch (error) {
        console.error(`[Renderer] Failed to load ${operatorId}:`, error.message);
        console.error('[Renderer] Error stack:', error.stack);
        return false;
    }
}

function hideOperatorCharacter(operatorId) {
    console.log(`[Renderer] Hiding operator: ${operatorId}`);
    if (characters[operatorId]) {
        characters[operatorId].hide();
        delete characters[operatorId];
        selectedOperators.delete(operatorId);
        console.log(`[Renderer] Operator ${operatorId} hidden and removed`);
    } else {
        console.log(`[Renderer] Operator ${operatorId} not found in characters`);
    }
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

    if (playRelaxAnimation && amiya) {
        amiya.playAnimation('Relax', true);
    }
    if (amiya) {
        amiya.stopMoving();
        if (amiya.animationTimer) {
            clearTimeout(amiya.animationTimer);
            amiya.animationTimer = null;
        }
    }

    if (!chatInputWrapper) {
        createChatUI();
    }

    chatInputWrapper.classList.add('visible');
    exitChatBtn.classList.add('visible');
    updateChatPosition();
    ipcRenderer.send('set-ignore-mouse-events', false);
    messageInput?.focus();

    if (showTakeoverMessage) {
        showSystemNotification();
        ipcRenderer.invoke('ai-mark-connected');
    } else {
        showGreeting();
    }
}

function showGreeting() {
    ipcRenderer.invoke('get-greeting').then(result => {
        if (result.success) {
            showAIBubble(result.greeting, false, GREETING_BUBBLE_DURATION_MS);
        }
    }).catch(() => {
        showAIBubble('欢迎回家，博士。', false, GREETING_BUBBLE_DURATION_MS);
    });
}

function showSystemNotification() {
    hideAIBubble();

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

    updateNotificationPosition();

    requestAnimationFrame(() => {
        systemNotification.classList.add('visible');
    });

    setTimeout(() => {
        hideSystemNotification();
        setTimeout(() => showGreeting(), 500);
    }, 3000);
}

function hideSystemNotification() {
    if (systemNotification) {
        systemNotification.classList.remove('visible');
    }
}

function updateNotificationPosition() {
    if (!systemNotification || !amiya) return;

    const bounds = amiya.getBounds();
    if (!bounds) return;

    const notificationWidth = systemNotification.offsetWidth || 280;
    const notificationHeight = systemNotification.offsetHeight || 80;

    const left = bounds.x + bounds.width / 2 - notificationWidth / 2;
    const top = bounds.y - notificationHeight - 20;

    systemNotification.style.left = `${Math.max(10, Math.min(screenWidth - notificationWidth - 10, left))}px`;
    systemNotification.style.top = `${Math.max(10, top)}px`;
}

function hideChatUI() {
    if (!chatVisible) return;
    chatVisible = false;
    isUserInteracting = false;

    chatInputWrapper?.classList.remove('visible');
    hideAIBubble();
    hideSystemNotification();
    hideLoadingSpinner();

    ipcRenderer.invoke('clear-conversation').catch(() => {});
    ipcRenderer.send('set-ignore-mouse-events', true);

    if (amiya) {
        amiya.playAnimation(getDefaultIdleAnimation(), true);
        amiya.scheduleNextAnimation(chatVisible);
    }
}

function showAIBubble(text, isError = false, autoHideMs = 0) {
    if (!aiBubble) {
        aiBubble = document.createElement('div');
        aiBubble.className = 'ai-bubble';
        document.body.appendChild(aiBubble);
    }

    if (aiBubbleHideTimer) {
        clearTimeout(aiBubbleHideTimer);
        aiBubbleHideTimer = null;
    }

    aiBubble.innerHTML = '';
    const bubbleText = document.createElement('div');
    bubbleText.className = 'bubble-text';
    bubbleText.textContent = text;
    aiBubble.appendChild(bubbleText);
    aiBubble.classList.remove('loading', 'error');
    if (isError) {
        aiBubble.classList.add('error');
    }

    updateAIBubblePosition();

    requestAnimationFrame(() => {
        aiBubble.classList.add('visible');
    });

    if (autoHideMs > 0) {
        aiBubbleHideTimer = setTimeout(() => {
            hideAIBubble();
            aiBubbleHideTimer = null;
        }, autoHideMs);
    }
}

function hideAIBubble() {
    if (aiBubbleHideTimer) {
        clearTimeout(aiBubbleHideTimer);
        aiBubbleHideTimer = null;
    }
    aiBubble?.classList.remove('visible');
}

function updateAIBubblePosition() {
    if (!aiBubble || !amiya) return;

    const bounds = amiya.getBounds();
    if (!bounds) return;

    const bubbleWidth = aiBubble.offsetWidth || 200;
    const bubbleHeight = aiBubble.offsetHeight || 60;

    const left = bounds.x + bounds.width / 2 - bubbleWidth / 2;
    const top = bounds.y - bubbleHeight - 15;

    aiBubble.style.left = `${Math.max(10, Math.min(screenWidth - bubbleWidth - 10, left))}px`;
    aiBubble.style.top = `${Math.max(10, top)}px`;
}

function createLoadingSpinner() {
    if (aiLoadingSpinner) return;

    aiLoadingSpinner = document.createElement('div');
    aiLoadingSpinner.className = 'ai-loading-spinner';
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
    aiLoadingSpinner?.classList.remove('visible');
}

function updateLoadingSpinnerPosition() {
    if (!aiLoadingSpinner || !amiya) return;

    const bounds = amiya.getBounds();
    if (!bounds) return;

    const spinnerSize = 28;

    const left = bounds.x + bounds.width - spinnerSize / 2;
    const top = bounds.y - spinnerSize / 2;

    aiLoadingSpinner.style.left = `${Math.max(10, left)}px`;
    aiLoadingSpinner.style.top = `${Math.max(10, top)}px`;
}

function createChatUI() {
    chatInputWrapper = document.createElement('div');
    chatInputWrapper.className = 'chat-input-wrapper';

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
        if (e.key === 'Enter') sendUserMessage();
    });

    messageBox.appendChild(messageInput);
    messageBox.appendChild(sendButton);

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
    if (!chatVisible || !amiya) return;

    const bounds = amiya.getBounds();
    if (!bounds) return;

    if (chatInputWrapper) {
        const inputWidth = chatInputWrapper.offsetWidth || 310;
        const left = bounds.x + bounds.width / 2 - inputWidth / 2;
        const top = bounds.y + bounds.height + 15;

        chatInputWrapper.style.left = `${Math.max(10, Math.min(screenWidth - inputWidth - 10, left))}px`;
        chatInputWrapper.style.top = `${Math.min(screenHeight - 60, top)}px`;
    }

    updateAIBubblePosition();
    updateLoadingSpinnerPosition();
    updateNotificationPosition();
}

function sendUserMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    messageInput.value = '';
    sendMessageToAI(message);
}

function sendMessageToAI(message) {
    showLoadingSpinner();

    ipcRenderer.invoke('ollama-generate', message).then(result => {
        hideLoadingSpinner();
        if (result.success) {
            showAIBubble(result.response, false, CHAT_BUBBLE_DURATION_MS);
        } else {
            showAIBubble('抱歉，连接 AI 服务失败：' + result.error, true, CHAT_BUBBLE_DURATION_MS);
        }
    }).catch(error => {
        hideLoadingSpinner();
        showAIBubble('抱歉，发生了错误：' + error.message, true, CHAT_BUBBLE_DURATION_MS);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initCSS();
    initPixi();
});

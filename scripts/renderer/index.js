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
const fs = require('fs');
const PIXI = require('pixi.js');

// Use absolute paths for module requires
const {
    GREETING_BUBBLE_DURATION_MS,
    CHAT_BUBBLE_DURATION_MS,
    CONTEXT_MENU_ITEMS,
    CHARACTER_CONFIGS,
    MODEL_NAMES
} = require(path.join(scriptDir, '..', 'shared', 'constants'));

const { AmiyaCharacter, TexasCharacter, KaltsitCharacter } = require(path.join(scriptDir, '..', 'characters'));
const { DragHandler } = require(path.join(scriptDir, 'drag-handler'));
const chatUI = require(path.join(scriptDir, 'chat-ui'));
const contextMenu = require(path.join(scriptDir, 'context-menu'));
const operatorPanel = require(path.join(scriptDir, 'operator-panel'));
const notification = require(path.join(scriptDir, 'notification'));
const { DialogRendererIntegration } = require(path.join(scriptDir, 'dialog-integration'));

const canvasContainer = document.getElementById('canvas-container');

let app = null;
let amiya = null;
let characters = {};
let screenWidth = 1920;
let screenHeight = 1080;
let startupGreetingShown = false;
let dialogIntegration = null;

let chatVisible = false;
let isUserInteracting = false;
let pendingChatAfterSetup = false;
let chatActivationInProgress = false;
let contextMenuTargetId = null;
let texasSkin = 'default';
let fileManagementMode = false;

const TEXAS_SKIN_OPTIONS = [
    {
        id: 'default',
        label: 'Default Skin',
        modelFolder: '102_Texas',
        modelName: MODEL_NAMES.texas
    },
    {
        id: 'ep7',
        label: 'Texas Epoque #7',
        modelFolder: '102_Texas Epoque #7',
        modelName: 'build_char_102_texas_epoque#7'
    }
];

function resolveSkinModelPath(skin) {
    const modelName = skin.modelName;
    const folder = skin.modelFolder;
    const candidates = [
        path.join(modelsBasePath, folder),
        path.join(modelsBasePath, folder.replace(/^Models/i, 'models'))
    ];

    if (process && process.resourcesPath) {
        const resourcesPath = process.resourcesPath;
        candidates.push(
            path.join(resourcesPath, 'app.asar', folder),
            path.join(resourcesPath, 'app.asar', 'Models', folder),
            path.join(resourcesPath, 'app.asar', 'models', folder),
            path.join(resourcesPath, 'app.asar.unpacked', folder),
            path.join(resourcesPath, 'app.asar.unpacked', 'Models', folder),
            path.join(resourcesPath, 'app.asar.unpacked', 'models', folder),
            path.join(resourcesPath, 'Models', folder),
            path.join(resourcesPath, 'models', folder),
            path.join(resourcesPath, '..', 'resources', folder),
            path.join(resourcesPath, '..', 'resources', 'Models', folder),
            path.join(resourcesPath, '..', 'resources', 'models', folder)
        );
    }

    for (const candidate of candidates) {
        const skelPath = path.join(candidate, `${modelName}.skel`);
        const atlasPath = path.join(candidate, `${modelName}.atlas`);
        const pngPath = path.join(candidate, `${modelName}.png`);
        if (fs.existsSync(skelPath) && fs.existsSync(atlasPath) && fs.existsSync(pngPath)) {
            return candidate;
        }
    }
    return null;
}

function isTexasSkinAvailable(skin) {
    return Boolean(resolveSkinModelPath(skin));
}

function getDefaultTexasSkin() {
    return TEXAS_SKIN_OPTIONS.find((skin) => isTexasSkinAvailable(skin)) || TEXAS_SKIN_OPTIONS[0];
}

function getAvailableTexasSkins() {
    return TEXAS_SKIN_OPTIONS.map((skin) => ({
        ...skin,
        available: isTexasSkinAvailable(skin)
    }));
}

let chatInputWrapper = null;
let exitChatBtn = null;
let aiBubble = null;
let aiBubbleHideTimer = null;
let aiBubbleTargetId = null;
let aiLoadingSpinner = null;
let messageInput = null;
let sendButton = null;
let systemNotification = null;

let contextMenuVisible = false;
let contextMenuInteraction = false;
let selectedOperators = new Set();
let loadingOperators = new Set(); // Track operators currently loading/unloading

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
    initDialogSystem();
}

async function initDialogSystem() {
    try {
        dialogIntegration = new DialogRendererIntegration();
        await dialogIntegration.initialize(scriptDir);
        
        if (amiya) {
            dialogIntegration.registerCharacter('amiya', amiya);
        }
        
        for (const [charId, char] of Object.entries(characters)) {
            if (char && char !== amiya) {
                dialogIntegration.registerCharacter(charId, char);
            }
        }
        
        dialogIntegration.start();
        
        setInterval(() => {
            if (dialogIntegration) {
                dialogIntegration.checkTimeAndUpdate();
            }
        }, 60000);
        
        setInterval(() => {
            if (dialogIntegration) {
                for (const [charId, char] of Object.entries(characters)) {
                    if (char && char.isEnabled && !char.isUserInteracting) {
                        dialogIntegration.updateCharacterPosition(charId, char);
                    }
                }
            }
        }, 1000);
        
        console.log('[Renderer] Dialog system initialized and started');
    } catch (error) {
        console.error('[Renderer] Failed to initialize dialog system:', error);
    }
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
            if (dialogIntegration) {
                dialogIntegration.updateCharacterPosition(id, char);
            }
        },
        onDragEnd: (id, char) => {
            if (!chatVisible) {
                char.playAnimation(getDefaultIdleAnimation(), true);
                isUserInteracting = false;
                char.scheduleNextAnimation(chatVisible);
            }
        },
        onClick: (id, char) => {
            if (fileManagementMode && id === 'texas') {
                showAIBubble('请将文件拖拽到我身上进行整理', false, 3000);
                return;
            }
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
        const { charId, character, bounds } = getCharacterAtPoint(e.clientX, e.clientY) || {};
        if (character && bounds) {
            e.preventDefault();
            contextMenuTargetId = charId;
            hideContextMenu();
            showContextMenu(e.clientX, e.clientY, charId, bounds);
        } else {
            hideContextMenu();
        }
    });
    
    canvasContainer.addEventListener('dragover', (e) => {
        if (!fileManagementMode) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });
    
    canvasContainer.addEventListener('drop', async (e) => {
        if (!fileManagementMode) return;
        
        e.preventDefault();
        
        const { charId } = getCharacterAtPoint(e.clientX, e.clientY) || {};
        if (charId !== 'texas') {
            showAIBubble('请将文件拖拽到 Texas 身上', false, 2000);
            return;
        }
        
        const files = [];
        const items = e.dataTransfer.items;
        
        if (items) {
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.kind === 'file') {
                    const file = item.getAsFile();
                    if (file && file.path) {
                        files.push(file.path);
                    }
                }
            }
        }
        
        const fileList = e.dataTransfer.files;
        if (fileList) {
            for (let i = 0; i < fileList.length; i++) {
                const file = fileList[i];
                if (file.path && !files.includes(file.path)) {
                    files.push(file.path);
                }
            }
        }
        
        console.log('[Renderer] Dropped files:', files);
        
        if (files.length === 0) {
            showAIBubble('未检测到有效文件', false, 2000);
            return;
        }
        
        showAIBubble(`检测到 ${files.length} 个文件，正在整理...`, false, 0);
        
        const organizeResult = await ipcRenderer.invoke('file-manager-organize-files', files);
        
        if (organizeResult.success && organizeResult.moved.length > 0) {
            const categorySummary = Object.entries(organizeResult.categories)
                .map(([cat, f]) => `${cat}: ${f.length}个`)
                .join(', ');
            showAIBubble(`整理完成！已移动 ${organizeResult.moved.length} 个文件（${categorySummary}）。按 Esc 退出。`, false, 4000);
            
            // Easter egg: Play Special animation if Texas is using Epoque #7 skin
            if (texasSkin === 'ep7' && characters.texas) {
                const texas = characters.texas;
                texas.isUserInteracting = true;
                if (texas.animationTimer) {
                    clearTimeout(texas.animationTimer);
                    texas.animationTimer = null;
                }
                texas.stopMoving();

                const specialAnimation = texas.resolveAnimationName('Special');
                const specialListener = {
                    complete(trackEntry) {
                        if (trackEntry.animation.name === specialAnimation) {
                            texas.isUserInteracting = false;
                            texas.scheduleNextAnimation(chatVisible);
                            if (texas.spine && texas.spine.state) {
                                texas.spine.state.removeListener(specialListener);
                            }
                        }
                    }
                };

                if (texas.spine && texas.spine.state) {
                    texas.spine.state.addListener(specialListener);
                }
                texas.playAnimation('Special', false);
            }
        } else if (organizeResult.errors.length > 0) {
            showAIBubble(`整理完成，但有 ${organizeResult.errors.length} 个文件移动失败。按 Esc 退出。`, true, 4000);
        } else {
            showAIBubble('没有文件需要整理。按 Esc 退出。', false, 3000);
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

function getCharacterAtPoint(x, y) {
    const allCharacters = { ...characters };
    for (const [charId, char] of Object.entries(allCharacters)) {
        if (char && char.isPointInside && char.isPointInside(x, y)) {
            return { charId, character: char, bounds: char.getBounds() };
        }
    }
    return null;
}

function showContextMenu(x, y, charId, bounds) {
    const targetChar = characters[charId];
    if (!targetChar || !bounds) return;

    targetChar.stopMoving();
    if (targetChar.animationTimer) {
        clearTimeout(targetChar.animationTimer);
    }
    isUserInteracting = true;
    contextMenuInteraction = true;
    const idleAnimation = typeof targetChar.getDefaultIdleAnimation === 'function'
        ? targetChar.getDefaultIdleAnimation()
        : getDefaultIdleAnimation();
    targetChar.playAnimation(idleAnimation, true);

    const menuX = bounds.x + bounds.width + 10;
    const menuY = bounds.y + bounds.height / 2 - 100;
    const customContent = charId === 'texas' ? buildTexasSkinSwitcher() : null;
    const menuItems = charId === 'texas'
        ? [{ id: 'file-management', label: 'File management' }, { id: 'exit', label: 'Exit' }]
        : charId === 'kalts'
            ? [
                { id: 'health-check', label: '\u5065\u5eb7\u68c0\u67e5' },
                { id: 'health-sources', label: '\u5065\u5eb7\u6765\u6e90' },
                { id: 'health-skills', label: '\u5065\u5eb7\u6280\u80fd' },
                { id: 'exit', label: 'Exit' }
            ]
            : CONTEXT_MENU_ITEMS;

    contextMenu.show(menuX, menuY, {
        screenWidth,
        screenHeight,
        items: menuItems,
        onAction: onContextMenuAction,
        bounds,
        customContent,
        contentBeforeItems: Boolean(customContent)
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
        if (contextMenuTargetId && characters[contextMenuTargetId]) {
            characters[contextMenuTargetId].scheduleNextAnimation(chatVisible);
        } else {
            amiya?.scheduleNextAnimation(chatVisible);
        }
        contextMenuTargetId = null;
    }
}

async function onContextMenuAction(actionId) {
    if (actionId === 'exit') {
        hideContextMenu();
        return;
    }
    if (actionId === 'file-management') {
        hideContextMenu();
        enterFileManagementMode();
        return;
    }
    if (actionId === 'health-check') {
        hideContextMenu();
        await runKaltsitHealthCheck();
        return;
    }
    if (actionId === 'health-sources') {
        hideContextMenu();
        await showKaltsitHealthSources();
        return;
    }
    if (actionId === 'health-skills') {
        hideContextMenu();
        await showKaltsitHealthSkills();
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
    if (actionId === 'close-texas') {
        hideOperatorCharacter('texas');
        hideContextMenu();
        return;
    }
}

function buildTexasSkinSwitcher() {
    const wrapper = document.createElement('div');
    wrapper.className = 'my-form';

    getAvailableTexasSkins().forEach((option) => {
        const row = document.createElement('div');
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'texas-skin';
        input.id = `texas-skin-${option.id}`;
        input.value = option.id;
        input.checked = texasSkin === option.id;
        input.disabled = !option.available;
        input.addEventListener('change', async () => {
            if (input.checked) {
                await setTexasSkin(option.id);
            }
        });

        const label = document.createElement('label');
        label.htmlFor = input.id;
        label.textContent = option.available ? option.label : `${option.label} (Unavailable)`;

        row.appendChild(input);
        row.appendChild(label);
        wrapper.appendChild(row);
    });

    return wrapper;
}

async function setTexasSkin(skinId) {
    if (texasSkin === skinId) return;

    const skin = TEXAS_SKIN_OPTIONS.find((item) => item.id === skinId);
    if (!skin) return;

    if (!isTexasSkinAvailable(skin)) {
        console.error(`[Renderer] Texas skin not available: ${skin.modelFolder}`);
        const fallback = getDefaultTexasSkin();
        if (fallback.id !== texasSkin) {
            texasSkin = fallback.id;
        }
        return;
    }

    texasSkin = skinId;

    if (!characters.texas) return;

    const currentTexas = characters.texas;
    const currentPosition = currentTexas.getBounds ? currentTexas.getBounds() : null;
    const startX = currentPosition ? currentPosition.x : currentTexas.spine?.x || screenWidth / 2;
    const startY = currentTexas.spine?.y || screenHeight - 80;
    const wasVisible = currentTexas.isEnabled;
    const moveDirection = currentTexas.moveDirection || 'right';

    hideOperatorCharacter('texas');

    if (wasVisible) {
        const success = await showOperatorCharacter('texas', {
            modelFolder: skin.modelFolder,
            modelName: skin.modelName,
            startX,
            startY
        });
        if (success && characters.texas) {
            characters.texas.setDirection(moveDirection);
        }
    }
}

function showOperatorPanel() {
    const operators = [
        { id: 'texas', name: 'Texas', checked: selectedOperators.has('texas') },
        { id: 'kalts', name: "Kal'tsit", checked: selectedOperators.has('kalts') }
    ];

    operatorPanel.show({
        operators,
        onToggle: async (operatorId, checked) => {
            // Prevent rapid clicking - check if already loading/unloading
            if (loadingOperators.has(operatorId)) {
                console.log(`[Renderer] Operator ${operatorId} is already loading/unloading, ignoring click`);
                operatorPanel.setSelectedOperator(operatorId, !checked);
                return;
            }

            try {
                // Mark as loading
                loadingOperators.add(operatorId);
                operatorPanel.setOperatorDisabled(operatorId, true);

                if (checked) {
                    const success = await showOperatorCharacter(operatorId);
                    if (!success) {
                        operatorPanel.setSelectedOperator(operatorId, false);
                    }
                } else {
                    hideOperatorCharacter(operatorId);
                }
            } catch (error) {
                console.error(`[Renderer] Error toggling operator ${operatorId}:`, error);
                operatorPanel.setSelectedOperator(operatorId, !checked);
            } finally {
                // Remove from loading set and re-enable checkbox
                loadingOperators.delete(operatorId);
                operatorPanel.setOperatorDisabled(operatorId, false);
            }
        },
        position: contextMenu.getElement()?.getBoundingClientRect(),
        screenWidth,
        screenHeight
    });
}

async function showOperatorCharacter(operatorId, overrideOptions = {}) {
    if (characters[operatorId]) {
        characters[operatorId].show();
        selectedOperators.add(operatorId);
        if (dialogIntegration) {
            dialogIntegration.registerCharacter(operatorId, characters[operatorId]);
        }
        return true;
    }

    const config = CHARACTER_CONFIGS[operatorId];
    if (!config) {
        console.error(`[Renderer] Character config not found for: ${operatorId}`);
        return false;
    }

    if (operatorId === 'texas' && !overrideOptions.modelFolder) {
        let skin = TEXAS_SKIN_OPTIONS.find(item => item.id === texasSkin);
        if (!skin || !isTexasSkinAvailable(skin)) {
            skin = getDefaultTexasSkin();
            texasSkin = skin.id;
        }
        if (skin) {
            overrideOptions = {
                modelFolder: skin.modelFolder,
                modelName: skin.modelName,
                ...overrideOptions
            };
        }
    }

    let CharacterClass;
    switch (operatorId) {
        case 'texas':
            CharacterClass = TexasCharacter;
            break;
        case 'kalts':
            CharacterClass = KaltsitCharacter;
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
        startY,
        ...overrideOptions
    });

    try {
        await char.load();

        char.show();
        characters[operatorId] = char;
        selectedOperators.add(operatorId);

        if (dialogIntegration) {
            dialogIntegration.registerCharacter(operatorId, char);
        }

        return true;
    } catch (error) {
        console.error(`[Renderer] Failed to load ${operatorId}:`, error.message);
        return false;
    }
}

function hideOperatorCharacter(operatorId) {
    if (characters[operatorId]) {
        characters[operatorId].hide();
        delete characters[operatorId];
        selectedOperators.delete(operatorId);
        
        if (dialogIntegration) {
            dialogIntegration.unregisterCharacter(operatorId);
        }
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

    if (dialogIntegration) {
        dialogIntegration.stop();
    }

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

    if (dialogIntegration) {
        dialogIntegration.start();
    }
}

function showAIBubble(text, isError = false, autoHideMs = 0, targetId = null) {
    if (!aiBubble) {
        aiBubble = document.createElement('div');
        aiBubble.className = 'ai-bubble';
        document.body.appendChild(aiBubble);
    }
    aiBubbleTargetId = targetId;

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
    aiBubbleTargetId = null;
    aiBubble?.classList.remove('visible');
}

function updateAIBubblePosition() {
    if (!aiBubble) return;

    let targetChar = aiBubbleTargetId && characters[aiBubbleTargetId]
        ? characters[aiBubbleTargetId]
        : amiya;
    if (!aiBubbleTargetId && fileManagementMode && characters.texas) {
        targetChar = characters.texas;
    }
    
    if (!targetChar) return;

    const bounds = targetChar.getBounds();
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

    // 设置按钮（齿轮图标）
    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'settings-btn';
    settingsBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>`;
    settingsBtn.title = 'AI 设置';
    settingsBtn.onclick = showAISettings;

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

    inputContainer.appendChild(settingsBtn);
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

let aiSettingsModal = null;

function showAISettings() {
    if (aiSettingsModal) {
        hideAISettings();
        return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'ai-settings-overlay';
    overlay.onclick = hideAISettings;

    const modal = document.createElement('div');
    modal.className = 'ai-settings-modal';
    modal.innerHTML = `
        <h3>⚙️ AI 设置</h3>
        <div class="setting-group">
            <label class="setting-label">当前模型</label>
            <select id="ai-model-select"></select>
        </div>
        <div class="setting-group">
            <label class="setting-label">已安装的模型</label>
            <div class="model-list" id="installed-models-list"></div>
        </div>
        <div class="setting-group">
            <label class="setting-label">下载镜像源</label>
            <select id="ai-mirror-select"></select>
        </div>
        <div class="setting-group">
            <label class="setting-label">模型存储位置</label>
            <div class="path-row">
                <input type="text" id="ai-model-path" placeholder="默认位置" readonly>
                <button class="btn btn-secondary" onclick="selectAIModelPath()">选择</button>
            </div>
        </div>
        <div class="btn-row">
            <button class="btn btn-secondary" onclick="hideAISettings()">关闭</button>
            <button class="btn btn-primary" onclick="saveAISettings()">保存</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    aiSettingsModal = { overlay, modal };

    loadAISettings();
}

async function loadAISettings() {
    const config = await ipcRenderer.invoke('ai-get-config');
    const models = await ipcRenderer.invoke('ai-get-installed-models');
    const mirrors = await ipcRenderer.invoke('ai-get-mirrors');
    const modelPath = await ipcRenderer.invoke('ai-get-model-path');

    // 填充模型选择
    const modelSelect = document.getElementById('ai-model-select');
    if (models.success && models.models.length > 0) {
        modelSelect.innerHTML = models.models.map(m => 
            `<option value="${m.name || m.id || m.model}" ${config.model === (m.name || m.id || m.model) ? 'selected' : ''}>
                ${m.name || m.id || m.model} (${m.size || ''})
            </option>`
        ).join('');
    } else {
        modelSelect.innerHTML = '<option value="">无可用模型</option>';
    }

    // 填充已安装模型列表
    const modelsList = document.getElementById('installed-models-list');
    if (models.success && models.models.length > 0) {
        modelsList.innerHTML = models.models.map(m => `
            <div class="model-item">
                <div>
                    <div class="model-name">${m.name || m.id || m.model}</div>
                    <div class="model-size">${m.size || ''}</div>
                </div>
                <button class="delete-btn" onclick="deleteAIModel('${m.name || m.id || m.model}')">删除</button>
            </div>
        `).join('');
    } else {
        modelsList.innerHTML = '<div class="empty-text">暂无已安装的模型</div>';
    }

    // 填充镜像源选择
    const mirrorSelect = document.getElementById('ai-mirror-select');
    mirrorSelect.innerHTML = Object.entries(mirrors).map(([key, mirror]) =>
        `<option value="${key}" ${config.mirror === key ? 'selected' : ''}>${mirror.name}</option>`
    ).join('');

    // 填充模型路径
    document.getElementById('ai-model-path').value = modelPath || '默认位置';
}

async function selectAIModelPath() {
    const result = await ipcRenderer.invoke('ai-select-model-path');
    if (result && result.path) {
        document.getElementById('ai-model-path').value = result.path;
    }
}

async function deleteAIModel(modelName) {
    if (!confirm(`确定要删除模型 "${modelName}" 吗？`)) return;
    
    const result = await ipcRenderer.invoke('ai-delete-model', modelName);
    if (result.success) {
        loadAISettings();
    } else {
        alert('删除失败: ' + result.message);
    }
}

async function saveAISettings() {
    const model = document.getElementById('ai-model-select').value;
    const mirror = document.getElementById('ai-mirror-select').value;

    await ipcRenderer.invoke('ai-update-config', { model, mirror });
    hideAISettings();
    showAIBubble('设置已保存', false, 2000);
}

function hideAISettings() {
    if (aiSettingsModal) {
        aiSettingsModal.overlay.remove();
        aiSettingsModal = null;
    }
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

async function runKaltsitHealthCheck() {
    try {
        const result = await ipcRenderer.invoke('health-check-now');
        showAIBubble(result.message, false, CHAT_BUBBLE_DURATION_MS, 'kalts');
    } catch (error) {
        showAIBubble(`Kal'tsit\uff1a\u5065\u5eb7\u68c0\u67e5\u5931\u8d25\uff1a${error.message}`, true, CHAT_BUBBLE_DURATION_MS, 'kalts');
    }
}

async function showKaltsitHealthSources() {
    try {
        const sources = await ipcRenderer.invoke('health-get-sources');
        const summary = sources
            .map(source => `${source.type}: ${source.enabled ? '\u542f\u7528' : '\u505c\u7528'} / ${source.status}`)
            .join('\n');
        showAIBubble(`Kal'tsit\uff1a\u5065\u5eb7\u6765\u6e90\u72b6\u6001\uff1a\n${summary}`, false, CHAT_BUBBLE_DURATION_MS, 'kalts');
    } catch (error) {
        showAIBubble(`Kal'tsit\uff1a\u6765\u6e90\u5de1\u68c0\u5931\u8d25\uff1a${error.message}`, true, CHAT_BUBBLE_DURATION_MS, 'kalts');
    }
}

async function showKaltsitHealthSkills() {
    try {
        const skills = await ipcRenderer.invoke('health-get-skills');
        const summary = skills
            .map(skill => `${skill.enabled ? '\u25cf' : '\u25cb'} ${skill.name}: ${skill.status}`)
            .join('\n');
        showAIBubble(`Kal'tsit\uff1a\u5df2\u63a5\u5165\u7684\u5065\u5eb7\u6280\u80fd\uff1a\n${summary}`, false, CHAT_BUBBLE_DURATION_MS, 'kalts');
    } catch (error) {
        showAIBubble(`Kal'tsit\uff1a\u5065\u5eb7\u6280\u80fd\u68c0\u67e5\u5931\u8d25\uff1a${error.message}`, true, CHAT_BUBBLE_DURATION_MS, 'kalts');
    }
}

function enterFileManagementMode() {
    if (fileManagementMode) return;
    
    fileManagementMode = true;
    console.log('[Renderer] Entered file management mode');
    
    if (characters.texas) {
        characters.texas.playAnimation('Relax', true);
    }
    
    showAIBubble('整理模式已启动。将桌面文件拖拽到我身上进行整理。按 Esc 退出。', false, 6000);
    
    document.body.classList.add('file-management-mode');
}

function exitFileManagementMode() {
    if (!fileManagementMode) return;
    
    fileManagementMode = false;
    console.log('[Renderer] Exited file management mode');
    
    document.body.classList.remove('file-management-mode');
    
    showAIBubble('已退出整理模式', false, 2000);
    
    if (characters.texas) {
        characters.texas.scheduleNextAnimation(chatVisible);
    }
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && fileManagementMode) {
        exitFileManagementMode();
    }
});

ipcRenderer.on('kaltsit-health-response', (event, payload) => {
    const message = payload && payload.message ? payload.message : "Kal'tsit\uff1a\u5065\u5eb7\u72b6\u6001\u5df2\u66f4\u65b0\u3002";
    const isError = payload && (payload.severity === 'high' || payload.severity === 'crisis');
    showAIBubble(message, isError, CHAT_BUBBLE_DURATION_MS, characters.kalts ? 'kalts' : null);
});

document.addEventListener('DOMContentLoaded', () => {
    initCSS();
    initPixi();
});

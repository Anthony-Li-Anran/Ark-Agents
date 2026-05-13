const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { AIConfigManager } = require('../Amiya/src/modules/ai/ai-config');
const { ScheduleManager } = require('../Amiya/src/modules/schedule/schedule-manager');
const { MemoManager } = require('../Amiya/src/modules/memo/memo-manager');
const { ReminderManager } = require('../Amiya/src/modules/reminder/reminder-manager');
const { AIToolRegistry } = require('../Amiya/src/modules/ai/ai-tools');
const { ProjectSkillPool } = require('../Amiya/src/modules/project/project-skill-pool');
const { FileManager } = require('../Texas/src/modules/file-manager');
const { KaltsitHealthAgent } = require('../Kaltsit/src/modules/health/health-agent');

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

let mainWindow = null;
let tray = null;
let chatWindow = null;
let setupWindow = null;
let scheduleWindow = null;
let memoWindow = null;
let reminderWindow = null;
let aiConfigManager = null;
let scheduleManager = null;
let memoManager = null;
let reminderManager = null;
let aiToolRegistry = null;
let projectSkillPool = null;
let fileManager = null;
let kaltsitHealthAgent = null;

// Base paths
const AMIVA_SRC_PATH = path.join(__dirname, '../Amiya/src');
const AMIVA_PATH = path.join(__dirname, '../Amiya');
const RENDERER_PATH = path.join(AMIVA_SRC_PATH, 'renderer');
const MODULES_PATH = path.join(AMIVA_SRC_PATH, 'modules');
const VIEWS_PATH = path.join(AMIVA_SRC_PATH, 'views');
const CONFIG_PATH = path.join(AMIVA_PATH, 'config');
const MODELS_PATH = path.join(__dirname, '../Models');

// Load system prompt
let systemPrompt = '';
let greetingMessage = '欢迎回家，博士。';
try {
    const promptPath = path.join(CONFIG_PATH, 'system_prompt.json');
    const promptData = JSON.parse(fs.readFileSync(promptPath, 'utf-8'));
    systemPrompt = promptData.system || '';
    greetingMessage = promptData.greeting || greetingMessage;
} catch (error) {
    console.warn('Failed to load system prompt:', error);
}

ipcMain.on('set-ignore-mouse-events', (event, ignore) => {
    if (mainWindow) {
        mainWindow.setIgnoreMouseEvents(ignore, { forward: true });
    }
});

ipcMain.on('app-exit', () => {
    app.quit();
});

// Check Ollama status
ipcMain.handle('check-ollama', async () => {
    try {
        const config = getAIConfig();
        const endpoint = trimTrailingSlashes(config.endpoint || 'http://127.0.0.1:11434');
        const response = await fetch(`${endpoint}/api/tags`);
        return { ready: response.ok };
    } catch (error) {
        return { ready: false, error: error.message };
    }
});

// Mark AI as connected
ipcMain.on('ai-mark-connected', () => {
    console.log('AI marked as connected');
});

function sendKaltsitHealthResponse(payload) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('kaltsit-health-response', payload);
    }
}

function getKaltsitHealthAgent() {
    if (!kaltsitHealthAgent) {
        throw new Error('Kaltsit health agent is not initialized.');
    }
    return kaltsitHealthAgent;
}

ipcMain.handle('health-get-status', () => {
    return getKaltsitHealthAgent().getStatus();
});

ipcMain.handle('health-get-sources', () => {
    return getKaltsitHealthAgent().getSources();
});

ipcMain.handle('health-get-skills', () => {
    return getKaltsitHealthAgent().getSkills();
});

ipcMain.handle('health-update-settings', (event, updates) => {
    return getKaltsitHealthAgent().updateSettings(updates || {});
});

ipcMain.handle('health-connect-source', (event, sourceType, metadata = {}) => {
    return getKaltsitHealthAgent().connectSource(sourceType, metadata);
});

ipcMain.handle('health-analyze-message', (event, message) => {
    return getKaltsitHealthAgent().analyzeMessage(message || {});
});

ipcMain.handle('health-analyze-batch', (event, messages) => {
    return getKaltsitHealthAgent().analyzeBatch(Array.isArray(messages) ? messages : []);
});

ipcMain.handle('health-record-action', (event, actionType) => {
    return getKaltsitHealthAgent().recordAction(actionType);
});

ipcMain.handle('health-run-skill', (event, skillId, input = {}) => {
    return getKaltsitHealthAgent().runSkill(skillId, input || {});
});

ipcMain.handle('health-check-now', () => {
    const agent = getKaltsitHealthAgent();
    const due = agent.checkDueReminders();
    return {
        status: agent.getStatus(),
        due,
        message: due.length > 0
            ? due[0].message
            : "Kal'tsit\uff1a\u5f53\u524d\u6ca1\u6709\u7d27\u6025\u5065\u5eb7\u5e72\u9884\u3002\u53ef\u4ee5\u7ee7\u7eed\u5de5\u4f5c\uff0c\u4f46\u522b\u628a\u8fd9\u7406\u89e3\u6210\u53ef\u4ee5\u5ffd\u89c6\u7761\u7720\u3001\u996e\u6c34\u548c\u6d3b\u52a8\u3002"
    };
});

// Open schedule (alias for todo)
ipcMain.on('open-schedule', () => {
    if (scheduleWindow && !scheduleWindow.isDestroyed()) {
        scheduleWindow.focus();
        return;
    }

    scheduleWindow = new BrowserWindow({
        width: 900,
        height: 700,
        title: 'Amiya - Schedule',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        resizable: true,
        minimizable: true,
        maximizable: true,
        closable: true,
        backgroundColor: '#1a1a2e'
    });

    scheduleWindow.loadFile(path.join(VIEWS_PATH, 'schedule.html'));

    scheduleWindow.on('closed', () => {
        scheduleWindow = null;
    });
});

// Open memo
ipcMain.on('open-memo', () => {
    if (memoWindow && !memoWindow.isDestroyed()) {
        memoWindow.focus();
        return;
    }

    memoWindow = new BrowserWindow({
        width: 760,
        height: 640,
        title: 'Amiya - Memo',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        resizable: true,
        minimizable: true,
        maximizable: true,
        closable: true,
        backgroundColor: '#f7f4ef'
    });

    memoWindow.loadFile(path.join(VIEWS_PATH, 'memo.html'));

    memoWindow.on('closed', () => {
        memoWindow = null;
    });
});

// Open reminder
ipcMain.on('open-reminder', () => {
    if (reminderWindow && !reminderWindow.isDestroyed()) {
        reminderWindow.focus();
        return;
    }

    reminderWindow = new BrowserWindow({
        width: 760,
        height: 620,
        title: 'Amiya - Reminder',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        resizable: true,
        minimizable: true,
        maximizable: true,
        closable: true,
        backgroundColor: '#f8fafc'
    });

    reminderWindow.loadFile(path.join(VIEWS_PATH, 'reminder.html'));

    reminderWindow.on('closed', () => {
        reminderWindow = null;
    });
});

ipcMain.on('open-chat-window', () => {
    if (chatWindow && !chatWindow.isDestroyed()) {
        chatWindow.focus();
        return;
    }

    chatWindow = new BrowserWindow({
        width: 600,
        height: 800,
        title: 'Amiya Chat',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        resizable: true,
        minimizable: true,
        maximizable: true,
        closable: true
    });

    chatWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(getChatWindowHTML())}`);

    chatWindow.on('closed', () => {
        chatWindow = null;
    });
});

ipcMain.on('open-memo-window', () => {
    if (memoWindow && !memoWindow.isDestroyed()) {
        memoWindow.focus();
        return;
    }

    memoWindow = new BrowserWindow({
        width: 760,
        height: 640,
        title: 'Amiya - Memo',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        resizable: true,
        minimizable: true,
        maximizable: true,
        closable: true,
        backgroundColor: '#f7f4ef'
    });

    memoWindow.loadFile(path.join(VIEWS_PATH, 'memo.html'));

    memoWindow.on('closed', () => {
        memoWindow = null;
    });
});

ipcMain.on('open-reminder-window', () => {
    if (reminderWindow && !reminderWindow.isDestroyed()) {
        reminderWindow.focus();
        return;
    }

    reminderWindow = new BrowserWindow({
        width: 760,
        height: 620,
        title: 'Amiya - Reminder',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        resizable: true,
        minimizable: true,
        maximizable: true,
        closable: true,
        backgroundColor: '#f8fafc'
    });

    reminderWindow.loadFile(path.join(VIEWS_PATH, 'reminder.html'));

    reminderWindow.on('closed', () => {
        reminderWindow = null;
    });
});

// Setup complete handler
ipcMain.on('setup-complete', () => {
    if (setupWindow && !setupWindow.isDestroyed()) {
        setupWindow.close();
        setupWindow = null;
    }
    if (!mainWindow || mainWindow.isDestroyed()) {
        createMainWindow();
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('ai-setup-complete');
    }
});

// Show setup window handler
ipcMain.on('show-setup-window', () => {
    if (!setupWindow || setupWindow.isDestroyed()) {
        createSetupWindow();
    } else {
        setupWindow.focus();
    }
});

// Store conversation history for context
const conversationHistory = new Map();

// Get current AI config
function getAIConfig() {
    return aiConfigManager ? aiConfigManager.getConfig() : {
        provider: 'ollama',
        endpoint: 'http://127.0.0.1:11434',
        model: ''
    };
}

function trimTrailingSlashes(url) {
    return String(url || '').trim().replace(/\/+$/, '');
}

function getOpenAICompatibleChatUrl(endpoint) {
    const baseUrl = trimTrailingSlashes(endpoint);
    return baseUrl.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;
}

async function callAI(config, prompt, messages = null) {
    const endpoint = trimTrailingSlashes(config.endpoint || 'http://127.0.0.1:11434');
    const model = String(config.model || '').trim();
    if (!model) {
        throw new Error('No AI model selected. Please configure a model first.');
    }

    let apiUrl;
    let requestBody;

    if (config.provider === 'ollama') {
        apiUrl = `${endpoint}/api/generate`;
        requestBody = {
            model,
            prompt,
            stream: false
        };
    } else if (config.provider === 'lmstudio' || config.provider === 'openai' || config.provider === 'custom') {
        apiUrl = getOpenAICompatibleChatUrl(endpoint);
        requestBody = {
            model,
            messages: messages || [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ],
            stream: false
        };
    } else {
        apiUrl = `${endpoint}/api/generate`;
        requestBody = {
            model,
            prompt,
            stream: false
        };
    }

    const headers = { 'Content-Type': 'application/json' };
    if (config.apiKey) {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = errorText;
        try {
            errorMessage = JSON.parse(errorText).error || errorText;
        } catch {
            // Keep raw service response text.
        }
        if (config.provider === 'ollama' && response.status === 404 && errorMessage.includes('not found')) {
            throw new Error(`Ollama model "${model}" is not installed. Run: ollama pull ${model}`);
        }
        throw new Error(`AI service response ${response.status}: ${errorMessage}`);
    }

    const data = await response.json();
    return config.provider === 'ollama'
        ? (data.response || '')
        : (data.choices?.[0]?.message?.content || '');
}

function buildToolChatPrompt(history, includeTools = true) {
    let prompt = systemPrompt ? `${systemPrompt}\n\n` : '';
    prompt += 'Conversation between Doctor and Amiya. Reply as Amiya only.\n';
    if (includeTools && aiToolRegistry) {
        prompt += aiToolRegistry.getToolPrompt();
    }
    prompt += '\n';

    for (const msg of history) {
        prompt += `${msg.role === 'user' ? 'Doctor' : 'Amiya'}: ${msg.content}\n`;
    }

    prompt += 'Amiya:';
    return prompt;
}

function cleanToolAIResponse(rawResponse) {
    let text = String(rawResponse || '').trim();
    for (const prefix of ['Amiya:', 'Doctor:', '阿米娅：', '博士：']) {
        if (text.startsWith(prefix)) {
            text = text.substring(prefix.length).trim();
        }
    }
    return text
        .split('\n')
        .filter(line => {
            const trimmed = line.trim();
            return !trimmed.startsWith('Amiya:') &&
                !trimmed.startsWith('Doctor:') &&
                !trimmed.startsWith('阿米娅：') &&
                !trimmed.startsWith('博士：');
        })
        .join('\n')
        .trim();
}

async function maybeExecuteAITool(config, rawResponse, history) {
    if (!aiToolRegistry) return null;

    const toolCall = aiToolRegistry.parseToolCall(rawResponse);
    if (!toolCall) return null;

    const result = aiToolRegistry.execute(toolCall);
    const toolResult = {
        tool: toolCall.tool,
        args: toolCall.args || {},
        result
    };

    const followupPrompt = `${systemPrompt || ''}\n\nA local tool was executed. Result:\n${JSON.stringify(toolResult, null, 2)}\n\nReply to Doctor briefly as Amiya. Do not output JSON.`;
    const followupMessages = [
        { role: 'system', content: systemPrompt },
        ...history.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content
        })),
        { role: 'assistant', content: JSON.stringify(toolCall) },
        { role: 'user', content: `Tool result: ${JSON.stringify(toolResult)}` }
    ];

    return {
        toolResult,
        response: await callAI(config, followupPrompt, followupMessages)
    };
}

ipcMain.handle('ollama-generate', async (event, message, sessionId = 'default') => {
    try {
        const config = getAIConfig();
        
        let history = conversationHistory.get(sessionId) || [];
        history.push({ role: 'user', content: message });

        if (kaltsitHealthAgent) {
            try {
                kaltsitHealthAgent.analyzeMessage({
                    source: 'app-chat',
                    text: message,
                    timestamp: new Date().toISOString()
                });
            } catch (healthError) {
                console.warn('[KaltsitHealthAgent] Failed to analyze app chat:', healthError.message);
            }
        }

        const prompt = buildToolChatPrompt(history, true);
        const rawToolAwareResponse = await callAI(config, prompt);
        const toolExecution = await maybeExecuteAITool(config, rawToolAwareResponse, history);
        const toolAwareCleanedResponse = cleanToolAIResponse(toolExecution ? toolExecution.response : rawToolAwareResponse);

        history.push({ role: 'assistant', content: toolAwareCleanedResponse });

        if (history.length > 20) {
            history = history.slice(-20);
        }

        conversationHistory.set(sessionId, history);

        return {
            success: true,
            response: toolAwareCleanedResponse,
            toolResult: toolExecution ? toolExecution.toolResult : null
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Get greeting message
ipcMain.handle('get-greeting', async () => {
    return { success: true, greeting: greetingMessage };
});

// Clear conversation history for a session
ipcMain.handle('clear-conversation', async (event, sessionId = 'default') => {
    conversationHistory.delete(sessionId);
    return { success: true };
});

function getChatWindowHTML() {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Amiya Chat</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        #chat-container { height: calc(100vh - 120px); overflow-y: auto; border: 1px solid #ccc; padding: 10px; background: white; margin-bottom: 10px; }
        #input-container { display: flex; }
        #message-input { flex: 1; padding: 10px; border: 1px solid #ccc; }
        #send-button { padding: 10px 20px; background: #007bff; color: white; border: none; cursor: pointer; }
        .message { margin-bottom: 10px; }
        .user { text-align: right; color: blue; }
        .ai { text-align: left; color: green; }
    </style>
</head>
<body>
    <h2>Amiya Chat</h2>
    <div id="chat-container"></div>
    <div id="input-container">
        <input type="text" id="message-input" placeholder="输入你的问题...">
        <button id="send-button">发送</button>
    </div>
    <script>
        const { ipcRenderer } = require('electron');
        const chatContainer = document.getElementById('chat-container');
        const messageInput = document.getElementById('message-input');
        const sendButton = document.getElementById('send-button');

        sendButton.addEventListener('click', sendMessage);
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });

        async function sendMessage() {
            const message = messageInput.value.trim();
            if (!message) return;

            addMessage('user', message);
            messageInput.value = '';

            try {
                const result = await ipcRenderer.invoke('ollama-generate', message);
                if (result.success) {
                    addMessage('ai', result.response);
                } else {
                    addMessage('ai', '抱歉，连接到 AI 服务失败：' + result.error);
                }
            } catch (error) {
                addMessage('ai', '抱歉，内部调用失败。请查看开发者控制台。');
                console.error(error);
            }
        }

        function addMessage(sender, text) {
            const div = document.createElement('div');
            div.className = 'message ' + sender;
            div.textContent = text;
            chatContainer.appendChild(div);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    </script>
</body>
</html>`;
}

function createMainWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    mainWindow = new BrowserWindow({
        width: width,
        height: height,
        x: 0,
        y: 0,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: false,
        hasShadow: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        }
    });

    mainWindow.loadFile(path.join(VIEWS_PATH, 'index.html'));

    // Log renderer errors to terminal
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error('[Main] Failed to load:', errorCode, errorDescription);
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function createSetupWindow() {
    setupWindow = new BrowserWindow({
        width: 700,
        height: 600,
        title: 'Amiya - 初始设置',
        resizable: false,
        maximizable: false,
        minimizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    setupWindow.loadFile(path.join(VIEWS_PATH, 'ai-setup.html'));

    setupWindow.on('closed', () => {
        setupWindow = null;
        if (!mainWindow) {
            app.quit();
        }
    });
}

function createTray() {
    const iconPath = path.join(MODELS_PATH, '002_Amiya', 'build_char_002_amiya.png');
    let trayIcon = null;

    try {
        trayIcon = nativeImage.createFromPath(iconPath);
        if (!trayIcon || trayIcon.isEmpty()) {
            console.error('Tray icon not found or invalid:', iconPath);
            trayIcon = nativeImage.createEmpty();
        } else {
            trayIcon = trayIcon.resize({ width: 16, height: 16 });
        }
    } catch (error) {
        console.error('Failed to create tray icon:', error);
        trayIcon = nativeImage.createEmpty();
    }

    tray = new Tray(trayIcon);
    const contextMenu = Menu.buildFromTemplate([
        {
            label: '显示/隐藏',
            click: () => {
                if (mainWindow.isVisible()) {
                    mainWindow.hide();
                } else {
                    mainWindow.show();
                }
            }
        },
        { type: 'separator' },
        {
            label: '退出',
            click: () => {
                app.quit();
            }
        }
    ]);
    tray.setToolTip('Amiya');
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        if (mainWindow && mainWindow.isVisible()) {
            mainWindow.hide();
        } else if (mainWindow) {
            mainWindow.show();
        }
    });

    tray.on('right-click', () => {
        tray.popUpContextMenu();
    });
}

app.whenReady().then(() => {
    aiConfigManager = new AIConfigManager(app.getPath('userData'));
    scheduleManager = new ScheduleManager(app.getPath('userData'));
    memoManager = new MemoManager(app.getPath('userData'));
    reminderManager = new ReminderManager(app.getPath('userData'));
    projectSkillPool = new ProjectSkillPool({ projectRoot: path.join(__dirname, '..') });
    aiToolRegistry = new AIToolRegistry({ scheduleManager, memoManager, reminderManager, projectSkillPool });
    fileManager = new FileManager();
    kaltsitHealthAgent = new KaltsitHealthAgent(app.getPath('userData'), {
        onResponse: sendKaltsitHealthResponse
    });
    kaltsitHealthAgent.start();
    
    createMainWindow();
    createTray();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
        }
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

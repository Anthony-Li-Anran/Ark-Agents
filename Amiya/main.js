const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { AIConfigManager } = require('./ai-config');
const { TodoManager } = require('./todo-manager');

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

let mainWindow = null;
let tray = null;
let chatWindow = null;
let setupWindow = null;
let todoWindow = null;
let aiConfigManager = null;
let todoManager = null;

// Load system prompt
let systemPrompt = '';
let greetingMessage = '欢迎回家，博士。';
try {
    const promptPath = path.join(__dirname, 'system_prompt.json');
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

ipcMain.on('open-todo-window', () => {
    if (todoWindow && !todoWindow.isDestroyed()) {
        todoWindow.focus();
        return;
    }

    todoWindow = new BrowserWindow({
        width: 900,
        height: 700,
        title: 'Amiya - Todo List',
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

    todoWindow.loadFile(path.join(__dirname, 'todo.html'));

    todoWindow.on('closed', () => {
        todoWindow = null;
    });
});

// Setup complete handler
ipcMain.on('setup-complete', () => {
    if (setupWindow && !setupWindow.isDestroyed()) {
        setupWindow.close();
        setupWindow = null;
    }
    // If main window is not created yet, create it
    if (!mainWindow || mainWindow.isDestroyed()) {
        createMainWindow();
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
        model: 'qwen2.5:3b'
    };
}

ipcMain.handle('ollama-generate', async (event, message, sessionId = 'default') => {
    try {
        const config = getAIConfig();
        
        // Get or create conversation history for this session
        let history = conversationHistory.get(sessionId) || [];
        
        // Add user message to history
        history.push({ role: 'user', content: message });
        
        // Build prompt with system prompt and history
        // Use a clear instruction format to prevent model confusion
        let fullPrompt = '';
        if (systemPrompt) {
            fullPrompt = `${systemPrompt}\n\n`;
        }
        
        // Add instruction for the model
        fullPrompt += '以下是博士和阿米娅的对话。请只以阿米娅的身份回复最后一句话，不要生成其他内容。\n\n';
        
        // Add conversation history
        for (const msg of history) {
            if (msg.role === 'user') {
                fullPrompt += `博士：${msg.content}\n`;
            } else {
                fullPrompt += `阿米娅：${msg.content}\n`;
            }
        }
        
        fullPrompt += '阿米娅：';
        
        // Use configured endpoint and model
        const endpoint = config.endpoint || 'http://127.0.0.1:11434';
        const model = config.model || 'qwen2.5:3b';
        
        let apiUrl;
        let requestBody;
        
        if (config.provider === 'ollama') {
            apiUrl = `${endpoint}/api/generate`;
            requestBody = {
                model: model,
                prompt: fullPrompt,
                stream: false
            };
        } else if (config.provider === 'lmstudio' || config.provider === 'openai' || config.provider === 'custom') {
            // OpenAI compatible API
            apiUrl = `${endpoint}/v1/chat/completions`;
            requestBody = {
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...history.map(msg => ({
                        role: msg.role === 'user' ? 'user' : 'assistant',
                        content: msg.content
                    }))
                ],
                stream: false
            };
        } else {
            // Default to Ollama format
            apiUrl = `${endpoint}/api/generate`;
            requestBody = {
                model: model,
                prompt: fullPrompt,
                stream: false
            };
        }
        
        const headers = { 'Content-Type': 'application/json' };
        if (config.apiKey) {
            headers['Authorization'] = `Bearer ${config.apiKey}`;
        }
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`AI service response ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        
        // Extract response based on provider
        let rawResponse = '';
        if (config.provider === 'ollama') {
            rawResponse = data.response || '';
        } else {
            // OpenAI format
            rawResponse = data.choices?.[0]?.message?.content || '';
        }
        
        // Clean up the response - remove any "博士：" or "阿米娅：" prefixes that might have been generated
        let cleanedResponse = rawResponse.trim();
        
        // Remove common unwanted prefixes
        if (cleanedResponse.startsWith('阿米娅：')) {
            cleanedResponse = cleanedResponse.substring(4).trim();
        }
        if (cleanedResponse.startsWith('博士：')) {
            cleanedResponse = cleanedResponse.substring(3).trim();
        }
        
        // Remove any lines that start with "博士：" (model sometimes generates the whole conversation)
        const lines = cleanedResponse.split('\n');
        const validLines = lines.filter(line => !line.trim().startsWith('博士：') && !line.trim().startsWith('阿米娅：'));
        cleanedResponse = validLines.join('\n').trim();
        
        // Add AI response to history
        history.push({ role: 'assistant', content: cleanedResponse });
        
        // Keep only last 10 exchanges to prevent context overflow
        if (history.length > 20) {
            history = history.slice(-20);
        }
        
        conversationHistory.set(sessionId, history);
        
        return { success: true, response: cleanedResponse };
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
    <script>
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

    mainWindow.loadFile(path.join(__dirname, 'index.html'));

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

    setupWindow.loadFile(path.join(__dirname, 'setup.html'));

    setupWindow.on('closed', () => {
        setupWindow = null;
        // If setup was closed without completion, quit app
        if (!mainWindow) {
            app.quit();
        }
    });
}

function createTray() {
    const iconPath = path.join(__dirname, '..', 'models', '002_amiya', 'build_char_002_amiya.png');
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
    // Initialize AI config manager
    aiConfigManager = new AIConfigManager(app.getPath('userData'));
    
    // Initialize Todo manager
    todoManager = new TodoManager(app.getPath('userData'));
    
    // Always create main window on startup
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

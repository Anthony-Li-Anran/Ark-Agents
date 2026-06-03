const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { AIConfigManager } = require('../Amiya/src/modules/ai/ai-config');
const { ScheduleManager } = require('../Amiya/src/modules/schedule/schedule-manager');
const { MemoManager } = require('../Amiya/src/modules/memo/memo-manager');
const { ReminderManager } = require('../Amiya/src/modules/reminder/reminder-manager');
const { AIToolRegistry } = require('../Amiya/src/modules/ai/ai-tools');
const { FileManager } = require('../Texas/src/modules/file-manager');
const { MedicalLogger } = require('../Kaltsit/src/modules/medical/medical-logger');
const { MedicalTools } = require('../Kaltsit/src/modules/medical/medical-tools');
const { DingTalkConfigManager } = require('./shared/dingtalk-config');
const { DingTalkConnector } = require('./shared/dingtalk-connector');
const { DingTalkStreamClient } = require('./shared/dingtalk-stream');
const { DocumentParser } = require('../Muelsyse/src/modules/document/document-parser');
const { DocumentStore } = require('../Muelsyse/src/modules/document/document-store');
const { RAGEngine } = require('../Muelsyse/src/modules/document/rag-engine');
const { LearningSummarizer } = require('../Muelsyse/src/modules/learning/learning-summarizer');
const { LearningQA } = require('../Muelsyse/src/modules/learning/learning-qa');
const { FlashCardGenerator } = require('../Muelsyse/src/modules/learning/flash-card');
const { PomodoroTimer } = require('../Muelsyse/src/modules/pomodoro/pomodoro-timer');

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

let mainWindow = null;
let tray = null;
let chatWindow = null;
let setupWindow = null;
let scheduleWindow = null;
let memoWindow = null;
let reminderWindow = null;
let mindmapWindow = null;
let mindmapData = null;
let aiConfigManager = null;
let scheduleManager = null;
let memoManager = null;
let reminderManager = null;
let aiToolRegistry = null;
let fileManager = null;
let medicalLogger = null;
let medicalTools = null;
let kaltsitConversationHistory = new Map();
let dingTalkConfigManager = null;
let dingTalkConnectors = {};
let dingTalkStreamClients = {};
let dingTalkConversationHistory = new Map();
let aiSettingsWindow = null;
let documentParser = null;
let documentStore = null;
let ragEngine = null;
let learningSummarizer = null;
let learningQA = null;
let flashCardGenerator = null;
let pomodoroTimer = null;
let muelsyseLearningWindow = null;

// Base paths - handle both development and production
function getBasePath() {
    // In development, __dirname points to scripts folder
    // In production, it points to app.asar/scripts
    return path.dirname(__dirname);
}

const BASE_PATH = getBasePath();
const AMIVA_SRC_PATH = path.join(BASE_PATH, 'Amiya/src');
const AMIVA_PATH = path.join(BASE_PATH, 'Amiya');
const RENDERER_PATH = path.join(AMIVA_SRC_PATH, 'renderer');
const MODULES_PATH = path.join(AMIVA_SRC_PATH, 'modules');
const VIEWS_PATH = path.join(AMIVA_SRC_PATH, 'views');
const CONFIG_PATH = path.join(AMIVA_PATH, 'config');
const MODELS_PATH = path.join(BASE_PATH, 'Models');
const KALTSIT_PATH = path.join(BASE_PATH, 'Kaltsit');
const KALTSIT_CONFIG_PATH = path.join(KALTSIT_PATH, 'config');
const MUELSYSE_PATH = path.join(BASE_PATH, 'Muelsyse');

// Load system prompt for Amiya
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

// Load Kaltsit medical system prompt
let kaltsitSystemConfig = null;
try {
    const kaltsitPromptPath = path.join(KALTSIT_CONFIG_PATH, 'system_prompt.json');
    kaltsitSystemConfig = JSON.parse(fs.readFileSync(kaltsitPromptPath, 'utf-8'));
    console.log('[Kaltsit] Medical system config loaded successfully');
} catch (error) {
    console.warn('Failed to load Kaltsit system prompt:', error);
    kaltsitSystemConfig = null;
}

function buildKaltsitSystemPrompt() {
    // Default fallback prompt if config not loaded
    const defaultPrompt = `你是凯尔希，一位专业的医疗咨询顾问。请像真正的医生一样回答患者的问题。

语气：冷静、理性、专业

回答要求：
1. 像面对面问诊一样自然交流
2. 必要时询问症状细节
3. 给出实用的建议
4. 回答末尾加上："以上建议仅供参考，如有不适请及时就医。"

请直接回答患者的问题，不要输出对话示例。`;
    
    if (!kaltsitSystemConfig) {
        console.warn('[Kaltsit] Using default system prompt (config not loaded)');
        return defaultPrompt;
    }
    
    if (kaltsitSystemConfig.system_prompt) {
        return kaltsitSystemConfig.system_prompt;
    }
    
    return defaultPrompt;
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

ipcMain.on('open-ai-settings', () => {
    if (aiSettingsWindow && !aiSettingsWindow.isDestroyed()) {
        aiSettingsWindow.focus();
        return;
    }

    aiSettingsWindow = new BrowserWindow({
        width: 700,
        height: 650,
        title: 'AI Settings',
        resizable: false,
        maximizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    aiSettingsWindow.loadFile(path.join(VIEWS_PATH, 'ai-setup.html'));

    aiSettingsWindow.on('closed', () => {
        aiSettingsWindow = null;
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

// Open DingTalk setup window
ipcMain.on('open-dingtalk-setup', () => {
    let dingtalkWindow = new BrowserWindow({
        width: 700,
        height: 800,
        title: '钉钉机器人配置',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        resizable: true,
        minimizable: true,
        maximizable: false,
        closable: true
    });

    dingtalkWindow.loadFile(path.join(VIEWS_PATH, 'dingtalk-setup.html'));

    dingtalkWindow.on('closed', () => {
        dingtalkWindow = null;
    });
});

ipcMain.on('open-muelsyse-learning', () => {
    if (muelsyseLearningWindow && !muelsyseLearningWindow.isDestroyed()) {
        muelsyseLearningWindow.focus();
        return;
    }

    muelsyseLearningWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        title: 'Muelsyse - Learning Assistant',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        resizable: true,
        minimizable: true,
        maximizable: true,
        closable: true,
        backgroundColor: '#ffffff'
    });

    muelsyseLearningWindow.loadFile(path.join(MUELSYSE_PATH, 'src/views/learning.html'));

    muelsyseLearningWindow.on('closed', () => {
        muelsyseLearningWindow = null;
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
    // Close setup window if exists
    if (setupWindow && !setupWindow.isDestroyed()) {
        setupWindow.close();
        setupWindow = null;
    }
    // Close AI settings window if exists
    if (aiSettingsWindow && !aiSettingsWindow.isDestroyed()) {
        aiSettingsWindow.close();
        aiSettingsWindow = null;
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
    } else if (config.provider === 'anthropic') {
        // Anthropic uses different API format
        apiUrl = `${endpoint}/messages`;
        requestBody = {
            model,
            max_tokens: 4096,
            messages: messages || [{ role: 'user', content: prompt }]
        };
    } else {
        // OpenAI-compatible APIs (lmstudio, openai, deepseek, zhipu, moonshot, qwen, custom)
        apiUrl = getOpenAICompatibleChatUrl(endpoint);
        requestBody = {
            model,
            messages: messages || [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ],
            stream: false
        };
    }

    const headers = { 'Content-Type': 'application/json' };
    
    if (config.provider === 'anthropic') {
        headers['x-api-key'] = config.apiKey;
        headers['anthropic-version'] = '2023-06-01';
    } else if (config.apiKey) {
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
            errorMessage = JSON.parse(errorText).error?.message || JSON.parse(errorText).error || errorText;
        } catch {
            // Keep raw service response text.
        }
        if (config.provider === 'ollama' && response.status === 404 && errorMessage.includes('not found')) {
            throw new Error(`Ollama model "${model}" is not installed. Run: ollama pull ${model}`);
        }
        throw new Error(`AI service response ${response.status}: ${errorMessage}`);
    }

    const data = await response.json();
    
    if (config.provider === 'ollama') {
        return data.response || '';
    } else if (config.provider === 'anthropic') {
        return data.content?.[0]?.text || '';
    } else {
        return data.choices?.[0]?.message?.content || '';
    }
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

    console.log('[Tool] Executing tool:', toolCall.tool, 'with args:', toolCall.args);
    
    const result = aiToolRegistry.execute(toolCall);
    console.log('[Tool] Execution result:', JSON.stringify(result, null, 2).substring(0, 500));
    
    const toolResult = {
        tool: toolCall.tool,
        args: toolCall.args || {},
        result
    };

    // Build prompt with explicit instruction to include data
    const resultStr = JSON.stringify(result, null, 2);
    const followupPrompt = `${systemPrompt || ''}\n\n【工具执行结果】\n工具：${toolCall.tool}\n结果：\n${resultStr}\n\n【重要】请根据上面的工具结果回复用户。如果结果是空数组，告诉用户没有找到相关数据。如果有数据，请详细列出每一条记录，包括标题、时间、状态等信息。不要编造数据，只使用工具返回的真实数据。`;
    
    const followupMessages = [
        { role: 'system', content: systemPrompt },
        ...history.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content
        })),
        { role: 'assistant', content: `我调用了工具：${toolCall.tool}` },
        { role: 'user', content: `工具返回结果：\n${resultStr}\n\n请根据这个结果回复我，列出所有数据。` }
    ];

    const response = await callAI(config, followupPrompt, followupMessages);
    console.log('[Tool] AI response after tool:', response.substring(0, 200));

    return {
        toolResult,
        response: response
    };
}

ipcMain.handle('ollama-generate', async (event, message, sessionId = 'default') => {
    try {
        const config = aiConfigManager.getOperatorConfig('amiya');
        
        if (!config.model) {
            return { success: false, error: 'No AI model configured for Amiya. Please configure in Settings.' };
        }
        
        let history = conversationHistory.get(sessionId) || [];
        history.push({ role: 'user', content: message });

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

// === Kaltsit Medical Consultation IPC Handlers ===

ipcMain.handle('medical-check-question', async (event, question) => {
    try {
        const result = medicalTools.isMedicalQuestion(question);
        return { isMedical: result, keywords: medicalTools.getMatchedKeywords(question) };
    } catch (error) {
        return { isMedical: false, error: error.message };
    }
});

ipcMain.handle('medical-check-network', async () => {
    try {
        const status = await medicalTools.checkNetworkStatus();
        return status;
    } catch (error) {
        return { available: false, error: error.message };
    }
});

ipcMain.handle('medical-search', async (event, query) => {
    try {
        medicalLogger.logNetworkQuery('web-search', 'started', 0, null);
        const startTime = Date.now();
        
        const result = await medicalTools.searchMedicalInfo(query);
        
        const responseTime = Date.now() - startTime;
        medicalLogger.logNetworkQuery('web-search', 'completed', responseTime, null);
        
        return result;
    } catch (error) {
        medicalLogger.logNetworkQuery('web-search', 'failed', 0, error.message);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('medical-chat', async (event, message, context = '') => {
    try {
        let config = aiConfigManager.getOperatorConfig('kaltsit');
        
        // If Kaltsit doesn't have a model configured, use global config
        if (!config.model) {
            const globalConfig = aiConfigManager.getConfig();
            if (globalConfig.global && globalConfig.global.model) {
                config = {
                    ...config,
                    model: globalConfig.global.model,
                    endpoint: globalConfig.global.endpoint || config.endpoint,
                    provider: globalConfig.global.provider || config.provider,
                    apiKey: globalConfig.global.apiKey || config.apiKey
                };
            }
        }
        
        if (!config.model) {
            return { success: false, error: 'No AI model configured. Please configure in Settings.' };
        }
        
        medicalLogger.logUserQuestion(message);
        const startTime = Date.now();
        
        let history = kaltsitConversationHistory.get('kaltsit') || [];
        
        let prompt = buildKaltsitSystemPrompt();
        if (context) {
            prompt += `\n\n【参考资料】\n${context}`;
        }
        
        prompt += '\n\n【对话历史】\n';
        if (history.length > 0) {
            for (const msg of history) {
                prompt += `${msg.role === 'user' ? '博士' : '凯尔希'}: ${msg.content}\n`;
            }
        }
        
        prompt += `\n博士: ${message}\n凯尔希:`;
        
        const response = await callAI(config, prompt);
        
        history.push({ role: 'user', content: message });
        history.push({ role: 'assistant', content: response });
        
        if (history.length > 20) {
            history = history.slice(-20);
        }
        kaltsitConversationHistory.set('kaltsit', history);
        
        const responseTime = Date.now() - startTime;
        medicalLogger.logModelResponse(response, responseTime);
        
        return { success: true, response: response };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('medical-clear-conversation', async () => {
    kaltsitConversationHistory.delete('kaltsit');
    return { success: true };
});

// === Muelsyse Document IPC handlers ===

ipcMain.handle('muelsyse-upload-document', async (event, filePath) => {
    try {
        if (!documentParser.isSupported(filePath)) {
            return { success: false, error: '不支持的文件格式' };
        }
        
        const parsed = await documentParser.parse(filePath);
        const fileName = path.basename(filePath);
        const doc = await documentStore.addDocument(fileName, parsed.text, {
            pages: parsed.pages,
            info: parsed.info
        }, event.sender);
        
        console.log(`[Muelsyse] Document uploaded: ${fileName}, chunks created`);
        return { success: true, document: doc };
    } catch (error) {
        console.error('[Muelsyse] Document upload error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('muelsyse-get-documents', async () => {
    return documentStore.getAllDocuments();
});

ipcMain.handle('muelsyse-delete-document', async (event, docId) => {
    return documentStore.deleteDocument(docId);
});

ipcMain.handle('muelsyse-search-documents', async (event, query, topK, threshold) => {
    try {
        const results = await documentStore.search(query, topK, threshold);
        return results;
    } catch (error) {
        console.error('[Muelsyse] Search error:', error);
        return [];
    }
});

ipcMain.handle('muelsyse-check-embedding-model', async () => {
    try {
        const result = await documentStore.checkEmbeddingModel();
        return result;
    } catch (error) {
        return { available: false, message: error.message };
    }
});

ipcMain.handle('muelsyse-pull-embedding-model', async (event) => {
    try {
        const modelName = documentStore.config.embeddingModel || 'nomic-embed-text';
        const result = await aiConfigManager.pullModel(modelName, event.sender);
        return result;
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('muelsyse-get-document-stats', async () => {
    try {
        return documentStore.getStats();
    } catch (error) {
        return { documentCount: 0, chunkCount: 0, embeddingCount: 0 };
    }
});

ipcMain.handle('muelsyse-reindex-documents', async () => {
    try {
        await documentStore.reindexAllDocuments();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('muelsyse-update-rag-settings', async (event, settings) => {
    try {
        if (settings.chunkSize) documentStore.config.chunkSize = settings.chunkSize;
        if (settings.chunkOverlap) documentStore.config.chunkOverlap = settings.chunkOverlap;
        if (settings.similarityThreshold) documentStore.config.similarityThreshold = settings.similarityThreshold;
        documentStore.saveData();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('muelsyse-summarize', async (event, docId) => {
    try {
        const doc = documentStore.getDocument(docId);
        if (!doc) {
            return { success: false, error: 'Document not found' };
        }
        const summary = await learningSummarizer.summarize(doc.text);
        return { success: true, summary };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('muelsyse-qa', async (event, question, sessionId) => {
    try {
        const result = await learningQA.ask(question, sessionId);
        return { success: true, ...result };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('muelsyse-qa-clear', async (event, sessionId) => {
    learningQA.clearHistory(sessionId);
    return { success: true };
});

ipcMain.handle('muelsyse-generate-flashcards', async (event, docId, count) => {
    try {
        const flashCards = await flashCardGenerator.generateFlashCards(docId, count);
        return { success: true, flashCards };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('muelsyse-generate-quiz', async (event, docId, count) => {
    try {
        const quiz = await flashCardGenerator.generateQuiz(docId, count);
        return { success: true, quiz };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('muelsyse-get-document-sections', async (event, docId) => {
    try {
        const sections = documentStore.getDocumentSections(docId);
        return { success: true, sections };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('muelsyse-get-section-content', async (event, sectionId) => {
    try {
        const content = documentStore.getSectionContent(sectionId);
        return { success: true, content };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('muelsyse-generate-flashcards-sections', async (event, sectionIds, count) => {
    try {
        const sections = documentStore.getSectionsContent(sectionIds);
        const combinedContent = sections.map(s => s.content).join('\n\n');
        const flashCards = await flashCardGenerator.generateFromContent(combinedContent, count);
        return { success: true, flashCards };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('muelsyse-generate-quiz-sections', async (event, sectionIds, count) => {
    try {
        const sections = documentStore.getSectionsContent(sectionIds);
        const combinedContent = sections.map(s => s.content).join('\n\n');
        const quiz = await flashCardGenerator.generateQuizFromContent(combinedContent, count);
        return { success: true, quiz };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('muelsyse-generate-fulltest', async (event, docId, config) => {
    try {
        const doc = documentStore.getDocument(docId);
        if (!doc) {
            return { success: false, error: 'Document not found' };
        }
        const test = await flashCardGenerator.generateFullTest(doc.text, config);
        return { success: true, test };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('muelsyse-generate-fulltest-sections', async (event, sectionIds, config) => {
    try {
        const sections = documentStore.getSectionsContent(sectionIds);
        const combinedContent = sections.map(s => s.content).join('\n\n');
        const test = await flashCardGenerator.generateFullTest(combinedContent, config);
        return { success: true, test };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('muelsyse-generate-mindmap', async (event, docId) => {
    try {
        const doc = documentStore.getDocument(docId);
        if (!doc) {
            return { success: false, error: 'Document not found' };
        }
        const mindmap = await flashCardGenerator.generateMindMap(doc.text);
        return { success: true, mindmap };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('muelsyse-generate-mindmap-section', async (event, sectionId) => {
    try {
        const sections = documentStore.getSectionsContent([sectionId]);
        if (!sections || sections.length === 0) {
            return { success: false, error: 'Section not found' };
        }
        const content = sections[0].content;
        const mindmap = await flashCardGenerator.generateMindMap(content);
        return { success: true, mindmap };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('muelsyse-open-mindmap-in-browser', async (event, markdown) => {
    try {
        // Store data for the window
        mindmapData = markdown;
        
        // If window already exists, focus it
        if (mindmapWindow && !mindmapWindow.isDestroyed()) {
            mindmapWindow.focus();
            mindmapWindow.webContents.send('mindmap-data-updated', markdown);
            return { success: true };
        }
        
        // Create new window
        mindmapWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                webSecurity: false  // Allow loading external resources
            },
            title: 'Mind Map',
            backgroundColor: '#1a1a2e',
            autoHideMenuBar: true
        });
        
        mindmapWindow.loadFile(path.join(MUELSYSE_PATH, 'src/views/mindmap.html'));
        
        mindmapWindow.on('closed', () => {
            mindmapWindow = null;
            mindmapData = null;
        });
        
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// IPC handlers for mindmap window
ipcMain.handle('get-mindmap-data', () => {
    return { markdown: mindmapData };
});

ipcMain.handle('close-mindmap-window', () => {
    if (mindmapWindow && !mindmapWindow.isDestroyed()) {
        mindmapWindow.close();
    }
});

ipcMain.handle('muelsyse-pomodoro-start', async () => {
    try {
        if (!pomodoroTimer) {
            return { success: false, error: 'Timer not initialized' };
        }
        return pomodoroTimer.start();
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('muelsyse-pomodoro-pause', async () => {
    try {
        if (!pomodoroTimer) {
            return { success: false, error: 'Timer not initialized' };
        }
        return pomodoroTimer.pause();
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('muelsyse-pomodoro-stop', async () => {
    try {
        if (!pomodoroTimer) {
            return { success: false, error: 'Timer not initialized' };
        }
        return pomodoroTimer.stop();
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('muelsyse-pomodoro-get-state', async () => {
    try {
        if (!pomodoroTimer) {
            return { timeRemaining: 0, isRunning: false, type: 'work', pomodoros: 0 };
        }
        return pomodoroTimer.getState();
    } catch (error) {
        return { timeRemaining: 0, isRunning: false, type: 'work', pomodoros: 0 };
    }
});

ipcMain.handle('muelsyse-pomodoro-get-stats', async () => {
    try {
        if (!pomodoroTimer) {
            return { today: { pomodoros: 0, focusTime: 0 }, week: [], total: { pomodoros: 0, focusTime: 0 } };
        }
        return pomodoroTimer.getStats();
    } catch (error) {
        return { today: { pomodoros: 0, focusTime: 0 }, week: [], total: { pomodoros: 0, focusTime: 0 } };
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

app.whenReady().then(async () => {
    aiConfigManager = new AIConfigManager(app.getPath('userData'));
    scheduleManager = new ScheduleManager(app.getPath('userData'));
    memoManager = new MemoManager(app.getPath('userData'));
    reminderManager = new ReminderManager(app.getPath('userData'));
    aiToolRegistry = new AIToolRegistry({ scheduleManager, memoManager, reminderManager });
    fileManager = new FileManager();
    medicalLogger = new MedicalLogger();
    medicalTools = new MedicalTools();
    dingTalkConfigManager = new DingTalkConfigManager(app.getPath('userData'));
    
    documentParser = new DocumentParser();
    documentStore = new DocumentStore(app.getPath('userData'), aiConfigManager);
    ragEngine = new RAGEngine({ documentStore, aiConfigManager, operatorId: 'muelsyse' });
    
    learningSummarizer = new LearningSummarizer({ aiConfigManager, operatorId: 'muelsyse' });
    learningQA = new LearningQA({ ragEngine, documentStore });
    flashCardGenerator = new FlashCardGenerator({ aiConfigManager, documentStore, operatorId: 'muelsyse' });
    
    pomodoroTimer = new PomodoroTimer(app.getPath('userData'));
    pomodoroTimer.onComplete = (result) => {
        // Send to muelsyse learning window
        if (muelsyseLearningWindow && !muelsyseLearningWindow.isDestroyed()) {
            muelsyseLearningWindow.webContents.send('muelsyse-pomodoro-complete', result);
        }
    };
    pomodoroTimer.onTick = (state) => {
        // Send to muelsyse learning window
        if (muelsyseLearningWindow && !muelsyseLearningWindow.isDestroyed()) {
            muelsyseLearningWindow.webContents.send('muelsyse-pomodoro-tick', state);
        }
    };
    
    await initDingTalkConnector();
    
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

// === DingTalk Integration ===

async function initDingTalkConnector() {
    const agents = ['amiya', 'texas', 'kaltsit'];
    
    for (const agent of agents) {
        const connectorConfig = dingTalkConfigManager.getConnectorConfig(agent);
        const streamConfig = dingTalkConfigManager.getStreamConfig(agent);
        
        if (!connectorConfig || !connectorConfig.enabled) {
            console.log(`[DingTalk] ${agent} integration disabled`);
            continue;
        }
        
        // Initialize connector for sending messages
        dingTalkConnectors[agent] = new DingTalkConnector(connectorConfig);
        console.log(`[DingTalk] ${agent} connector initialized`);
        
        // Initialize Stream client for receiving messages
        if (streamConfig && streamConfig.appKey && streamConfig.appSecret) {
            const streamClient = new DingTalkStreamClient(streamConfig);
            
            streamClient.on('message', (message) => {
                handleDingTalkMessage(message, agent);
            });
            
            streamClient.on('connected', () => {
                console.log(`[DingTalk] ${agent} stream client connected`);
            });
            
            streamClient.on('error', (error) => {
                console.error(`[DingTalk] ${agent} stream client error:`, error.message);
            });
            
            dingTalkStreamClients[agent] = streamClient;
            
            const result = await streamClient.start();
            if (result.success) {
                console.log(`[DingTalk] ${agent} stream client started`);
            } else {
                console.error(`[DingTalk] ${agent} stream client failed:`, result.error);
            }
        } else {
            console.log(`[DingTalk] ${agent} stream mode not configured (missing appKey/appSecret)`);
        }
    }
}

async function handleDingTalkMessage(message, agent) {
    const { senderId, content, senderNick } = message;
    
    // Check if user has active session
    const sessionKey = `dingtalk_${agent}_${senderId}`;
    let session = dingTalkConversationHistory.get(sessionKey);
    
    if (!session) {
        session = { agent, history: [] };
        dingTalkConversationHistory.set(sessionKey, session);
    }
    
    // Route to appropriate handler based on agent
    if (agent === 'amiya') {
        await handleDingTalkAmiyaMessage(senderId, content, session);
    } else if (agent === 'texas') {
        await handleDingTalkTexasMessage(senderId, content, session);
    } else if (agent === 'kaltsit') {
        await handleDingTalkKaltsitMessage(senderId, content, session);
    }
}

async function handleDingTalkAmiyaMessage(userId, content, session) {
    try {
        const config = aiConfigManager.getOperatorConfig('amiya');
        
        session.history.push({ role: 'user', content });

        const prompt = buildToolChatPrompt(session.history, true);
        const rawToolAwareResponse = await callAI(config, prompt);
        const toolExecution = await maybeExecuteAITool(config, rawToolAwareResponse, session.history);
        const response = cleanToolAIResponse(toolExecution ? toolExecution.response : rawToolAwareResponse);

        session.history.push({ role: 'assistant', content: response });

        if (session.history.length > 20) {
            session.history = session.history.slice(-20);
        }
        
        if (dingTalkConnectors.amiya) {
            await dingTalkConnectors.amiya.sendTextMessage(response);
        }
        
    } catch (error) {
        console.error('[DingTalk] Amiya response error:', error);
        if (dingTalkConnectors.amiya) {
            await dingTalkConnectors.amiya.sendTextMessage('抱歉，处理消息时出错了，请稍后再试。');
        }
    }
}

async function handleDingTalkTexasMessage(userId, content, session) {
    const response = '德克萨斯的文件整理功能需要在桌面应用中操作。请在应用中右键点击德克萨斯，选择"File management"进入整理模式，然后将文件拖拽到她身上即可。';
    
    if (dingTalkConnectors.texas) {
        await dingTalkConnectors.texas.sendTextMessage(response);
    }
}

async function handleDingTalkKaltsitMessage(userId, content, session) {
    try {
        let config = aiConfigManager.getOperatorConfig('kaltsit');
        
        // If Kaltsit doesn't have a model configured, use global config
        if (!config.model) {
            const globalConfig = aiConfigManager.getConfig();
            if (globalConfig.global && globalConfig.global.model) {
                config = {
                    ...config,
                    model: globalConfig.global.model,
                    endpoint: globalConfig.global.endpoint || config.endpoint,
                    provider: globalConfig.global.provider || config.provider,
                    apiKey: globalConfig.global.apiKey || config.apiKey
                };
            }
        }
        
        if (!config.model) {
            if (dingTalkConnectors.kaltsit) {
                await dingTalkConnectors.kaltsit.sendTextMessage('抱歉，AI模型未配置，请在设置中配置模型。');
            }
            return;
        }
        
        let prompt = buildKaltsitSystemPrompt();
        
        if (session.history.length > 0) {
            prompt += '\n\n【对话历史】\n';
            for (const msg of session.history.slice(-10)) {
                prompt += `${msg.role === 'user' ? '博士' : '凯尔希'}: ${msg.content}\n`;
            }
        }
        
        prompt += `\n博士: ${content}\n凯尔希:`;
        
        const response = await callAI(config, prompt);
        
        session.history.push({ role: 'user', content });
        session.history.push({ role: 'assistant', content: response });
        
        if (session.history.length > 20) {
            session.history = session.history.slice(-20);
        }
        
        if (dingTalkConnectors.kaltsit) {
            await dingTalkConnectors.kaltsit.sendTextMessage(response);
        }
        
    } catch (error) {
        console.error('[DingTalk] Kaltsit response error:', error);
        if (dingTalkConnectors.kaltsit) {
            await dingTalkConnectors.kaltsit.sendTextMessage('抱歉，医疗咨询暂时无法处理，请稍后再试。');
        }
    }
}

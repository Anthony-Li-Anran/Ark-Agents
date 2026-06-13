/**
 * AI Configuration Manager
 * Handles LLM service detection, configuration, and management
 */

const { ipcMain, dialog, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
let _createAIProvider = null;

function setCreateAIProvider(factory) {
    _createAIProvider = factory;
}

const CONFIG_FILE = 'ai-config.json';

const defaultConfig = {
    provider: 'ollama',
    endpoint: 'http://127.0.0.1:11434',
    model: '',
    apiKey: '',
    isFirstRun: true,
    isConfigured: false,
    isFirstConnect: true,
    mirror: 'auto'
};

const defaultOperatorConfig = {
    provider: 'ollama',
    endpoint: 'http://127.0.0.1:11434',
    model: '',
    apiKey: '',
    isConfigured: false
};

const mirrors = {
    auto: { name: 'Auto (自动选择)', url: null },
    official: { name: 'Official (官方)', url: null },
    aliyun: { name: 'Aliyun (阿里云镜像)', url: 'https://mirrors.aliyun.com/ollama' },
    tencent: { name: 'Tencent (腾讯云镜像)', url: 'https://mirrors.cloud.tencent.com/ollama' }
};

// Supported providers
const providers = {
    ollama: {
        name: 'Ollama',
        defaultEndpoint: 'http://127.0.0.1:11434',
        defaultModel: '',
        models: [
            { id: 'qwen2.5:0.5b', name: 'Qwen 2.5 (0.5B) - 超轻量', size: '400MB', desc: '极小体积，适合极低配电脑，基础对话能力', category: 'small' },
            { id: 'qwen2.5:1.5b', name: 'Qwen 2.5 (1.5B) - 轻量', size: '1.0GB', desc: '轻量级，适合低配电脑，日常对话流畅', category: 'small' },
            { id: 'qwen2.5:3b', name: 'Qwen 2.5 (3B) - 入门', size: '1.9GB', desc: '入门级，平衡性能与资源占用', category: 'medium' },
            { id: 'qwen2.5:7b', name: 'Qwen 2.5 (7B) - 推荐', size: '4.7GB', desc: '中文表现优秀，平衡性能，适合大多数用户', category: 'medium' },
            { id: 'qwen2.5:14b', name: 'Qwen 2.5 (14B) - 高性能', size: '9.0GB', desc: '高性能，需要较好的显卡', category: 'large' },
            { id: 'qwen2.5:32b', name: 'Qwen 2.5 (32B) - 旗舰', size: '20GB', desc: '旗舰级性能，需要高端配置', category: 'large' }
        ],
        requiresApiKey: false
    },
    lmstudio: {
        name: 'LM Studio',
        defaultEndpoint: 'http://127.0.0.1:1234/v1',
        defaultModel: 'local-model',
        models: [],
        requiresApiKey: false
    },
    openai: {
        name: 'OpenAI',
        defaultEndpoint: 'https://api.openai.com/v1',
        defaultModel: 'gpt-4o-mini',
        models: [
            { id: 'gpt-4o', name: 'GPT-4o', desc: '最新旗舰模型' },
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini', desc: '性价比高' },
            { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', desc: '高性能' },
            { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', desc: '经济实惠' }
        ],
        requiresApiKey: true
    },
    anthropic: {
        name: 'Anthropic (Claude)',
        defaultEndpoint: 'https://api.anthropic.com/v1',
        defaultModel: 'claude-3-5-sonnet-latest',
        models: [
            { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet', desc: '最新推荐' },
            { id: 'claude-3-opus-latest', name: 'Claude 3 Opus', desc: '最强性能' },
            { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', desc: '平衡性能' },
            { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', desc: '快速响应' }
        ],
        requiresApiKey: true
    },
    deepseek: {
        name: 'DeepSeek',
        defaultEndpoint: 'https://api.deepseek.com/v1',
        defaultModel: 'deepseek-chat',
        models: [
            { id: 'deepseek-chat', name: 'DeepSeek Chat', desc: '通用对话' },
            { id: 'deepseek-coder', name: 'DeepSeek Coder', desc: '代码专用' }
        ],
        requiresApiKey: true
    },
    zhipu: {
        name: '智谱 AI',
        defaultEndpoint: 'https://open.bigmodel.cn/api/paas/v4',
        defaultModel: 'glm-4-flash',
        models: [
            { id: 'glm-4', name: 'GLM-4', desc: '旗舰模型' },
            { id: 'glm-4-flash', name: 'GLM-4-Flash', desc: '快速免费' },
            { id: 'glm-4-plus', name: 'GLM-4-Plus', desc: '增强版' },
            { id: 'glm-3-turbo', name: 'GLM-3-Turbo', desc: '经典版' }
        ],
        requiresApiKey: true
    },
    moonshot: {
        name: 'Moonshot (Kimi)',
        defaultEndpoint: 'https://api.moonshot.cn/v1',
        defaultModel: 'moonshot-v1-8k',
        models: [
            { id: 'moonshot-v1-8k', name: 'Moonshot V1 8K', desc: '标准上下文' },
            { id: 'moonshot-v1-32k', name: 'Moonshot V1 32K', desc: '长上下文' },
            { id: 'moonshot-v1-128k', name: 'Moonshot V1 128K', desc: '超长上下文' }
        ],
        requiresApiKey: true
    },
    qwen: {
        name: '通义千问',
        defaultEndpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        defaultModel: 'qwen-turbo',
        models: [
            { id: 'qwen-turbo', name: 'Qwen Turbo', desc: '快速响应' },
            { id: 'qwen-plus', name: 'Qwen Plus', desc: '平衡性能' },
            { id: 'qwen-max', name: 'Qwen Max', desc: '最强性能' },
            { id: 'qwen-long', name: 'Qwen Long', desc: '长上下文' }
        ],
        requiresApiKey: true
    },
    custom: {
        name: '自定义 API',
        defaultEndpoint: '',
        defaultModel: '',
        models: [],
        requiresApiKey: true
    }
};

class AIConfigManager {
    constructor(appDataPath) {
        this.configPath = path.join(appDataPath, CONFIG_FILE);
        this.config = this.loadConfig();
        this.setupIPC();
    }

    normalizeConfig(config) {
        const normalized = { ...defaultConfig, ...(config || {}) };

        if (typeof normalized.provider === 'string') {
            normalized.provider = normalized.provider.trim() || defaultConfig.provider;
        }
        if (typeof normalized.endpoint === 'string') {
            normalized.endpoint = normalized.endpoint.trim().replace(/\/+$/, '');
        }
        if (typeof normalized.model === 'string') {
            normalized.model = normalized.model.trim();
        }
        if (typeof normalized.apiKey === 'string') {
            normalized.apiKey = normalized.apiKey.trim();
        }

        if (!normalized.endpoint) {
            normalized.endpoint = providers[normalized.provider]?.defaultEndpoint || defaultConfig.endpoint;
        }
        return normalized;
    }

    normalizeOperatorConfig(config) {
        const normalized = { ...defaultOperatorConfig, ...(config || {}) };
        if (typeof normalized.provider === 'string') {
            normalized.provider = normalized.provider.trim() || defaultOperatorConfig.provider;
        }
        if (typeof normalized.endpoint === 'string') {
            normalized.endpoint = normalized.endpoint.trim().replace(/\/+$/, '');
        }
        if (typeof normalized.model === 'string') {
            normalized.model = normalized.model.trim();
        }
        if (typeof normalized.apiKey === 'string') {
            normalized.apiKey = normalized.apiKey.trim();
        }
        if (!normalized.endpoint) {
            normalized.endpoint = providers[normalized.provider]?.defaultEndpoint || defaultOperatorConfig.endpoint;
        }
        return normalized;
    }

    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const data = fs.readFileSync(this.configPath, 'utf-8');
                const raw = JSON.parse(data);
                return {
                    global: {
                        ...defaultConfig,
                        ...(raw.global || {}),
                        isFirstRun: raw.global?.isFirstRun ?? true,
                        isFirstConnect: raw.global?.isFirstConnect ?? true,
                        mirror: raw.global?.mirror || 'auto'
                    },
                    operators: raw.operators || {}
                };
            }
        } catch (error) {
            console.warn('Failed to load AI config:', error);
        }
        return {
            global: { ...defaultConfig },
            operators: {}
        };
    }

    saveConfig() {
        try {
            fs.mkdirSync(path.dirname(this.configPath), { recursive: true });
            const data = JSON.stringify(this.config, null, 2);
            fs.writeFileSync(this.configPath, data);
            console.log('[AI Config] Config saved successfully to:', this.configPath);
            console.log('[AI Config] Saved data:', data.substring(0, 500));
            return true;
        } catch (error) {
            console.error('[AI Config] Failed to save:', error);
            return false;
        }
    }

    getConfig() {
        this.config = this.loadConfig();
        return { ...this.config.global };
    }

    updateConfig(updates) {
        this.config.global = this.normalizeConfig({ ...this.config.global, ...updates });
        return this.saveConfig();
    }

    getOperatorConfig(operatorId) {
        this.config = this.loadConfig();
        const opConfig = this.config.operators[operatorId] || {};
        return this.normalizeOperatorConfig(opConfig);
    }

    updateOperatorConfig(operatorId, updates) {
        console.log(`[AI Config] Updating operator ${operatorId} with:`, updates);
        this.config.operators[operatorId] = this.normalizeOperatorConfig({
            ...(this.config.operators[operatorId] || {}),
            ...updates
        });
        const result = this.saveConfig();
        console.log(`[AI Config] Save result:`, result, 'Config path:', this.configPath);
        return result;
    }

    hasModel(models, modelName) {
        if (!modelName) return true;
        return (models || []).some((model) => {
            const name = model.name || model.id || model.model;
            return name === modelName;
        });
    }

    async isOllamaServiceRunning() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            const response = await fetch('http://127.0.0.1:11434/api/tags', {
                method: 'GET',
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response.ok;
        } catch {
            return false;
        }
    }

    async startOllamaService() {
        try {
            const ollamaPath = await this.getOllamaExecutable();
            if (!ollamaPath) {
                console.log('[AI Config] Ollama executable not found, cannot auto-start');
                return false;
            }

            console.log('[AI Config] Attempting to start Ollama service...');

            // Use spawn to start Ollama in the background
            const child = spawn(ollamaPath, ['serve'], {
                detached: true,
                windowsHide: true,
                stdio: 'ignore'
            });

            child.unref();

            // Wait a moment for the service to start, then verify
            await new Promise(resolve => setTimeout(resolve, 2500));

            const isRunning = await this.isOllamaServiceRunning();
            if (isRunning) {
                console.log('[AI Config] Ollama service started successfully');
            } else {
                console.log('[AI Config] Ollama service may still be starting...');
            }
            return isRunning;
        } catch (error) {
            console.error('[AI Config] Failed to start Ollama service:', error.message);
            return false;
        }
    }

    async getOllamaExecutable() {
        const command = process.platform === 'win32' ? 'where ollama' : 'which ollama';

        try {
            const { stdout } = await execPromise(command);
            const firstPath = stdout.split(/\r?\n/).map(line => line.trim()).find(Boolean);
            if (firstPath && fs.existsSync(firstPath)) {
                return firstPath;
            }
        } catch {
            // Continue with common install locations below.
        }

        const candidates = process.platform === 'win32'
            ? [
                path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe'),
                path.join(process.env.ProgramFiles || '', 'Ollama', 'ollama.exe'),
                path.join(process.env['ProgramFiles(x86)'] || '', 'Ollama', 'ollama.exe')
            ]
            : ['/usr/local/bin/ollama', '/usr/bin/ollama'];

        return candidates.find(candidate => candidate && fs.existsSync(candidate)) || null;
    }

    parseOllamaList(output) {
        return output
            .split(/\r?\n/)
            .slice(1)
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => {
                const [name, id, size, ...modifiedParts] = line.split(/\s{2,}|\t+/).filter(Boolean);
                return {
                    name,
                    id,
                    size,
                    modified_at: modifiedParts.join(' ')
                };
            })
            .filter((model) => model.name);
    }

    async listOllamaModels() {
        // First, try to fetch models via HTTP API
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch('http://127.0.0.1:11434/api/tags', {
                method: 'GET',
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                console.log('[AI Config] Ollama models fetched:', data.models);
                return { success: true, models: data.models || [] };
            }
        } catch (error) {
            console.log('[AI Config] Ollama HTTP service not running, attempting auto-start...');
        }

        // If HTTP API is not available, check if Ollama is installed and try to auto-start
        const ollamaPath = await this.getOllamaExecutable();
        if (ollamaPath) {
            const started = await this.startOllamaService();
            if (started) {
                // Retry fetching models after auto-start
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 5000);

                    const response = await fetch('http://127.0.0.1:11434/api/tags', {
                        method: 'GET',
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);

                    if (response.ok) {
                        const data = await response.json();
                        console.log('[AI Config] Ollama models fetched after auto-start:', data.models);
                        return { success: true, models: data.models || [] };
                    }
                } catch (error) {
                    console.log('[AI Config] Fetch error after auto-start:', error.message);
                }
            }
        } else {
            console.log('[AI Config] Ollama executable not found, skipping auto-start');
        }

        // Final fallback: try CLI
        try {
            if (!ollamaPath) {
                return { success: false, models: [], message: 'Ollama executable was not found.' };
            }
            const { stdout } = await execPromise(`"${ollamaPath}" list`);
            return { success: true, models: this.parseOllamaList(stdout) };
        } catch (error) {
            return { success: false, models: [], message: error.message };
        }
    }

    parsePullProgress(text) {
        const cleanText = String(text || '')
            .replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        if (!cleanText) {
            return null;
        }

        const percentMatch = cleanText.match(/(\d{1,3})\s*%/);
        const percent = percentMatch ? Math.max(0, Math.min(100, Number(percentMatch[1]))) : null;

        return {
            percent,
            status: cleanText
        };
    }

    sendPullProgress(sender, payload) {
        if (sender && !sender.isDestroyed()) {
            sender.send('ai-pull-model-progress', payload);
        }
    }

    // Detect local LLM services
    async detectLocalServices() {
        const services = [];

        // Helper for fetch with timeout
        const fetchWithTimeout = async (url, options = {}, timeoutMs = 3000) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const response = await fetch(url, { ...options, signal: controller.signal });
                clearTimeout(timeoutId);
                return response;
            } catch (error) {
                clearTimeout(timeoutId);
                throw error;
            }
        };

        // Check Ollama
        try {
            const response = await fetchWithTimeout('http://127.0.0.1:11434/api/tags', { method: 'GET' });
            if (response.ok) {
                const data = await response.json();
                services.push({
                    provider: 'ollama',
                    name: 'Ollama',
                    endpoint: 'http://127.0.0.1:11434',
                    models: data.models || [],
                    status: 'running'
                });
            }
        } catch (error) {
            // Ollama not running
        }

        // Check LM Studio
        try {
            const response = await fetchWithTimeout('http://127.0.0.1:1234/v1/models', { method: 'GET' });
            if (response.ok) {
                const data = await response.json();
                services.push({
                    provider: 'lmstudio',
                    name: 'LM Studio',
                    endpoint: 'http://127.0.0.1:1234',
                    models: data.data || [],
                    status: 'running'
                });
            }
        } catch (error) {
            // LM Studio not running
        }

        return services;
    }

    // Test connection to a service
    async testConnection(config) {
        try {
            // For Ollama, try auto-start if not running before testing
            if (config.provider === 'ollama') {
                if (!config.model) {
                    return {
                        success: false,
                        message: 'No Ollama model selected. Please choose a local model or download one.',
                        models: []
                    };
                }

                const isRunning = await this.isOllamaServiceRunning();
                if (!isRunning) {
                    const ollamaPath = await this.getOllamaExecutable();
                    if (ollamaPath) {
                        console.log('[AI Config] Ollama not running during test, attempting auto-start...');
                        await this.startOllamaService();
                    }
                }
            }

            if (!_createAIProvider) {
                throw new Error('AI Provider factory not set. Call setCreateAIProvider() first.');
            }
            const provider = _createAIProvider(config);
            return await provider.testConnection();
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    // Check if Ollama is installed
    async isOllamaInstalled() {
        if (await this.isOllamaServiceRunning()) {
            return true;
        }
        return Boolean(await this.getOllamaExecutable());
    }

    // Get Ollama download URL based on platform
    getOllamaDownloadUrl() {
        const platform = process.platform;
        const arch = process.arch;
        
        if (platform === 'win32') {
            return 'https://ollama.com/download/OllamaSetup.exe';
        } else if (platform === 'darwin') {
            return arch === 'arm64' 
                ? 'https://ollama.com/download/Ollama-darwin-arm64.zip'
                : 'https://ollama.com/download/Ollama-darwin-amd64.zip';
        } else if (platform === 'linux') {
            return 'https://ollama.com/download/ollama-linux-amd64.tgz';
        }
        return null;
    }

    // Open Ollama download page
    async downloadOllama() {
        const url = this.getOllamaDownloadUrl();
        if (url) {
            await shell.openExternal(url);
            return { success: true, message: '已打开下载页面' };
        }
        return { success: false, message: '不支持的平台' };
    }

    // Pull a model in Ollama
    async pullModel(modelName, sender = null, mirrorKey = null) {
        return new Promise((resolve) => {
            this.getOllamaExecutable().then((ollamaPath) => {
                if (!ollamaPath) {
                    resolve({ success: false, message: 'Ollama executable was not found.' });
                    return;
                }

                this.sendPullProgress(sender, {
                    modelName,
                    percent: 0,
                    status: `Starting download for ${modelName}...`
                });

                // 设置镜像源和模型路径环境变量
                const env = { ...process.env };
                const selectedMirror = mirrorKey || this.config.mirror || 'auto';
                
                if (selectedMirror !== 'auto' && mirrors[selectedMirror]?.url) {
                    env.OLLAMA_MIRRORS = mirrors[selectedMirror].url;
                    this.sendPullProgress(sender, {
                        modelName,
                        percent: 0,
                        status: `Using mirror: ${mirrors[selectedMirror].name}`
                    });
                }

                // 设置自定义模型存储路径
                if (this.config.modelPath) {
                    env.OLLAMA_MODELS = this.config.modelPath;
                    this.sendPullProgress(sender, {
                        modelName,
                        percent: 0,
                        status: `Saving to: ${this.config.modelPath}`
                    });
                }

                const pullProcess = spawn(ollamaPath, ['pull', modelName], {
                    detached: false,
                    windowsHide: true,
                    env: env
                });

            let output = '';
            let errorOutput = '';
            let lastPercent = 0;

            const handleProgress = (data) => {
                const segments = data.toString().split(/\r?\n|\r/).map(part => part.trim()).filter(Boolean);
                for (const segment of segments) {
                    const progress = this.parsePullProgress(segment);
                    if (!progress) continue;

                    if (progress.percent !== null) {
                        lastPercent = Math.max(lastPercent, progress.percent);
                    }

                    this.sendPullProgress(sender, {
                        modelName,
                        percent: progress.percent !== null ? lastPercent : null,
                        status: progress.status
                    });
                }
            };

            pullProcess.stdout.on('data', (data) => {
                output += data.toString();
                handleProgress(data);
            });

            pullProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
                handleProgress(data);
            });

            pullProcess.on('close', (code) => {
                if (code === 0) {
                    this.sendPullProgress(sender, {
                        modelName,
                        percent: 100,
                        status: `Downloaded ${modelName}.`
                    });
                    resolve({ success: true, message: '模型下载完成' });
                } else {
                    this.sendPullProgress(sender, {
                        modelName,
                        percent: lastPercent || null,
                        status: errorOutput || output || 'Download failed.'
                    });
                    resolve({ success: false, message: errorOutput || '下载失败' });
                }
            });

            pullProcess.on('error', (error) => {
                this.sendPullProgress(sender, {
                    modelName,
                    percent: lastPercent || null,
                    status: error.message
                });
                resolve({ success: false, message: error.message });
            });
            }).catch((error) => {
                resolve({ success: false, message: error.message });
            });
        });
    }

    // Delete a model from Ollama
    async deleteModel(modelName) {
        try {
            const ollamaPath = await this.getOllamaExecutable();
            if (!ollamaPath) {
                return { success: false, message: 'Ollama executable was not found.' };
            }

            const { stdout, stderr } = await execPromise(`"${ollamaPath}" rm "${modelName}"`);
            return { success: true, message: `Model ${modelName} deleted.` };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    // Setup IPC handlers
    setupIPC() {
        // Get current config (global)
        ipcMain.handle('ai-get-config', () => {
            return this.getConfig();
        });

        // Update config (global)
        ipcMain.handle('ai-update-config', (event, updates) => {
            return this.updateConfig(updates);
        });

        // Get operator-specific config
        ipcMain.handle('ai-get-operator-config', (event, operatorId) => {
            return this.getOperatorConfig(operatorId);
        });

        // Update operator-specific config
        ipcMain.handle('ai-update-operator-config', (event, operatorId, updates) => {
            return this.updateOperatorConfig(operatorId, updates);
        });

        // Detect local services
        ipcMain.handle('ai-detect-services', async () => {
            return await this.detectLocalServices();
        });

        // Test connection
        ipcMain.handle('ai-test-connection', async (event, config) => {
            return await this.testConnection(config);
        });

        // Check if Ollama is installed
        ipcMain.handle('ai-is-ollama-installed', async () => {
            return await this.isOllamaInstalled();
        });

        // Download Ollama
        ipcMain.handle('ai-download-ollama', async () => {
            return await this.downloadOllama();
        });

        // Pull model
        ipcMain.handle('ai-pull-model', async (event, modelName, mirrorKey) => {
            return await this.pullModel(modelName, event.sender, mirrorKey);
        });

        ipcMain.handle('ai-list-ollama-models', async () => {
            return await this.listOllamaModels();
        });

        // Get providers info
        ipcMain.handle('ai-get-providers', () => {
            return providers;
        });

        // Get mirrors info
        ipcMain.handle('ai-get-mirrors', () => {
            return mirrors;
        });

        // Select model storage path
        ipcMain.handle('ai-select-model-path', async () => {
            const result = await dialog.showOpenDialog({
                title: 'Select Model Storage Folder',
                properties: ['openDirectory', 'createDirectory'],
                buttonLabel: 'Select Folder'
            });
            
            if (!result.canceled && result.filePaths.length > 0) {
                const selectedPath = result.filePaths[0];
                this.config.modelPath = selectedPath;
                this.saveConfig();
                return { path: selectedPath };
            }
            return null;
        });

        // Get current model path
        ipcMain.handle('ai-get-model-path', () => {
            return this.config.modelPath || process.env.OLLAMA_MODELS || null;
        });

        // Get installed models
        ipcMain.handle('ai-get-installed-models', async () => {
            return await this.listOllamaModels();
        });

        // Delete a model
        ipcMain.handle('ai-delete-model', async (event, modelName) => {
            return await this.deleteModel(modelName);
        });

        // Mark as connected (disable first connect message)
        ipcMain.handle('ai-mark-connected', () => {
            this.config.isFirstConnect = false;
            return this.saveConfig();
        });
    }
}

module.exports = { AIConfigManager, providers, mirrors, setCreateAIProvider };

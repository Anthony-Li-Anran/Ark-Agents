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

const CONFIG_FILE = 'ai-config.json';

// Default configuration
const defaultConfig = {
    provider: 'ollama', // 'ollama', 'lmstudio', 'openai', 'custom'
    endpoint: 'http://127.0.0.1:11434',
    model: '',
    apiKey: '',
    isFirstRun: true,
    isConfigured: false,
    isFirstConnect: true // Show takeover message on first successful connection
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
        defaultEndpoint: 'http://127.0.0.1:1234',
        defaultModel: 'local-model',
        models: [],
        requiresApiKey: false
    },
    openai: {
        name: 'OpenAI API',
        defaultEndpoint: 'https://api.openai.com/v1',
        defaultModel: 'gpt-3.5-turbo',
        models: [
            { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', desc: '性价比高' },
            { id: 'gpt-4', name: 'GPT-4', desc: '最强性能' }
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

    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const data = fs.readFileSync(this.configPath, 'utf-8');
                return this.normalizeConfig(JSON.parse(data));
            }
        } catch (error) {
            console.warn('Failed to load AI config:', error);
        }
        return this.normalizeConfig(defaultConfig);
    }

    saveConfig() {
        try {
            fs.mkdirSync(path.dirname(this.configPath), { recursive: true });
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
            return true;
        } catch (error) {
            console.error('Failed to save AI config:', error);
            return false;
        }
    }

    getConfig() {
        this.config = this.loadConfig();
        return { ...this.config };
    }

    updateConfig(updates) {
        this.config = this.normalizeConfig({ ...this.config, ...updates });
        return this.saveConfig();
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
            const response = await fetch('http://127.0.0.1:11434/api/tags', {
                method: 'GET',
                timeout: 3000
            });
            return response.ok;
        } catch {
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
        try {
            const response = await fetch('http://127.0.0.1:11434/api/tags', {
                method: 'GET',
                timeout: 5000
            });
            if (response.ok) {
                const data = await response.json();
                return { success: true, models: data.models || [] };
            }
        } catch {
            // Fall back to the CLI below when the local HTTP service is not ready.
        }

        try {
            const ollamaPath = await this.getOllamaExecutable();
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

        // Check Ollama
        try {
            const response = await fetch('http://127.0.0.1:11434/api/tags', { 
                method: 'GET',
                timeout: 3000 
            });
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
            const response = await fetch('http://127.0.0.1:1234/v1/models', {
                method: 'GET',
                timeout: 3000
            });
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
            if (config.provider === 'ollama') {
                if (!config.model) {
                    return {
                        success: false,
                        message: 'No Ollama model selected. Please choose a local model or download one.',
                        models: []
                    };
                }
                const response = await fetch(`${config.endpoint}/api/tags`, {
                    method: 'GET',
                    timeout: 5000
                });
                if (response.ok) {
                    const data = await response.json();
                    const models = data.models || [];
                    if (!this.hasModel(models, config.model)) {
                        return {
                            success: false,
                            message: `Ollama model "${config.model}" is not installed. Run: ollama pull ${config.model}`,
                            models
                        };
                    }
                    return { 
                        success: true, 
                        message: '连接成功',
                        models
                    };
                }
            } else if (config.provider === 'lmstudio') {
                const response = await fetch(`${config.endpoint}/v1/models`, {
                    method: 'GET',
                    timeout: 5000
                });
                if (response.ok) {
                    const data = await response.json();
                    return { 
                        success: true, 
                        message: '连接成功',
                        models: data.data || []
                    };
                }
            } else if (config.provider === 'openai' || config.provider === 'custom') {
                const headers = { 'Content-Type': 'application/json' };
                if (config.apiKey) {
                    headers['Authorization'] = `Bearer ${config.apiKey}`;
                }
                const response = await fetch(`${config.endpoint}/models`, {
                    method: 'GET',
                    headers,
                    timeout: 5000
                });
                if (response.ok) {
                    return { success: true, message: '连接成功' };
                }
            }
            return { success: false, message: '无法连接到服务' };
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
    async pullModel(modelName, sender = null) {
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

                const pullProcess = spawn(ollamaPath, ['pull', modelName], {
                    detached: false,
                    windowsHide: true
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

    // Setup IPC handlers
    setupIPC() {
        // Get current config
        ipcMain.handle('ai-get-config', () => {
            return this.getConfig();
        });

        // Update config
        ipcMain.handle('ai-update-config', (event, updates) => {
            return this.updateConfig(updates);
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
        ipcMain.handle('ai-pull-model', async (event, modelName) => {
            return await this.pullModel(modelName, event.sender);
        });

        ipcMain.handle('ai-list-ollama-models', async () => {
            return await this.listOllamaModels();
        });

        // Get providers info
        ipcMain.handle('ai-get-providers', () => {
            return providers;
        });

        // Mark as connected (disable first connect message)
        ipcMain.handle('ai-mark-connected', () => {
            this.config.isFirstConnect = false;
            return this.saveConfig();
        });
    }
}

module.exports = { AIConfigManager, providers };

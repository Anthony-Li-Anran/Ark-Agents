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
    model: 'qwen2.5:7b',
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
        defaultModel: 'qwen2.5:7b',
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

    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const data = fs.readFileSync(this.configPath, 'utf-8');
                return { ...defaultConfig, ...JSON.parse(data) };
            }
        } catch (error) {
            console.warn('Failed to load AI config:', error);
        }
        return { ...defaultConfig };
    }

    saveConfig() {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
            return true;
        } catch (error) {
            console.error('Failed to save AI config:', error);
            return false;
        }
    }

    getConfig() {
        return { ...this.config };
    }

    updateConfig(updates) {
        this.config = { ...this.config, ...updates };
        return this.saveConfig();
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
                const response = await fetch(`${config.endpoint}/api/tags`, {
                    method: 'GET',
                    timeout: 5000
                });
                if (response.ok) {
                    const data = await response.json();
                    return { 
                        success: true, 
                        message: '连接成功',
                        models: data.models || []
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
        try {
            if (process.platform === 'win32') {
                await execPromise('where ollama');
            } else {
                await execPromise('which ollama');
            }
            return true;
        } catch {
            return false;
        }
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
    async pullModel(modelName) {
        return new Promise((resolve) => {
            const pullProcess = spawn('ollama', ['pull', modelName], {
                detached: false,
                windowsHide: true
            });

            let output = '';
            let errorOutput = '';

            pullProcess.stdout.on('data', (data) => {
                output += data.toString();
            });

            pullProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            pullProcess.on('close', (code) => {
                if (code === 0) {
                    resolve({ success: true, message: '模型下载完成' });
                } else {
                    resolve({ success: false, message: errorOutput || '下载失败' });
                }
            });

            pullProcess.on('error', (error) => {
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
            return await this.pullModel(modelName);
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

const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

const AMIYA_CONFIG_FILE = 'ai-config.json';
const KALTSIT_CONFIG_FILE = 'medical-config.json';

const defaultMedicalConfig = {
    enableMedicalMode: true,
    autoDiagnosis: false,
    verboseOutput: true
};

class MedicalConfigManager {
    constructor(appDataPath) {
        this.appDataPath = appDataPath;
        this.amiyaConfigPath = path.join(appDataPath, AMIYA_CONFIG_FILE);
        this.kaltsitConfigPath = path.join(appDataPath, KALTSIT_CONFIG_FILE);
        this.medicalConfig = this.loadMedicalConfig();
        this.setupIPC();
    }

    loadMedicalConfig() {
        try {
            if (fs.existsSync(this.kaltsitConfigPath)) {
                const data = fs.readFileSync(this.kaltsitConfigPath, 'utf-8');
                return { ...defaultMedicalConfig, ...JSON.parse(data) };
            }
        } catch (error) {
            console.warn('Failed to load medical config:', error);
        }
        return { ...defaultMedicalConfig };
    }

    saveMedicalConfig() {
        try {
            fs.mkdirSync(path.dirname(this.kaltsitConfigPath), { recursive: true });
            fs.writeFileSync(this.kaltsitConfigPath, JSON.stringify(this.medicalConfig, null, 2));
            return true;
        } catch (error) {
            console.error('Failed to save medical config:', error);
            return false;
        }
    }

    getConfig() {
        const amiyaConfig = this.loadAmiyaConfig();
        return {
            ai: amiyaConfig,
            medical: { ...this.medicalConfig }
        };
    }

    loadAmiyaConfig() {
        try {
            if (fs.existsSync(this.amiyaConfigPath)) {
                const data = fs.readFileSync(this.amiyaConfigPath, 'utf-8');
                const config = JSON.parse(data);
                return this.normalizeConfig(config);
            }
        } catch (error) {
            console.warn('Failed to load Amiya AI config:', error);
        }
        return this.getDefaultAmiyaConfig();
    }

    normalizeConfig(config) {
        const defaultConfig = this.getDefaultAmiyaConfig();
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
            normalized.endpoint = this.getProviderDefaultEndpoint(normalized.provider);
        }
        return normalized;
    }

    getDefaultAmiyaConfig() {
        return {
            provider: 'ollama',
            endpoint: 'http://127.0.0.1:11434',
            model: '',
            apiKey: '',
            isFirstRun: true,
            isConfigured: false,
            isFirstConnect: true,
            mirror: 'auto'
        };
    }

    getProviderDefaultEndpoint(provider) {
        const endpoints = {
            ollama: 'http://127.0.0.1:11434',
            lmstudio: 'http://127.0.0.1:1234',
            openai: 'https://api.openai.com/v1'
        };
        return endpoints[provider] || '';
    }

    getSystemPrompt() {
        return {
            system_prompt: ''
        };
    }

    validateConfig() {
        const amiyaConfig = this.loadAmiyaConfig();
        const errors = [];

        if (!amiyaConfig.provider) {
            errors.push('Provider is not configured');
        }

        if (!amiyaConfig.endpoint) {
            errors.push('Endpoint is not configured');
        }

        if (!amiyaConfig.model) {
            errors.push('Model is not selected');
        }

        if (amiyaConfig.provider === 'openai' && !amiyaConfig.apiKey) {
            errors.push('API key is required for OpenAI provider');
        }

        if (amiyaConfig.provider === 'custom' && !amiyaConfig.apiKey) {
            errors.push('API key is required for custom provider');
        }

        return {
            valid: errors.length === 0,
            errors: errors,
            config: amiyaConfig
        };
    }

    updateMedicalConfig(updates) {
        this.medicalConfig = { ...this.medicalConfig, ...updates };
        return this.saveMedicalConfig();
    }

    async testConnection() {
        const config = this.loadAmiyaConfig();
        
        if (!config.endpoint) {
            return { success: false, message: 'Endpoint is not configured' };
        }

        try {
            let testUrl;
            let headers = { 'Content-Type': 'application/json' };

            if (config.provider === 'ollama') {
                testUrl = `${config.endpoint}/api/tags`;
            } else if (config.provider === 'lmstudio') {
                testUrl = `${config.endpoint}/v1/models`;
            } else {
                testUrl = `${config.endpoint}/models`;
                if (config.apiKey) {
                    headers['Authorization'] = `Bearer ${config.apiKey}`;
                }
            }

            const response = await fetch(testUrl, {
                method: 'GET',
                headers,
                signal: AbortSignal.timeout(5000)
            });

            if (response.ok) {
                return { success: true, message: '连接成功' };
            }
            return { success: false, message: `连接失败: HTTP ${response.status}` };
        } catch (error) {
            return { success: false, message: error.message || '连接失败' };
        }
    }

    setupIPC() {
        ipcMain.handle('medical-get-config', () => {
            return this.getConfig();
        });

        ipcMain.handle('medical-get-system-prompt', () => {
            return this.getSystemPrompt();
        });

        ipcMain.handle('medical-validate-config', () => {
            return this.validateConfig();
        });

        ipcMain.handle('medical-update-config', (event, updates) => {
            return this.updateMedicalConfig(updates);
        });

        ipcMain.handle('medical-test-connection', async () => {
            return await this.testConnection();
        });

        ipcMain.handle('medical-get-ai-config', () => {
            return this.loadAmiyaConfig();
        });
    }
}

module.exports = { MedicalConfigManager };

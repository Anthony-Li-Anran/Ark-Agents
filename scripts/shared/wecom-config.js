/**
 * WeCom Configuration Manager
 * Manages Enterprise WeChat integration settings for agents
 */

const fs = require('fs');
const path = require('path');
const { ipcMain } = require('electron');

const CONFIG_FILE = 'wecom-config.json';

// Default configuration
const defaultConfig = {
    enabled: false,
    corpId: '',
    agentId: '',
    secret: '',
    token: '',
    encodingAESKey: '',
    webhookPort: 3000,
    agents: {
        amiya: {
            enabled: true,
            welcomeMessage: '你好，我是阿米娅，有什么可以帮你的吗？',
            systemPrompt: ''
        },
        texas: {
            enabled: false,
            welcomeMessage: '德克萨斯，文件整理专家。',
            systemPrompt: ''
        },
        kaltsit: {
            enabled: false,
            welcomeMessage: '凯尔希。健康相关问题可以问我。',
            systemPrompt: ''
        }
    }
};

class WeComConfigManager {
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
            console.warn('[WeComConfig] Failed to load config:', error);
        }
        return { ...defaultConfig };
    }

    saveConfig() {
        try {
            fs.mkdirSync(path.dirname(this.configPath), { recursive: true });
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
            return true;
        } catch (error) {
            console.error('[WeComConfig] Failed to save config:', error);
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

    updateAgentConfig(agentId, agentConfig) {
        if (!this.config.agents[agentId]) {
            this.config.agents[agentId] = {};
        }
        this.config.agents[agentId] = { ...this.config.agents[agentId], ...agentConfig };
        return this.saveConfig();
    }

    getAgentConfig(agentId) {
        return this.config.agents[agentId] || null;
    }

    isAgentEnabled(agentId) {
        return this.config.enabled && 
               this.config.agents[agentId]?.enabled;
    }

    getConnectorConfig() {
        return {
            corpId: this.config.corpId,
            agentId: this.config.agentId,
            secret: this.config.secret,
            token: this.config.token,
            encodingAESKey: this.config.encodingAESKey,
            webhookPort: this.config.webhookPort,
            enabled: this.config.enabled
        };
    }

    setupIPC() {
        // Get WeCom config
        ipcMain.handle('wecom-get-config', () => {
            return this.getConfig();
        });

        // Update WeCom config
        ipcMain.handle('wecom-update-config', (event, updates) => {
            return this.updateConfig(updates);
        });

        // Get agent config
        ipcMain.handle('wecom-get-agent-config', (event, agentId) => {
            return this.getAgentConfig(agentId);
        });

        // Update agent config
        ipcMain.handle('wecom-update-agent-config', (event, agentId, config) => {
            return this.updateAgentConfig(agentId, config);
        });

        // Check if agent is enabled
        ipcMain.handle('wecom-is-agent-enabled', (event, agentId) => {
            return this.isAgentEnabled(agentId);
        });

        // Test WeCom connection
        ipcMain.handle('wecom-test-connection', async () => {
            const { WeComConnector } = require('./wecom-connector');
            const connector = new WeComConnector(this.getConnectorConfig());
            return await connector.testConnection();
        });

        // Start webhook server
        ipcMain.handle('wecom-start-webhook', async () => {
            const { WeComConnector } = require('./wecom-connector');
            const connector = new WeComConnector(this.getConnectorConfig());
            return await connector.startWebhookServer();
        });

        // Stop webhook server
        ipcMain.handle('wecom-stop-webhook', () => {
            // This will be handled by the main process
            return { success: true };
        });
    }
}

module.exports = { WeComConfigManager };

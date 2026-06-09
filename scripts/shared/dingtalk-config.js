/**
 * DingTalk Configuration Manager
 * Manages DingTalk robot integration settings for each agent independently
 */

const fs = require('fs');
const path = require('path');
const { ipcMain } = require('electron');

const CONFIG_FILE = 'dingtalk-config.json';

// Default configuration - each agent has independent robot config
const defaultConfig = {
    agents: {
        amiya: {
            enabled: false,
            appKey: '',
            appSecret: '',
            webhookUrl: '',
            accessToken: '',
            secret: '',
            welcomeMessage: '你好，我是阿米娅，有什么可以帮你的吗？'
        },
        texas: {
            enabled: false,
            appKey: '',
            appSecret: '',
            webhookUrl: '',
            accessToken: '',
            secret: '',
            welcomeMessage: '德克萨斯，文件整理专家。'
        },
        kaltsit: {
            enabled: false,
            appKey: '',
            appSecret: '',
            webhookUrl: '',
            accessToken: '',
            secret: '',
            welcomeMessage: '凯尔希。健康相关问题可以问我。'
        },
        svrash: {
            enabled: false,
            appKey: '',
            appSecret: '',
            webhookUrl: '',
            accessToken: '',
            secret: '',
            welcomeMessage: '银灰金融助手已启用。我将为您提供市场动态和股票提醒。',
            watchlist: [],
            pushEnabled: true,
            pushSchedule: {
                open: '09:15',
                midday: ['11:30', '14:00'],
                close: '15:05'
            },
            thresholdAlertsEnabled: true,
            checkIntervalMinutes: 5
        }
    }
};

class DingTalkConfigManager {
    constructor(appDataPath) {
        this.configPath = path.join(appDataPath, CONFIG_FILE);
        this.config = this.loadConfig();
        this.setupIPC();
    }

    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const data = fs.readFileSync(this.configPath, 'utf-8');
                const loaded = JSON.parse(data);
                
                // Check if it's old format (root-level config) or new format (agents)
                const isOldFormat = loaded.appKey !== undefined || loaded.webhookUrl !== undefined;
                
                if (isOldFormat && loaded.agents) {
                    // Migrate old format: copy root-level config to each enabled agent
                    const migratedAgents = {};
                    for (const [agentId, agentConfig] of Object.entries(loaded.agents)) {
                        migratedAgents[agentId] = {
                            ...defaultConfig.agents[agentId],
                            ...agentConfig,
                            // Copy root-level config if agent was enabled
                            ...(agentConfig.enabled ? {
                                appKey: loaded.appKey || '',
                                appSecret: loaded.appSecret || '',
                                webhookUrl: loaded.webhookUrl || '',
                                accessToken: loaded.accessToken || '',
                                secret: loaded.secret || ''
                            } : {})
                        };
                    }
                    return { agents: migratedAgents };
                }
                
                // New format or default
                return {
                    agents: {
                        amiya: { ...defaultConfig.agents.amiya, ...loaded.agents?.amiya },
                        texas: { ...defaultConfig.agents.texas, ...loaded.agents?.texas },
                        kaltsit: { ...defaultConfig.agents.kaltsit, ...loaded.agents?.kaltsit },
                        svrash: { ...defaultConfig.agents.svrash, ...loaded.agents?.svrash }
                    }
                };
            }
        } catch (error) {
            console.warn('[DingTalkConfig] Failed to load config:', error);
        }
        return { ...defaultConfig };
    }

    saveConfig() {
        try {
            fs.mkdirSync(path.dirname(this.configPath), { recursive: true });
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
            return true;
        } catch (error) {
            console.error('[DingTalkConfig] Failed to save config:', error);
            return false;
        }
    }

    getConfig() {
        return { ...this.config };
    }

    getAgentConfig(agentId) {
        return this.config.agents[agentId] || null;
    }

    updateAgentConfig(agentId, agentConfig) {
        if (!this.config.agents[agentId]) {
            this.config.agents[agentId] = {};
        }
        this.config.agents[agentId] = { ...this.config.agents[agentId], ...agentConfig };
        return this.saveConfig();
    }

    isAgentEnabled(agentId) {
        return this.config.agents[agentId]?.enabled || false;
    }

    getConnectorConfig(agentId) {
        const agent = this.config.agents[agentId];
        if (!agent) return null;
        return {
            webhookUrl: agent.webhookUrl,
            accessToken: agent.accessToken,
            secret: agent.secret,
            enabled: agent.enabled
        };
    }

    getStreamConfig(agentId) {
        const agent = this.config.agents[agentId];
        if (!agent) return null;
        return {
            appKey: agent.appKey,
            appSecret: agent.appSecret,
            enabled: agent.enabled
        };
    }

    setupIPC() {
        // Get full config
        ipcMain.handle('dingtalk-get-config', () => {
            return this.getConfig();
        });

        // Get agent config
        ipcMain.handle('dingtalk-get-agent-config', (event, agentId) => {
            return this.getAgentConfig(agentId);
        });

        // Update agent config
        ipcMain.handle('dingtalk-update-agent-config', (event, agentId, config) => {
            return this.updateAgentConfig(agentId, config);
        });

        // Check if agent is enabled
        ipcMain.handle('dingtalk-is-agent-enabled', (event, agentId) => {
            return this.isAgentEnabled(agentId);
        });

        // Test agent connection
        ipcMain.handle('dingtalk-test-connection', async (event, agentId) => {
            const { DingTalkConnector } = require('./dingtalk-connector');
            const connector = new DingTalkConnector(this.getConnectorConfig(agentId));
            return await connector.testConnection();
        });

        // Test agent stream
        ipcMain.handle('dingtalk-test-stream', async (event, agentId) => {
            const { DingTalkStreamClient } = require('./dingtalk-stream');
            const streamClient = new DingTalkStreamClient(this.getStreamConfig(agentId));
            return await streamClient.start();
        });
    }
}

module.exports = { DingTalkConfigManager };

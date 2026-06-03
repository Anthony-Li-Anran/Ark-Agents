/**
 * DingTalk Robot Connector
 * Provides integration with DingTalk Group Robot for agent communication
 * 
 * Architecture:
 * - Uses DingTalk Group Robot Webhook for sending messages
 * - Uses DingTalk OpenAPI for receiving messages (optional)
 * - Supports text, markdown, and interactive card messages
 */

const crypto = require('crypto');
const { EventEmitter } = require('events');

class DingTalkConnector extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            webhookUrl: config.webhookUrl || '',
            accessToken: config.accessToken || '',
            secret: config.secret || '',  // For signature verification
            appKey: config.appKey || '',
            appSecret: config.appSecret || '',
            enabled: config.enabled || false
        };
        
        this.accessToken = null;
        this.tokenExpireTime = 0;
    }

    // Validate configuration
    validateConfig() {
        const required = ['webhookUrl'];
        const missing = required.filter(key => !this.config[key]);
        
        if (missing.length > 0) {
            return {
                valid: false,
                message: `Missing required config: ${missing.join(', ')}`
            };
        }
        
        return { valid: true };
    }

    // Update configuration
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        return this.validateConfig();
    }

    // Get current config (without sensitive data)
    getConfig() {
        return {
            webhookUrl: this.config.webhookUrl,
            accessToken: this.config.accessToken ? '***' : '',
            appKey: this.config.appKey,
            enabled: this.config.enabled
        };
    }

    // Generate signature for webhook
    generateSignature(timestamp) {
        if (!this.config.secret) return '';
        
        const stringToSign = `${timestamp}\n${this.config.secret}`;
        const hmac = crypto.createHmac('sha256', this.config.secret);
        hmac.update(stringToSign);
        return hmac.digest('base64');
    }

    // Build signed webhook URL
    _buildWebhookUrl() {
        const timestamp = Date.now();
        const sign = this.generateSignature(timestamp);
        const url = new URL(this.config.webhookUrl);
        if (sign) {
            url.searchParams.append('timestamp', timestamp);
            url.searchParams.append('sign', sign);
        }
        return url.toString();
    }

    // Send message with generic body
    async _sendMessage(body) {
        const validation = this.validateConfig();
        if (!validation.valid) {
            return { success: false, error: validation.message };
        }

        try {
            const response = await fetch(this._buildWebhookUrl(), {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(body)
            });

            const data = await response.json();

            if (data.errcode === 0) {
                return { success: true, message: 'Message sent successfully' };
            } else {
                return { success: false, error: data.errmsg, code: data.errcode };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Send text message to group
    async sendTextMessage(content, atMobiles = [], isAtAll = false) {
        return this._sendMessage({
            msgtype: 'text',
            text: { content },
            at: { atMobiles, isAtAll }
        });
    }

    // Send markdown message to group
    async sendMarkdownMessage(title, text, atMobiles = [], isAtAll = false) {
        return this._sendMessage({
            msgtype: 'markdown',
            markdown: { title, text },
            at: { atMobiles, isAtAll }
        });
    }

    // Send interactive action card
    async sendActionCard(title, markdown, singleTitle, singleURL, btnOrientation = '0') {
        return this._sendMessage({
            msgtype: 'action_card',
            action_card: {
                title,
                markdown,
                single_title: singleTitle,
                single_url: singleURL,
                btn_orientation: btnOrientation
            }
        });
    }

    // Get access token for OpenAPI (if needed for advanced features)
    async getAccessToken() {
        const now = Date.now();
        
        if (this.accessToken && now < this.tokenExpireTime) {
            return { success: true, token: this.accessToken };
        }

        if (!this.config.appKey || !this.config.appSecret) {
            return { success: false, error: 'AppKey and AppSecret required for OpenAPI' };
        }

        try {
            const url = `https://oapi.dingtalk.com/gettoken?appkey=${this.config.appKey}&appsecret=${this.config.appSecret}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.errcode === 0) {
                this.accessToken = data.access_token;
                this.tokenExpireTime = now + (data.expires_in - 300) * 1000;
                return { success: true, token: this.accessToken };
            } else {
                return { success: false, error: data.errmsg };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Test connection by sending a test message
    async testConnection() {
        const validation = this.validateConfig();
        if (!validation.valid) {
            return { success: false, error: validation.message };
        }
        return await this.sendTextMessage('🎉 Ark Agents 钉钉机器人连接测试成功！');
    }

    // Parse incoming webhook message (if using streaming or callback)
    parseIncomingMessage(body) {
        try {
            // DingTalk robot webhook messages typically contain:
            // - msgtype: message type
            // - text: text content
            // - senderStaffId: sender's staff ID
            // - senderNick: sender's nickname
            // - createAt: timestamp
            
            return {
                type: body.msgtype,
                content: body.text?.content || body.content,
                senderId: body.senderStaffId,
                senderNick: body.senderNick,
                createTime: body.createAt,
                chatbotCorpId: body.chatbotCorpId,
                conversationTitle: body.conversationTitle,
                raw: body
            };
        } catch (error) {
            console.error('[DingTalk] Parse message error:', error);
            return null;
        }
    }

    // Verify webhook signature from DingTalk
    verifySignature(timestamp, sign) {
        if (!this.config.secret) return true;
        
        const expectedSign = this.generateSignature(timestamp);
        return expectedSign === sign;
    }
}

module.exports = { DingTalkConnector };

/**
 * WeCom (Enterprise WeChat) Connector
 * Provides integration with Enterprise WeChat for agent communication
 * 
 * Architecture:
 * - Receives messages via webhook callback
 * - Sends messages via WeCom API
 * - Routes messages to appropriate agents based on configuration
 */

const crypto = require('crypto');
const { EventEmitter } = require('events');

class WeComConnector extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            corpId: config.corpId || '',
            agentId: config.agentId || '',
            secret: config.secret || '',
            token: config.token || '',
            encodingAESKey: config.encodingAESKey || '',
            webhookPort: config.webhookPort || 3000,
            enabled: config.enabled || false
        };
        
        this.accessToken = null;
        this.tokenExpireTime = 0;
        this.isRunning = false;
    }

    // Validate configuration
    validateConfig() {
        const required = ['corpId', 'agentId', 'secret'];
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
            corpId: this.config.corpId,
            agentId: this.config.agentId,
            enabled: this.config.enabled,
            webhookPort: this.config.webhookPort
        };
    }

    // Get access token from WeCom API
    async getAccessToken() {
        const now = Date.now();
        
        // Return cached token if still valid
        if (this.accessToken && now < this.tokenExpireTime) {
            return { success: true, token: this.accessToken };
        }

        try {
            const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${this.config.corpId}&corpsecret=${this.config.secret}`;
            const response = await fetch(url, { timeout: 10000 });
            const data = await response.json();

            if (data.errcode === 0) {
                this.accessToken = data.access_token;
                this.tokenExpireTime = now + (data.expires_in - 300) * 1000; // Refresh 5 minutes early
                return { success: true, token: this.accessToken };
            } else {
                return { success: false, error: data.errmsg, code: data.errcode };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Send text message to user
    async sendTextMessage(userId, content) {
        const tokenResult = await this.getAccessToken();
        if (!tokenResult.success) {
            return tokenResult;
        }

        try {
            const url = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${tokenResult.token}`;
            const body = {
                touser: userId,
                msgtype: 'text',
                agentid: this.config.agentId,
                text: { content }
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                timeout: 15000
            });

            const data = await response.json();

            if (data.errcode === 0) {
                return { success: true, messageId: data.msgid };
            } else {
                return { success: false, error: data.errmsg, code: data.errcode };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Send markdown message to user
    async sendMarkdownMessage(userId, content) {
        const tokenResult = await this.getAccessToken();
        if (!tokenResult.success) {
            return tokenResult;
        }

        try {
            const url = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${tokenResult.token}`;
            const body = {
                touser: userId,
                msgtype: 'markdown',
                agentid: this.config.agentId,
                markdown: { content }
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                timeout: 15000
            });

            const data = await response.json();

            if (data.errcode === 0) {
                return { success: true, messageId: data.msgid };
            } else {
                return { success: false, error: data.errmsg, code: data.errcode };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Verify webhook signature
    verifySignature(signature, timestamp, nonce, body) {
        if (!this.config.token) return true; // Skip if no token configured
        
        const sorted = [this.config.token, timestamp, nonce, body].sort().join('');
        const hash = crypto.createHash('sha1').update(sorted).digest('hex');
        return hash === signature;
    }

    // Decrypt message from WeCom
    decryptMessage(encryptedMsg) {
        if (!this.config.encodingAESKey) return null;
        
        try {
            const key = Buffer.from(this.config.encodingAESKey + '=', 'base64');
            const encrypted = Buffer.from(encryptedMsg, 'base64');
            
            // Simple AES decryption (simplified for demo)
            const decipher = crypto.createDecipheriv('aes-256-cbc', key.slice(0, 32), key.slice(32, 48));
            let decrypted = decipher.update(encrypted);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            
            // Remove padding and extract message
            const length = decrypted.readUInt32BE(16);
            return decrypted.slice(20, 20 + length).toString('utf-8');
        } catch (error) {
            console.error('[WeCom] Decrypt error:', error);
            return null;
        }
    }

    // Parse incoming webhook message
    parseWebhookMessage(xmlData) {
        try {
            // Simple XML parsing (in production, use proper XML parser)
            const msgType = this.extractXmlValue(xmlData, 'MsgType');
            const fromUser = this.extractXmlValue(xmlData, 'FromUserName');
            const content = this.extractXmlValue(xmlData, 'Content');
            const msgId = this.extractXmlValue(xmlData, 'MsgId');
            const createTime = this.extractXmlValue(xmlData, 'CreateTime');

            return {
                type: msgType,
                fromUser,
                content,
                msgId,
                createTime: parseInt(createTime) * 1000,
                raw: xmlData
            };
        } catch (error) {
            console.error('[WeCom] Parse message error:', error);
            return null;
        }
    }

    extractXmlValue(xml, tag) {
        const match = xml.match(new RegExp(`<${tag}><!\\[CDATA\\[(.*?)\\]\\]></${tag}>`));
        return match ? match[1] : '';
    }

    // Start webhook server
    async startWebhookServer() {
        if (this.isRunning) return { success: true, message: 'Already running' };
        
        const validation = this.validateConfig();
        if (!validation.valid) {
            return { success: false, error: validation.message };
        }

        try {
            const http = require('http');
            
            this.server = http.createServer((req, res) => {
                if (req.method === 'GET') {
                    // Handle verification request
                    this.handleVerification(req, res);
                } else if (req.method === 'POST') {
                    // Handle incoming message
                    this.handleIncomingMessage(req, res);
                }
            });

            this.server.listen(this.config.webhookPort, () => {
                this.isRunning = true;
                console.log(`[WeCom] Webhook server started on port ${this.config.webhookPort}`);
            });

            return { success: true, port: this.config.webhookPort };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Handle verification request from WeCom
    handleVerification(req, res) {
        const url = new URL(req.url, `http://localhost:${this.config.webhookPort}`);
        const signature = url.searchParams.get('msg_signature');
        const timestamp = url.searchParams.get('timestamp');
        const nonce = url.searchParams.get('nonce');
        const echostr = url.searchParams.get('echostr');

        if (this.verifySignature(signature, timestamp, nonce, echostr)) {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(echostr);
        } else {
            res.writeHead(403);
            res.end('Forbidden');
        }
    }

    // Handle incoming message from WeCom
    handleIncomingMessage(req, res) {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const message = this.parseWebhookMessage(body);
            if (message) {
                this.emit('message', message);
            }
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('success');
        });
    }

    // Stop webhook server
    stopWebhookServer() {
        if (this.server) {
            this.server.close();
            this.server = null;
            this.isRunning = false;
        }
    }

    // Test connection to WeCom API
    async testConnection() {
        const tokenResult = await this.getAccessToken();
        if (!tokenResult.success) {
            return { success: false, error: tokenResult.error };
        }

        try {
            // Try to get agent info
            const url = `https://qyapi.weixin.qq.com/cgi-bin/agent/get?access_token=${tokenResult.token}&agentid=${this.config.agentId}`;
            const response = await fetch(url, { timeout: 10000 });
            const data = await response.json();

            if (data.errcode === 0) {
                return { 
                    success: true, 
                    agentName: data.name,
                    agentId: data.agentid
                };
            } else {
                return { success: false, error: data.errmsg };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = { WeComConnector };

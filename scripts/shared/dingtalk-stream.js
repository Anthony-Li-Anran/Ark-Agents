/**
 * DingTalk Stream Client
 * Uses WebSocket to receive messages from DingTalk without public IP
 * Based on DingTalk OpenAPI Stream Mode
 */

const { EventEmitter } = require('events');
const WebSocket = require('ws');

class DingTalkStreamClient extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            appKey: config.appKey || '',
            appSecret: config.appSecret || '',
            enabled: config.enabled || false
        };
        
        this.ws = null;
        this.reconnectTimer = null;
        this.heartbeatTimer = null;
        this.isRunning = false;
        this.reconnectInterval = 5000;
        this.heartbeatInterval = 30000;
    }

    validateConfig() {
        const required = ['appKey', 'appSecret'];
        const missing = required.filter(key => !this.config[key]);
        
        if (missing.length > 0) {
            return {
                valid: false,
                message: `Missing required config: ${missing.join(', ')}`
            };
        }
        
        return { valid: true };
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        return this.validateConfig();
    }

    async start() {
        if (this.isRunning) {
            return { success: true, message: 'Already running' };
        }

        const validation = this.validateConfig();
        if (!validation.valid) {
            return { success: false, error: validation.message };
        }

        try {
            await this.connect();
            return { success: true, message: 'Stream client started' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    stop() {
        this.isRunning = false;
        
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
        
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        console.log('[DingTalk Stream] Client stopped');
    }

    async connect() {
        try {
            // Get WebSocket endpoint and ticket
            const connectionInfo = await this.getWebSocketEndpoint();
            if (!connectionInfo) {
                throw new Error('Failed to get WebSocket endpoint');
            }

            const { endpoint, ticket } = connectionInfo;
            const wsUrl = `${endpoint}?ticket=${ticket}`;
            console.log('[DingTalk Stream] Connecting to:', endpoint);

            this.ws = new WebSocket(wsUrl);

            this.ws.on('open', () => {
                console.log('[DingTalk Stream] WebSocket connected');
                this.isRunning = true;
                this.startHeartbeat();
                this.emit('connected');
            });

            this.ws.on('message', (data) => {
                this.handleMessage(data);
            });

            this.ws.on('error', (error) => {
                console.error('[DingTalk Stream] WebSocket error:', error.message);
                this.emit('error', error);
            });

            this.ws.on('close', () => {
                console.log('[DingTalk Stream] WebSocket closed');
                this.isRunning = false;
                this.stopHeartbeat();
                this.scheduleReconnect();
            });

        } catch (error) {
            console.error('[DingTalk Stream] Connection error:', error.message);
            this.scheduleReconnect();
            throw error;
        }
    }

    async getWebSocketEndpoint() {
        try {
            const url = 'https://api.dingtalk.com/v1.0/gateway/connections/open';
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    clientId: this.config.appKey,
                    clientSecret: this.config.appSecret,
                    subscriptions: [
                        {
                            type: 'EVENT',
                            topic: '*'
                        },
                        {
                            type: 'CALLBACK',
                            topic: '/v1.0/im/bot/messages/get'
                        }
                    ],
                    ua: 'ark-agents/1.0.0'
                })
            });

            const data = await response.json();
            
            if (data.endpoint && data.ticket) {
                return { endpoint: data.endpoint, ticket: data.ticket };
            } else {
                console.error('[DingTalk Stream] Get endpoint failed:', data);
                return null;
            }
        } catch (error) {
            console.error('[DingTalk Stream] Get endpoint error:', error.message);
            return null;
        }
    }

    handleMessage(data) {
        try {
            const message = JSON.parse(data.toString());

            // Acknowledge the message
            if (message.headers && message.headers.messageId) {
                this.ackMessage(message.headers.messageId);
            }

            // Parse and emit the message
            const parsedMessage = this.parseMessage(message);
            if (parsedMessage) {
                this.emit('message', parsedMessage);
            }
        } catch (error) {
            console.error('[DingTalk Stream] Handle message error:', error.message);
        }
    }

    parseMessage(message) {
        try {
            let body = message.body || message;
            
            // DingTalk Stream message has data as JSON string
            if (body.data && typeof body.data === 'string') {
                try {
                    body = JSON.parse(body.data);
                } catch (e) {
                    console.error('[DingTalk Stream] Failed to parse data field:', e.message);
                    return null;
                }
            }
            
            // Handle robot message
            if (body.msgtype || body.messageType) {
                const msgType = body.msgtype || body.messageType;
                const content = body.text?.content || body.content || body.text || body.message;
                const senderId = body.senderStaffId || body.senderUserId || body.sender;
                const senderNick = body.senderNick || body.senderStaffId || 'Unknown';
                
                if (content && senderId) {
                    return {
                        type: msgType,
                        content: content.trim(),
                        senderId: senderId,
                        senderNick: senderNick,
                        conversationId: body.conversationId || body.chatId,
                        conversationTitle: body.conversationTitle || body.chatTitle,
                        createTime: body.createAt || body.createTime,
                        raw: body
                    };
                }
            }

            return null;
        } catch (error) {
            console.error('[DingTalk Stream] Parse message error:', error);
            return null;
        }
    }

    ackMessage(messageId) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const ack = {
                code: 200,
                headers: {
                    messageId: messageId
                },
                message: 'ok'
            };
            this.ws.send(JSON.stringify(ack));
        }
    }

    startHeartbeat() {
        this.heartbeatTimer = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: 'ping' }));
            }
        }, this.heartbeatInterval);
    }

    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    scheduleReconnect() {
        if (this.reconnectTimer) return;
        
        console.log(`[DingTalk Stream] Reconnecting in ${this.reconnectInterval}ms...`);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            if (this.config.enabled) {
                this.connect().catch(() => {});
            }
        }, this.reconnectInterval);
    }
}

module.exports = { DingTalkStreamClient };

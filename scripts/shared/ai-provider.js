/**
 * AI Provider Abstraction Layer
 * Unified interface for all LLM services
 */

function trimTrailingSlashes(url) {
    return String(url || '').trim().replace(/\/+$/, '');
}

function getOpenAICompatibleChatUrl(endpoint) {
    const baseUrl = trimTrailingSlashes(endpoint);
    return baseUrl.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
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
}

/**
 * Base AI Provider interface
 */
class AIProvider {
    constructor(config) {
        this.config = config;
        this.model = String(config.model || '').trim();
        this.endpoint = trimTrailingSlashes(config.endpoint || '');
    }

    validate() {
        if (!this.model) {
            throw new Error('No AI model selected. Please configure a model first.');
        }
        if (!this.endpoint) {
            throw new Error('No endpoint configured.');
        }
    }

    /**
     * Send a chat completion request
     * @param {Array<{role: string, content: string}>} messages
     * @param {Object} options - { temperature, maxTokens, systemPrompt }
     * @returns {Promise<string>} AI response text
     */
    async chat(messages, options = {}) {
        throw new Error('Not implemented');
    }

    /**
     * Send a single prompt (legacy style, for backward compatibility)
     * @param {string} prompt
     * @param {Object} options
     * @returns {Promise<string>}
     */
    async complete(prompt, options = {}) {
        const messages = [
            { role: 'system', content: options.systemPrompt || '' },
            { role: 'user', content: prompt }
        ];
        return this.chat(messages, options);
    }

    /**
     * Test connection to the service
     * @returns {Promise<{success: boolean, message: string, models?: Array}>}
     */
    async testConnection() {
        throw new Error('Not implemented');
    }

    /**
     * Stream chat completion (reserved for future)
     * @param {Array<{role: string, content: string}>} messages
     * @param {Object} options
     * @returns {AsyncGenerator<string>}
     */
    async *streamChat(messages, options = {}) {
        throw new Error('Streaming not implemented for this provider');
    }

    _handleError(response, errorText) {
        let errorMessage = errorText;
        try {
            const parsed = JSON.parse(errorText);
            errorMessage = parsed.error?.message || parsed.error || parsed.message || errorText;
        } catch {
            // Keep raw response text
        }
        throw new Error(`AI service response ${response.status}: ${errorMessage}`);
    }
}

/**
 * Ollama Provider
 */
class OllamaProvider extends AIProvider {
    constructor(config) {
        super(config);
        this.endpoint = this.endpoint || 'http://127.0.0.1:11434';
    }

    async chat(messages, options = {}) {
        this.validate();

        // Convert messages array to Ollama prompt format
        const prompt = this._messagesToPrompt(messages);

        const requestBody = {
            model: this.model,
            prompt,
            stream: false,
            options: {
                temperature: options.temperature ?? 0.7,
                top_p: options.topP ?? 0.9
            }
        };

        const response = await fetchWithTimeout(`${this.endpoint}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            if (response.status === 404 && errorText.includes('not found')) {
                throw new Error(`Ollama model "${this.model}" is not installed. Run: ollama pull ${this.model}`);
            }
            this._handleError(response, errorText);
        }

        const data = await response.json();
        return data.response || '';
    }

    async complete(prompt, options = {}) {
        this.validate();

        const requestBody = {
            model: this.model,
            prompt,
            stream: false,
            options: {
                temperature: options.temperature ?? 0.7,
                top_p: options.topP ?? 0.9
            }
        };

        const response = await fetchWithTimeout(`${this.endpoint}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            if (response.status === 404 && errorText.includes('not found')) {
                throw new Error(`Ollama model "${this.model}" is not installed. Run: ollama pull ${this.model}`);
            }
            this._handleError(response, errorText);
        }

        const data = await response.json();
        return data.response || '';
    }

    async testConnection() {
        try {
            const response = await fetchWithTimeout(`${this.endpoint}/api/tags`, {
                method: 'GET'
            }, 5000);

            if (response.ok) {
                const data = await response.json();
                const models = data.models || [];
                if (!this.model) {
                    return { success: true, message: '连接成功', models };
                }
                const hasModel = models.some(m => m.name === this.model);
                if (!hasModel) {
                    return {
                        success: false,
                        message: `Ollama model "${this.model}" is not installed. Run: ollama pull ${this.model}`,
                        models
                    };
                }
                return { success: true, message: '连接成功', models };
            }
            return { success: false, message: '无法连接到 Ollama 服务' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    _messagesToPrompt(messages) {
        // Convert OpenAI-style messages to Ollama prompt string
        return messages.map(m => {
            const role = m.role === 'user' ? 'User' : m.role === 'system' ? 'System' : 'Assistant';
            return `${role}: ${m.content}`;
        }).join('\n\n') + '\n\nAssistant:';
    }
}

/**
 * OpenAI-compatible Provider (OpenAI, DeepSeek, Zhipu, Moonshot, Qwen, LM Studio, Custom)
 */
class OpenAICompatibleProvider extends AIProvider {
    constructor(config) {
        super(config);
    }

    async chat(messages, options = {}) {
        this.validate();

        const requestBody = {
            model: this.model,
            messages,
            stream: false,
            temperature: options.temperature ?? 0.7
        };

        if (options.maxTokens) {
            requestBody.max_tokens = options.maxTokens;
        }

        const headers = { 'Content-Type': 'application/json' };
        if (this.config.apiKey) {
            headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        }

        const response = await fetchWithTimeout(getOpenAICompatibleChatUrl(this.endpoint), {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            this._handleError(response, await response.text());
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
    }

    async testConnection() {
        try {
            const headers = { 'Content-Type': 'application/json' };
            if (this.config.apiKey) {
                headers['Authorization'] = `Bearer ${this.config.apiKey}`;
            }

            const response = await fetchWithTimeout(`${trimTrailingSlashes(this.endpoint)}/models`, {
                method: 'GET',
                headers
            }, 5000);

            if (response.ok) {
                const data = await response.json();
                return { success: true, message: '连接成功', models: data.data || [] };
            }

            const error = await response.json().catch(() => ({}));
            return { success: false, message: error.error?.message || 'API Key 无效或端点错误' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }
}

/**
 * Anthropic Provider
 */
class AnthropicProvider extends AIProvider {
    constructor(config) {
        super(config);
    }

    async chat(messages, options = {}) {
        this.validate();

        const requestBody = {
            model: this.model,
            max_tokens: options.maxTokens || 4096,
            messages: messages.filter(m => m.role !== 'system'),
            temperature: options.temperature ?? 0.7
        };

        // Anthropic handles system prompt separately
        const systemMsg = messages.find(m => m.role === 'system');
        if (systemMsg) {
            requestBody.system = systemMsg.content;
        }

        const headers = {
            'Content-Type': 'application/json',
            'x-api-key': this.config.apiKey,
            'anthropic-version': '2023-06-01'
        };

        const response = await fetchWithTimeout(`${trimTrailingSlashes(this.endpoint)}/messages`, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            this._handleError(response, await response.text());
        }

        const data = await response.json();
        return data.content?.[0]?.text || '';
    }

    async testConnection() {
        try {
            const headers = {
                'Content-Type': 'application/json',
                'x-api-key': this.config.apiKey,
                'anthropic-version': '2023-06-01'
            };

            const response = await fetchWithTimeout(`${trimTrailingSlashes(this.endpoint)}/messages`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    model: this.model,
                    max_tokens: 10,
                    messages: [{ role: 'user', content: 'Hi' }]
                })
            }, 10000);

            if (response.ok) {
                return { success: true, message: '连接成功' };
            }

            const error = await response.json();
            return { success: false, message: error.error?.message || 'API Key 无效' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }
}

/**
 * LM Studio Provider (OpenAI-compatible but with different test endpoint)
 */
class LMStudioProvider extends OpenAICompatibleProvider {
    async testConnection() {
        try {
            const response = await fetchWithTimeout(`${trimTrailingSlashes(this.endpoint)}/models`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            }, 5000);

            if (response.ok) {
                const data = await response.json();
                return { success: true, message: '连接成功', models: data.data || [] };
            }
            return { success: false, message: '无法连接到 LM Studio' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }
}

/**
 * Factory to create the right provider from config
 */
function createAIProvider(config) {
    const provider = config.provider;

    switch (provider) {
        case 'ollama':
            return new OllamaProvider(config);
        case 'anthropic':
            return new AnthropicProvider(config);
        case 'lmstudio':
            return new LMStudioProvider(config);
        case 'openai':
        case 'deepseek':
        case 'zhipu':
        case 'moonshot':
        case 'qwen':
        case 'custom':
            return new OpenAICompatibleProvider(config);
        default:
            throw new Error(`Unknown AI provider: ${provider}`);
    }
}

module.exports = {
    AIProvider,
    OllamaProvider,
    OpenAICompatibleProvider,
    AnthropicProvider,
    LMStudioProvider,
    createAIProvider
};

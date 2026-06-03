/**
 * Learning Summarizer
 * Document summarization and key point extraction
 */

class LearningSummarizer {
    constructor({ aiConfigManager, operatorId = 'muelsyse' }) {
        this.aiConfigManager = aiConfigManager;
        this.operatorId = operatorId;
    }

    async summarize(text, maxLength = 3000) {
        const config = this.aiConfigManager.getOperatorConfig(this.operatorId);
        const endpoint = config.endpoint || 'http://127.0.0.1:11434';
        const model = config.model;
        
        if (!model) {
            throw new Error('No AI model configured');
        }
        
        const truncatedText = text.length > maxLength 
            ? text.slice(0, maxLength) + '...(内容过长已截断)' 
            : text;
        
        const prompt = `请对以下文档内容进行结构化摘要，包含：
1. 概述（2-3句话总结文档主旨）
2. 核心要点（3-5条，每条不超过50字）
3. 关键术语解释（3-5个术语及其简要解释）

文档内容：
${truncatedText}

请按以下JSON格式输出：
{
    "overview": "概述内容",
    "keyPoints": ["要点1", "要点2", "要点3"],
    "terms": [
        {"term": "术语1", "explanation": "解释1"},
        {"term": "术语2", "explanation": "解释2"}
    ]
}`;

        const apiUrl = config.provider === 'ollama' 
            ? `${endpoint}/api/generate` 
            : `${endpoint}/v1/chat/completions`;
        
        const requestBody = config.provider === 'ollama'
            ? { model, prompt, stream: false }
            : {
                model,
                messages: [{ role: 'user', content: prompt }],
                stream: false
            };
        
        const headers = { 'Content-Type': 'application/json' };
        if (config.apiKey) {
            headers['Authorization'] = `Bearer ${config.apiKey}`;
        }
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            throw new Error(`AI service error: ${response.status}`);
        }
        
        const data = await response.json();
        const rawResponse = config.provider === 'ollama' 
            ? data.response 
            : data.choices?.[0]?.message?.content;
        
        try {
            const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
        }
        
        return {
            overview: rawResponse,
            keyPoints: [],
            terms: []
        };
    }
}

module.exports = { LearningSummarizer };

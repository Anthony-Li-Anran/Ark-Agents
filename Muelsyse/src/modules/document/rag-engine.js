/**
 * RAG Engine with Semantic Search
 * Retrieval-Augmented Generation engine using Ollama embeddings
 */

class RAGEngine {
    constructor({ documentStore, aiConfigManager, operatorId = 'muelsyse' }) {
        this.documentStore = documentStore;
        this.aiConfigManager = aiConfigManager;
        this.operatorId = operatorId;
        this.defaultTopK = 5;
        this.defaultThreshold = 0.3;
    }

    async retrieve(query, topK = null, threshold = null) {
        const actualTopK = topK ?? this.defaultTopK;
        const actualThreshold = threshold ?? this.defaultThreshold;
        
        console.log(`[RAGEngine] Retrieving context for: "${query.substring(0, 50)}..."`);
        
        const results = await this.documentStore.search(query, actualTopK, actualThreshold);
        
        console.log(`[RAGEngine] Retrieved ${results.length} relevant chunks`);
        
        return results;
    }

    buildContext(searchResults, maxLength = 4000) {
        if (!searchResults || searchResults.length === 0) {
            return '';
        }
        
        const contextParts = [];
        let totalLength = 0;
        
        for (const result of searchResults) {
            const doc = this.documentStore.getDocument(result.chunk.docId);
            const sourceName = doc?.fileName || '未知文档';
            const chunkText = result.chunk.text;
            
            const part = `[${sourceName}]\n${chunkText}`;
            
            if (totalLength + part.length > maxLength) {
                break;
            }
            
            contextParts.push(part);
            totalLength += part.length;
        }
        
        return contextParts.join('\n\n---\n\n');
    }

    async generateAnswer(query, context, systemPrompt) {
        const config = this.aiConfigManager.getOperatorConfig(this.operatorId);
        const endpoint = config.endpoint || 'http://127.0.0.1:11434';
        const model = config.model;
        
        if (!model) {
            throw new Error('No AI model configured for Muelsyse');
        }
        
        const fullPrompt = context 
            ? `${systemPrompt}\n\n【参考资料】\n${context}\n\n【用户问题】\n${query}\n\n请基于参考资料回答用户问题，如果参考资料中有相关信息，请标注来源。如果参考资料中没有相关信息，请根据你的知识回答，但要说明这不是来自文档。`
            : `${systemPrompt}\n\n【用户问题】\n${query}\n\n注意：没有找到相关的参考资料，请根据你的知识回答。`;
        
        console.log(`[RAGEngine] Generating answer using model: ${model}`);
        
        let apiUrl;
        let requestBody;
        
        if (config.provider === 'ollama') {
            apiUrl = `${endpoint}/api/generate`;
            requestBody = { 
                model, 
                prompt: fullPrompt, 
                stream: false,
                options: {
                    temperature: 0.7,
                    top_p: 0.9
                }
            };
        } else {
            apiUrl = `${endpoint}/v1/chat/completions`;
            requestBody = {
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: context ? `参考资料：\n${context}\n\n问题：${query}` : query }
                ],
                stream: false,
                temperature: 0.7
            };
        }
        
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
            const errorText = await response.text();
            throw new Error(`AI service error: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        const answer = config.provider === 'ollama' ? data.response : data.choices?.[0]?.message?.content;
        
        console.log(`[RAGEngine] Generated answer (${answer.length} chars)`);
        
        return answer;
    }

    async query(query, systemPrompt, options = {}) {
        const {
            topK = this.defaultTopK,
            threshold = this.defaultThreshold,
            maxContextLength = 4000
        } = options;
        
        const startTime = Date.now();
        
        const searchResults = await this.retrieve(query, topK, threshold);
        const context = this.buildContext(searchResults, maxContextLength);
        
        const answer = await this.generateAnswer(query, context, systemPrompt);
        
        const processingTime = Date.now() - startTime;
        console.log(`[RAGEngine] Query completed in ${processingTime}ms`);
        
        return {
            answer,
            sources: searchResults.map(r => ({
                docId: r.chunk.docId,
                fileName: this.documentStore.getDocument(r.chunk.docId)?.fileName || '未知',
                text: r.chunk.text.substring(0, 200) + (r.chunk.text.length > 200 ? '...' : ''),
                similarity: r.similarity
            })),
            hasContext: searchResults.length > 0,
            contextLength: context.length,
            processingTime
        };
    }

    async summarizeDocument(docId, systemPrompt) {
        const doc = this.documentStore.getDocument(docId);
        if (!doc) {
            throw new Error(`Document not found: ${docId}`);
        }
        
        const config = this.aiConfigManager.getOperatorConfig(this.operatorId);
        const endpoint = config.endpoint || 'http://127.0.0.1:11434';
        const model = config.model;
        
        if (!model) {
            throw new Error('No AI model configured for Muelsyse');
        }
        
        const prompt = `${systemPrompt}\n\n请总结以下文档内容：\n\n【文档名称】${doc.fileName}\n\n【文档内容】\n${doc.text.substring(0, 8000)}`;
        
        const response = await fetch(`${endpoint}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                prompt,
                stream: false
            })
        });
        
        if (!response.ok) {
            throw new Error(`AI service error: ${response.status}`);
        }
        
        const data = await response.json();
        return data.response;
    }

    async generateFlashcards(content, systemPrompt, count = 10) {
        const config = this.aiConfigManager.getOperatorConfig(this.operatorId);
        const endpoint = config.endpoint || 'http://127.0.0.1:11434';
        const model = config.model;
        
        if (!model) {
            throw new Error('No AI model configured for Muelsyse');
        }
        
        const prompt = `${systemPrompt}\n\n请基于以下内容生成${count}个学习闪卡，每个闪卡包含问题和答案。以JSON数组格式返回：\n[{"question": "问题", "answer": "答案"}]\n\n【内容】\n${content.substring(0, 6000)}`;
        
        const response = await fetch(`${endpoint}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                prompt,
                stream: false,
                format: 'json'
            })
        });
        
        if (!response.ok) {
            throw new Error(`AI service error: ${response.status}`);
        }
        
        const data = await response.json();
        
        try {
            return JSON.parse(data.response);
        } catch {
            const jsonMatch = data.response.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            throw new Error('Failed to parse flashcards from AI response');
        }
    }

    async generateQuiz(content, systemPrompt, count = 5) {
        const config = this.aiConfigManager.getOperatorConfig(this.operatorId);
        const endpoint = config.endpoint || 'http://127.0.0.1:11434';
        const model = config.model;
        
        if (!model) {
            throw new Error('No AI model configured for Muelsyse');
        }
        
        const prompt = `${systemPrompt}\n\n请基于以下内容生成${count}道选择题测试题。以JSON数组格式返回：\n[{"question": "问题", "options": ["A选项", "B选项", "C选项", "D选项"], "correct": 0, "explanation": "答案解析"}]\n其中correct是正确选项的索引（0-3）。\n\n【内容】\n${content.substring(0, 6000)}`;
        
        const response = await fetch(`${endpoint}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                prompt,
                stream: false,
                format: 'json'
            })
        });
        
        if (!response.ok) {
            throw new Error(`AI service error: ${response.status}`);
        }
        
        const data = await response.json();
        
        try {
            return JSON.parse(data.response);
        } catch {
            const jsonMatch = data.response.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            throw new Error('Failed to parse quiz from AI response');
        }
    }

    setDefaultThreshold(threshold) {
        this.defaultThreshold = threshold;
    }

    setDefaultTopK(topK) {
        this.defaultTopK = topK;
    }
}

module.exports = { RAGEngine };

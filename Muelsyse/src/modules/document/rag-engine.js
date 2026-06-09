/**
 * RAG Engine with Semantic Search
 * Retrieval-Augmented Generation engine using Ollama embeddings
 */

let _createAIProvider = null;

function setCreateAIProvider(factory) {
    _createAIProvider = factory;
}

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
        if (!_createAIProvider) {
            throw new Error('AI Provider factory not set. Call setCreateAIProvider() first.');
        }

        const config = this.aiConfigManager.getOperatorConfig(this.operatorId);
        const provider = _createAIProvider(config);

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: context
                ? `参考资料：\n${context}\n\n问题：${query}\n\n请基于参考资料回答用户问题，如果参考资料中有相关信息，请标注来源。如果参考资料中没有相关信息，请根据你的知识回答，但要说明这不是来自文档。`
                : `${query}\n\n注意：没有找到相关的参考资料，请根据你的知识回答。`
            }
        ];

        console.log(`[RAGEngine] Generating answer using model: ${config.model}`);

        const answer = await provider.chat(messages, { temperature: 0.7, topP: 0.9 });

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
        if (!_createAIProvider) {
            throw new Error('AI Provider factory not set. Call setCreateAIProvider() first.');
        }

        const doc = this.documentStore.getDocument(docId);
        if (!doc) {
            throw new Error(`Document not found: ${docId}`);
        }

        const config = this.aiConfigManager.getOperatorConfig(this.operatorId);
        const provider = _createAIProvider(config);

        const prompt = `请总结以下文档内容：\n\n【文档名称】${doc.fileName}\n\n【文档内容】\n${doc.text.substring(0, 8000)}`;

        return provider.complete(prompt, { systemPrompt });
    }

    async generateFlashcards(content, systemPrompt, count = 10) {
        if (!_createAIProvider) {
            throw new Error('AI Provider factory not set. Call setCreateAIProvider() first.');
        }

        const config = this.aiConfigManager.getOperatorConfig(this.operatorId);
        const provider = _createAIProvider(config);

        const prompt = `请基于以下内容生成${count}个学习闪卡，每个闪卡包含问题和答案。以JSON数组格式返回：\n[{"question": "问题", "answer": "答案"}]\n\n【内容】\n${content.substring(0, 6000)}`;

        const response = await provider.complete(prompt, { systemPrompt });

        try {
            return JSON.parse(response);
        } catch {
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            throw new Error('Failed to parse flashcards from AI response');
        }
    }

    async generateQuiz(content, systemPrompt, count = 5) {
        if (!_createAIProvider) {
            throw new Error('AI Provider factory not set. Call setCreateAIProvider() first.');
        }

        const config = this.aiConfigManager.getOperatorConfig(this.operatorId);
        const provider = _createAIProvider(config);

        const prompt = `请基于以下内容生成${count}道选择题测试题。以JSON数组格式返回：\n[{"question": "问题", "options": ["A选项", "B选项", "C选项", "D选项"], "correct": 0, "explanation": "答案解析"}]\n其中correct是正确选项的索引（0-3）。\n\n【内容】\n${content.substring(0, 6000)}`;

        const response = await provider.complete(prompt, { systemPrompt });

        try {
            return JSON.parse(response);
        } catch {
            const jsonMatch = response.match(/\[[\s\S]*\]/);
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

module.exports = { RAGEngine, setCreateAIProvider };

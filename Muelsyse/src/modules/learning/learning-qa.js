/**
 * Learning QA Engine
 * Intelligent Q&A based on RAG retrieval
 */

class LearningQA {
    constructor({ ragEngine, documentStore }) {
        this.ragEngine = ragEngine;
        this.documentStore = documentStore;
        this.conversationHistory = new Map();
    }

    getSystemPrompt() {
        return `你是缪尔赛斯，罗德岛的水源术师，也是博士的专属学习助手。

性格特点：
- 温柔、耐心、善于引导学习
- 对知识充满热情，乐于帮助博士掌握新知识

称呼用户为"博士"。

回答原则：
1. 用清晰易懂的方式解释复杂概念
2. 善于举例说明，帮助理解
3. 鼓励博士主动思考和提问
4. 基于提供的参考资料回答问题
5. 如果参考资料中没有相关信息，坦诚告知`;
    }

    async ask(question, sessionId = 'default') {
        const history = this.conversationHistory.get(sessionId) || [];
        history.push({ role: 'user', content: question });
        
        const result = await this.ragEngine.query(
            question, 
            this.getSystemPrompt(),
            5,
            0.5
        );
        
        history.push({ role: 'assistant', content: result.answer });
        
        if (history.length > 20) {
            this.conversationHistory.set(sessionId, history.slice(-20));
        } else {
            this.conversationHistory.set(sessionId, history);
        }
        
        return result;
    }

    clearHistory(sessionId = 'default') {
        this.conversationHistory.delete(sessionId);
    }

    getHistory(sessionId = 'default') {
        return this.conversationHistory.get(sessionId) || [];
    }
}

module.exports = { LearningQA };

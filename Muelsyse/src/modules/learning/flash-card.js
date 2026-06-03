/**
 * Flash Card Generator
 * Generate flash cards and quiz questions from documents
 */

class FlashCardGenerator {
    constructor({ aiConfigManager, documentStore, operatorId = 'muelsyse' }) {
        this.aiConfigManager = aiConfigManager;
        this.documentStore = documentStore;
        this.operatorId = operatorId;
    }

    /**
     * Fix JSON string with LaTeX formulas and other issues
     * LaTeX commands like \theta, \alpha, \frac, \{, \}, etc. are invalid JSON escape sequences
     */
    fixJsonLatex(jsonStr) {
        let result = jsonStr;
        
        // Step 1: Fix LaTeX commands - backslash followed by letters (e.g., \theta, \frac, \alpha)
        result = result.replace(/\\([a-zA-Z]+)/g, '\\\\$1');
        
        // Step 2: Fix LaTeX special characters - backslash followed by non-letter special chars
        // \{ \} \_ \^ \& \% \$ \# \~ \! \, \; \: \. \@ 
        result = result.replace(/\\([{}_\^&%$#~!.,;:.@])/g, '\\\\$1');
        
        // Step 3: Fix \( and \) (inline math delimiters)
        result = result.replace(/\\\(/g, '\\\\(');
        result = result.replace(/\\\)/g, '\\\\)');
        
        // Step 4: Fix \[ and \] (display math delimiters)
        result = result.replace(/\\\[/g, '\\\\[');
        result = result.replace(/\\\]/g, '\\\\]');
        
        // Step 5: Fix any remaining single backslash followed by non-JSON-escape character
        // Valid JSON escapes: \" \\ \/ \b \f \n \r \t \uXXXX
        // We need to be careful not to double-escape already valid escapes
        result = result.replace(/\\([^"\\\/bfnrtu])/g, '\\\\$1');
        
        return result;
    }

    /**
     * Safely parse JSON that may contain LaTeX formulas
     */
    safeParseJson(jsonStr) {
        // First try direct parse
        try {
            return JSON.parse(jsonStr);
        } catch (e) {
            // Try fixing LaTeX escapes
            try {
                const fixed = this.fixJsonLatex(jsonStr);
                return JSON.parse(fixed);
            } catch (e2) {
                // Try more aggressive fix - rebuild JSON from scratch
                try {
                    return this.rebuildJson(jsonStr);
                } catch (e3) {
                    console.error('[FlashCard] JSON parse failed after all attempts:', e3.message);
                    console.error('[FlashCard] Original JSON preview:', jsonStr.substring(0, 200));
                    return null;
                }
            }
        }
    }

    /**
     * Attempt to rebuild JSON by extracting valid objects
     */
    rebuildJson(jsonStr) {
        const objects = [];
        
        // Try multiple patterns to extract objects
        const patterns = [
            // Pattern 1: Standard object with question field
            /\{"question"\s*:\s*"[^"]*"[^}]*\}/gi,
            // Pattern 2: Object with any string key
            /\{[^{}]*"[^"]*"\s*:\s*"[^"]*"[^{}]*\}/gi,
            // Pattern 3: More permissive
            /\{[^{}]+\}/gi
        ];
        
        for (const pattern of patterns) {
            let match;
            const tempStr = jsonStr;
            while ((match = pattern.exec(tempStr)) !== null) {
                try {
                    let objStr = match[0];
                    // Apply fixes
                    objStr = this.fixJsonLatex(objStr);
                    // Try to parse
                    const obj = JSON.parse(objStr);
                    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
                        // Check if it has meaningful content
                        const hasContent = Object.values(obj).some(v => 
                            typeof v === 'string' && v.length > 0 ||
                            Array.isArray(v) && v.length > 0 ||
                            typeof v === 'number'
                        );
                        if (hasContent) {
                            objects.push(obj);
                        }
                    }
                } catch (e) {
                    // Skip invalid objects
                }
            }
            if (objects.length > 0) break;
        }
        
        if (objects.length > 0) {
            return objects;
        }
        
        throw new Error('Could not rebuild JSON');
    }

    async generateFlashCards(docId, count = 5) {
        const doc = this.documentStore.getDocument(docId);
        if (!doc) {
            throw new Error('Document not found');
        }
        
        const config = this.aiConfigManager.getOperatorConfig(this.operatorId);
        const endpoint = config.endpoint || 'http://127.0.0.1:11434';
        const model = config.model;
        
        const text = doc.text.slice(0, 3000);
        
        const prompt = `基于以下文档内容，生成${count}张学习闪卡。

文档内容：
${text}

请按以下JSON格式输出闪卡数组：
[
    {
        "front": "问题或术语",
        "back": "答案或解释"
    }
]

要求：
1. 闪卡应涵盖文档的核心概念和重要知识点
2. 正面应该是清晰的问题或术语
3. 背面应该是简洁准确的答案或解释`;

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
            const jsonMatch = rawResponse.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                return this.safeParseJson(jsonMatch[0]) || [];
            }
        } catch (e) {
        }
        
        return [];
    }

    async generateQuiz(docId, count = 5) {
        const doc = this.documentStore.getDocument(docId);
        if (!doc) {
            throw new Error('Document not found');
        }
        
        const config = this.aiConfigManager.getOperatorConfig(this.operatorId);
        const endpoint = config.endpoint || 'http://127.0.0.1:11434';
        const model = config.model;
        
        const text = doc.text.slice(0, 3000);
        
        const prompt = `基于以下文档内容，生成${count}道选择题。

文档内容：
${text}

请按以下JSON格式输出题目数组：
[
    {
        "question": "问题",
        "options": ["选项A", "选项B", "选项C", "选项D"],
        "correctIndex": 0,
        "explanation": "答案解析"
    }
]

要求：
1. 题目应涵盖文档的核心知识点
2. 每题4个选项，只有1个正确答案
3. correctIndex是正确答案的索引（0-3）
4. explanation应简要说明为什么这个答案正确`;

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
            const jsonMatch = rawResponse.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                return this.safeParseJson(jsonMatch[0]) || [];
            }
        } catch (e) {
        }
        
        return [];
    }

    async generateFromContent(content, count = 5) {
        const config = this.aiConfigManager.getOperatorConfig(this.operatorId);
        const endpoint = config.endpoint || 'http://127.0.0.1:11434';
        const model = config.model;
        
        const text = content.slice(0, 4000);
        
        const prompt = `基于以下内容，生成${count}张学习闪卡。

内容：
${text}

请按以下JSON格式输出闪卡数组：
[
    {
        "front": "问题或术语",
        "back": "答案或解释"
    }
]

要求：
1. 闪卡应涵盖核心概念和重要知识点
2. 正面应该是清晰的问题或术语
3. 背面应该是简洁准确的答案或解释`;

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
            const jsonMatch = rawResponse.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                return this.safeParseJson(jsonMatch[0]) || [];
            }
        } catch (e) {
        }
        
        return [];
    }

    async generateQuizFromContent(content, count = 5) {
        const config = this.aiConfigManager.getOperatorConfig(this.operatorId);
        const endpoint = config.endpoint || 'http://127.0.0.1:11434';
        const model = config.model;
        
        const text = content.slice(0, 4000);
        
        const prompt = `基于以下内容，生成${count}道选择题。

内容：
${text}

请按以下JSON格式输出题目数组：
[
    {
        "question": "问题",
        "options": ["选项A", "选项B", "选项C", "选项D"],
        "correctIndex": 0,
        "explanation": "答案解析"
    }
]

要求：
1. 题目应涵盖核心知识点
2. 每题4个选项，只有1个正确答案
3. correctIndex是正确答案的索引（0-3）
4. explanation应简要说明为什么这个答案正确`;

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
            const jsonMatch = rawResponse.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                return this.safeParseJson(jsonMatch[0]) || [];
            }
        } catch (e) {
        }
        
        return [];
    }

    async generateFullTest(content, config) {
        const aiConfig = this.aiConfigManager.getOperatorConfig(this.operatorId);
        const endpoint = aiConfig.endpoint || 'http://127.0.0.1:11434';
        const model = aiConfig.model;
        
        const text = content.slice(0, 12000);
        
        const test = {
            singleChoice: [],
            multipleChoice: [],
            fillBlank: [],
            essay: [],
            config: config
        };

        // Helper to retry generation until we get enough questions
        const generateWithRetry = async (prompt, expectedCount, maxRetries = 2) => {
            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                const result = await this.callAI(endpoint, model, aiConfig, prompt);
                const jsonMatch = result.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    const parsed = this.safeParseJson(jsonMatch[0]);
                    if (parsed && parsed.length >= expectedCount) {
                        return parsed.slice(0, expectedCount);
                    }
                    if (parsed && parsed.length > 0) {
                        // Return what we have, even if not enough
                        return parsed;
                    }
                }
            }
            return [];
        };
        
        if (config.singleChoice > 0) {
            const prompt = `【重要】你必须生成恰好${config.singleChoice}道单选题，不能多也不能少。

学习内容：
${text}

生成要求：
1. 【必须】生成恰好${config.singleChoice}道题目，这是硬性要求
2. 每道题必须有且仅有4个选项（A、B、C、D）
3. 正确答案必须是0-3之间的整数，表示正确选项的索引
4. 题目应覆盖学习内容的核心知识点
5. 难度适中，避免过于简单或过于复杂
6. 【JSON格式警告】不要在JSON字符串中使用反斜杠、换行符或特殊符号，如有公式请用纯文本描述

输出格式（仅输出JSON数组，不要有任何其他文字）：
[{"question":"题目1","options":["选项A","选项B","选项C","选项D"],"correctIndex":0,"explanation":"解析"}]

再次强调：必须输出恰好${config.singleChoice}个题目对象！`;

            test.singleChoice = await generateWithRetry(prompt, config.singleChoice);
        }
        
        if (config.multipleChoice > 0) {
            const prompt = `【重要】你必须生成恰好${config.multipleChoice}道多选题，不能多也不能少。

学习内容：
${text}

生成要求：
1. 【必须】生成恰好${config.multipleChoice}道题目，这是硬性要求
2. 每道题必须有且仅有4个选项（A、B、C、D）
3. 正确答案必须是包含2-4个整数的数组，表示正确选项的索引
4. 题目应覆盖学习内容的核心知识点
5. 难度适中，避免过于简单或过于复杂
6. 【JSON格式警告】不要在JSON字符串中使用反斜杠、换行符或特殊符号，如有公式请用纯文本描述

输出格式（仅输出JSON数组，不要有任何其他文字）：
[{"question":"题目1","options":["选项A","选项B","选项C","选项D"],"correctIndices":[0,2],"explanation":"解析"}]

再次强调：必须输出恰好${config.multipleChoice}个题目对象！`;

            test.multipleChoice = await generateWithRetry(prompt, config.multipleChoice);
        }
        
        if (config.fillBlank > 0) {
            const prompt = `【重要】你必须生成恰好${config.fillBlank}道填空题，不能多也不能少。

学习内容：
${text}

生成要求：
1. 【必须】生成恰好${config.fillBlank}道题目，这是硬性要求
2. 使用连续三个下划线___表示空白处
3. 答案应简洁明确
4. 题目应覆盖学习内容的核心知识点
5. 难度适中，避免过于简单或过于复杂
6. 【JSON格式警告】不要在JSON字符串中使用反斜杠、换行符或特殊符号，如有公式请用纯文本描述

输出格式（仅输出JSON数组，不要有任何其他文字）：
[{"question":"题目内容，用___表示空白","answer":"正确答案","explanation":"解析"}]

再次强调：必须输出恰好${config.fillBlank}个题目对象！`;

            test.fillBlank = await generateWithRetry(prompt, config.fillBlank);
        }
        
        if (config.essay > 0) {
            const prompt = `【重要】你必须生成恰好${config.essay}道主观题，不能多也不能少。

学习内容：
${text}

生成要求：
1. 【必须】生成恰好${config.essay}道题目，这是硬性要求
2. 题目应是需要详细论述的问题
3. 提供参考答案和答题要点
4. 题目应覆盖学习内容的核心知识点
5. 难度适中，避免过于简单或过于复杂
6. 【JSON格式警告】不要在JSON字符串中使用反斜杠、换行符或特殊符号，如有公式请用纯文本描述

输出格式（仅输出JSON数组，不要有任何其他文字）：
[{"question":"题目内容","referenceAnswer":"参考答案","keyPoints":["要点1","要点2"]}]

再次强调：必须输出恰好${config.essay}个题目对象！`;

            test.essay = await generateWithRetry(prompt, config.essay);
        }
        
        return test;
    }

    async generateMindMap(content) {
        const config = this.aiConfigManager.getOperatorConfig(this.operatorId);
        const endpoint = config.endpoint || 'http://127.0.0.1:11434';
        const model = config.model;
        
        const text = content.slice(0, 6000);
        
        // Generate markdown format for Markmap
        const prompt = `分析以下内容，生成思维导图的 Markdown 格式。

内容：
${text}

请直接输出 Markdown 格式的思维导图，使用以下结构：
# 中心主题（文档标题或核心概念）
## 分支主题1
### 子要点1
### 子要点2
## 分支主题2
### 子要点1
### 子要点2

要求：
1. 第一行必须是 # 开头的中心主题
2. 使用 ## 表示主要分支（3-6个）
3. 使用 ### 表示具体要点（每个分支2-5个要点）
4. 可以使用 LaTeX 公式（用 $ 包裹）
5. 直接输出 Markdown，不要有任何其他说明文字`;

        const result = await this.callAI(endpoint, model, config, prompt);
        return result || '# 思维导图\n## 暂无内容';
    }

    async callAI(endpoint, model, config, prompt) {
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
        return config.provider === 'ollama' 
            ? data.response 
            : data.choices?.[0]?.message?.content;
    }
}

module.exports = { FlashCardGenerator };

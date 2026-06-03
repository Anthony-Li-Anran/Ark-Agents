/**
 * Document Store with Semantic Embeddings
 * Uses Ollama Embedding API for true semantic vector retrieval
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ollama = require('ollama');

const DOCUMENTS_FILE = 'muelsyse-documents.json';

const DEFAULT_EMBEDDING_MODEL = 'nomic-embed-text';
const DEFAULT_CHUNK_SIZE = 800;
const DEFAULT_CHUNK_OVERLAP = 200;
const DEFAULT_SIMILARITY_THRESHOLD = 0.3;

class DocumentStore {
    constructor(appDataPath, aiConfigManager = null) {
        this.dataPath = path.join(appDataPath, DOCUMENTS_FILE);
        this.aiConfigManager = aiConfigManager;
        this.documents = new Map();
        this.chunks = new Map();
        this.embeddings = new Map();
        this.sections = new Map();
        this.config = {
            embeddingModel: DEFAULT_EMBEDDING_MODEL,
            chunkSize: DEFAULT_CHUNK_SIZE,
            chunkOverlap: DEFAULT_CHUNK_OVERLAP,
            similarityThreshold: DEFAULT_SIMILARITY_THRESHOLD
        };
        this.ollamaConfig = null;
        this.loadData();
    }

    setAIConfigManager(aiConfigManager) {
        this.aiConfigManager = aiConfigManager;
    }

    async getOllamaConfig() {
        if (this.ollamaConfig) {
            return this.ollamaConfig;
        }
        
        if (this.aiConfigManager) {
            this.ollamaConfig = this.aiConfigManager.getOperatorConfig('muelsyse');
            return this.ollamaConfig;
        }
        
        return {
            provider: 'ollama',
            endpoint: 'http://127.0.0.1:11434',
            model: ''
        };
    }

    setOllamaConfig(config) {
        this.ollamaConfig = config;
    }

    loadData() {
        try {
            if (fs.existsSync(this.dataPath)) {
                const data = JSON.parse(fs.readFileSync(this.dataPath, 'utf-8'));
                this.documents = new Map(Object.entries(data.documents || {}));
                this.chunks = new Map(Object.entries(data.chunks || {}));
                this.embeddings = new Map(Object.entries(data.embeddings || {}));
                this.sections = new Map(Object.entries(data.sections || {}));
                if (data.config) {
                    this.config = { ...this.config, ...data.config };
                }
                console.log(`[DocumentStore] Loaded ${this.documents.size} documents, ${this.chunks.size} chunks, ${this.sections.size} sections`);
            }
        } catch (error) {
            console.warn('[DocumentStore] Failed to load data:', error);
        }
    }

    saveData() {
        try {
            const data = {
                documents: Object.fromEntries(this.documents),
                chunks: Object.fromEntries(this.chunks),
                embeddings: Object.fromEntries(this.embeddings),
                sections: Object.fromEntries(this.sections),
                config: this.config,
                lastUpdated: new Date().toISOString()
            };
            fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2));
            console.log(`[DocumentStore] Saved ${this.documents.size} documents, ${this.chunks.size} chunks`);
            return true;
        } catch (error) {
            console.error('[DocumentStore] Failed to save data:', error);
            return false;
        }
    }

    generateId() {
        return crypto.randomUUID();
    }

    async generateEmbedding(text) {
        const config = await this.getOllamaConfig();
        const endpoint = config.endpoint || 'http://127.0.0.1:11434';
        
        try {
            const response = await fetch(`${endpoint}/api/embeddings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.config.embeddingModel,
                    prompt: text
                })
            });

            if (!response.ok) {
                throw new Error(`Embedding API error: ${response.status}`);
            }

            const data = await response.json();
            return data.embedding;
        } catch (error) {
            console.error('[DocumentStore] Embedding generation failed:', error);
            return null;
        }
    }

    async generateEmbeddingsBatch(texts) {
        const embeddings = [];
        for (let i = 0; i < texts.length; i++) {
            const embedding = await this.generateEmbedding(texts[i]);
            embeddings.push(embedding);
            if (i % 10 === 0) {
                console.log(`[DocumentStore] Generated embedding ${i + 1}/${texts.length}`);
            }
        }
        return embeddings;
    }

    chunkText(text) {
        const chunks = [];
        const { chunkSize, chunkOverlap } = this.config;
        
        const paragraphs = text.split(/\n\n+/);
        let currentChunk = '';
        let chunkIndex = 0;

        for (const paragraph of paragraphs) {
            const trimmedParagraph = paragraph.trim();
            if (!trimmedParagraph) continue;

            if (currentChunk.length + trimmedParagraph.length + 2 <= chunkSize) {
                currentChunk += (currentChunk ? '\n\n' : '') + trimmedParagraph;
            } else {
                if (currentChunk) {
                    chunks.push({
                        text: currentChunk,
                        index: chunkIndex++
                    });
                    
                    const sentences = currentChunk.split(/[。！？.!?]/);
                    const overlapText = sentences.slice(-2).join('。').slice(-chunkOverlap);
                    currentChunk = overlapText + '\n\n' + trimmedParagraph;
                } else {
                    const subChunks = this.splitLongParagraph(trimmedParagraph, chunkSize, chunkOverlap);
                    for (const subChunk of subChunks) {
                        chunks.push({
                            text: subChunk,
                            index: chunkIndex++
                        });
                    }
                    currentChunk = '';
                }
            }
        }

        if (currentChunk.trim()) {
            chunks.push({
                text: currentChunk.trim(),
                index: chunkIndex
            });
        }

        return chunks;
    }

    splitLongParagraph(paragraph, chunkSize, overlap) {
        const chunks = [];
        const sentences = paragraph.split(/(?<=[。！？.!?])\s*/);
        let currentChunk = '';

        for (const sentence of sentences) {
            if (currentChunk.length + sentence.length <= chunkSize) {
                currentChunk += sentence;
            } else {
                if (currentChunk) {
                    chunks.push(currentChunk);
                    const overlapStart = Math.max(0, currentChunk.length - overlap);
                    currentChunk = currentChunk.slice(overlapStart) + sentence;
                } else {
                    for (let i = 0; i < sentence.length; i += chunkSize - overlap) {
                        chunks.push(sentence.slice(i, i + chunkSize));
                    }
                    currentChunk = '';
                }
            }
        }

        if (currentChunk) {
            chunks.push(currentChunk);
        }

        return chunks;
    }

    extractSections(text) {
        const sections = [];
        const lines = text.split('\n');
        
        const topLevelPatterns = [
            /^第[一二三四五六七八九十百千万]+[章节篇部][^\n]*/,
            /^第\d+[章节篇部][^\n]*/,
            /^Chapter\s+\d+[^\n]*/i,
            /^Part\s+\d+[^\n]*/i,
            /^#{1,2}\s+[^#\n]+$/,
            /^[【\[【][^】\]\】]+[】\]\】]/
        ];

        const excludePatterns = [
            /^[\d]+\.[\d]+/,
            /^[\d]+\.[\d]+\.[\d]+/,
            /^[一二三四五六七八九十]+[、.．]\s*[\d]+/,
            /^#{3,}/
        ];

        let currentSection = null;
        let currentContent = [];
        let sectionIndex = 0;

        for (const line of lines) {
            const trimmedLine = line.trim();
            let isTopLevelHeading = false;

            for (const pattern of excludePatterns) {
                if (pattern.test(trimmedLine)) {
                    isTopLevelHeading = false;
                    break;
                }
            }

            if (!isTopLevelHeading) {
                for (const pattern of topLevelPatterns) {
                    if (pattern.test(trimmedLine)) {
                        isTopLevelHeading = true;
                        break;
                    }
                }
            }

            if (isTopLevelHeading && trimmedLine.length > 2 && trimmedLine.length < 80) {
                if (currentSection) {
                    currentSection.content = currentContent.join('\n').trim();
                    currentSection.charCount = currentSection.content.length;
                    if (currentSection.charCount > 200) {
                        sections.push(currentSection);
                    }
                }

                currentSection = {
                    id: `section_${sectionIndex++}`,
                    title: trimmedLine.replace(/^#+\s*/, '').replace(/^[【\[【]|[】\]\】]$/g, '').trim(),
                    content: '',
                    charCount: 0,
                    startIndex: sections.length
                };
                currentContent = [];
            } else if (currentSection) {
                currentContent.push(line);
            } else {
                currentContent.push(line);
            }
        }

        if (currentSection) {
            currentSection.content = currentContent.join('\n').trim();
            currentSection.charCount = currentSection.content.length;
            if (currentSection.charCount > 200) {
                sections.push(currentSection);
            }
        }

        if (sections.length === 0) {
            sections.push({
                id: 'full_doc',
                title: 'Full Document',
                content: text,
                charCount: text.length,
                startIndex: 0
            });
        }

        console.log(`[DocumentStore] Extracted ${sections.length} top-level sections`);
        return sections;
    }

    async addDocument(fileName, text, metadata = {}, eventSender = null) {
        const docId = this.generateId();
        const document = {
            id: docId,
            fileName,
            text,
            charCount: text.length,
            createdAt: new Date().toISOString(),
            ...metadata
        };
        
        this.documents.set(docId, document);
        
        const sendProgress = (percent, status, detail = '') => {
            if (eventSender) {
                eventSender.send('muelsyse-upload-progress', { percent, status, detail });
            }
        };
        
        sendProgress(20, 'Extracting sections...', '');
        
        const extractedSections = this.extractSections(text);
        const docSections = [];
        extractedSections.forEach((section, index) => {
            const sectionId = `${docId}_section_${index}`;
            this.sections.set(sectionId, {
                id: sectionId,
                docId,
                title: section.title,
                content: section.content,
                charCount: section.charCount,
                index
            });
            docSections.push(sectionId);
        });
        document.sections = docSections;
        
        sendProgress(30, 'Creating chunks...', `${extractedSections.length} sections found`);
        
        const chunkData = this.chunkText(text);
        console.log(`[DocumentStore] Created ${chunkData.length} chunks, ${docSections.length} sections for document ${fileName}`);
        
        sendProgress(40, 'Generating embeddings...', `${chunkData.length} chunks to process`);
        
        const chunkTexts = chunkData.map(c => c.text);
        const embeddings = [];
        
        for (let i = 0; i < chunkTexts.length; i++) {
            const embedding = await this.generateEmbedding(chunkTexts[i]);
            embeddings.push(embedding);
            
            const progress = 40 + Math.floor((i / chunkTexts.length) * 50);
            sendProgress(progress, 'Generating embeddings...', `Chunk ${i + 1}/${chunkTexts.length}`);
        }
        
        sendProgress(90, 'Saving...', '');
        
        chunkData.forEach((chunk, index) => {
            const chunkId = `${docId}_${index}`;
            this.chunks.set(chunkId, {
                id: chunkId,
                docId,
                text: chunk.text,
                index: chunk.index
            });
            
            if (embeddings[index]) {
                this.embeddings.set(chunkId, embeddings[index]);
            }
        });
        
        this.saveData();
        
        sendProgress(100, 'Complete!', '');
        
        return document;
    }

    cosineSimilarity(vec1, vec2) {
        if (!vec1 || !vec2 || vec1.length !== vec2.length) {
            return 0;
        }

        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;

        for (let i = 0; i < vec1.length; i++) {
            dotProduct += vec1[i] * vec2[i];
            norm1 += vec1[i] * vec1[i];
            norm2 += vec2[i] * vec2[i];
        }

        if (norm1 === 0 || norm2 === 0) {
            return 0;
        }

        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    }

    async search(query, topK = 5, threshold = null) {
        const actualThreshold = threshold ?? this.config.similarityThreshold;
        
        console.log(`[DocumentStore] Searching for: "${query.substring(0, 50)}..."`);
        
        const queryEmbedding = await this.generateEmbedding(query);
        if (!queryEmbedding) {
            console.error('[DocumentStore] Failed to generate query embedding');
            return [];
        }

        const results = [];
        
        for (const [chunkId, chunk] of this.chunks) {
            const chunkEmbedding = this.embeddings.get(chunkId);
            if (!chunkEmbedding) {
                continue;
            }

            const similarity = this.cosineSimilarity(queryEmbedding, chunkEmbedding);
            
            if (similarity >= actualThreshold) {
                results.push({
                    chunk,
                    similarity,
                    embedding: chunkEmbedding
                });
            }
        }

        results.sort((a, b) => b.similarity - a.similarity);
        const topResults = results.slice(0, topK);
        
        console.log(`[DocumentStore] Found ${results.length} results above threshold, returning top ${topResults.length}`);
        
        return topResults;
    }

    getDocument(docId) {
        return this.documents.get(docId);
    }

    getAllDocuments() {
        return Array.from(this.documents.values());
    }

    getDocumentSections(docId) {
        const sections = [];
        for (const [sectionId, section] of this.sections) {
            if (section.docId === docId) {
                sections.push({
                    id: sectionId,
                    title: section.title,
                    charCount: section.charCount,
                    index: section.index
                });
            }
        }
        return sections.sort((a, b) => a.index - b.index);
    }

    getSectionContent(sectionId) {
        const section = this.sections.get(sectionId);
        if (!section) return null;
        
        const doc = this.documents.get(section.docId);
        return {
            ...section,
            docName: doc?.fileName || 'Unknown'
        };
    }

    getSectionsContent(sectionIds) {
        const contents = [];
        for (const sectionId of sectionIds) {
            const section = this.getSectionContent(sectionId);
            if (section) {
                contents.push(section);
            }
        }
        return contents;
    }

    deleteDocument(docId) {
        const chunksToDelete = [];
        const sectionsToDelete = [];
        
        for (const [chunkId, chunk] of this.chunks) {
            if (chunk.docId === docId) {
                chunksToDelete.push(chunkId);
            }
        }
        
        for (const [sectionId, section] of this.sections) {
            if (section.docId === docId) {
                sectionsToDelete.push(sectionId);
            }
        }
        
        chunksToDelete.forEach(chunkId => {
            this.chunks.delete(chunkId);
            this.embeddings.delete(chunkId);
        });
        
        sectionsToDelete.forEach(sectionId => {
            this.sections.delete(sectionId);
        });
        
        this.documents.delete(docId);
        this.saveData();
        
        console.log(`[DocumentStore] Deleted document ${docId}, ${chunksToDelete.length} chunks, ${sectionsToDelete.length} sections`);
        return true;
    }

    async reindexAllDocuments() {
        console.log('[DocumentStore] Reindexing all documents...');
        
        const allDocs = this.getAllDocuments();
        this.chunks.clear();
        this.embeddings.clear();
        
        for (const doc of allDocs) {
            const chunkData = this.chunkText(doc.text);
            const chunkTexts = chunkData.map(c => c.text);
            const embeddings = await this.generateEmbeddingsBatch(chunkTexts);
            
            chunkData.forEach((chunk, index) => {
                const chunkId = `${doc.id}_${index}`;
                this.chunks.set(chunkId, {
                    id: chunkId,
                    docId: doc.id,
                    text: chunk.text,
                    index: chunk.index
                });
                
                if (embeddings[index]) {
                    this.embeddings.set(chunkId, embeddings[index]);
                }
            });
            
            console.log(`[DocumentStore] Reindexed document: ${doc.fileName}`);
        }
        
        this.saveData();
        console.log('[DocumentStore] Reindexing complete');
    }

    setEmbeddingModel(model) {
        this.config.embeddingModel = model;
        this.saveData();
    }

    setChunkSettings(chunkSize, chunkOverlap) {
        this.config.chunkSize = chunkSize;
        this.config.chunkOverlap = chunkOverlap;
        this.saveData();
    }

    setSimilarityThreshold(threshold) {
        this.config.similarityThreshold = threshold;
        this.saveData();
    }

    getStats() {
        return {
            documentCount: this.documents.size,
            chunkCount: this.chunks.size,
            embeddingCount: this.embeddings.size,
            sectionCount: this.sections.size,
            config: this.config
        };
    }

    async checkEmbeddingModel() {
        const config = await this.getOllamaConfig();
        const endpoint = config.endpoint || 'http://127.0.0.1:11434';
        
        try {
            const response = await fetch(`${endpoint}/api/tags`);
            if (!response.ok) {
                return { available: false, message: 'Ollama服务未运行' };
            }
            
            const data = await response.json();
            const models = data.models || [];
            const hasEmbeddingModel = models.some(m => m.name.includes(this.config.embeddingModel));
            
            if (hasEmbeddingModel) {
                return { available: true, model: this.config.embeddingModel };
            } else {
                return { 
                    available: false, 
                    message: `需要安装embedding模型: ${this.config.embeddingModel}`,
                    suggestedCommand: `ollama pull ${this.config.embeddingModel}`
                };
            }
        } catch (error) {
            return { available: false, message: `连接失败: ${error.message}` };
        }
    }
}

module.exports = { DocumentStore, DEFAULT_EMBEDDING_MODEL };

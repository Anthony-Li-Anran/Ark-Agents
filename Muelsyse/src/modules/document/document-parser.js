/**
 * Document Parser
 * Multi-format document parsing (PDF, Word, TXT, PPT)
 */

const fs = require('fs');
const path = require('path');

class DocumentParser {
    constructor() {
        this.supportedExtensions = ['.pdf', '.docx', '.doc', '.txt', '.pptx', '.ppt'];
    }

    isSupported(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        return this.supportedExtensions.includes(ext);
    }

    async parse(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        
        if (!this.isSupported(filePath)) {
            throw new Error(`Unsupported file format: ${ext}`);
        }

        switch (ext) {
            case '.pdf':
                return await this.parsePDF(filePath);
            case '.docx':
            case '.doc':
                return await this.parseWord(filePath);
            case '.txt':
                return await this.parseTXT(filePath);
            case '.pptx':
            case '.ppt':
                return await this.parsePPT(filePath);
            default:
                throw new Error(`Unsupported file format: ${ext}`);
        }
    }

    async parsePDF(filePath) {
        const pdfParse = require('pdf-parse');
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        return {
            text: data.text,
            pages: data.numpages,
            info: data.info
        };
    }

    async parseWord(filePath) {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ path: filePath });
        return {
            text: result.value,
            pages: null,
            info: null
        };
    }

    async parseTXT(filePath) {
        const text = fs.readFileSync(filePath, 'utf-8');
        const lines = text.split('\n').length;
        return {
            text: text,
            pages: null,
            info: { lines: lines }
        };
    }

    async parsePPT(filePath) {
        const officeparser = require('officeparser');
        const text = await officeparser.parseOffice(filePath);
        return {
            text: text,
            pages: null,
            info: null
        };
    }

    chunkText(text, chunkSize = 500, overlap = 50) {
        const chunks = [];
        let start = 0;
        
        while (start < text.length) {
            let end = start + chunkSize;
            
            if (end < text.length) {
                const lastPeriod = text.lastIndexOf('。', end);
                const lastNewline = text.lastIndexOf('\n', end);
                const lastSpace = text.lastIndexOf(' ', end);
                const breakPoint = Math.max(lastPeriod, lastNewline, lastSpace);
                
                if (breakPoint > start + chunkSize / 2) {
                    end = breakPoint + 1;
                }
            } else {
                end = text.length;
            }
            
            chunks.push({
                text: text.slice(start, end).trim(),
                index: chunks.length
            });
            
            start = end - overlap;
            if (start < 0) start = 0;
        }
        
        return chunks;
    }
}

module.exports = { DocumentParser };

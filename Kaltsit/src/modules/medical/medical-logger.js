const fs = require('fs');
const path = require('path');

class MedicalLogger {
    constructor(logsDir = null) {
        this.logsDir = logsDir || path.join(__dirname, '..', '..', '..', 'logs');
        this.retentionDays = 30;
        this._ensureLogsDir();
    }

    _ensureLogsDir() {
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }
    }

    _getLogFilePath() {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const fileName = `medical-${year}-${month}-${day}.log`;
        return path.join(this.logsDir, fileName);
    }

    _formatTimestamp() {
        return new Date().toISOString();
    }

    _writeLog(entry) {
        const logPath = this._getLogFilePath();
        const logLine = JSON.stringify(entry) + '\n';
        fs.appendFileSync(logPath, logLine, 'utf8');
    }

    logUserQuestion(question) {
        const entry = {
            type: 'user_question',
            timestamp: this._formatTimestamp(),
            question: question
        };
        this._writeLog(entry);
        return entry;
    }

    logModelResponse(response, responseTime) {
        const entry = {
            type: 'model_response',
            timestamp: this._formatTimestamp(),
            response: response,
            responseTime: responseTime
        };
        this._writeLog(entry);
        return entry;
    }

    logNetworkQuery(url, status, responseTime, error = null) {
        const entry = {
            type: 'network_query',
            timestamp: this._formatTimestamp(),
            url: url,
            status: status,
            responseTime: responseTime,
            error: error
        };
        this._writeLog(entry);
        return entry;
    }

    cleanOldLogs() {
        this._ensureLogsDir();
        
        const files = fs.readdirSync(this.logsDir);
        const medicalLogFiles = files.filter(file => file.startsWith('medical-') && file.endsWith('.log'));
        
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
        
        const deletedFiles = [];
        
        for (const file of medicalLogFiles) {
            const match = file.match(/medical-(\d{4})-(\d{2})-(\d{2})\.log/);
            if (match) {
                const fileDate = new Date(
                    parseInt(match[1]),
                    parseInt(match[2]) - 1,
                    parseInt(match[3])
                );
                
                if (fileDate < cutoffDate) {
                    const filePath = path.join(this.logsDir, file);
                    fs.unlinkSync(filePath);
                    deletedFiles.push(file);
                }
            }
        }
        
        return deletedFiles;
    }

    getTodayLogs() {
        const logPath = this._getLogFilePath();
        if (!fs.existsSync(logPath)) {
            return [];
        }
        
        const content = fs.readFileSync(logPath, 'utf8');
        const lines = content.trim().split('\n').filter(line => line.length > 0);
        
        return lines.map(line => {
            try {
                return JSON.parse(line);
            } catch (e) {
                return { raw: line, parseError: true };
            }
        });
    }

    getLogsByDate(dateStr) {
        const fileName = `medical-${dateStr}.log`;
        const logPath = path.join(this.logsDir, fileName);
        
        if (!fs.existsSync(logPath)) {
            return [];
        }
        
        const content = fs.readFileSync(logPath, 'utf8');
        const lines = content.trim().split('\n').filter(line => line.length > 0);
        
        return lines.map(line => {
            try {
                return JSON.parse(line);
            } catch (e) {
                return { raw: line, parseError: true };
            }
        });
    }

    setRetentionDays(days) {
        if (days > 0) {
            this.retentionDays = days;
        }
    }
}

module.exports = { MedicalLogger };

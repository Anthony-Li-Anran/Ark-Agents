/**
 * Logger Utility
 * Centralized logging system for consistent log formatting
 */

const { ENV, IS_DEV } = require('./env.config');

class Logger {
    constructor(moduleName) {
        this.moduleName = moduleName;
        this.debugEnabled = IS_DEV || ENV.DEBUG;
    }

    formatMessage(level, message) {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${level}] [${this.moduleName}] ${message}`;
    }

    info(message, ...args) {
        console.log(this.formatMessage('INFO', message), ...args);
    }

    warn(message, ...args) {
        console.warn(this.formatMessage('WARN', message), ...args);
    }

    error(message, ...args) {
        console.error(this.formatMessage('ERROR', message), ...args);
    }

    debug(message, ...args) {
        if (this.debugEnabled) {
            console.log(this.formatMessage('DEBUG', message), ...args);
        }
    }

    success(message, ...args) {
        console.log(this.formatMessage('SUCCESS', message), ...args);
    }
}

function createLogger(moduleName) {
    return new Logger(moduleName);
}

module.exports = {
    Logger,
    createLogger
};

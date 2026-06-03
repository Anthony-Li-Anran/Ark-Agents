/**
 * Environment Configuration
 * Centralized configuration for different environments
 */

const path = require('path');
const { app } = require('electron');

// Get base path that works in both development and production
function getBasePath() {
    // In development: __dirname is scripts/shared, so go up 2 levels
    // In production (asar): __dirname is app.asar/scripts/shared, so go up 2 levels
    return path.resolve(__dirname, '..', '..');
}

const BASE_PATH = getBasePath();

const ENV = {
    development: {
        DEBUG: true,
        LOG_LEVEL: 'debug',
        MODELS_BASE_PATH: path.join(BASE_PATH, 'Models'),
        AMIYA_SRC_PATH: path.join(BASE_PATH, 'Amiya', 'src'),
        TEXAS_SRC_PATH: path.join(BASE_PATH, 'Texas', 'src'),
        KALTSIT_SRC_PATH: path.join(BASE_PATH, 'Kaltsit', 'src'),
        TEXAS2_SRC_PATH: path.join(BASE_PATH, 'Texas2', 'src')
    },
    production: {
        DEBUG: false,
        LOG_LEVEL: 'info',
        MODELS_BASE_PATH: path.join(BASE_PATH, 'Models'),
        AMIYA_SRC_PATH: path.join(BASE_PATH, 'Amiya', 'src'),
        TEXAS_SRC_PATH: path.join(BASE_PATH, 'Texas', 'src'),
        KALTSIT_SRC_PATH: path.join(BASE_PATH, 'Kaltsit', 'src'),
        TEXAS2_SRC_PATH: path.join(BASE_PATH, 'Texas2', 'src')
    }
};

const currentEnv = process.env.NODE_ENV || 'development';

module.exports = {
    ENV: ENV[currentEnv],
    IS_DEV: currentEnv === 'development',
    IS_PROD: currentEnv === 'production',
    BASE_PATH,
    
    getModelsPath: () => ENV[currentEnv].MODELS_BASE_PATH,
    getAmiyaPath: () => ENV[currentEnv].AMIYA_SRC_PATH,
    getTexasPath: () => ENV[currentEnv].TEXAS_SRC_PATH,
    getKaltsitPath: () => ENV[currentEnv].KALTSIT_SRC_PATH,
    getTexas2Path: () => ENV[currentEnv].TEXAS2_SRC_PATH
};

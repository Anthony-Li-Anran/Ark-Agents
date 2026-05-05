/**
 * Environment Configuration
 * Centralized configuration for different environments
 */

const path = require('path');

const ENV = {
    development: {
        DEBUG: true,
        LOG_LEVEL: 'debug',
        MODELS_BASE_PATH: path.join(__dirname, '..', 'Models'),
        AMIYA_SRC_PATH: path.join(__dirname, '..', 'Amiya', 'src'),
        TEXAS_SRC_PATH: path.join(__dirname, '..', 'Texas', 'src'),
        KALTSIT_SRC_PATH: path.join(__dirname, '..', 'Kaltsit', 'src'),
        TEXAS2_SRC_PATH: path.join(__dirname, '..', 'Texas2', 'src')
    },
    production: {
        DEBUG: false,
        LOG_LEVEL: 'info',
        MODELS_BASE_PATH: path.join(__dirname, '..', 'Models'),
        AMIYA_SRC_PATH: path.join(__dirname, '..', 'Amiya', 'src'),
        TEXAS_SRC_PATH: path.join(__dirname, '..', 'Texas', 'src'),
        KALTSIT_SRC_PATH: path.join(__dirname, '..', 'Kaltsit', 'src'),
        TEXAS2_SRC_PATH: path.join(__dirname, '..', 'Texas2', 'src')
    }
};

const currentEnv = process.env.NODE_ENV || 'development';

module.exports = {
    ENV: ENV[currentEnv],
    IS_DEV: currentEnv === 'development',
    IS_PROD: currentEnv === 'production',
    
    getModelsPath: () => ENV[currentEnv].MODELS_BASE_PATH,
    getAmiyaPath: () => ENV[currentEnv].AMIYA_SRC_PATH,
    getTexasPath: () => ENV[currentEnv].TEXAS_SRC_PATH,
    getKaltsitPath: () => ENV[currentEnv].KALTSIT_SRC_PATH,
    getTexas2Path: () => ENV[currentEnv].TEXAS2_SRC_PATH
};

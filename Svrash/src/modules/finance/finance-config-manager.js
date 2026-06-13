const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '..', '..', '..', 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'finance-config.json');

const DEFAULT_CONFIG = {
  pushEnabled: true,
  pushSchedule: {
    open: '09:15',
    midday: ['11:30', '14:00'],
    close: '15:05'
  },
  thresholdAlertsEnabled: true,
  checkIntervalMinutes: 5
};

function ensureFile() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(CONFIG_FILE)) {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('ensureFile error:', err.message);
  }
}

function readConfig() {
  ensureFile();
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...config };
  } catch (err) {
    console.error('readConfig error:', err.message);
    return { ...DEFAULT_CONFIG };
  }
}

function writeConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.error('writeConfig error:', err.message);
  }
}

function getConfig() {
  return readConfig();
}

function updateConfig(updates) {
  const config = { ...readConfig(), ...updates };
  writeConfig(config);
  return config;
}

function getPushSchedule() {
  return readConfig().pushSchedule;
}

function isPushEnabled() {
  return !!readConfig().pushEnabled;
}

function isThresholdAlertsEnabled() {
  return !!readConfig().thresholdAlertsEnabled;
}

const financeConfigManager = {
  getConfig,
  updateConfig,
  getPushSchedule,
  isPushEnabled,
  isThresholdAlertsEnabled,
};

module.exports = { financeConfigManager };

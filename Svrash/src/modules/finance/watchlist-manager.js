const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '..', '..', '..', 'data');
const WATCHLIST_FILE = path.join(DATA_DIR, 'watchlist.json');

function ensureFile() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(WATCHLIST_FILE)) {
      fs.writeFileSync(WATCHLIST_FILE, JSON.stringify([], null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('ensureFile error:', err.message);
  }
}

function readWatchlist() {
  ensureFile();
  try {
    const raw = fs.readFileSync(WATCHLIST_FILE, 'utf-8');
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.error('readWatchlist error:', err.message);
    return [];
  }
}

function writeWatchlist(list) {
  try {
    fs.writeFileSync(WATCHLIST_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('writeWatchlist error:', err.message);
  }
}

function isValidCode(code) {
  return typeof code === 'string' && /^\d{6}$/.test(code);
}

function addStock(code, name, threshold, costPrice, holdings) {
  if (!isValidCode(code)) {
    throw new Error('Invalid stock code, must be 6 digits');
  }
  const list = readWatchlist();
  const existing = list.find(item => item.code === code);
  if (existing) {
    existing.name = name || existing.name;
    if (threshold !== undefined) existing.threshold = threshold;
    if (costPrice !== undefined) existing.costPrice = costPrice;
    if (holdings !== undefined) existing.holdings = holdings;
  } else {
    list.push({
      code,
      name: name || '',
      threshold: threshold !== undefined ? threshold : null,
      costPrice: costPrice !== undefined ? costPrice : null,
      holdings: holdings !== undefined ? holdings : null
    });
  }
  writeWatchlist(list);
  return list;
}

function removeStock(code) {
  if (!isValidCode(code)) {
    throw new Error('Invalid stock code, must be 6 digits');
  }
  const list = readWatchlist().filter(item => item.code !== code);
  writeWatchlist(list);
  return list;
}

function getWatchlist() {
  return readWatchlist();
}

function updateThreshold(code, threshold) {
  if (!isValidCode(code)) {
    throw new Error('Invalid stock code, must be 6 digits');
  }
  const list = readWatchlist();
  const item = list.find(i => i.code === code);
  if (!item) {
    throw new Error('Stock not found in watchlist');
  }
  item.threshold = threshold;
  writeWatchlist(list);
  return list;
}

function updateCostAndHoldings(code, costPrice, holdings) {
  if (!isValidCode(code)) {
    throw new Error('Invalid stock code, must be 6 digits');
  }
  const list = readWatchlist();
  const item = list.find(i => i.code === code);
  if (!item) {
    throw new Error('Stock not found in watchlist');
  }
  if (costPrice !== undefined) item.costPrice = costPrice;
  if (holdings !== undefined) item.holdings = holdings;
  writeWatchlist(list);
  return list;
}

const watchlistManager = {
  addStock,
  removeStock,
  getWatchlist,
  updateThreshold,
  updateCostAndHoldings,
};

module.exports = { watchlistManager };

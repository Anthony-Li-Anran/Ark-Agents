const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const DATA_DIR = path.resolve(__dirname, '..', '..', '..', 'data');
const HOLIDAYS_FILE = path.join(DATA_DIR, 'holidays.json');
const STALE_DAYS = 90;

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const req = client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

function loadHolidays() {
  try {
    if (!fs.existsSync(HOLIDAYS_FILE)) return null;
    const raw = fs.readFileSync(HOLIDAYS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('loadHolidays error:', err.message);
    return null;
  }
}

function saveHolidays(holidays, updatedAt) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const payload = { updatedAt: updatedAt || new Date().toISOString(), holidays };
    fs.writeFileSync(HOLIDAYS_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  } catch (err) {
    console.error('saveHolidays error:', err.message);
  }
}

function isCacheStale(cache) {
  if (!cache || !cache.updatedAt) return true;
  const updated = new Date(cache.updatedAt).getTime();
  const now = Date.now();
  return (now - updated) > STALE_DAYS * 24 * 60 * 60 * 1000;
}

async function fetchHolidaysFromNetwork() {
  // Try East Money / AKShare-like endpoint for trade calendar
  // Using a public Sina or East Money proxy is not stable; fallback to weekend-only if fails.
  try {
    // This endpoint may not always be available; wrap in try/catch
    const url = 'https://push2ex.eastmoney.com/getStockFuturesDays?secid=1.000001';
    const data = await fetchJson(url);
    // If we can parse holidays from response, do so; otherwise throw to fallback
    if (!data || !data.data) throw new Error('No holiday data');
    // The above endpoint does not directly provide holidays; as a pragmatic fallback,
    // we return empty so caller falls back to weekend-only.
    return [];
  } catch (err) {
    console.error('fetchHolidaysFromNetwork error:', err.message);
    return [];
  }
}

function ensureDefaultHolidays() {
  const defaults = [
    '2024-01-01', '2024-02-09', '2024-02-10', '2024-02-11', '2024-02-12',
    '2024-02-13', '2024-02-14', '2024-02-15', '2024-02-16', '2024-02-17',
    '2024-04-04', '2024-04-05', '2024-04-06', '2024-05-01', '2024-05-02',
    '2024-05-03', '2024-05-04', '2024-05-05', '2024-06-10', '2024-09-15',
    '2024-09-16', '2024-09-17', '2024-10-01', '2024-10-02', '2024-10-03',
    '2024-10-04', '2024-10-05', '2024-10-06', '2024-10-07',
    '2025-01-01', '2025-01-28', '2025-01-29', '2025-01-30', '2025-01-31',
    '2025-02-01', '2025-02-02', '2025-02-03', '2025-02-04', '2025-04-04',
    '2025-04-05', '2025-04-06', '2025-05-01', '2025-05-02', '2025-05-03',
    '2025-05-04', '2025-05-05', '2025-05-31', '2025-06-01', '2025-06-02',
    '2025-10-01', '2025-10-02', '2025-10-03', '2025-10-04', '2025-10-05',
    '2025-10-06', '2025-10-07', '2025-10-08'
  ];
  let cache = loadHolidays();
  if (!cache || !Array.isArray(cache.holidays) || cache.holidays.length === 0) {
    saveHolidays(defaults, '2025-01-01T00:00:00.000Z');
    cache = loadHolidays();
  }
  return cache;
}

async function refreshHolidaysIfNeeded() {
  let cache = ensureDefaultHolidays();
  if (isCacheStale(cache)) {
    const fetched = await fetchHolidaysFromNetwork();
    if (fetched && fetched.length > 0) {
      saveHolidays(fetched);
      cache = loadHolidays();
    }
  }
  return cache;
}

function toDateString(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isTradingDay(date) {
  const d = date instanceof Date ? date : new Date(date);
  const dayOfWeek = d.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;

  const cache = ensureDefaultHolidays();
  const dateStr = toDateString(d);
  const holidays = new Set(cache?.holidays || []);
  return !holidays.has(dateStr);
}

module.exports = {
  isTradingDay,
  refreshHolidaysIfNeeded,
  loadHolidays,
  saveHolidays,
};

const https = require('https');
const http = require('http');

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

function formatSecid(code) {
  if (!code || code.length !== 6) return null;
  // Shanghai: 600/601/603/605/688/689/510/511/512/513/515/516/518/560/563/588
  //           (A股/科创板/ETF基金)
  // Shenzhen: 000/001/002/003/300/301/159 (A股/创业板/ETF基金)
  const shPrefixes = ['600', '601', '603', '605', '688', '689', '510', '511', '512', '513', '515', '516', '518', '560', '563', '588'];
  const prefix = code.substring(0, 3);
  if (shPrefixes.includes(prefix)) {
    return `1.${code}`;
  }
  return `0.${code}`;
}

async function getStockQuote(codes) {
  if (!Array.isArray(codes) || codes.length === 0) return [];
  const secids = codes.map(formatSecid).filter(Boolean);
  if (secids.length === 0) return [];

  const fields = 'f12,f13,f14,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f18,f20,f21,f22,f23,f24,f25,f26,f27,f28,f29,f30,f31,f32,f33,f34,f35,f36,f37,f38,f39,f40,f41,f42,f43,f44,f45,f46,f47,f48,f49,f50,f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64,f65,f66,f67,f68,f69,f70,f71,f72,f73,f74,f75,f76,f77,f78,f79,f80,f81,f82,f83,f84,f85,f86,f87,f88,f89,f90,f91,f92,f93,f94,f95,f96,f97,f98,f99,f100';
  const url = `http://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&invt=2&fields=${fields}&ut=fa5fd1943c7b386f172d6893dbfba10b&secids=${secids.join(',')}`;

  try {
    const data = await fetchJson(url);
    const list = data?.data?.diff || [];
    return list.map(item => ({
      code: item.f12 || '',
      name: item.f14 || '',
      price: item.f2 || 0,
      open: item.f17 || 0,
      high: item.f15 || 0,
      low: item.f16 || 0,
      prevClose: item.f18 || 0,
      change: item.f4 || 0,
      changePercent: item.f3 || 0,
      volume: item.f5 || 0,
      amount: item.f6 || 0,
    }));
  } catch (err) {
    console.error('getStockQuote error:', err.message);
    return [];
  }
}

async function getFinanceNews() {
  const url = 'https://searchapi.eastmoney.com/api/sns/getArticleList?type=1&count=10';
  try {
    const data = await fetchJson(url);
    const list = data?.result?.data || data?.data || [];
    return list.slice(0, 10).map(item => ({
      title: item.title || item.art_title || '',
      url: item.url || item.art_url || '',
      source: item.source || item.mediaName || 'East Money',
      time: item.showTime || item.publishTime || item.time || '',
    }));
  } catch (err) {
    console.error('getFinanceNews error:', err.message);
    return [];
  }
}

module.exports = {
  getStockQuote,
  getFinanceNews,
};

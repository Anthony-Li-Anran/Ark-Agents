function formatDate(date) {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function padChange(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return '-';
  const sign = num > 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}%`;
}

function padPrice(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return '-';
  return num.toFixed(3);
}

function formatProfitLoss(profitLoss) {
  const num = Number(profitLoss);
  if (Number.isNaN(num)) return '-';
  const sign = num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}`;
}

function padVolume(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return '-';
  if (num >= 100000000) return `${(num / 100000000).toFixed(2)}亿`;
  if (num >= 10000) return `${(num / 10000).toFixed(2)}万`;
  return String(Math.round(num));
}

function formatOpenPush(date, stocks, news) {
  const lines = [
    '## 📈 银灰 | 开盘简报',
    '',
    `**日期**：${formatDate(date)}`,
    '',
    '| 代码 | 名称 | 开盘价 | 涨跌幅 |',
    '| --- | --- | --- | --- |',
  ];

  for (const s of stocks || []) {
    lines.push(`| ${s.code || '-'} | ${s.name || '-'} | ${padPrice(s.open)} | ${padChange(s.changePercent)} |`);
  }

  if (news && news.length > 0) {
    lines.push('', '**要闻速览**：');
    for (const n of news) {
      lines.push(`- ${n.title || n}`);
    }
  }

  lines.push('', '*数据仅供参考，投资有风险。*');
  return lines.join('\n');
}

function formatMiddayPush(date, stocks, watchlist) {
  const lines = [
    '## 📊 银灰 | 盘中播报',
    '',
    `**日期**：${formatDate(date)}`,
    '',
    '| 代码 | 名称 | 最新价 | 涨跌幅 | 持仓盈亏 |',
    '| --- | --- | --- | --- | --- |',
  ];

  for (const s of stocks || []) {
    // Find watchlist item to calculate profit/loss
    const watchItem = watchlist?.find(w => w.code === s.code);
    let profitLossStr = '-';
    if (watchItem && watchItem.costPrice && watchItem.holdings && Number(watchItem.holdings) > 0) {
      const pl = (Number(s.price) - Number(watchItem.costPrice)) * Number(watchItem.holdings);
      profitLossStr = formatProfitLoss(pl);
    }
    lines.push(`| ${s.code || '-'} | ${s.name || '-'} | ${padPrice(s.price)} | ${padChange(s.changePercent)} | ${profitLossStr} |`);
  }

  lines.push('', '*数据仅供参考，投资有风险。*');
  return lines.join('\n');
}

function formatClosePush(date, stocks, watchlist) {
  const sorted = (stocks || []).slice().sort((a, b) => {
    const ca = Number(a.changePercent) || 0;
    const cb = Number(b.changePercent) || 0;
    return cb - ca;
  });

  const lines = [
    '## 📉 银灰 | 收盘总结',
    '',
    `**日期**：${formatDate(date)}`,
    '',
    '| 代码 | 名称 | 收盘价 | 涨跌幅 | 持仓盈亏 |',
    '| --- | --- | --- | --- | --- |',
  ];

  for (const s of sorted) {
    // Find watchlist item to calculate profit/loss
    const watchItem = watchlist?.find(w => w.code === s.code);
    let profitLossStr = '-';
    if (watchItem && watchItem.costPrice && watchItem.holdings && Number(watchItem.holdings) > 0) {
      const pl = (Number(s.price) - Number(watchItem.costPrice)) * Number(watchItem.holdings);
      profitLossStr = formatProfitLoss(pl);
    }
    lines.push(`| ${s.code || '-'} | ${s.name || '-'} | ${padPrice(s.price)} | ${padChange(s.changePercent)} | ${profitLossStr} |`);
  }

  lines.push('', '*数据仅供参考，投资有风险。*');
  return lines.join('\n');
}

function formatThresholdAlert(stock) {
  const lines = [
    '## ⚠️ 银灰 | 异动提醒',
    '',
    `**${stock.name || stock.code || ''}** 出现显著波动，请关注。`,
    '',
    '| 代码 | 名称 | 当前价 | 涨跌幅 |',
    '| --- | --- | --- | --- |',
    `| ${stock.code || '-'} | ${stock.name || '-'} | ${padPrice(stock.price)} | ${padChange(stock.changePercent)} |`,
    '',
    '*数据仅供参考，投资有风险。*',
  ];
  return lines.join('\n');
}

module.exports = {
  formatOpenPush,
  formatMiddayPush,
  formatClosePush,
  formatThresholdAlert,
};

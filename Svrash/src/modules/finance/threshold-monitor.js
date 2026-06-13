const cron = require('node-cron');
const { getStockQuote } = require('./finance-data');
const { watchlistManager } = require('./watchlist-manager');
const { financeConfigManager } = require('./finance-config-manager');
const { formatThresholdAlert } = require('./message-formatter');
const { isTradingDay } = require('./trading-day');

class ThresholdMonitor {
  constructor(dingtalkConnector) {
    this.dingtalk = dingtalkConnector;
    this.job = null;
    this.alertedToday = new Set();
    this.todayString = this._getTodayString();
  }

  _getTodayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  _resetIfNewDay() {
    const current = this._getTodayString();
    if (current !== this.todayString) {
      this.todayString = current;
      this.alertedToday.clear();
    }
  }

  async _tick() {
    this._resetIfNewDay();

    const config = financeConfigManager.getConfig();
    if (!config.thresholdAlertsEnabled) return;
    if (!this.dingtalk) return;

    const isTrading = isTradingDay(new Date());
    if (!isTrading) return;

    const watchlist = watchlistManager.getWatchlist();
    if (!watchlist || watchlist.length === 0) return;

    const codes = watchlist.map(s => s.code);
    const stocks = await getStockQuote(codes);

    for (const s of stocks || []) {
      const change = Number(s.changePercent) || 0;
      const key = s.code || s.name;
      if (!key) continue;
      const watchItem = watchlist.find(w => w.code === s.code);
      const threshold = watchItem && watchItem.threshold != null ? watchItem.threshold : 5;
      if (Math.abs(change) >= threshold && !this.alertedToday.has(key)) {
        this.alertedToday.add(key);
        const message = formatThresholdAlert(s);
        if (this.dingtalk.sendMarkdownMessage) {
          await this.dingtalk.sendMarkdownMessage('⚠️ 银灰 | 异动提醒', message);
        } else if (this.dingtalk.sendMarkdown) {
          await this.dingtalk.sendMarkdown(message);
        }
      }
    }
  }

  start() {
    this.stop();
    const config = financeConfigManager.getConfig();
    const intervalMinutes = Number(config.checkIntervalMinutes) || 5;
    const cronExpr = `*/${intervalMinutes} 9-15 * * 1-5`;

    if (!cron.validate(cronExpr)) return;

    this.job = cron.schedule(cronExpr, async () => {
      try {
        await this._tick();
      } catch (err) {
        // Silently ignore to avoid crashing the scheduler
      }
    }, { scheduled: true, timezone: 'Asia/Shanghai' });
  }

  stop() {
    if (this.job) {
      this.job.stop();
      this.job = null;
    }
  }
}

module.exports = { ThresholdMonitor };

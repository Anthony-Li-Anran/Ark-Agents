const cron = require('node-cron');
const { isTradingDay } = require('./trading-day');
const { getStockQuote, getFinanceNews } = require('./finance-data');
const { formatOpenPush, formatMiddayPush, formatClosePush } = require('./message-formatter');
const { watchlistManager } = require('./watchlist-manager');
const { financeConfigManager } = require('./finance-config-manager');

class Scheduler {
  constructor(dingtalkConnector) {
    this.dingtalk = dingtalkConnector;
    this.jobs = new Map();
  }

  async _shouldPush() {
    const config = financeConfigManager.getConfig();
    if (!config.pushEnabled) return false;
    if (!this.dingtalk) return false;
    const isTrading = isTradingDay(new Date());
    if (!isTrading) return false;
    return true;
  }

  async _doPush(type) {
    const date = new Date();
    const watchlist = watchlistManager.getWatchlist();
    if (!watchlist || watchlist.length === 0) return;

    const codes = watchlist.map(s => s.code);
    const stocks = await getStockQuote(codes);
    let message;
    if (type === 'open') {
      const news = await getFinanceNews();
      message = formatOpenPush(date, stocks, news);
    } else if (type === 'midday') {
      message = formatMiddayPush(date, stocks, watchlist);
    } else if (type === 'close') {
      message = formatClosePush(date, stocks, watchlist);
    }

    if (message && this.dingtalk.sendMarkdownMessage) {
      await this.dingtalk.sendMarkdownMessage('银灰金融助手', message);
    } else if (message && this.dingtalk.sendMarkdown) {
      await this.dingtalk.sendMarkdown(message);
    }
  }

  start() {
    this.stop();
    const config = financeConfigManager.getConfig();
    const schedule = config.pushSchedule || {};

    const entries = [
      { key: 'open', time: this._timeToCron(schedule.open || '09:15'), type: 'open' },
      { key: 'midday1', time: this._timeToCron(schedule.midday?.[0] || '11:30'), type: 'midday' },
      { key: 'midday2', time: this._timeToCron(schedule.midday?.[1] || '14:00'), type: 'midday' },
      { key: 'close', time: this._timeToCron(schedule.close || '15:05'), type: 'close' },
    ];

    for (const entry of entries) {
      if (!cron.validate(entry.time)) continue;
      const job = cron.schedule(entry.time, async () => {
        if (await this._shouldPush()) {
          await this._doPush(entry.type);
        }
      }, { scheduled: true, timezone: 'Asia/Shanghai' });
      this.jobs.set(entry.key, job);
    }
  }

  _timeToCron(timeStr) {
    const [hour, minute] = timeStr.split(':');
    return `${minute} ${hour} * * 1-5`;
  }

  stop() {
    for (const job of this.jobs.values()) {
      job.stop();
    }
    this.jobs.clear();
  }

  async triggerPushNow(type) {
    if (!['open', 'midday', 'close'].includes(type)) {
      throw new Error(`Invalid push type: ${type}`);
    }
    if (await this._shouldPush()) {
      await this._doPush(type);
    }
  }
}

module.exports = { Scheduler };

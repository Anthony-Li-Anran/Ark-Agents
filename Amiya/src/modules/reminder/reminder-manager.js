/**
 * Reminder Manager
 * Handles reminder settings, persistence, and notification scheduling.
 */

const { ipcMain, Notification } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REMINDER_FILE = 'reminder-data.json';
const CHECK_INTERVAL_MS = 30 * 1000;

const defaultReminders = [
    {
        id: 'water',
        title: '喝水提醒',
        message: '博士，该补充水分了。',
        frequencyMinutes: 60,
        enabled: false,
        category: 'health'
    },
    {
        id: 'stand',
        title: '久坐提醒',
        message: '博士，起来活动一下吧。',
        frequencyMinutes: 45,
        enabled: false,
        category: 'health'
    },
    {
        id: 'eyes',
        title: '护眼提醒',
        message: '博士，请让眼睛休息一会儿。',
        frequencyMinutes: 30,
        enabled: false,
        category: 'health'
    }
];

const defaultReminderData = {
    reminders: defaultReminders.map(reminder => ({
        ...reminder,
        lastTriggeredAt: null,
        nextTriggerAt: null
    })),
    lastUpdated: new Date().toISOString()
};

class ReminderManager {
    constructor(appDataPath) {
        this.dataPath = path.join(appDataPath, REMINDER_FILE);
        this.data = this.loadData();
        this.ensureDefaultReminders();
        this.setupIPC();
        this.startScheduler();
    }

    loadData() {
        try {
            if (fs.existsSync(this.dataPath)) {
                const data = fs.readFileSync(this.dataPath, 'utf-8');
                return { ...defaultReminderData, ...JSON.parse(data) };
            }
        } catch (error) {
            console.warn('Failed to load reminder data:', error);
        }
        return JSON.parse(JSON.stringify(defaultReminderData));
    }

    saveData() {
        try {
            fs.mkdirSync(path.dirname(this.dataPath), { recursive: true });
            this.data.lastUpdated = new Date().toISOString();
            fs.writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2));
            return true;
        } catch (error) {
            console.error('Failed to save reminder data:', error);
            return false;
        }
    }

    ensureDefaultReminders() {
        const existing = new Map(this.data.reminders.map(reminder => [reminder.id, reminder]));
        const defaultIds = new Set(defaultReminders.map(reminder => reminder.id));
        const mergedDefaults = defaultReminders.map(defaultReminder => {
            const reminder = existing.get(defaultReminder.id) || {};
            return {
                ...defaultReminder,
                ...reminder,
                frequencyMinutes: Number(reminder.frequencyMinutes || defaultReminder.frequencyMinutes),
                enabled: reminder.enabled !== undefined ? Boolean(reminder.enabled) : defaultReminder.enabled,
                lastTriggeredAt: reminder.lastTriggeredAt || null,
                nextTriggerAt: reminder.nextTriggerAt || this.calculateNextTrigger(defaultReminder.frequencyMinutes)
            };
        });
        const customReminders = this.data.reminders.filter(reminder => !defaultIds.has(reminder.id));
        this.data.reminders = [...mergedDefaults, ...customReminders];
        this.saveData();
    }

    calculateNextTrigger(frequencyMinutes, from = new Date()) {
        return new Date(from.getTime() + Number(frequencyMinutes) * 60 * 1000).toISOString();
    }

    getAllReminders() {
        return this.data.reminders;
    }

    getReminder(id) {
        return this.data.reminders.find(reminder => reminder.id === id);
    }

    createReminder(reminderData) {
        const frequencyMinutes = Math.max(1, Number(reminderData.frequencyMinutes || 60));
        const reminder = {
            id: reminderData.id || crypto.randomUUID(),
            title: reminderData.title || '自定义提醒',
            message: reminderData.message || reminderData.title || '该做这件事了。',
            frequencyMinutes,
            enabled: reminderData.enabled !== undefined ? Boolean(reminderData.enabled) : true,
            category: reminderData.category || 'habit',
            lastTriggeredAt: null,
            nextTriggerAt: this.calculateNextTrigger(frequencyMinutes)
        };

        this.data.reminders.push(reminder);
        this.saveData();
        return reminder;
    }

    updateReminder(id, updates) {
        const index = this.data.reminders.findIndex(reminder => reminder.id === id);
        if (index === -1) return null;

        const current = this.data.reminders[index];
        const nextFrequency = Math.max(1, Number(updates.frequencyMinutes ?? current.frequencyMinutes));
        const enabledChanged = updates.enabled !== undefined && Boolean(updates.enabled) !== current.enabled;
        const frequencyChanged = updates.frequencyMinutes !== undefined && nextFrequency !== current.frequencyMinutes;

        const updated = {
            ...current,
            ...updates,
            frequencyMinutes: nextFrequency,
            enabled: updates.enabled !== undefined ? Boolean(updates.enabled) : current.enabled
        };

        if (enabledChanged || frequencyChanged || !updated.nextTriggerAt) {
            updated.nextTriggerAt = this.calculateNextTrigger(updated.frequencyMinutes);
        }

        this.data.reminders[index] = updated;
        this.saveData();
        return updated;
    }

    resetReminder(id) {
        const reminder = this.getReminder(id);
        if (!reminder) return null;
        return this.updateReminder(id, {
            nextTriggerAt: this.calculateNextTrigger(reminder.frequencyMinutes),
            lastTriggeredAt: null
        });
    }

    deleteReminder(id) {
        const index = this.data.reminders.findIndex(reminder => reminder.id === id);
        if (index === -1) return false;

        this.data.reminders.splice(index, 1);
        this.saveData();
        return true;
    }

    searchReminders(query) {
        const keyword = String(query || '').trim().toLowerCase();
        if (!keyword) return this.getAllReminders();

        return this.data.reminders.filter(reminder => {
            return String(reminder.title || '').toLowerCase().includes(keyword) ||
                String(reminder.message || '').toLowerCase().includes(keyword) ||
                String(reminder.category || '').toLowerCase().includes(keyword);
        });
    }

    triggerReminder(id) {
        const reminder = this.getReminder(id);
        if (!reminder) return null;
        this.showNotification(reminder);
        reminder.lastTriggeredAt = new Date().toISOString();
        reminder.nextTriggerAt = this.calculateNextTrigger(reminder.frequencyMinutes);
        this.saveData();
        return reminder;
    }

    showNotification(reminder) {
        if (!Notification.isSupported()) {
            console.log(`[Reminder] ${reminder.title}: ${reminder.message}`);
            return;
        }

        const notification = new Notification({
            title: reminder.title,
            body: reminder.message,
            silent: false
        });
        notification.show();
    }

    checkDueReminders() {
        const now = Date.now();
        let changed = false;

        for (const reminder of this.data.reminders) {
            if (!reminder.enabled) continue;
            if (!reminder.nextTriggerAt) {
                reminder.nextTriggerAt = this.calculateNextTrigger(reminder.frequencyMinutes);
                changed = true;
                continue;
            }

            if (new Date(reminder.nextTriggerAt).getTime() <= now) {
                this.showNotification(reminder);
                reminder.lastTriggeredAt = new Date().toISOString();
                reminder.nextTriggerAt = this.calculateNextTrigger(reminder.frequencyMinutes);
                changed = true;
            }
        }

        if (changed) {
            this.saveData();
        }
    }

    startScheduler() {
        this.checkDueReminders();
        this.timer = setInterval(() => this.checkDueReminders(), CHECK_INTERVAL_MS);
    }

    setupIPC() {
        ipcMain.handle('reminder-get-all', () => this.getAllReminders());
        ipcMain.handle('reminder-create', (event, reminderData) => this.createReminder(reminderData));
        ipcMain.handle('reminder-update', (event, id, updates) => this.updateReminder(id, updates));
        ipcMain.handle('reminder-delete', (event, id) => this.deleteReminder(id));
        ipcMain.handle('reminder-search', (event, query) => this.searchReminders(query));
        ipcMain.handle('reminder-reset', (event, id) => this.resetReminder(id));
        ipcMain.handle('reminder-trigger-now', (event, id) => this.triggerReminder(id));
    }
}

module.exports = { ReminderManager };

/**
 * Pomodoro Timer
 * Pomodoro timer with statistics and task association
 */

const fs = require('fs');
const path = require('path');

const POMODORO_FILE = 'muelsyse-pomodoro.json';

const defaultSettings = {
    workDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    pomodorosBeforeLongBreak: 4,
    autoStartBreak: true,
    autoStartPomodoro: false,
    soundEnabled: true
};

const defaultStats = {
    today: { pomodoros: 0, focusTime: 0 },
    week: [],
    total: { pomodoros: 0, focusTime: 0 }
};

class PomodoroTimer {
    constructor(appDataPath) {
        this.dataPath = path.join(appDataPath, POMODORO_FILE);
        this.settings = { ...defaultSettings };
        this.stats = this.initStats();
        this.state = {
            status: 'idle',
            timeRemaining: 0,
            currentSession: 0,
            startedAt: null,
            pausedAt: null,
            associatedTask: null
        };
        this.timerInterval = null;
        this.onTick = null;
        this.onComplete = null;
        
        this.loadData();
    }

    initStats() {
        const today = new Date().toISOString().split('T')[0];
        return {
            ...defaultStats,
            todayDate: today,
            week: this.initWeekStats()
        };
    }

    initWeekStats() {
        const week = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            week.push({
                date: date.toISOString().split('T')[0],
                pomodoros: 0,
                focusTime: 0
            });
        }
        return week;
    }

    loadData() {
        try {
            if (fs.existsSync(this.dataPath)) {
                const data = JSON.parse(fs.readFileSync(this.dataPath, 'utf-8'));
                this.settings = { ...defaultSettings, ...(data.settings || {}) };
                this.stats = { ...this.initStats(), ...(data.stats || {}) };
                this.checkAndResetDailyStats();
            }
        } catch (error) {
            console.warn('Failed to load pomodoro data:', error);
        }
    }

    saveData() {
        try {
            fs.writeFileSync(this.dataPath, JSON.stringify({
                settings: this.settings,
                stats: this.stats
            }, null, 2));
            return true;
        } catch (error) {
            console.error('Failed to save pomodoro data:', error);
            return false;
        }
    }

    checkAndResetDailyStats() {
        const today = new Date().toISOString().split('T')[0];
        if (this.stats.todayDate !== today) {
            const weekDates = this.stats.week.map(w => w.date);
            if (!weekDates.includes(this.stats.todayDate)) {
                this.stats.week.push({
                    date: this.stats.todayDate,
                    pomodoros: this.stats.today.pomodoros,
                    focusTime: this.stats.today.focusTime
                });
                if (this.stats.week.length > 7) {
                    this.stats.week.shift();
                }
            }
            
            this.stats.today = { pomodoros: 0, focusTime: 0 };
            this.stats.todayDate = today;
            this.saveData();
        }
    }

    start(taskId = null) {
        if (this.state.status !== 'idle' && this.state.status !== 'paused') {
            return { success: false, error: 'Timer already running' };
        }
        
        this.checkAndResetDailyStats();
        
        if (this.state.status === 'paused') {
            this.state.status = this.state.previousStatus || 'working';
            this.state.pausedAt = null;
        } else {
            this.state.status = 'working';
            this.state.timeRemaining = this.settings.workDuration * 60;
            this.state.startedAt = Date.now();
            this.state.associatedTask = taskId;
        }
        
        this.startTimer();
        return { success: true, state: this.getState() };
    }

    startTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        
        this.timerInterval = setInterval(() => {
            this.tick();
        }, 1000);
    }

    tick() {
        if (this.state.timeRemaining > 0) {
            this.state.timeRemaining--;
            if (this.onTick) {
                this.onTick(this.getState());
            }
        } else {
            this.complete();
        }
    }

    complete() {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
        
        const previousStatus = this.state.status;
        
        if (previousStatus === 'working') {
            this.state.currentSession++;
            this.stats.today.pomodoros++;
            this.stats.today.focusTime += this.settings.workDuration;
            this.stats.total.pomodoros++;
            this.stats.total.focusTime += this.settings.workDuration;
            this.saveData();
            
            if (this.state.currentSession >= this.settings.pomodorosBeforeLongBreak) {
                this.state.status = 'longBreak';
                this.state.timeRemaining = this.settings.longBreakDuration * 60;
                this.state.currentSession = 0;
            } else {
                this.state.status = 'shortBreak';
                this.state.timeRemaining = this.settings.shortBreakDuration * 60;
            }
            
            if (this.onComplete) {
                this.onComplete({
                    type: 'work',
                    pomodoros: this.stats.today.pomodoros,
                    nextStatus: this.state.status
                });
            }
            
            if (this.settings.autoStartBreak) {
                this.startTimer();
            } else {
                this.state.status = 'idle';
            }
        } else if (previousStatus === 'shortBreak' || previousStatus === 'longBreak') {
            if (this.onComplete) {
                this.onComplete({
                    type: 'break',
                    nextStatus: 'working'
                });
            }
            
            if (this.settings.autoStartPomodoro) {
                this.state.status = 'working';
                this.state.timeRemaining = this.settings.workDuration * 60;
                this.startTimer();
            } else {
                this.state.status = 'idle';
            }
        }
    }

    pause() {
        if (this.state.status === 'idle' || this.state.status === 'paused') {
            return { success: false, error: 'Cannot pause' };
        }
        
        clearInterval(this.timerInterval);
        this.timerInterval = null;
        this.state.previousStatus = this.state.status;
        this.state.status = 'paused';
        this.state.pausedAt = Date.now();
        
        return { success: true, state: this.getState() };
    }

    stop() {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
        
        this.state = {
            status: 'idle',
            timeRemaining: 0,
            currentSession: 0,
            startedAt: null,
            pausedAt: null,
            associatedTask: null
        };
        
        return { success: true, state: this.getState() };
    }

    getState() {
        return {
            status: this.state.status,
            timeRemaining: this.state.timeRemaining,
            currentSession: this.state.currentSession,
            totalSessions: this.settings.pomodorosBeforeLongBreak,
            associatedTask: this.state.associatedTask
        };
    }

    getStats() {
        this.checkAndResetDailyStats();
        return {
            today: this.stats.today,
            week: this.stats.week,
            total: this.stats.total
        };
    }

    getSettings() {
        return { ...this.settings };
    }

    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.saveData();
        return { success: true, settings: this.settings };
    }
}

module.exports = { PomodoroTimer };

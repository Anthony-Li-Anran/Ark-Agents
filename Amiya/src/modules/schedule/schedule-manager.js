/**
 * Schedule Manager
 * Handles schedule/todo list data storage and management
 */

const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SCHEDULE_FILE = 'schedule-data.json';

// Simple UUID v4 generator using crypto
function uuidv4() {
    return crypto.randomUUID();
}

// Default schedule data structure
const defaultScheduleData = {
    schedules: [],
    categories: [
        { id: 'default', name: '默认', color: '#667eea' },
        { id: 'work', name: '工作', color: '#f56565' },
        { id: 'personal', name: '个人', color: '#48bb78' },
        { id: 'study', name: '学习', color: '#ed8936' }
    ],
    lastUpdated: new Date().toISOString()
};

class ScheduleManager {
    constructor(appDataPath) {
        this.dataPath = path.join(appDataPath, SCHEDULE_FILE);
        this.data = this.loadData();
        this.setupIPC();
    }

    loadData() {
        try {
            if (fs.existsSync(this.dataPath)) {
                const data = fs.readFileSync(this.dataPath, 'utf-8');
                return { ...defaultScheduleData, ...JSON.parse(data) };
            }
        } catch (error) {
            console.warn('Failed to load schedule data:', error);
        }
        return { ...defaultScheduleData };
    }

    saveData() {
        try {
            this.data.lastUpdated = new Date().toISOString();
            fs.writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2));
            return true;
        } catch (error) {
            console.error('Failed to save schedule data:', error);
            return false;
        }
    }

    // ==================== Schedule CRUD Operations ====================

    getAllSchedules() {
        return this.data.schedules;
    }

    getScheduleById(id) {
        return this.data.schedules.find(schedule => schedule.id === id);
    }

    createSchedule(scheduleData) {
        const newSchedule = {
            id: uuidv4(),
            title: scheduleData.title || '',
            description: scheduleData.description || '',
            status: scheduleData.status || 'pending',
            priority: scheduleData.priority || 'medium',
            categoryId: scheduleData.categoryId || 'default',
            createdAt: new Date().toISOString(),
            dueDate: scheduleData.dueDate || null,
            completedAt: null,
            tags: scheduleData.tags || [],
            reminder: scheduleData.reminder || null
        };

        this.data.schedules.push(newSchedule);
        this.saveData();
        return newSchedule;
    }

    updateSchedule(id, updates) {
        const index = this.data.schedules.findIndex(schedule => schedule.id === id);
        if (index === -1) return null;

        const schedule = this.data.schedules[index];
        
        // If status is being changed to completed, set completedAt
        if (updates.status === 'completed' && schedule.status !== 'completed') {
            updates.completedAt = new Date().toISOString();
        }
        // If status is being changed from completed, clear completedAt
        if (updates.status && updates.status !== 'completed' && schedule.status === 'completed') {
            updates.completedAt = null;
        }

        this.data.schedules[index] = { ...schedule, ...updates };
        this.saveData();
        return this.data.schedules[index];
    }

    deleteSchedule(id) {
        const index = this.data.schedules.findIndex(schedule => schedule.id === id);
        if (index === -1) return false;

        this.data.schedules.splice(index, 1);
        this.saveData();
        return true;
    }

    // ==================== Batch Operations ====================

    deleteCompletedSchedules() {
        const initialCount = this.data.schedules.length;
        this.data.schedules = this.data.schedules.filter(schedule => schedule.status !== 'completed');
        const deletedCount = initialCount - this.data.schedules.length;
        if (deletedCount > 0) {
            this.saveData();
        }
        return deletedCount;
    }

    // ==================== Query Operations ====================

    getSchedulesByStatus(status) {
        return this.data.schedules.filter(schedule => schedule.status === status);
    }

    getSchedulesByCategory(categoryId) {
        return this.data.schedules.filter(schedule => schedule.categoryId === categoryId);
    }

    getSchedulesByPriority(priority) {
        return this.data.schedules.filter(schedule => schedule.priority === priority);
    }

    getOverdueSchedules() {
        const now = new Date().toISOString();
        return this.data.schedules.filter(schedule => 
            schedule.status !== 'completed' && 
            schedule.dueDate && 
            schedule.dueDate < now
        );
    }

    getTodaySchedules() {
        const today = new Date().toISOString().split('T')[0];
        return this.data.schedules.filter(schedule => {
            if (schedule.status === 'completed') return false;
            if (!schedule.dueDate) return false;
            return schedule.dueDate.startsWith(today);
        });
    }

    // ==================== Category Operations ====================

    getAllCategories() {
        return this.data.categories;
    }

    createCategory(categoryData) {
        const newCategory = {
            id: uuidv4(),
            name: categoryData.name || '新分类',
            color: categoryData.color || '#667eea'
        };

        this.data.categories.push(newCategory);
        this.saveData();
        return newCategory;
    }

    updateCategory(id, updates) {
        const index = this.data.categories.findIndex(cat => cat.id === id);
        if (index === -1) return null;

        this.data.categories[index] = { ...this.data.categories[index], ...updates };
        this.saveData();
        return this.data.categories[index];
    }

    deleteCategory(id) {
        // Don't allow deleting default category
        if (id === 'default') return false;

        const index = this.data.categories.findIndex(cat => cat.id === id);
        if (index === -1) return false;

        // Move schedules in this category to default
        this.data.schedules.forEach(schedule => {
            if (schedule.categoryId === id) {
                schedule.categoryId = 'default';
            }
        });

        this.data.categories.splice(index, 1);
        this.saveData();
        return true;
    }

    // ==================== Statistics ====================

    getStatistics() {
        const total = this.data.schedules.length;
        const completed = this.data.schedules.filter(s => s.status === 'completed').length;
        const pending = this.data.schedules.filter(s => s.status === 'pending').length;
        const inProgress = this.data.schedules.filter(s => s.status === 'in_progress').length;
        const overdue = this.getOverdueSchedules().length;

        return {
            total,
            completed,
            pending,
            inProgress,
            overdue,
            completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
        };
    }

    // ==================== IPC Setup ====================

    setupIPC() {
        // Schedule CRUD - 保持与前端兼容的IPC事件名
        ipcMain.handle('schedule-get-all', () => {
            return this.getAllSchedules();
        });

        ipcMain.handle('schedule-get-by-id', (event, id) => {
            return this.getScheduleById(id);
        });

        ipcMain.handle('schedule-create', (event, scheduleData) => {
            return this.createSchedule(scheduleData);
        });

        ipcMain.handle('schedule-update', (event, id, updates) => {
            return this.updateSchedule(id, updates);
        });

        ipcMain.handle('schedule-delete', (event, id) => {
            return this.deleteSchedule(id);
        });

        // Batch operations
        ipcMain.handle('schedule-delete-completed', () => {
            return this.deleteCompletedSchedules();
        });

        // Query operations
        ipcMain.handle('schedule-get-by-status', (event, status) => {
            return this.getSchedulesByStatus(status);
        });

        ipcMain.handle('schedule-get-by-category', (event, categoryId) => {
            return this.getSchedulesByCategory(categoryId);
        });

        ipcMain.handle('schedule-get-by-priority', (event, priority) => {
            return this.getSchedulesByPriority(priority);
        });

        ipcMain.handle('schedule-get-overdue', () => {
            return this.getOverdueSchedules();
        });

        ipcMain.handle('schedule-get-today', () => {
            return this.getTodaySchedules();
        });

        // Category operations
        ipcMain.handle('schedule-get-categories', () => {
            return this.getAllCategories();
        });

        ipcMain.handle('schedule-create-category', (event, categoryData) => {
            return this.createCategory(categoryData);
        });

        ipcMain.handle('schedule-update-category', (event, id, updates) => {
            return this.updateCategory(id, updates);
        });

        ipcMain.handle('schedule-delete-category', (event, id) => {
            return this.deleteCategory(id);
        });

        // Statistics
        ipcMain.handle('schedule-get-statistics', () => {
            return this.getStatistics();
        });
    }
}

module.exports = { ScheduleManager };

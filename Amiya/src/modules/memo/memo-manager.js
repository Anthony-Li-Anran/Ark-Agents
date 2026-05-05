/**
 * Memo Manager
 * Handles memo data storage and management.
 */

const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MEMO_FILE = 'memo-data.json';

const defaultMemoData = {
    memos: [],
    lastUpdated: new Date().toISOString()
};

class MemoManager {
    constructor(appDataPath) {
        this.dataPath = path.join(appDataPath, MEMO_FILE);
        this.data = this.loadData();
        this.setupIPC();
    }

    loadData() {
        try {
            if (fs.existsSync(this.dataPath)) {
                const data = fs.readFileSync(this.dataPath, 'utf-8');
                return { ...defaultMemoData, ...JSON.parse(data) };
            }
        } catch (error) {
            console.warn('Failed to load memo data:', error);
        }
        return { ...defaultMemoData };
    }

    saveData() {
        try {
            fs.mkdirSync(path.dirname(this.dataPath), { recursive: true });
            this.data.lastUpdated = new Date().toISOString();
            fs.writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2));
            return true;
        } catch (error) {
            console.error('Failed to save memo data:', error);
            return false;
        }
    }

    getAllMemos() {
        return [...this.data.memos].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    }

    getMemoById(id) {
        return this.data.memos.find(memo => memo.id === id);
    }

    createMemo(memoData) {
        const now = new Date().toISOString();
        const memo = {
            id: crypto.randomUUID(),
            title: memoData.title || 'Untitled',
            content: memoData.content || '',
            tags: memoData.tags || [],
            createdAt: now,
            updatedAt: now
        };

        this.data.memos.push(memo);
        this.saveData();
        return memo;
    }

    updateMemo(id, updates) {
        const index = this.data.memos.findIndex(memo => memo.id === id);
        if (index === -1) return null;

        this.data.memos[index] = {
            ...this.data.memos[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        this.saveData();
        return this.data.memos[index];
    }

    deleteMemo(id) {
        const index = this.data.memos.findIndex(memo => memo.id === id);
        if (index === -1) return false;

        this.data.memos.splice(index, 1);
        this.saveData();
        return true;
    }

    searchMemos(query) {
        const keyword = String(query || '').trim().toLowerCase();
        if (!keyword) return this.getAllMemos();

        return this.getAllMemos().filter(memo => {
            return memo.title.toLowerCase().includes(keyword) ||
                memo.content.toLowerCase().includes(keyword) ||
                memo.tags.some(tag => tag.toLowerCase().includes(keyword));
        });
    }

    setupIPC() {
        ipcMain.handle('memo-get-all', () => this.getAllMemos());
        ipcMain.handle('memo-get-by-id', (event, id) => this.getMemoById(id));
        ipcMain.handle('memo-create', (event, memoData) => this.createMemo(memoData));
        ipcMain.handle('memo-update', (event, id, updates) => this.updateMemo(id, updates));
        ipcMain.handle('memo-delete', (event, id) => this.deleteMemo(id));
        ipcMain.handle('memo-search', (event, query) => this.searchMemos(query));
    }
}

module.exports = { MemoManager };

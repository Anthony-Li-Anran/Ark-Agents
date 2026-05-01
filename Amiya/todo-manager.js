/**
 * Todo Manager
 * Handles todo list data storage and management
 */

const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TODO_FILE = 'todo-data.json';

// Simple UUID v4 generator using crypto
function uuidv4() {
    return crypto.randomUUID();
}

// Default todo data structure
const defaultTodoData = {
    todos: [],
    categories: [
        { id: 'default', name: '默认', color: '#667eea' },
        { id: 'work', name: '工作', color: '#f56565' },
        { id: 'personal', name: '个人', color: '#48bb78' },
        { id: 'study', name: '学习', color: '#ed8936' }
    ],
    lastUpdated: new Date().toISOString()
};

class TodoManager {
    constructor(appDataPath) {
        this.dataPath = path.join(appDataPath, TODO_FILE);
        this.data = this.loadData();
        this.setupIPC();
    }

    loadData() {
        try {
            if (fs.existsSync(this.dataPath)) {
                const data = fs.readFileSync(this.dataPath, 'utf-8');
                return { ...defaultTodoData, ...JSON.parse(data) };
            }
        } catch (error) {
            console.warn('Failed to load todo data:', error);
        }
        return { ...defaultTodoData };
    }

    saveData() {
        try {
            this.data.lastUpdated = new Date().toISOString();
            fs.writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2));
            return true;
        } catch (error) {
            console.error('Failed to save todo data:', error);
            return false;
        }
    }

    // ==================== Todo CRUD Operations ====================

    getAllTodos() {
        return this.data.todos;
    }

    getTodoById(id) {
        return this.data.todos.find(todo => todo.id === id);
    }

    createTodo(todoData) {
        const newTodo = {
            id: uuidv4(),
            title: todoData.title || '',
            description: todoData.description || '',
            status: todoData.status || 'pending',
            priority: todoData.priority || 'medium',
            categoryId: todoData.categoryId || 'default',
            createdAt: new Date().toISOString(),
            dueDate: todoData.dueDate || null,
            completedAt: null,
            tags: todoData.tags || [],
            reminder: todoData.reminder || null
        };

        this.data.todos.push(newTodo);
        this.saveData();
        return newTodo;
    }

    updateTodo(id, updates) {
        const index = this.data.todos.findIndex(todo => todo.id === id);
        if (index === -1) return null;

        const todo = this.data.todos[index];
        
        // If status is being changed to completed, set completedAt
        if (updates.status === 'completed' && todo.status !== 'completed') {
            updates.completedAt = new Date().toISOString();
        }
        // If status is being changed from completed, clear completedAt
        if (updates.status && updates.status !== 'completed' && todo.status === 'completed') {
            updates.completedAt = null;
        }

        this.data.todos[index] = { ...todo, ...updates };
        this.saveData();
        return this.data.todos[index];
    }

    deleteTodo(id) {
        const index = this.data.todos.findIndex(todo => todo.id === id);
        if (index === -1) return false;

        this.data.todos.splice(index, 1);
        this.saveData();
        return true;
    }

    // ==================== Batch Operations ====================

    deleteCompletedTodos() {
        const initialCount = this.data.todos.length;
        this.data.todos = this.data.todos.filter(todo => todo.status !== 'completed');
        const deletedCount = initialCount - this.data.todos.length;
        if (deletedCount > 0) {
            this.saveData();
        }
        return deletedCount;
    }

    // ==================== Query Operations ====================

    getTodosByStatus(status) {
        return this.data.todos.filter(todo => todo.status === status);
    }

    getTodosByCategory(categoryId) {
        return this.data.todos.filter(todo => todo.categoryId === categoryId);
    }

    getTodosByPriority(priority) {
        return this.data.todos.filter(todo => todo.priority === priority);
    }

    getOverdueTodos() {
        const now = new Date().toISOString();
        return this.data.todos.filter(todo => 
            todo.status !== 'completed' && 
            todo.dueDate && 
            todo.dueDate < now
        );
    }

    getTodayTodos() {
        const today = new Date().toISOString().split('T')[0];
        return this.data.todos.filter(todo => {
            if (todo.status === 'completed') return false;
            if (!todo.dueDate) return false;
            return todo.dueDate.startsWith(today);
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

        // Move todos in this category to default
        this.data.todos.forEach(todo => {
            if (todo.categoryId === id) {
                todo.categoryId = 'default';
            }
        });

        this.data.categories.splice(index, 1);
        this.saveData();
        return true;
    }

    // ==================== Statistics ====================

    getStatistics() {
        const total = this.data.todos.length;
        const completed = this.data.todos.filter(t => t.status === 'completed').length;
        const pending = this.data.todos.filter(t => t.status === 'pending').length;
        const inProgress = this.data.todos.filter(t => t.status === 'in_progress').length;
        const overdue = this.getOverdueTodos().length;

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
        // Todo CRUD
        ipcMain.handle('todo-get-all', () => {
            return this.getAllTodos();
        });

        ipcMain.handle('todo-get-by-id', (event, id) => {
            return this.getTodoById(id);
        });

        ipcMain.handle('todo-create', (event, todoData) => {
            return this.createTodo(todoData);
        });

        ipcMain.handle('todo-update', (event, id, updates) => {
            return this.updateTodo(id, updates);
        });

        ipcMain.handle('todo-delete', (event, id) => {
            return this.deleteTodo(id);
        });

        // Batch operations
        ipcMain.handle('todo-delete-completed', () => {
            return this.deleteCompletedTodos();
        });

        // Query operations
        ipcMain.handle('todo-get-by-status', (event, status) => {
            return this.getTodosByStatus(status);
        });

        ipcMain.handle('todo-get-by-category', (event, categoryId) => {
            return this.getTodosByCategory(categoryId);
        });

        ipcMain.handle('todo-get-by-priority', (event, priority) => {
            return this.getTodosByPriority(priority);
        });

        ipcMain.handle('todo-get-overdue', () => {
            return this.getOverdueTodos();
        });

        ipcMain.handle('todo-get-today', () => {
            return this.getTodayTodos();
        });

        // Category operations
        ipcMain.handle('todo-get-categories', () => {
            return this.getAllCategories();
        });

        ipcMain.handle('todo-create-category', (event, categoryData) => {
            return this.createCategory(categoryData);
        });

        ipcMain.handle('todo-update-category', (event, id, updates) => {
            return this.updateCategory(id, updates);
        });

        ipcMain.handle('todo-delete-category', (event, id) => {
            return this.deleteCategory(id);
        });

        // Statistics
        ipcMain.handle('todo-get-statistics', () => {
            return this.getStatistics();
        });
    }
}

module.exports = { TodoManager };

/**
 * Dialog Content Manager
 * Manages loading, parsing and accessing dialog resources
 */

const fs = require('fs');
const path = require('path');

class DialogContentManager {
    constructor(basePath = path.join(__dirname, '..', '..')) {
        this.basePath = basePath;
        this.dialogResources = new Map();
        this.operatorIdMap = {
            'kalts': 'kaltsit'
        };
        this.operatorPaths = {
            'amiya': path.join(basePath, 'Amiya', 'talk'),
            'kaltsit': path.join(basePath, 'Kaltsit', 'talk'),
            'texas': path.join(basePath, 'Texas', 'talk')
        };
    }

    normalizeOperatorId(operatorId) {
        const id = operatorId.toLowerCase();
        return this.operatorIdMap[id] || id;
    }

    registerOperator(operatorId, talkPath) {
        this.operatorPaths[operatorId.toLowerCase()] = talkPath;
    }

    async loadAllDialogs() {
        const loadPromises = [];
        
        for (const [operatorId, talkPath] of Object.entries(this.operatorPaths)) {
            loadPromises.push(this.loadOperatorDialogs(operatorId, talkPath));
        }
        
        await Promise.all(loadPromises);
        console.log('[DialogContentManager] All dialogs loaded');
    }

    async loadOperatorDialogs(operatorId, talkPath) {
        try {
            if (!fs.existsSync(talkPath)) {
                console.warn(`[DialogContentManager] Talk path not found for ${operatorId}: ${talkPath}`);
                return;
            }

            const files = fs.readdirSync(talkPath);
            const dialogFiles = files.filter(f => f.endsWith('.json') || f.endsWith('_say'));
            
            const normalizedId = this.normalizeOperatorId(operatorId);
            const operatorDialogs = {
                operatorId: normalizedId,
                dialogues: new Map(),
                crossDialogs: new Map()
            };

            for (const file of dialogFiles) {
                const filePath = path.join(talkPath, file);
                try {
                    const content = fs.readFileSync(filePath, 'utf-8');
                    const dialogData = JSON.parse(content);
                    this.parseDialogFile(normalizedId, dialogData, operatorDialogs);
                } catch (error) {
                    console.error(`[DialogContentManager] Failed to load ${filePath}:`, error.message);
                }
            }

            this.dialogResources.set(normalizedId, operatorDialogs);
            console.log(`[DialogContentManager] Loaded dialogs for ${operatorId}`);
        } catch (error) {
            console.error(`[DialogContentManager] Error loading dialogs for ${operatorId}:`, error);
        }
    }

    parseDialogFile(operatorId, dialogData, operatorDialogs) {
        if (!dialogData.dialogues) return;

        for (const [targetOperator, dialogues] of Object.entries(dialogData.dialogues)) {
            const targetId = this.normalizeOperatorId(targetOperator);
            
            if (!operatorDialogs.crossDialogs.has(targetId)) {
                operatorDialogs.crossDialogs.set(targetId, []);
            }

            const crossDialogList = operatorDialogs.crossDialogs.get(targetId);
            
            for (const [dialogId, dialogContent] of Object.entries(dialogues)) {
                const dialogEntry = {
                    id: `${operatorId}_${targetId}_${dialogId}`,
                    speaker: operatorId.toLowerCase(),
                    target: targetId,
                    content: dialogContent,
                    type: 'single'
                };
                
                crossDialogList.push(dialogEntry);
            }
        }
    }

    getDialogPairs(operator1Id, operator2Id) {
        const op1 = this.normalizeOperatorId(operator1Id);
        const op2 = this.normalizeOperatorId(operator2Id);
        
        const dialogs1 = this.dialogResources.get(op1);
        const dialogs2 = this.dialogResources.get(op2);
        
        if (!dialogs1 || !dialogs2) {
            return [];
        }

        const pairs = [];
        
        const op1ToOp2 = dialogs1.crossDialogs.get(op2) || [];
        const op2ToOp1 = dialogs2.crossDialogs.get(op1) || [];
        
        const maxPairs = Math.max(op1ToOp2.length, op2ToOp1.length);
        
        for (let i = 0; i < maxPairs; i++) {
            const dialog1 = op1ToOp2[i];
            const dialog2 = op2ToOp1[i];
            
            if (dialog1 && dialog2) {
                pairs.push({
                    id: `pair_${op1}_${op2}_${i}`,
                    first: dialog1,
                    second: dialog2,
                    triggerProbability: 0.3
                });
            }
        }
        
        return pairs;
    }

    getRandomDialogPair(operator1Id, operator2Id) {
        const pairs = this.getDialogPairs(operator1Id, operator2Id);
        if (pairs.length === 0) return null;
        
        const randomIndex = Math.floor(Math.random() * pairs.length);
        return pairs[randomIndex];
    }

    getAvailableOperators() {
        return Array.from(this.dialogResources.keys());
    }

    hasDialogs(operatorId) {
        const normalizedId = this.normalizeOperatorId(operatorId);
        return this.dialogResources.has(normalizedId);
    }

    getDialogCount(operator1Id, operator2Id) {
        const pairs = this.getDialogPairs(operator1Id, operator2Id);
        return pairs.length;
    }

    reloadOperator(operatorId) {
        const talkPath = this.operatorPaths[operatorId.toLowerCase()];
        if (talkPath) {
            return this.loadOperatorDialogs(operatorId, talkPath);
        }
    }
}

module.exports = { DialogContentManager };

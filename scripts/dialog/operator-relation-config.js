/**
 * Operator Relation Configuration
 * Defines which operators can trigger dialogs with each other
 */

class OperatorRelationConfig {
    constructor() {
        this.relations = new Map();
        this.defaultProbability = 0.3;
        this.cooldownTime = 30000;
        this.initializeDefaultRelations();
    }

    initializeDefaultRelations() {
        this.addRelation('amiya', 'kaltsit', {
            probability: 0.35,
            cooldown: 25000,
            priority: 1
        });

        this.addRelation('amiya', 'texas', {
            probability: 0.30,
            cooldown: 30000,
            priority: 2
        });

        this.addRelation('kaltsit', 'texas', {
            probability: 0.25,
            cooldown: 35000,
            priority: 3
        });
    }

    addRelation(operator1, operator2, config = {}) {
        const op1 = operator1.toLowerCase();
        const op2 = operator2.toLowerCase();
        
        const relationKey = this.getRelationKey(op1, op2);
        
        const relation = {
            operators: [op1, op2],
            probability: config.probability || this.defaultProbability,
            cooldown: config.cooldown || this.cooldownTime,
            priority: config.priority || 999,
            enabled: config.enabled !== false,
            lastTriggerTime: 0,
            triggerCount: 0
        };
        
        this.relations.set(relationKey, relation);
    }

    getRelationKey(op1, op2) {
        const sorted = [op1, op2].sort();
        return `${sorted[0]}_${sorted[1]}`;
    }

    getRelation(operator1, operator2) {
        const key = this.getRelationKey(operator1.toLowerCase(), operator2.toLowerCase());
        return this.relations.get(key);
    }

    canTrigger(operator1, operator2, currentTime = Date.now()) {
        const relation = this.getRelation(operator1, operator2);
        
        if (!relation) {
            return false;
        }

        if (!relation.enabled) {
            return false;
        }

        const timeSinceLastTrigger = currentTime - relation.lastTriggerTime;
        if (timeSinceLastTrigger < relation.cooldown) {
            return false;
        }

        return true;
    }

    shouldTrigger(operator1, operator2, currentTime = Date.now()) {
        if (!this.canTrigger(operator1, operator2, currentTime)) {
            return false;
        }

        const relation = this.getRelation(operator1, operator2);
        return Math.random() < relation.probability;
    }

    markTriggered(operator1, operator2, currentTime = Date.now()) {
        const relation = this.getRelation(operator1, operator2);
        if (relation) {
            relation.lastTriggerTime = currentTime;
            relation.triggerCount++;
        }
    }

    getAvailableRelations() {
        return Array.from(this.relations.values());
    }

    getRelationsForOperator(operatorId) {
        const op = operatorId.toLowerCase();
        const relations = [];
        
        for (const relation of this.relations.values()) {
            if (relation.operators.includes(op)) {
                relations.push(relation);
            }
        }
        
        return relations.sort((a, b) => a.priority - b.priority);
    }

    setProbability(operator1, operator2, probability) {
        const relation = this.getRelation(operator1, operator2);
        if (relation) {
            relation.probability = Math.max(0, Math.min(1, probability));
        }
    }

    setCooldown(operator1, operator2, cooldownMs) {
        const relation = this.getRelation(operator1, operator2);
        if (relation) {
            relation.cooldown = Math.max(0, cooldownMs);
        }
    }

    enableRelation(operator1, operator2) {
        const relation = this.getRelation(operator1, operator2);
        if (relation) {
            relation.enabled = true;
        }
    }

    disableRelation(operator1, operator2) {
        const relation = this.getRelation(operator1, operator2);
        if (relation) {
            relation.enabled = false;
        }
    }

    removeRelation(operator1, operator2) {
        const key = this.getRelationKey(operator1.toLowerCase(), operator2.toLowerCase());
        this.relations.delete(key);
    }

    getStats() {
        const stats = {
            totalRelations: this.relations.size,
            totalTriggers: 0,
            byOperator: {}
        };

        for (const relation of this.relations.values()) {
            stats.totalTriggers += relation.triggerCount;
            
            for (const op of relation.operators) {
                if (!stats.byOperator[op]) {
                    stats.byOperator[op] = {
                        relations: 0,
                        triggers: 0
                    };
                }
                stats.byOperator[op].relations++;
                stats.byOperator[op].triggers += relation.triggerCount;
            }
        }

        return stats;
    }

    reset() {
        for (const relation of this.relations.values()) {
            relation.lastTriggerTime = 0;
            relation.triggerCount = 0;
        }
    }
}

module.exports = { OperatorRelationConfig };

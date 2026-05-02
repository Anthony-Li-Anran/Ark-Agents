/**
 * AI Tools
 * A small allowlist layer for chat-driven local actions.
 */

class AIToolRegistry {
    constructor({ scheduleManager, memoManager, reminderManager }) {
        this.scheduleManager = scheduleManager;
        this.memoManager = memoManager;
        this.reminderManager = reminderManager;
    }

    getToolPrompt() {
        return `

你可以在需要操作本地数据时调用工具。需要调用工具时，只输出一段 JSON，不要输出其他文字。
格式：{"tool":"工具名","args":{...}}

可用工具：
- schedule.list args {}
- schedule.search args {"query":"关键词"}
- schedule.create args {"title":"标题","description":"描述","dueDate":"YYYY-MM-DDTHH:mm 或 null","priority":"low|medium|high","status":"pending|in_progress|completed","tags":["标签"]}
- schedule.update args {"id":"日程ID","updates":{...}}
- schedule.delete args {"id":"日程ID"}
- memo.list args {}
- memo.search args {"query":"关键词"}
- memo.create args {"title":"标题","content":"内容","tags":["标签"]}
- memo.update args {"id":"memo ID","updates":{...}}
- memo.delete args {"id":"memo ID"}
- reminder.list args {}
- reminder.search args {"query":"关键词"}
- reminder.create args {"title":"标题","message":"提醒内容","frequencyMinutes":分钟数,"enabled":true}
- reminder.update args {"id":"提醒ID","updates":{...}}
- reminder.delete args {"id":"提醒ID"}
- reminder.enable args {"id":"提醒ID"}
- reminder.disable args {"id":"提醒ID"}

删除和更新必须提供明确 ID。若用户只给了模糊描述，先用 search/list 查询并请求确认。
如果不需要工具，请正常用阿米娅的口吻回复。
`;
    }

    parseToolCall(text) {
        const raw = String(text || '').trim();
        const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
        const candidate = fenced ? fenced[1].trim() : raw;

        const direct = this.tryParseJSON(candidate);
        if (direct?.tool) return direct;

        const objectMatch = candidate.match(/\{[\s\S]*\}/);
        if (!objectMatch) return null;

        const parsed = this.tryParseJSON(objectMatch[0]);
        return parsed?.tool ? parsed : null;
    }

    tryParseJSON(text) {
        try {
            return JSON.parse(text);
        } catch {
            return null;
        }
    }

    execute(toolCall) {
        if (!toolCall || typeof toolCall.tool !== 'string') {
            throw new Error('Invalid tool call.');
        }

        const args = toolCall.args || {};
        switch (toolCall.tool) {
            case 'schedule.list':
                return this.scheduleManager.getAllTodos();
            case 'schedule.search':
                return this.searchSchedule(args.query);
            case 'schedule.create':
                return this.scheduleManager.createTodo(this.normalizeSchedule(args));
            case 'schedule.update':
                this.requireId(args);
                return this.scheduleManager.updateTodo(args.id, args.updates || {});
            case 'schedule.delete':
                this.requireId(args);
                return this.scheduleManager.deleteTodo(args.id);
            case 'memo.list':
                return this.memoManager.getAllMemos();
            case 'memo.search':
                return this.memoManager.searchMemos(args.query);
            case 'memo.create':
                return this.memoManager.createMemo({
                    title: args.title || 'Untitled',
                    content: args.content || '',
                    tags: Array.isArray(args.tags) ? args.tags : []
                });
            case 'memo.update':
                this.requireId(args);
                return this.memoManager.updateMemo(args.id, args.updates || {});
            case 'memo.delete':
                this.requireId(args);
                return this.memoManager.deleteMemo(args.id);
            case 'reminder.list':
                return this.reminderManager.getAllReminders();
            case 'reminder.search':
                return this.reminderManager.searchReminders(args.query);
            case 'reminder.create':
                return this.reminderManager.createReminder(args);
            case 'reminder.update':
                this.requireId(args);
                return this.reminderManager.updateReminder(args.id, args.updates || {});
            case 'reminder.delete':
                this.requireId(args);
                return this.reminderManager.deleteReminder(args.id);
            case 'reminder.enable':
                this.requireId(args);
                return this.reminderManager.updateReminder(args.id, { enabled: true });
            case 'reminder.disable':
                this.requireId(args);
                return this.reminderManager.updateReminder(args.id, { enabled: false });
            default:
                throw new Error(`Unknown tool: ${toolCall.tool}`);
        }
    }

    searchSchedule(query) {
        const keyword = String(query || '').trim().toLowerCase();
        const items = this.scheduleManager.getAllTodos();
        if (!keyword) return items;

        return items.filter(item => {
            return String(item.title || '').toLowerCase().includes(keyword) ||
                String(item.description || '').toLowerCase().includes(keyword) ||
                (item.tags || []).some(tag => String(tag).toLowerCase().includes(keyword));
        });
    }

    normalizeSchedule(args) {
        return {
            title: args.title || 'Untitled',
            description: args.description || '',
            status: args.status || 'pending',
            priority: args.priority || 'medium',
            categoryId: args.categoryId || 'default',
            dueDate: args.dueDate || null,
            tags: Array.isArray(args.tags) ? args.tags : []
        };
    }

    requireId(args) {
        if (!args.id) {
            throw new Error('This tool requires an id.');
        }
    }
}

module.exports = { AIToolRegistry };

/**
 * AI Tools
 * A small allowlist layer for chat-driven local actions.
 */

const { ProjectSkillPool } = require('../project/project-skill-pool');

const PROJECT_SKILL_TOOL_PROMPT = `

\u3010\u9879\u76ee skills \u6c60\u3011
\u8fd9\u4e9b\u5de5\u5177\u53ea\u8bfb\uff0c\u7528\u4e8e\u5206\u6790\u9879\u76ee\u5e76\u9009\u62e9\u9002\u5408\u5f53\u524d\u9636\u6bb5\u7684 skills\u3002\u5f53\u7528\u6237\u660e\u786e\u8bf4\u201c\u5206\u6790\u9879\u76ee\u201d\u3001\u201c\u63a8\u8350 skills\u201d\u3001\u201c\u9009\u62e9\u80fd\u529b\u201d\u6216\u201c\u7ef4\u62a4 skills \u6c60\u201d\u65f6\u53ef\u4ee5\u8c03\u7528\u3002
- project.skills.list args {"projectType":"electron-desktop|frontend-app|node-app|game|unknown","stage":"discovery|setup|implementation|testing|release|maintenance|incident","category":"analysis|execution|verification|safety|orchestration|release|debugging"}
- project.analyze args {"name":"\u9879\u76ee\u540d","projectType":"\u53ef\u9009","stage":"\u53ef\u9009","progress":0-100,"signals":["\u4fe1\u53f7"],"blockers":["\u963b\u585e"]}
- project.skills.recommend args {"projectType":"\u53ef\u9009","stage":"\u53ef\u9009","progress":0-100,"signals":["\u4fe1\u53f7"],"blockers":["\u963b\u585e"],"limit":6}
`;

class AIToolRegistry {
    constructor({ scheduleManager, memoManager, reminderManager, projectSkillPool }) {
        this.scheduleManager = scheduleManager;
        this.memoManager = memoManager;
        this.reminderManager = reminderManager;
        this.projectSkillPool = projectSkillPool || new ProjectSkillPool();
    }

    getToolPrompt() {
        return PROJECT_SKILL_TOOL_PROMPT + `

你可以通过调用本地工具来操作数据。格式：{"tool":"工具名","args":{...}}

【重要】只有当用户明确要求操作数据时才能调用工具，绝不能自动记录或创建数据。

【绝对禁止】（以下情况绝对不能调用任何工具）：
- 绝对不能自动把对话内容保存到备忘录
- 绝对不能在用户没有明确要求的情况下创建任何备忘录、日程或提醒
- 绝对不能因为"觉得内容重要"就自动记录
- 绝对不能主动建议用户"要我帮您记下来吗"（除非用户明确询问）
- 当不确定用户意图时，禁止调用任何工具
- 用户只是在聊天、倾诉或分享日常时，不能自动记录

【正确的触发方式】（只有满足以下条件才调用工具）：
用户必须明确说出以下关键词之一：
1. "记一下" / "记录下来" / "保存到备忘录" / "新建备忘录" → 使用 memo
2. "添加日程" / "添加待办" / "提醒我[具体时间]" → 使用 schedule
3. "每隔XX分钟/小时提醒我" / "设置提醒" / "每小时提醒" → 使用 reminder

【工具选择精确规则】：

1. Schedule（日程/待办）- 只有用户明确要求"添加日程"、"添加待办"、"提醒我[具体日期时间]"时使用
   - ✓ 正确："帮我添加一个待办：明天开会"
   - ✓ 正确："记一下周五要交报告"
   - ✗ 错误：用户只是提到某个日期但没有要求添加日程
   - 工具：
   - schedule.list args {}
   - schedule.search args {"query":"关键词"}
   - schedule.create args {"title":"标题","description":"描述","dueDate":"YYYY-MM-DDTHH:mm:ss.sssZ 或 null","priority":"low|medium|high","status":"pending|in_progress|completed","tags":["标签"]}
   - schedule.update args {"id":"日程ID","updates":{...}}
   - schedule.delete args {"id":"日程ID"}

2. Reminder（周期性提醒）- 只有用户明确要求"每隔XX分钟/小时提醒我"时使用
   - ✓ 正确："每小时提醒我喝水"
   - ✓ 正确："每30分钟提醒我休息眼睛"
   - ✗ 错误：用户只是提到健康相关的话题
   - 工具：
   - reminder.list args {}
   - reminder.search args {"query":"关键词"}
   - reminder.create args {"title":"标题","message":"提醒内容","frequencyMinutes":分钟数,"enabled":true}
   - reminder.update args {"id":"提醒ID","updates":{...}}
   - reminder.delete args {"id":"提醒ID"}
   - reminder.enable args {"id":"提醒ID"}
   - reminder.disable args {"id":"提醒ID"}

3. Memo（备忘录）- 只有用户明确要求"记一下"、"保存到备忘录"时使用
   - ✓ 正确："记一下我的想法：......"
   - ✓ 正确："帮我保存这段话：......"
   - ✓ 正确："新建一个备忘录，标题是XXX，内容是XXX"
   - ✗ 错误：用户只是在聊天、分享日常、倾诉
   - ✗ 错误：用户说"我今天..."（只是分享日常）
   - 工具：
   - memo.list args {}
   - memo.search args {"query":"关键词"}
   - memo.create args {"title":"标题","content":"内容","tags":["标签"]}
   - memo.update args {"id":"memo ID","updates":{...}}
   - memo.delete args {"id":"memo ID"}

【操作限制】：
- 查询（list/search）无需确认，可以直接执行
- 创建（create）必须用户明确要求，不能自动创建
- 修改（update）和删除（delete）必须先获取ID，若用户只给了模糊描述（如"删除那个日程"），必须先用 search/list 查询，然后将结果展示给用户，请求用户确认具体要操作哪个

【回复原则】：
- 如果用户没有明确要求操作数据，请正常用阿米娅的口吻聊天
- 绝对不要主动建议"要我帮您记下来吗"这类话
- 只有当用户明确说"记一下..."、"添加日程..."、"设置提醒..."时才调用工具
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
                return this.scheduleManager.getAllSchedules();
            case 'schedule.search':
                return this.searchSchedule(args.query);
            case 'schedule.create':
                return this.scheduleManager.createSchedule(this.normalizeSchedule(args));
            case 'schedule.update':
                this.requireId(args);
                return this.scheduleManager.updateSchedule(args.id, args.updates || {});
            case 'schedule.delete':
                this.requireId(args);
                return this.scheduleManager.deleteSchedule(args.id);
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
            case 'project.skills.list':
                return this.projectSkillPool.listSkills(args);
            case 'project.analyze':
                return this.projectSkillPool.analyzeProject(args);
            case 'project.skills.recommend':
                return this.projectSkillPool.recommendSkills(args, { limit: args.limit });
            default:
                throw new Error(`Unknown tool: ${toolCall.tool}`);
        }
    }

    searchSchedule(query) {
        const keyword = String(query || '').trim().toLowerCase();
        const items = this.scheduleManager.getAllSchedules();
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

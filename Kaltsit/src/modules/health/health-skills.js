/**
 * Kaltsit Health Skills
 *
 * Capability catalog for the local-first health agent. The labels are stored
 * with unicode escapes so the file stays friendly to Windows shell encodings
 * while still rendering Chinese text at runtime.
 */

const HEALTH_SKILLS = [
    {
        id: 'sleep-supervision',
        category: 'routine',
        name: '\u7761\u7720\u76d1\u7763',
        description: '\u5728\u8bbe\u5b9a\u7761\u7720\u65f6\u6bb5\u5185\u63d0\u9192\u7528\u6237\u505c\u6b62\u5de5\u4f5c\u5e76\u4f11\u606f\u3002',
        settingPath: ['sleep', 'enabled']
    },
    {
        id: 'hydration-reminder',
        category: 'routine',
        name: '\u996e\u6c34\u63d0\u9192',
        description: '\u6309\u95f4\u9694\u63d0\u9192\u7528\u6237\u8865\u6c34\uff0c\u5e76\u8bb0\u5f55\u54cd\u5e94\u884c\u4e3a\u3002',
        settingPath: ['hydration', 'enabled']
    },
    {
        id: 'movement-break',
        category: 'routine',
        name: '\u4e45\u5750\u6d3b\u52a8',
        description: '\u63d0\u9192\u7528\u6237\u8d77\u8eab\u3001\u6d3b\u52a8\u80a9\u9888\u5e76\u77ed\u65f6\u6b65\u884c\u3002',
        settingPath: ['movement', 'enabled']
    },
    {
        id: 'daily-exercise',
        category: 'routine',
        name: '\u65e5\u5e38\u953b\u70bc',
        description: '\u5728\u6bcf\u65e5\u8bbe\u5b9a\u65f6\u95f4\u540e\u63d0\u9192\u5b8c\u6210\u4f4e\u95e8\u69db\u8fd0\u52a8\u3002',
        settingPath: ['dailyExercise', 'enabled']
    },
    {
        id: 'mental-health-check',
        category: 'signal',
        name: '\u5fc3\u7406\u72b6\u6001\u5de1\u68c0',
        description: '\u4ece\u5e94\u7528\u5185\u804a\u5929\u3001\u90ae\u4ef6\u6216\u624b\u52a8\u5bfc\u5165\u6d88\u606f\u4e2d\u8bc6\u522b\u538b\u529b\u3001\u7126\u8651\u3001\u5931\u7720\u548c\u5d29\u6e83\u4fe1\u53f7\u3002',
        settingPath: ['mentalHealth', 'enabled']
    },
    {
        id: 'crisis-support',
        category: 'signal',
        name: '\u5371\u673a\u652f\u6301',
        description: '\u5bf9\u81ea\u4f24\u6216\u7acb\u5373\u98ce\u9669\u4fe1\u53f7\u7acb\u5373\u54cd\u5e94\uff0c\u63d0\u9192\u8054\u7cfb\u73b0\u5b9e\u4e2d\u7684\u53ef\u4fe1\u4efb\u4eba\u5458\u548c\u7d27\u6025\u652f\u6301\u3002',
        settingPath: ['mentalHealth', 'enabled']
    },
    {
        id: 'source-review',
        category: 'source',
        name: '\u6765\u6e90\u5de1\u68c0',
        description: '\u68c0\u67e5 Gmail\u3001Outlook\u3001\u5e94\u7528\u5185\u804a\u5929\u3001\u5fae\u4fe1\u3001QQ \u548c Telegram \u7684\u63a5\u5165\u72b6\u6001\u3002',
        settingPath: null
    },
    {
        id: 'privacy-guard',
        category: 'safety',
        name: '\u9690\u79c1\u5b88\u536b',
        description: '\u9ed8\u8ba4\u4e0d\u4fdd\u5b58\u539f\u6587\uff0c\u53ea\u4fdd\u7559\u98ce\u9669\u7ea7\u522b\u3001\u4fe1\u53f7\u6458\u8981\u548c\u5fc5\u8981\u7684\u56de\u5e94\u8bb0\u5f55\u3002',
        settingPath: null
    }
];

function getPathValue(root, pathParts) {
    if (!pathParts) return true;
    return pathParts.reduce((current, key) => current && current[key], root);
}

function buildHealthSkills(settings = {}) {
    return HEALTH_SKILLS.map((skill) => ({
        ...skill,
        enabled: Boolean(getPathValue(settings, skill.settingPath)),
        status: getPathValue(settings, skill.settingPath) === false ? 'disabled' : 'ready'
    }));
}

module.exports = {
    HEALTH_SKILLS,
    buildHealthSkills
};

/**
 * Kaltsit Medical Tools Module
 * Provides medical keyword recognition, network status detection,
 * medical information search, and disclaimer management
 */

const MEDICAL_KEYWORDS = {
    symptoms: [
        '头痛', '头疼', '发烧', '发热', '咳嗽', '腹痛', '肚子疼', '恶心', '呕吐',
        '腹泻', '拉肚子', '失眠', '睡不着', '乏力', '疲劳', '头晕', '眩晕',
        '胸闷', '气短', '呼吸困难', '心悸', '心慌', '便秘', '腹胀', '胃痛',
        '胃酸', '反酸', '烧心', '鼻塞', '流鼻涕', '打喷嚏', '喉咙痛', '嗓子疼',
        '牙痛', '牙疼', '口腔溃疡', '皮疹', '瘙痒', '过敏', '水肿', '浮肿',
        '关节痛', '肌肉痛', '背痛', '腰痛', '颈痛', '肩痛', '麻木', '刺痛',
        '出血', '淤血', '贫血', '黄疸', '消瘦', '体重下降', '食欲不振',
        '多饮', '多尿', '多食', '少尿', '尿频', '尿急', '尿痛', '血尿'
    ],
    diseases: [
        '感冒', '流感', '新冠', '新冠肺炎', 'COVID', '糖尿病', '高血压', '低血压',
        '心脏病', '冠心病', '心肌梗死', '心梗', '心律失常', '心力衰竭', '心衰',
        '癌症', '肿瘤', '恶性肿瘤', '良性肿瘤', '肺癌', '肝癌', '胃癌', '肠癌',
        '乳腺癌', '前列腺癌', '白血病', '淋巴瘤', '肺炎', '支气管炎', '哮喘',
        '胃炎', '胃溃疡', '十二指肠溃疡', '肠炎', '结肠炎', '克罗恩病',
        '肝炎', '脂肪肝', '肝硬化', '胆囊炎', '胆结石', '肾结石', '肾炎',
        '尿路感染', '前列腺炎', '前列腺增生', '甲状腺', '甲亢', '甲减',
        '痛风', '风湿', '类风湿', '关节炎', '骨质疏松', '腰椎间盘突出',
        '颈椎病', '肩周炎', '抑郁症', '焦虑症', '失眠症', '精神分裂',
        '帕金森', '阿尔茨海默', '老年痴呆', '癫痫', '脑卒中', '中风',
        '脑梗', '脑出血', '偏头痛', '神经痛', '带状疱疹', '湿疹', '银屑病',
        '白癜风', '痤疮', '青春痘', '荨麻疹', '皮炎', '艾滋病', 'HIV',
        '梅毒', '淋病', '尖锐湿疣', '生殖器疱疹', '结核病', '肺结核'
    ],
    medications: [
        '阿司匹林', '布洛芬', '对乙酰氨基酚', '扑热息痛', '泰诺', '芬必得',
        '抗生素', '青霉素', '阿莫西林', '头孢', '红霉素', '阿奇霉素',
        '降压药', '硝苯地平', '氨氯地平', '卡托普利', '缬沙坦', '氯沙坦',
        '胰岛素', '二甲双胍', '格列美脲', '格列齐特', '拜糖平',
        '他汀', '阿托伐他汀', '辛伐他汀', '瑞舒伐他汀',
        '胃药', '奥美拉唑', '兰索拉唑', '雷贝拉唑', '法莫替丁',
        '抗过敏药', '氯雷他定', '西替利嗪', '扑尔敏', '苯海拉明',
        '止咳药', '化痰药', '氨溴索', '溴己新', '右美沙芬',
        '镇静剂', '安眠药', '安定', '阿普唑仑', '佐匹克隆',
        '抗抑郁药', '舍曲林', '氟西汀', '帕罗西汀', '文拉法辛',
        '激素', '泼尼松', '地塞米松', '甲泼尼龙', '氢化可的松',
        '维生素', '维C', '维生素C', '维生素B', '维生素D', '钙片',
        '中成药', '中药', '板蓝根', '连花清瘟', '感冒灵', '藿香正气'
    ],
    medicalActions: [
        '治疗', '诊断', '手术', '检查', '用药', '副作用', '不良反应',
        '症状', '体征', '化验', '体检', '影像', 'CT', 'MRI', 'X光',
        'B超', '超声', '心电图', '血常规', '尿常规', '肝功能', '肾功能',
        '血糖', '血脂', '血压', '心率', '体温', '脉搏', '呼吸',
        '住院', '出院', '门诊', '急诊', '挂号', '复诊', '随访',
        '处方', '医嘱', '禁忌', '注意事项', '剂量', '用法', '用量',
        '疗程', '康复', '预后', '复发', '转移', '扩散', '缓解',
        '治愈', '根治', '保守治疗', '手术治疗', '化疗', '放疗',
        '靶向治疗', '免疫治疗', '介入治疗', '物理治疗', '康复训练',
        '疫苗', '接种', '免疫', '预防', '保健', '养生', '调理'
    ]
};

const MEDICAL_DISCLAIMER = `
---
**免责声明**：以上信息仅供参考，不构成医疗建议、诊断或治疗方案。如有健康问题，请及时就医并遵循专业医生的指导。本助手无法替代专业医疗诊断和治疗。
`;

const SEARCH_TIMEOUT_MS = 30000;

const MEDICAL_SOURCES = [
    '丁香医生',
    '春雨医生',
    '好大夫在线',
    '有来医生',
    '快速问医生',
    '百度百科医典',
    '妙手医生'
];

class MedicalTools {
    constructor() {
        this.networkAvailable = null;
        this.lastNetworkCheck = null;
        this.networkCheckInterval = 60000;
    }

    isMedicalQuestion(text) {
        if (!text || typeof text !== 'string') {
            return false;
        }

        const normalizedText = text.toLowerCase();
        
        for (const category of Object.keys(MEDICAL_KEYWORDS)) {
            for (const keyword of MEDICAL_KEYWORDS[category]) {
                if (normalizedText.includes(keyword.toLowerCase())) {
                    return true;
                }
            }
        }

        const medicalPatterns = [
            /怎么.*治疗/,
            /如何.*治疗/,
            /吃什么.*药/,
            /用什么.*药/,
            /有什么.*症状/,
            /症状.*是什么/,
            /怎么.*预防/,
            /如何.*预防/,
            /得.*病/,
            /患.*病/,
            /生.*病/,
            /身体.*不.*适/,
            /感觉.*不.*舒服/,
            /不舒服/,
            /去医院/,
            /看医生/,
            /挂号/,
            /体检/,
            /检查.*身体/
        ];

        for (const pattern of medicalPatterns) {
            if (pattern.test(normalizedText)) {
                return true;
            }
        }

        return false;
    }

    getMatchedKeywords(text) {
        if (!text || typeof text !== 'string') {
            return {};
        }

        const matched = {
            symptoms: [],
            diseases: [],
            medications: [],
            medicalActions: []
        };

        const normalizedText = text.toLowerCase();

        for (const category of Object.keys(MEDICAL_KEYWORDS)) {
            for (const keyword of MEDICAL_KEYWORDS[category]) {
                if (normalizedText.includes(keyword.toLowerCase())) {
                    matched[category].push(keyword);
                }
            }
        }

        return matched;
    }

    async checkNetworkStatus() {
        const now = Date.now();
        
        if (this.networkAvailable !== null && 
            this.lastNetworkCheck && 
            (now - this.lastNetworkCheck) < this.networkCheckInterval) {
            return {
                available: this.networkAvailable,
                cached: true,
                timestamp: this.lastNetworkCheck
            };
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch('https://www.baidu.com', {
                method: 'HEAD',
                mode: 'no-cors',
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            
            this.networkAvailable = true;
            this.lastNetworkCheck = now;

            return {
                available: true,
                cached: false,
                timestamp: now
            };
        } catch (error) {
            this.networkAvailable = false;
            this.lastNetworkCheck = now;

            return {
                available: false,
                cached: false,
                timestamp: now,
                error: error.message
            };
        }
    }

    async searchMedicalInfo(query, options = {}) {
        const {
            timeout = SEARCH_TIMEOUT_MS,
            sources = MEDICAL_SOURCES,
            maxResults = 5
        } = options;

        const networkStatus = await this.checkNetworkStatus();
        
        if (!networkStatus.available) {
            return {
                success: false,
                error: '网络不可用，无法进行医疗信息搜索',
                results: [],
                networkStatus
            };
        }

        if (!query || typeof query !== 'string') {
            return {
                success: false,
                error: '查询内容不能为空',
                results: [],
                networkStatus
            };
        }

        const enhancedQuery = this._enhanceMedicalQuery(query);

        try {
            const searchPromise = this._performSearch(enhancedQuery, maxResults);
            
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('搜索超时')), timeout);
            });

            const results = await Promise.race([searchPromise, timeoutPromise]);

            return {
                success: true,
                query: enhancedQuery,
                originalQuery: query,
                results,
                sources,
                networkStatus,
                timestamp: Date.now()
            };
        } catch (error) {
            const isTimeout = error.message === '搜索超时';
            
            return {
                success: false,
                error: isTimeout ? `搜索超时（${timeout / 1000}秒）` : error.message,
                results: [],
                query: enhancedQuery,
                originalQuery: query,
                networkStatus,
                timestamp: Date.now()
            };
        }
    }

    _enhanceMedicalQuery(query) {
        const keywords = this.getMatchedKeywords(query);
        const enhancements = [];

        if (keywords.diseases.length > 0) {
            enhancements.push('疾病');
        }
        if (keywords.symptoms.length > 0) {
            enhancements.push('症状');
        }
        if (keywords.medications.length > 0) {
            enhancements.push('用药');
        }

        if (enhancements.length > 0 && !query.includes('医疗') && !query.includes('健康')) {
            return `${query} 医疗健康`;
        }

        return query;
    }

    async _performSearch(query, maxResults) {
        const results = [];
        
        try {
            const wikiUrl = `https://zh.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query + ' 医学')}&format=json&origin=*&srlimit=${maxResults}`;
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            const response = await fetch(wikiUrl, {
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json();
                
                if (data.query && data.query.search && Array.isArray(data.query.search)) {
                    for (const item of data.query.search) {
                        if (item.snippet) {
                            results.push({
                                title: item.title,
                                snippet: item.snippet.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"'),
                                source: '维基百科',
                                type: 'wiki'
                            });
                        }
                    }
                }
            }
        } catch (error) {
            console.error('[MedicalTools] Wiki search failed:', error.message);
        }
        
        if (results.length === 0) {
            results.push({
                title: '参考提示',
                snippet: `请根据您的医学知识回答关于"${query}"的问题。`,
                source: '系统',
                type: 'fallback'
            });
        }
        
        return results;
    }

    _getSourceName(url) {
        if (!url) return '网络搜索';
        if (url.includes('dxy.com')) return '丁香医生';
        if (url.includes('chunyuyisheng.com')) return '春雨医生';
        if (url.includes('haodf.com')) return '好大夫在线';
        if (url.includes('youlai.cn')) return '有来医生';
        if (url.includes('120ask.com')) return '快速问医生';
        if (url.includes('baike.baidu.com')) return '百度百科';
        if (url.includes('wikipedia.org')) return '维基百科';
        return '网络搜索';
    }

    addDisclaimer(response, options = {}) {
        const {
            customDisclaimer = null,
            position = 'end'
        } = options;

        const disclaimer = customDisclaimer || MEDICAL_DISCLAIMER;

        if (!response || typeof response !== 'string') {
            return disclaimer;
        }

        if (response.includes('免责声明')) {
            return response;
        }

        if (position === 'start') {
            return `${disclaimer}\n\n${response}`;
        }

        return `${response}${disclaimer}`;
    }

    formatMedicalResponse(query, searchResults, options = {}) {
        const { includeDisclaimer = true } = options;

        let response = '';

        if (searchResults.success && searchResults.results.length > 0) {
            response = `关于"${query}"的医疗信息：\n\n`;
            
            searchResults.results.forEach((result, index) => {
                response += `${index + 1}. ${result.title || '相关信息'}\n`;
                if (result.snippet) {
                    response += `   ${result.snippet}\n`;
                }
                if (result.source) {
                    response += `   来源：${result.source}\n`;
                }
                response += '\n';
            });
        } else if (searchResults.success) {
            response = `抱歉，未找到关于"${query}"的相关医疗信息。\n\n建议您：\n`;
            response += '1. 咨询专业医生获取准确诊断\n';
            response += '2. 访问权威医疗网站查询\n';
            response += '3. 如有紧急情况，请立即就医\n';
        } else {
            response = `搜索医疗信息时遇到问题：${searchResults.error}\n\n`;
            response += '建议您直接咨询专业医生或访问权威医疗网站获取准确信息。';
        }

        if (includeDisclaimer) {
            response = this.addDisclaimer(response);
        }

        return response;
    }

    getMedicalCategories() {
        return Object.keys(MEDICAL_KEYWORDS);
    }

    getKeywordsByCategory(category) {
        return MEDICAL_KEYWORDS[category] || [];
    }

    getAllKeywords() {
        const allKeywords = [];
        for (const category of Object.keys(MEDICAL_KEYWORDS)) {
            allKeywords.push(...MEDICAL_KEYWORDS[category]);
        }
        return [...new Set(allKeywords)];
    }

    getMedicalSources() {
        return [...MEDICAL_SOURCES];
    }

    getDisclaimer() {
        return MEDICAL_DISCLAIMER;
    }
}

module.exports = {
    MedicalTools,
    MEDICAL_KEYWORDS,
    MEDICAL_DISCLAIMER,
    MEDICAL_SOURCES,
    SEARCH_TIMEOUT_MS
};

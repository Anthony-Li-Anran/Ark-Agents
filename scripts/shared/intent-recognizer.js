/**
 * Intent Recognition Module
 * Provides intent detection for routing user messages to appropriate agents
 */

const MEDICAL_KEYWORDS = [
    '头痛', '头疼', '发烧', '发热', '咳嗽', '腹痛', '肚子疼', '恶心', '呕吐',
    '腹泻', '拉肚子', '失眠', '睡不着', '乏力', '疲劳', '头晕', '眩晕',
    '胸闷', '气短', '呼吸困难', '心悸', '心慌', '便秘', '胃痛', '胃酸',
    '鼻塞', '流鼻涕', '打喷嚏', '喉咙痛', '嗓子疼', '牙痛', '牙疼',
    '皮疹', '瘙痒', '过敏', '水肿', '关节痛', '肌肉痛', '背痛', '腰痛',
    '感冒', '流感', '新冠', '糖尿病', '高血压', '低血压', '心脏病',
    '癌症', '肿瘤', '肺炎', '支气管炎', '哮喘', '胃炎', '胃溃疡',
    '肝炎', '脂肪肝', '肝硬化', '肾结石', '肾炎', '甲状腺', '甲亢', '甲减',
    '痛风', '风湿', '关节炎', '骨质疏松', '颈椎病', '抑郁症', '焦虑症',
    '治疗', '诊断', '手术', '检查', '用药', '副作用', '症状', '化验',
    '体检', 'CT', 'MRI', 'B超', '心电图', '血常规', '血糖', '血压',
    '住院', '出院', '门诊', '急诊', '挂号', '处方', '医嘱', '剂量',
    '康复', '预后', '复发', '治愈', '化疗', '放疗', '疫苗', '接种',
    '阿司匹林', '布洛芬', '对乙酰氨基酚', '抗生素', '青霉素', '阿莫西林',
    '降压药', '胰岛素', '二甲双胍', '维生素', '中药', '感冒药', '止痛药',
    '医生', '医院', '护士', '药品', '药物', '病症', '患者', '病人',
    '健康', '生病', '不舒服', '疼痛', '难受', '治愈', '疗效'
];

const FILE_KEYWORDS = [
    '整理文件', '整理桌面', '文件整理', '桌面整理', '清理桌面',
    '文件分类', '分类文件', '整理一下', '收拾桌面', '收拾文件',
    '文件乱', '桌面乱', '文件太多', '桌面太乱',
    '帮我整理', '帮我分类', '帮我收拾',
    '文档整理', '图片整理', '下载整理',
    '文件管理', '文件归档', '归档文件',
    '移动文件', '复制文件', '备份文件',
    '桌面文件', '文件夹整理', '目录整理'
];

const LEARNING_KEYWORDS = [
    '学习', '复习', '考试', '笔记', '知识点', '摘要', '总结',
    '背诵', '记忆', '理解', '讲解', '解释', '题目', '答题',
    '作业', '练习', '测试', '测验', '考试复习', '考前复习',
    '重点', '难点', '考点', '知识', '概念', '定义', '原理',
    '公式', '定理', '定律', '理论', '学说', '观点',
    '文档分析', '文档总结', '文档理解', '阅读理解',
    '学习计划', '学习方法', '学习技巧', '学习效率',
    '番茄钟', '番茄工作法', '专注', '集中注意力',
    '闪卡', '记忆卡片', '知识点卡片', '问答卡片',
    '错题', '错题本', '错题整理', '错题分析',
    '思维导图', '知识图谱', '知识结构',
    '预习', '复习', '巩固', '提高', '进步',
    '课程', '教材', '课本', '教科书', '讲义',
    '论文', '研究报告', '文献', '参考资料',
    '学习助手', '帮我学习', '辅导', '答疑'
];

class IntentRecognizer {
    constructor() {
        this.medicalKeywords = MEDICAL_KEYWORDS;
        this.fileKeywords = FILE_KEYWORDS;
        this.learningKeywords = LEARNING_KEYWORDS;
    }
    
    recognize(text) {
        const lowerText = text.toLowerCase();
        
        const medicalScore = this._calculateScore(lowerText, this.medicalKeywords);
        const fileScore = this._calculateScore(lowerText, this.fileKeywords);
        const learningScore = this._calculateScore(lowerText, this.learningKeywords);
        
        const maxScore = Math.max(medicalScore, fileScore, learningScore);
        
        if (medicalScore > 0 && medicalScore === maxScore) {
            return {
                intent: 'medical',
                confidence: medicalScore,
                suggestion: '您可以问问凯尔希医生，她是罗德岛的医疗专家。'
            };
        }
        
        if (fileScore > 0 && fileScore === maxScore) {
            return {
                intent: 'file_management',
                confidence: fileScore,
                suggestion: '德克萨斯可以帮您整理桌面文件，您可以把文件拖拽到她身上。'
            };
        }
        
        return {
            intent: 'general',
            confidence: 0,
            suggestion: null
        };
    }
    
    isMedicalIntent(text) {
        const result = this.recognize(text);
        return result.intent === 'medical';
    }
    
    isFileIntent(text) {
        const result = this.recognize(text);
        return result.intent === 'file_management';
    }
    
    isLearningIntent(text) {
        const result = this.recognize(text);
        return result.intent === 'learning';
    }
    
    _calculateScore(text, keywords) {
        let score = 0;
        for (const keyword of keywords) {
            if (text.includes(keyword.toLowerCase())) {
                score += keyword.length;
            }
        }
        return score;
    }
}

module.exports = { IntentRecognizer, MEDICAL_KEYWORDS, FILE_KEYWORDS, LEARNING_KEYWORDS };

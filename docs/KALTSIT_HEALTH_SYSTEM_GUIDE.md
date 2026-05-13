# 凯尔希健康系统接入指南

## 系统概览

凯尔希健康系统是 Ark Agents 中由 Kal'tsit 负责的本地健康监督能力。它会在应用内观察用户主动发送的聊天内容，并结合手动导入的邮件或聊天记录，识别睡眠不足、压力过高、焦虑、崩溃、自伤风险等健康信号。

系统目标不是替代医生、心理咨询师或紧急服务，而是在桌面交互中及时提醒用户休息、喝水、活动身体、睡觉，并在高风险表达出现时提示用户联系现实中的可信任人员或紧急支持。

## 快速开始

### 1. 启动应用

```powershell
cd E:\working\arkagents\Ark-Agents
npm start
```

启动后默认会先显示阿米娅。右键阿米娅，打开 `Operators`，勾选 `Kal'tsit`。

### 2. 打开凯尔希健康菜单

对凯尔希模型本体右键，可以看到：

- `健康检查`：立即执行一次睡眠、饮水、活动、运动提醒检查。
- `健康来源`：查看应用内聊天、Gmail、Outlook、微信、QQ、Telegram 的接入状态。
- `健康技能`：查看当前启用的健康能力。

### 3. 应用内聊天自动接入

当用户在 Ark Agents 内和 AI 聊天时，消息会被送入凯尔希健康系统进行本地分析。

默认行为：

- 会分析文本中的健康风险信号。
- 会记录风险等级、信号摘要、来源和时间。
- 默认不保存原始文本。
- 如果发现中高风险或危机信号，凯尔希会用桌面气泡回应。

## 当前支持的健康技能

| 技能 | 作用 |
| --- | --- |
| 睡眠监督 | 在设定睡眠时段提醒用户停止工作并准备睡觉 |
| 饮水提醒 | 按间隔提醒用户喝水 |
| 久坐活动 | 提醒用户起身、活动肩颈和短时步行 |
| 日常锻炼 | 在每日设定时间后提醒用户完成低门槛运动 |
| 心理状态巡检 | 从聊天、邮件或手动导入内容中识别压力、焦虑、失眠和崩溃信号 |
| 危机支持 | 对自伤或立即风险表达做出高优先级回应 |
| 来源巡检 | 查看各消息来源接入状态 |
| 隐私守卫 | 默认不保存原文，只保留必要健康信号 |
| 联网搜索解决方法 | 在用户明确询问时打开医疗信息搜索入口 |
| 附近医院搜索 | 在用户需要就医时打开附近医院或急诊地图搜索 |
| 购药准备 | 打开药店/药品搜索入口并提醒咨询医生或药师，不自动下单 |

## 消息来源接入

### 应用内聊天

状态：已自动接入。

入口在主进程的 `ollama-generate` 流程中。用户发送到应用内聊天的消息会自动传给：

```javascript
kaltsitHealthAgent.analyzeMessage({
  source: 'app-chat',
  text: message,
  timestamp: new Date().toISOString()
});
```

### Gmail 和 Outlook

状态：当前为手动导入来源。

现阶段系统不会直接登录或抓取邮箱。外部邮件需要通过后续连接器、OAuth 适配器，或手动导入文本传给健康系统。

手动导入示例：

```javascript
ipcRenderer.invoke('health-analyze-message', {
  source: 'gmail',
  subject: 'Work pressure',
  text: 'I feel overwhelmed and cannot sleep.',
  timestamp: new Date().toISOString()
});
```

Outlook 只需要把 `source` 改为 `outlook`。

### 微信、QQ、Telegram

状态：当前为手动导入来源。

这些平台的桌面客户端和导出格式差异较大，当前系统只提供稳定的导入边界，不直接读取本地客户端数据库。

手动导入示例：

```javascript
ipcRenderer.invoke('health-analyze-batch', [
  {
    source: 'wechat',
    text: '最近压力很大，一直睡不着。',
    timestamp: new Date().toISOString()
  },
  {
    source: 'telegram',
    text: 'I am exhausted and anxious after work.',
    timestamp: new Date().toISOString()
  }
]);
```

## 隐私和安全边界

健康系统默认采用本地优先策略：

- 健康数据保存在 Electron 的 `app.getPath('userData')` 目录下。
- 文件名为 `kaltsit-health-data.json`。
- 默认 `storeRawText: false`，不保存原始消息正文。
- 默认保存最近观察记录、风险等级、信号摘要、提醒时间和计数器。
- 外部账号不会被自动登录、读取或上传。

如果确实需要保存原文，可以通过设置开启：

```javascript
ipcRenderer.invoke('health-update-settings', {
  storeRawText: true
});
```

不建议长期开启，除非用户明确知道这会把消息正文写入本地健康数据文件。

## 用户回应逻辑

系统会按风险等级决定是否回应：

| 风险等级 | 默认行为 |
| --- | --- |
| low | 默认不主动回应 |
| moderate | 达到冷却时间后提醒休息、喝水、减压 |
| high | 立即提醒用户停下、坐到安全位置、联系可信任的人 |
| crisis | 立即提醒远离危险物品，联系当地紧急服务或现实中的可信任人员 |

危机回应不会进行诊断，只会提示现实世界支持。凯尔希可以陪伴提示，但不能替代紧急服务或专业人员。

## 配置项

健康系统默认配置在 `Kaltsit/src/modules/health/health-agent.js` 中。

常用设置：

```javascript
ipcRenderer.invoke('health-update-settings', {
  sleep: {
    enabled: true,
    bedtimeHour: 23,
    wakeHour: 7,
    cooldownMinutes: 60
  },
  hydration: {
    enabled: true,
    frequencyMinutes: 60
  },
  movement: {
    enabled: true,
    frequencyMinutes: 45
  },
  dailyExercise: {
    enabled: true,
    time: '18:30'
  },
  mentalHealth: {
    enabled: true,
    respondToLowRisk: false,
    cooldownMinutes: 20
  }
});
```

## 可用 IPC 接口

| 接口 | 作用 |
| --- | --- |
| `health-get-status` | 获取设置、计数器、最近观察记录和来源状态 |
| `health-get-sources` | 获取来源列表 |
| `health-get-skills` | 获取健康技能列表 |
| `health-update-settings` | 更新健康系统设置 |
| `health-connect-source` | 标记某个来源已接入或已导入 |
| `health-analyze-message` | 分析单条消息 |
| `health-analyze-batch` | 批量分析消息 |
| `health-record-action` | 记录用户已喝水、已活动、已锻炼等动作 |
| `health-run-skill` | 手动执行某个健康技能 |
| `health-check-now` | 立即检查当前是否有提醒到期 |

## 联网搜索、医院和购药辅助

凯尔希可以在用户明确询问时辅助打开搜索入口：

```javascript
ipcRenderer.invoke('health-run-skill', 'medical-web-search', {
  query: 'headache and fever'
});

ipcRenderer.invoke('health-run-skill', 'nearby-hospital-search', {
  location: 'Seattle'
});

ipcRenderer.invoke('health-run-skill', 'medicine-prep-assist', {
  medicine: 'ibuprofen'
});
```

安全边界：

- `medical-web-search` 只打开搜索入口，不做诊断。
- `nearby-hospital-search` 只打开地图搜索；急症时应优先联系当地紧急服务。
- `medicine-prep-assist` 只做购药准备，不自动下单，不代买药品。
- 处方药必须遵医嘱，非处方药也应核对禁忌、过敏史和药物相互作用。

## 手动执行健康技能

```javascript
ipcRenderer.invoke('health-run-skill', 'hydration-reminder');
ipcRenderer.invoke('health-run-skill', 'movement-break');
ipcRenderer.invoke('health-run-skill', 'sleep-supervision');
ipcRenderer.invoke('health-run-skill', 'privacy-guard');
```

带消息执行心理巡检：

```javascript
ipcRenderer.invoke('health-run-skill', 'mental-health-check', {
  source: 'outlook',
  subject: 'Recent workload',
  text: 'I feel hopeless and cannot go on.',
  timestamp: new Date().toISOString()
});
```

## 接入真实外部连接器

后续如果要接入 Gmail、Outlook、微信、QQ 或 Telegram 的真实数据源，建议遵循这个顺序：

1. 新增来源适配器，只负责读取或接收消息，不直接做风险判断。
2. 将消息转换为统一结构：

```javascript
{
  source: 'gmail',
  subject: 'optional subject',
  text: 'message body',
  timestamp: '2026-05-13T10:00:00.000Z'
}
```

3. 调用 `analyzeMessage()` 或 `analyzeBatch()`。
4. 保持 `storeRawText` 默认关闭。
5. 对 OAuth token、聊天导出文件、邮箱内容做单独权限提示。
6. 不要绕过 `normalizeSource()`，新来源必须先加入 `SOURCE_TYPES`。

## 验证方式

开发后至少运行：

```powershell
npm test
node --check Kaltsit\src\modules\health\health-agent.js
node --check Kaltsit\src\modules\health\health-skills.js
node --check scripts\main.js
node --check scripts\renderer\index.js
```

建议再做一次 Electron 启动冒烟：

```powershell
npm start
```

确认：

- 凯尔希可以通过 `Operators` 调出。
- 右键凯尔希能看到健康菜单。
- `健康检查` 能显示气泡。
- `健康来源` 能列出所有来源。
- `健康技能` 能列出所有健康技能。

## 常见问题

### 看不到凯尔希

右键阿米娅，打开 `Operators`，勾选 `Kal'tsit`。右键必须点在角色模型本体上，点透明区域不会弹出角色菜单。

### 健康来源显示 manual-import

这是正常状态。表示该来源已经在健康系统中登记，但还没有真实 OAuth 或平台适配器，当前需要手动导入消息。

### 为什么没有保存原文

这是隐私默认值。系统默认只保存健康信号，不保存用户原始消息。需要保存原文时必须显式开启 `storeRawText`。

### 危机提示为什么很强硬

当消息出现自伤或立即风险信号时，系统会优先提醒用户联系现实世界支持。桌面 agent 只能提供提示，不能替代紧急服务、医生或心理健康专业人员。

## 相关文件

- `Kaltsit/src/modules/health/health-agent.js`
- `Kaltsit/src/modules/health/health-skills.js`
- `scripts/main.js`
- `scripts/renderer/index.js`
- `test-health-agent.js`
- `test-kaltsit-agent.js`

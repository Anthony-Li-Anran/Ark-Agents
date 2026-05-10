# 干员对话调度系统使用指南

## 系统概述

干员对话调度系统是一个高度可复用的对话管理框架，支持干员之间的随机对话触发、对话互斥、概率调度等功能。

## 快速开始

### 1. 初始化系统

```javascript
const { DialogSystem } = require('./scripts/dialog');

// 创建对话系统实例
const dialogSystem = new DialogSystem({
    basePath: path.join(__dirname),  // 项目根目录
    checkInterval: 5000,              // 对话检查间隔（毫秒）
    baseTriggerProbability: 0.1,      // 基础触发概率
    bubbleOptions: {
        typingSpeed: 50               // 打字速度（毫秒/字）
    }
});

// 初始化系统
await dialogSystem.initialize();
```

### 2. 注册干员

```javascript
// 注册干员并设置初始位置
dialogSystem.registerOperator('amiya', { x: 500, y: 800 });
dialogSystem.registerOperator('kaltsit', { x: 800, y: 800 });
dialogSystem.registerOperator('texas', { x: 1100, y: 800 });
```

### 3. 更新干员位置

```javascript
// 当干员移动时，更新其位置
dialogSystem.updateOperatorPosition('amiya', { x: 550, y: 800 });
```

### 4. 启动系统

```javascript
// 启动对话调度
dialogSystem.start();
```

### 5. 停止系统

```javascript
// 停止对话调度
dialogSystem.stop();
```

## 对话资源文件格式

对话资源文件存放在各干员目录下的 `talk` 文件夹中：

```
e:\Ark\
├── Amiya\talk\Amiya_say.json
├── Kaltsit\talk\Kaltsit_say.json
└── Texas\talk\Texas_say.json
```

### JSON 格式示例

```json
{
  "character": "Texas",
  "dialogues": {
    "amiya": {
      "1": "嗯，按时送达了。……有pocky要吃吗？",
      "2": "别管她。……需要我帮你处理什么文件吗？",
      "3": "……谢谢。但在这里，我只是企鹅物流的德克萨斯。"
    },
    "kaltsit": {
      "1": "……只是旧伤，不影响任务。",
      "2": "……您要没收吗？",
      "3": "……在罗德岛，我不需要用到那个程度。"
    }
  }
}
```

## 配置干员关系

### 添加新的干员关系

```javascript
dialogSystem.addOperatorRelation('amiya', 'texas', {
    probability: 0.35,    // 触发概率 (0-1)
    cooldown: 30000,      // 冷却时间（毫秒）
    priority: 1,          // 优先级（数字越小越优先）
    enabled: true         // 是否启用
});
```

### 修改触发概率

```javascript
dialogSystem.setDialogProbability('amiya', 'kaltsit', 0.4);
```

### 修改冷却时间

```javascript
dialogSystem.setDialogCooldown('amiya', 'texas', 25000);
```

## 系统配置

### 设置检查间隔

```javascript
// 设置对话检查间隔为 3 秒
dialogSystem.setCheckInterval(3000);
```

### 设置打字速度

```javascript
// 设置打字速度为 30 毫秒/字
dialogSystem.setTypingSpeed(30);
```

## 事件监听

```javascript
// 监听对话触发事件
dialogSystem.on('dialogTriggered', (dialogInfo) => {
    console.log('对话触发:', dialogInfo.operator1, '<->', dialogInfo.operator2);
});

// 监听对话结束事件
dialogSystem.on('dialogEnded', (dialogInfo) => {
    console.log('对话结束:', dialogInfo);
});
```

## 系统状态查询

```javascript
// 获取系统统计信息
const stats = dialogSystem.getStats();
console.log('系统状态:', stats);
```

## 扩展新干员

### 1. 创建对话资源文件

在干员目录下创建 `talk` 文件夹和对话文件：

```
e:\Ark\NewOperator\talk\NewOperator_say.json
```

### 2. 注册干员到系统

```javascript
// 方法一：直接注册（系统会自动检测对话文件）
dialogSystem.registerOperator('newoperator', { x: 600, y: 800 });

// 方法二：手动添加对话路径
dialogSystem.contentManager.registerOperator(
    'newoperator',
    path.join(__dirname, 'NewOperator', 'talk')
);
```

### 3. 配置干员关系

```javascript
dialogSystem.addOperatorRelation('newoperator', 'amiya', {
    probability: 0.3,
    cooldown: 30000
});
```

## 核心特性

### 1. 对话互斥机制

系统确保同一时间只能显示一组干员对话，避免多个对话同时出现造成混乱。

### 2. 概率触发

基于配置的概率随机触发对话，支持为不同干员组合设置不同的触发几率。

### 3. 冷却时间

对话触发后进入冷却期，避免频繁触发同一组对话。

### 4. 一问一答

对话严格按照一问一答的顺序进行，确保对话流程的连贯性。

### 5. 逐字显示

对话文本支持逐字显示效果，提升阅读体验。

### 6. 白色气泡

统一使用白色对话气泡，简洁美观。

## API 参考

### DialogSystem

#### 方法

- `initialize()` - 初始化系统
- `start()` - 启动对话调度
- `stop()` - 停止对话调度
- `registerOperator(operatorId, position)` - 注册干员
- `unregisterOperator(operatorId)` - 注销干员
- `updateOperatorPosition(operatorId, position)` - 更新干员位置
- `addOperatorRelation(op1, op2, config)` - 添加干员关系
- `setDialogProbability(op1, op2, probability)` - 设置触发概率
- `setDialogCooldown(op1, op2, cooldown)` - 设置冷却时间
- `setCheckInterval(interval)` - 设置检查间隔
- `setTypingSpeed(speed)` - 设置打字速度
- `getStats()` - 获取系统状态
- `on(event, callback)` - 监听事件
- `destroy()` - 销毁系统

## 注意事项

1. 确保对话资源文件格式正确
2. 干员 ID 不区分大小写
3. 对话位置应根据干员实际位置动态更新
4. 系统销毁前应调用 `destroy()` 方法清理资源

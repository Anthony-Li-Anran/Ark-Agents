# Tasks: 拆分 renderer.js（分期实施）

## 第一期：提取通用 UI 组件

### 任务 1.1: 创建目录结构
- [x] 创建 `scripts/renderer/` 目录
- [x] 创建 `scripts/shared/` 目录

### 任务 1.2: 提取共享常量
- [x] 创建 `scripts/shared/constants.js`
  - [x] 提取动画配置常量（DAY_ANIMATIONS, SLEEP_ANIMATIONS, TEXAS_ANIMATIONS）
  - [x] 提取模型路径常量（MODEL_PATH, TEXAS_MODEL_PATH）
  - [x] 提取尺寸和速度常量（MOVING_SPEED, MODEL_WIDTH 等）
  - [x] 提取时间常量（GREETING_BUBBLE_DURATION_MS, CHAT_BUBBLE_DURATION_MS）

### 任务 1.3: 提取聊天 UI 组件
- [x] 创建 `scripts/renderer/chat-ui.js`
  - [x] 提取 CSS 样式（聊天输入框、AI 气泡、加载动画）
  - [x] 提取 createChatUI() 函数
  - [x] 提取 updateChatPosition() 函数
  - [x] 提取 showChatUI() / hideChatUI() 函数
  - [x] 提取 showAIBubble() / hideAIBubble() 函数
  - [x] 提取 showLoadingSpinner() / hideLoadingSpinner() 函数
  - [x] 提取 sendUserMessage() / sendMessageToAI() 函数
  - [x] 导出所有功能供外部使用

### 任务 1.4: 提取右键菜单组件
- [x] 创建 `scripts/renderer/context-menu.js`
  - [x] 提取 CSS 样式（菜单样式）
  - [x] 提取 createContextMenu() 函数
  - [x] 提取 showContextMenu() / hideContextMenu() 函数
  - [x] 提取 onContextMenuAction() 函数
  - [x] 导出所有功能供外部使用

### 任务 1.5: 提取角色切换面板
- [x] 创建 `scripts/renderer/operator-panel.js`
  - [x] 提取 CSS 样式（面板样式）
  - [x] 提取 createOperatorPanel() 函数
  - [x] 提取 showOperatorPanel() / hideOperatorPanel() 函数
  - [x] 提取 positionOperatorPanel() 函数
  - [x] 导出所有功能供外部使用

### 任务 1.6: 提取系统通知
- [x] 创建 `scripts/renderer/notification.js`
  - [x] 提取 CSS 样式（通知样式）
  - [x] 提取 showSystemNotification() 函数
  - [x] 提取 hideSystemNotification() 函数
  - [x] 提取 updateNotificationPosition() 函数
  - [x] 导出所有功能供外部使用

### 任务 1.7: 提取通用工具函数
- [x] 创建 `scripts/renderer/utils.js`
  - [x] 提取拖拽相关函数（initDrag 等）
  - [x] 提取鼠标事件处理函数
  - [x] 提取边界检测函数（isAtLeftEdge, isAtRightEdge, handleEdgeCollision）
  - [x] 提取模型点击检测函数（isPointInModel, isPointInTexas）
  - [x] 导出所有功能供外部使用

### 任务 1.8: 第一期验证
- [x] 验证原 renderer.js 仍可正常运行
- [x] 验证所有提取的模块可以正常导入

---

## 第二期：重构 Amiya 角色逻辑

### 任务 2.1: 创建 Amiya 角色类
- [x] 创建 `Amiya/src/renderer/amiya-animations.js`
  - [x] 提取 DAY_ANIMATIONS 配置
  - [x] 提取 SLEEP_ANIMATIONS 配置
  - [x] 导出动画配置

- [x] 创建 `Amiya/src/renderer/amiya-character.js`
  - [x] 创建 AmiyaCharacter 类
  - [x] 提取 Amiya 动画状态机逻辑
  - [x] 提取 Amiya 移动逻辑（startMoving, stopMoving）
  - [x] 提取 Amiya 渲染逻辑
  - [x] 提取动画切换逻辑（getNextAnimation, scheduleNextAnimation）
  - [x] 导出 AmiyaCharacter 类

### 任务 2.2: 第二期验证
- [x] 验证 Amiya 角色动画正常
- [x] 验证 Amiya 角色移动正常
- [x] 验证 Amiya 角色交互正常

---

## 第三期：重构 Texas 角色逻辑

### 任务 3.1: 创建 Texas 目录结构
- [x] 创建 `Texas/src/renderer/` 目录

### 任务 3.2: 创建 Texas 角色类
- [x] 创建 `Texas/src/renderer/texas-animations.js`
  - [x] 提取 TEXAS_ANIMATIONS 配置
  - [x] 导出动画配置

- [x] 创建 `Texas/src/renderer/texas-character.js`
  - [x] 创建 TexasCharacter 类
  - [x] 提取 Texas 动画状态机逻辑
  - [x] 提取 Texas 移动逻辑（startTexasMoving, stopTexasMoving）
  - [x] 提取 Texas 渲染逻辑
  - [x] 提取动画切换逻辑（getNextTexasAnimation, scheduleNextTexasAnimation）
  - [x] 导出 TexasCharacter 类

### 任务 3.3: 第三期验证
- [x] 验证 Texas 角色可以正常显示
- [x] 验证 Texas 角色动画正常
- [x] 验证 Texas 角色移动正常

---

## 第四期：整合与验证

### 任务 4.1: 创建新的渲染进程入口
- [x] 重构 `Amiya/src/renderer/index.js`
  - [x] 导入共享常量
  - [x] 导入通用 UI 组件
  - [x] 导入 AmiyaCharacter 类
  - [x] 导入 TexasCharacter 类
  - [x] 初始化 PixiJS
  - [x] 设置 IPC 监听
  - [x] 启动应用

### 任务 4.2: 更新引用路径
- [x] 更新 `Amiya/src/views/index.html`
  - [x] 修改 script src 指向新的入口

### 任务 4.3: 清理旧文件
- [x] 删除旧的 `Amiya/src/renderer/renderer.js`

### 任务 4.4: 最终验证
- [x] 验证应用正常启动无报错
- [x] 验证 Amiya 角色默认动画正常播放
- [x] 验证 Amiya 角色移动动画正常
- [x] 验证 Texas 角色可以正常显示
- [x] 验证 Texas 角色动画正常
- [x] 验证聊天窗口可以正常打开
- [x] 验证可以正常发送消息给 AI
- [x] 验证右键菜单正常显示
- [x] 验证角色切换面板正常显示
- [x] 验证可以切换到 Texas 角色
- [x] 验证可以切换回 Amiya 角色

---

# Task Dependencies

```
第一期任务（1.1-1.8）可以并行执行
    ↓
第二期任务（2.1-2.2）依赖第一期完成
    ↓
第三期任务（3.1-3.3）依赖第一期完成
    ↓
第四期任务（4.1-4.4）依赖第二、三期完成
```

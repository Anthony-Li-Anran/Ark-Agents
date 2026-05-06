# Checklist: 拆分 renderer.js（分期验证）

## 第一期验证清单

### 目录结构
- [ ] `scripts/renderer/` 目录已创建
- [ ] `scripts/shared/` 目录已创建

### 共享常量 (scripts/shared/constants.js)
- [ ] 文件已创建
- [ ] DAY_ANIMATIONS 常量正确导出
- [ ] SLEEP_ANIMATIONS 常量正确导出
- [ ] TEXAS_ANIMATIONS 常量正确导出
- [ ] MODEL_PATH 常量正确导出
- [ ] TEXAS_MODEL_PATH 常量正确导出
- [ ] MOVING_SPEED 常量正确导出
- [ ] MODEL_WIDTH 常量正确导出
- [ ] TEXAS_MODEL_WIDTH 常量正确导出
- [ ] GREETING_BUBBLE_DURATION_MS 常量正确导出
- [ ] CHAT_BUBBLE_DURATION_MS 常量正确导出

### 聊天 UI 组件 (scripts/renderer/chat-ui.js)
- [ ] 文件已创建
- [ ] CSS 样式正确注入
- [ ] createChatUI() 函数正确导出
- [ ] updateChatPosition() 函数正确导出
- [ ] showChatUI() 函数正确导出
- [ ] hideChatUI() 函数正确导出
- [ ] showAIBubble() 函数正确导出
- [ ] hideAIBubble() 函数正确导出
- [ ] showLoadingSpinner() 函数正确导出
- [ ] hideLoadingSpinner() 函数正确导出
- [ ] sendUserMessage() 函数正确导出
- [ ] sendMessageToAI() 函数正确导出

### 右键菜单组件 (scripts/renderer/context-menu.js)
- [ ] 文件已创建
- [ ] CSS 样式正确注入
- [ ] createContextMenu() 函数正确导出
- [ ] showContextMenu() 函数正确导出
- [ ] hideContextMenu() 函数正确导出
- [ ] onContextMenuAction() 函数正确导出

### 角色切换面板 (scripts/renderer/operator-panel.js)
- [ ] 文件已创建
- [ ] CSS 样式正确注入
- [ ] createOperatorPanel() 函数正确导出
- [ ] showOperatorPanel() 函数正确导出
- [ ] hideOperatorPanel() 函数正确导出
- [ ] positionOperatorPanel() 函数正确导出

### 系统通知 (scripts/renderer/notification.js)
- [ ] 文件已创建
- [ ] CSS 样式正确注入
- [ ] showSystemNotification() 函数正确导出
- [ ] hideSystemNotification() 函数正确导出
- [ ] updateNotificationPosition() 函数正确导出

### 通用工具函数 (scripts/renderer/utils.js)
- [ ] 文件已创建
- [ ] initDrag() 函数正确导出
- [ ] 鼠标事件处理函数正确导出
- [ ] isAtLeftEdge() 函数正确导出
- [ ] isAtRightEdge() 函数正确导出
- [ ] handleEdgeCollision() 函数正确导出
- [ ] isPointInModel() 函数正确导出
- [ ] isPointInTexas() 函数正确导出

### 第一期完成验证
- [ ] 原 renderer.js 仍可正常运行
- [ ] 所有新模块可以正常 require/import

---

## 第二期验证清单

### Amiya 动画配置 (Amiya/src/renderer/amiya-animations.js)
- [ ] 文件已创建
- [ ] DAY_ANIMATIONS 正确导出
- [ ] SLEEP_ANIMATIONS 正确导出

### Amiya 角色类 (Amiya/src/renderer/amiya-character.js)
- [ ] 文件已创建
- [ ] AmiyaCharacter 类正确导出
- [ ] 构造函数正常工作
- [ ] loadModel() 方法正常工作
- [ ] playAnimation() 方法正常工作
- [ ] startMoving() 方法正常工作
- [ ] stopMoving() 方法正常工作
- [ ] getNextAnimation() 方法正常工作
- [ ] scheduleNextAnimation() 方法正常工作

### 第二期完成验证
- [ ] Amiya 角色默认动画正常播放
- [ ] Amiya 角色移动动画正常
- [ ] Amiya 角色可以响应点击
- [ ] Amiya 角色拖拽功能正常

---

## 第三期验证清单

### Texas 目录结构
- [ ] `Texas/src/renderer/` 目录已创建

### Texas 动画配置 (Texas/src/renderer/texas-animations.js)
- [ ] 文件已创建
- [ ] TEXAS_ANIMATIONS 正确导出

### Texas 角色类 (Texas/src/renderer/texas-character.js)
- [ ] 文件已创建
- [ ] TexasCharacter 类正确导出
- [ ] 构造函数正常工作
- [ ] loadModel() 方法正常工作
- [ ] playAnimation() 方法正常工作
- [ ] startMoving() 方法正常工作
- [ ] stopMoving() 方法正常工作
- [ ] getNextAnimation() 方法正常工作
- [ ] scheduleNextAnimation() 方法正常工作

### 第三期完成验证
- [ ] Texas 角色可以正常显示
- [ ] Texas 角色动画正常播放
- [ ] Texas 角色移动动画正常

---

## 第四期验证清单

### 新的渲染进程入口 (Amiya/src/renderer/index.js)
- [ ] 文件已创建
- [ ] 正确导入共享常量
- [ ] 正确导入通用 UI 组件
- [ ] 正确导入 AmiyaCharacter 类
- [ ] 正确导入 TexasCharacter 类
- [ ] PixiJS 初始化正常
- [ ] IPC 监听设置正常
- [ ] 应用启动逻辑正常

### 路径更新
- [ ] `Amiya/src/views/index.html` 已更新
- [ ] script src 指向 `Amiya/src/renderer/index.js`

### 旧文件清理
- [ ] 旧的 `Amiya/src/renderer/renderer.js` 已删除

### 最终功能验证
- [ ] 应用正常启动无报错
- [ ] Amiya 角色默认动画正常播放
- [ ] Amiya 角色移动动画正常
- [ ] Amiya 角色交互正常（点击、拖拽）
- [ ] Texas 角色可以正常显示
- [ ] Texas 角色动画正常
- [ ] 聊天窗口可以正常打开
- [ ] 可以正常发送消息给 AI
- [ ] AI 回复气泡正常显示
- [ ] 右键菜单正常显示
- [ ] 右键菜单项点击正常
- [ ] 角色切换面板正常显示
- [ ] 可以切换到 Texas 角色
- [ ] 可以切换回 Amiya 角色
- [ ] 系统通知正常显示
- [ ] 拖拽功能正常工作
- [ ] 模型边界碰撞检测正常

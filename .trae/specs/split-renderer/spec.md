# 拆分 renderer.js 规范

## Why

renderer.js 当前约 1880 行，职责过多，包含：
- CSS 样式定义
- 聊天 UI 管理
- 右键菜单管理
- 角色切换面板
- 动画状态机
- 拖拽逻辑
- 模型渲染（Amiya 和 Texas）

按照用户的设计逻辑，需要将代码按角色分离：Amiya 相关放 `e:\Ark\Amiya`，Texas 相关放 `e:\Ark\Texas`，通用进程逻辑放 `e:\Ark\scripts`。

## 分期计划

### 第一期：提取通用 UI 组件
将聊天 UI、右键菜单、角色面板等通用组件提取到 `scripts/renderer/`

### 第二期：重构 Amiya 角色逻辑
将 Amiya 专属渲染逻辑提取到 `Amiya/src/renderer/`

### 第三期：重构 Texas 角色逻辑
将 Texas 专属渲染逻辑提取到 `Texas/src/renderer/`

### 第四期：整合与验证
创建新的渲染进程入口，更新所有引用，验证功能完整性

## What Changes

### 目录结构（最终状态）

```
e:\Ark\
├── scripts\                    # 应用核心逻辑
│   ├── main.js                 # 主进程入口
│   ├── renderer\               # 渲染进程通用逻辑
│   │   ├── index.js            # 渲染进程入口（第四期）
│   │   ├── chat-ui.js          # 聊天 UI 组件（第一期）
│   │   ├── context-menu.js     # 右键菜单（第一期）
│   │   ├── operator-panel.js   # 角色切换面板（第一期）
│   │   └── utils.js            # 通用工具函数（第一期）
│   └── shared\                 # 共享常量（第一期）
│       └── constants.js
├── Amiya\                      # 阿米娅角色
│   └── src\renderer\           # 渲染相关（第二期）
│       ├── amiya-character.js
│       └── amiya-animations.js
└── Texas\                      # 德克萨斯角色
    └── src\renderer\           # 渲染相关（第三期）
        ├── texas-character.js
        └── texas-animations.js
```

## ADDED Requirements

### Requirement: 功能保持

**CRITICAL**: The system SHALL maintain ALL existing functionality throughout the refactoring process. No features shall be removed or altered in behavior.

#### Scenario: 功能完整性验证
- **WHEN** 每期重构完成后
- **THEN** 所有原有功能必须 100% 保持可用
- **AND** 用户交互行为不得改变
- **AND** UI 外观不得改变
- **AND** 性能不得降低

### Requirement: 分期实施

The system SHALL implement the refactoring in 4 phases to minimize risk.

#### Scenario: 第一期完成
- **WHEN** 第一期完成后
- **THEN** 通用 UI 组件应在 `scripts/renderer/` 中
- **AND** 原 renderer.js 应仍然可用
- **AND** 所有功能保持正常

#### Scenario: 第二期完成
- **WHEN** 第二期完成后
- **THEN** Amiya 角色逻辑应在 `Amiya/src/renderer/` 中
- **AND** Amiya 角色功能 100% 正常
- **AND** 动画、移动、交互行为完全一致

#### Scenario: 第三期完成
- **WHEN** 第三期完成后
- **THEN** Texas 角色逻辑应在 `Texas/src/renderer/` 中
- **AND** Texas 角色功能 100% 正常
- **AND** 动画、移动、交互行为完全一致

#### Scenario: 第四期完成
- **WHEN** 第四期完成后
- **THEN** 新的渲染进程入口应正常工作
- **AND** 所有功能 100% 保持可用
- **AND** 用户体验完全一致

## MODIFIED Requirements

### Requirement: 渐进式重构

每一期完成后，应用应保持可运行状态，且功能完全不变。

### Requirement: 代码行为保持

重构过程中：
- 不得修改任何业务逻辑
- 不得修改任何算法实现
- 不得修改任何状态管理
- 仅允许代码组织和文件结构的变更

## REMOVED Requirements

无

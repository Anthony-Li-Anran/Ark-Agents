<div align="center">

<img src="icons/Ark Agent.png" alt="Ark Agents Logo" width="200">

# Ark Agents

> 基于罗德岛干员的 Electron 模块化多智能体桌面应用

[![Version](https://img.shields.io/badge/Version-v0.2.0--beta.1-blue)](https://github.com/Anthony-Li-Anran/Ark-Agents/releases)
[![Platform](https://img.shields.io/badge/Platform-Windows-red)](https://github.com/Anthony-Li-Anran/Ark-Agents)
[![Electron](https://img.shields.io/badge/Powered%20by-Electron-yellow)](https://www.electronjs.org/)
[![AI](https://img.shields.io/badge/AI-Powered-orange)](https://github.com/Anthony-Li-Anran/Ark-Agents)
[![Animation](https://img.shields.io/badge/Animation-Spine-green)](https://esotericsoftware.com/)

</div>

Ark Agents 是一款创新的桌面应用，将《明日方舟》中的罗德岛干员带到你的工作空间。基于 Electron 构建，提供沉浸式多智能体交互体验与 AI 驱动功能。

***

## 当前版本 <sub>Version</sub>

### v0.2.0-beta.1

**主要特性**

- 完成核心干员阿米娅的基础功能与干员管理系统
- 测试管理干员：德克萨斯、凯尔希
- 基于 Spine 的流畅 2D 骨骼动画展示
- AI 驱动的自然语言对话系统
- 支持 Ollama、LM Studio、OpenAI API 等多种 AI 提供商
- 日程管理、提醒和备忘录等生产力工具
- 智能移动与边界检测、碰撞避免

**🆕 新增功能**

- **Texas 文件整理功能**: 德克萨斯专属桌面文件整理功能
  - 右键菜单进入整理模式
  - 拖拽桌面文件到 Texas 身上进行自动分类整理
  - 支持文档、图片、视频、音乐、压缩包、代码等多种文件类型
  - 整理模式可手动退出（Esc 键）

- **统一 UI 设计**: Memo、Schedule、Reminder 页面采用 Shadcn Dashboard 风格
- **AI 设置优化**: 
  - 支持自定义模型存储位置
  - 添加国内镜像源（阿里云、腾讯云）加速模型下载
  - 聊天界面新增设置按钮

**更新内容**

- 修复干员渲染性能问题
- 优化对话响应速度
- 改进配置向导流程
- 添加自动检测 AI 服务功能
- 优化气泡提示定位逻辑

***

## 功能特性 <sub>Features</sub>

### 多智能体系统

<details><summary>查看详情</summary>
- **干员管理**: 同时管理多名干员，支持添加和移除
- **交互角色**: 在桌面上拖拽移动干员，自由调整位置
- **流畅动画**: 基于 Spine 的实时 2D 骨骼动画
- **智能移动**: 自动移动与边界检测、碰撞避免
- **皮肤切换**: 部分干员支持多皮肤切换（如 Texas Epoque #7）
</details>

### AI 集成

<details><summary>查看详情</summary>
- **自然语言对话**: AI 驱动的角色扮演对话
- **工具集成**: 日程管理、提醒和备忘录系统
- **多提供商支持**: Ollama、LM Studio、OpenAI API 和自定义端点
- **自动配置**: 引导式配置，自动检测服务
- **镜像加速**: 国内用户可使用镜像源加速模型下载
</details>

### 生产力工具

<details><summary>查看详情</summary>
- **日程管理器**: 任务和事件管理
- **提醒系统**: 周期性提醒和通知
- **备忘录管理器**: 快速笔记和组织
- **文件整理器**: Texas 专属桌面文件自动分类整理
</details>

***

## 技术栈 <sub>Tech Stack</sub>

| 技术           | 描述            |
| ------------ | ------------- |
| **Electron** | 跨平台桌面运行时      |
| **PixiJS**   | 2D WebGL 渲染引擎 |
| **Spine**    | 2D 骨骼动画       |
| **Ollama**   | 本地 LLM 推理（可选） |
| **Node.js**  | 后端运行时         |

***

## 安装 <sub>Installation</sub>

### 前置要求

- Windows 10/11（64位）
- Node.js 18+
- npm 或 yarn

### 预构建包

从 [Releases](https://github.com/Anthony-Li-Anran/Ark-Agents/releases) 页面下载预构建包。

### 快速开始

```bash
# 克隆仓库
git clone https://github.com/Anthony-Li-Anran/Ark-Agents.git
cd Ark-Agents

# 安装依赖
npm install

# 开发模式运行
npm start
```

***

## 使用说明 <sub>Usage</sub>

1. **启动应用**: 运行 `Ark Agents.exe`
2. **配置 AI**: 按照设置向导配置 AI 提供商
3. **交互**: 右键点击干员访问上下文菜单
4. **管理干员**: 使用"Operators"菜单添加/移除干员
5. **对话**: 选择"Chat"与阿米娅开始对话
6. **文件整理**: 右键 Texas → File management → 拖拽文件整理

***

## 配置 <sub>Configuration</sub>

### AI 提供商

- **Ollama**（推荐）: 本地 LLM，无需 API 密钥
- **LM Studio**: 桌面 LLM 应用
- **OpenAI API**: 云端 AI 服务
- **自定义 API**: 任何兼容 OpenAI 的端点

### 设置

- 模型选择和配置
- 动画速度和行为
- UI 外观和位置
- 模型存储位置
- 下载镜像源选择

***

## 下一步计划 <sub>Roadmap</sub>

以下内容正在开发或计划中：

- 支持更多有专业技能的新干员
- 接入AI的干员可以拥有自己的日记
- 多模态支持
- 性能优化与适用性改善
- 更多干员专属功能

***

## 贡献 <sub>Contributing</sub>

欢迎贡献！

### 开发设置

```bash
# 安装依赖
npm install
# 启动开发服务器
npm run dev
# 运行测试
npm test
```

***

## 支持 <sub>Support</sub>

如果遇到问题或有疑问，请在 [GitHub Issues](https://github.com/Anthony-Li-Anran/Ark-Agents/issues) 页面提交 issue。

***

## 致谢 <sub>Acknowledgments</sub>

### 灵感来源

本项目受到 **ArkPets**（Windows 平台）的启发：

- GitHub: <https://github.com/isHarryh/Ark-Pets>

### 素材版权

《明日方舟》及所有相关角色均为 **鹰角网络** 所有：

- 官网: <https://www.hypergryph.com/>

### 特别感谢

感谢 **Jomify** 对项目的贡献和支持。

***

## 许可证 <sub>License</sub>

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。

***

<div align="center">

*Ark Agents - Ark Operator For Everyone*

</div>

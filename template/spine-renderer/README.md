# Spine Renderer Template

Electron + PixiJS + Spine v3.8 模型渲染模板

## 使用方法

### 1. 安装依赖

```bash
npm install
```

### 2. 配置模型

编辑 `config.json` 文件：

```json
{
  "window": {
    "width": 400,
    "height": 400,
    "transparent": true,
    "frame": false,
    "alwaysOnTop": true,
    "clickThrough": true
  },
  "model": {
    "path": "models/your_model",
    "name": "your_model_name",
    "scale": 1.0,
    "x": 200,
    "y": 350,
    "speed": 80,
    "boundary": 150,
    "defaultAnimation": "Relax"
  },
  "canvas": {
    "width": 400,
    "height": 400
  }
}
```

### 3. 放置模型文件

将 Spine 模型文件放入指定路径：

```
models/your_model/
├── your_model_name.skel
├── your_model_name.atlas
└── your_model_name.png
```

### 4. 运行

```bash
npm start
```

## 配置说明

| 配置项                      | 说明           |
| ------------------------ | ------------ |
| `window.width/height`    | 窗口大小         |
| `window.transparent`     | 窗口透明         |
| `window.frame`           | 窗口边框         |
| `window.alwaysOnTop`     | 窗口置顶         |
| `window.clickThrough`    | 点击穿透         |
| `model.path`             | 模型文件夹路径      |
| `model.name`             | 模型文件名（不含扩展名） |
| `model.scale`            | 模型缩放比例       |
| `model.x/y`              | 模型在画布中的位置    |
| `model.speed`            | Move 动画移动速度    |
| `model.boundary`         | 模型碰撞边缘判断宽度   |
| `model.defaultAnimation` | 默认播放的动画      |
| `canvas.width/height`    | 画布大小         |

## 功能特性

- ✅ 透明窗口
- ✅ 无边框置顶
- ✅ 点击穿透
- ✅ 托盘图标与显示/隐藏控制
- ✅ `MoveLeft` / `MoveRight` 方向移动，碰撞边缘后可反向或切换 `Relax`
- ✅ 保持模型比例，不使用缩放调整镜像

## 依赖版本

- Electron: ^28.3.3
- @pixi-spine/all-3.8: 3.1.2
- PixiJS: 6.5.10


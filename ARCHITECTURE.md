# Project:Ark Architecture Document

## 1. Project Overview

**Project Name**: Ark-Agents
**Version**: 0.1.0-beta.1
**Type**: Electron-based modular multi-Agent desktop application

**Core Features**:
- Desktop pet application featuring operators from Rhodes Island (Arknights)
- AI conversation integration (planned)
- Personal productivity tools: Memo, Reminder, Schedule

**Vision**: Let the operators of Rhodes Island truly change your life

---

## 2. System Architecture

### 2.1 Module Structure

```
Ark-Agents/
├── Amiya/                    # Amiya operator module
│   ├── config/              # Operator-specific configurations
│   │   └── system_prompt.json
│   ├── src/
│   │   ├── modules/         # Functional modules
│   │   │   ├── ai/          # AI integration
│   │   │   ├── memo/        # Memo management
│   │   │   ├── reminder/    # Reminder management
│   │   │   └── schedule/   # Schedule management
│   │   ├── renderer/        # Rendering components
│   │   │   ├── amiya-animations.js
│   │   │   ├── amiya-character.js
│   │   │   └── index.js
│   │   └── views/           # HTML views
│   └── ...
├── Texas/                   # Texas operator module
│   └── src/renderer/
├── Kaltsit/                 # Kaltsit operator module
│   └── src/renderer/
├── Models/                  # Spine model assets
│   ├── 002_Amiya/
│   ├── 003_kalts/
│   └── 102_Texas/
└── scripts/                 # Core application scripts
    ├── characters/          # Character base classes
    ├── renderer/           # Renderer modules
    └── shared/             # Shared utilities
```

### 2.2 Core Classes

| Class | File | Description |
|-------|------|-------------|
| `CharacterBase` | scripts/characters/character-base.js | Base class for all operators |
| `AmiyaCharacter` | Amiya/src/renderer/amiya-character.js | Amiya operator implementation |
| `TexasCharacter` | Texas/src/renderer/texas-character.js | Texas operator implementation |
| `KaltsitCharacter` | Kaltsit/src/renderer/kaltsit-character.js | Kaltsit operator implementation |

### 2.3 Renderer Modules

| Module | File | Description |
|--------|------|-------------|
| `ChatUI` | scripts/renderer/chat-ui.js | Chat interface |
| `ContextMenu` | scripts/renderer/context-menu.js | Right-click context menu |
| `DragHandler` | scripts/renderer/drag-handler.js | Drag interaction handling |
| `OperatorPanel` | scripts/renderer/operator-panel.js | Operator selection panel |
| `Notification` | scripts/renderer/notification.js | System notifications |

---

## 3. Technology Stack

- **Electron** (v28.3.3) — cross-platform desktop runtime
- **Spine** (@pixi-spine/all-3.8 v3.1.2) — 2D skeletal animation engine
- **Pixi.js** (v6.5.10) — 2D WebGL renderer
- **Ollama** [Planned] — local LLM inference
- **Web Technologies** — UI rendering (HTML/CSS/JS)
- **Electron IPC** — main/renderer process communication
- **@electron/remote** (v2.1.2) — Electron remote module

---

## 4. Data Flow

### 4.1 Character Rendering Flow

```
User Action (Click/Toggle)
    ↓
OperatorPanel.onToggle()
    ↓
showOperatorCharacter() / hideOperatorCharacter()
    ↓
CharacterClass.load() → Spine Model Loading
    ↓
CharacterBase.show() → Animation Start
    ↓
PIXI Stage → Desktop Display
```

### 4.2 Animation State Machine

```
Idle State (Relax/Relax_Idle/Sit)
    ↓ [Markov Chain Transition]
Next Animation State
    ↓ [Movement Trigger]
MoveLeft / MoveRight Animation + Movement
    ↓ [Boundary Detection]
handleEdgeCollision() → Direction Change
```

### 4.3 Multi-Character Management

```
characters: { [operatorId]: CharacterInstance }
selectedOperators: Set<operatorId>
    ↓
showOperatorCharacter() → Add to characters + selectedOperators
hideOperatorCharacter() → Remove from characters + selectedOperators
```

---

## 5. Development Status

### v0.1.0-beta.1 - Multi-Operator Desktop Pet (Current)

#### Core Features
- [x] Electron window fullscreen transparent display
- [x] Spine model loading and rendering
- [x] Model area boundary identification
- [x] Markov chain animation state transitions
- [x] Left/Right movement animations
- [x] Drag to move model position
- [x] Boundary turn logic
- [x] Operator selection panel (multi-character support)
- [x] Right-click context menu
- [x] Click interaction with operators
- [x] Multiple simultaneous character rendering
- [x] Character position distribution algorithm
- [x] Operator toggle state management

#### Operators
- [x] **Amiya** — Default operator, full AI integration ready
- [x] **Texas** — Classic Texas operator
- [x] **Kaltsit** — Kal'tsit operator

#### Productivity Modules [Planned]
- [ ] AI conversation integration (Ollama)
- [ ] Memo management system
- [ ] Reminder system
- [ ] Schedule management

### v0.1.0 - Operator Amiya Basic Interaction (Baseline)
- [x] Electron window fullscreen transparent display
- [x] Spine model loading and rendering
- [x] Model area boundary identification (red border)
- [x] Markov chain animation state transitions
- [x] Left/Right movement animations
- [x] Drag to move model position
- [x] Boundary turn logic

---

## 6. Configuration

### 6.1 Character Configuration

Located in `scripts/shared/constants.js`:

```javascript
CHARACTER_CONFIGS = {
    amiya: { id: 'amiya', name: 'Amiya', modelFolder: '002_Amiya', ... },
    texas: { id: 'texas', name: 'Texas', modelFolder: '102_Texas', ... },
    kalts: { id: 'kalts', name: "Kal'tsit", modelFolder: '003_kalts', ... }
}
```

### 6.2 Animation Configuration

| Operator | Day Animations | Sleep Animations |
|----------|---------------|------------------|
| Amiya | Relax, Relax_Idle, Sit, Move | Sleep |
| Texas | Relax, Relax_Idle, Sit, Move | Relax, Relax_Idle, Sit |
| Kaltsit | Relax, Relax_Idle, Sit, Move | Relax, Relax_Idle, Sit |

---

## 7. Known Issues & Limitations

- [ ] AI conversation not yet implemented
- [ ] Productivity modules (Memo, Reminder, Schedule) not yet implemented
- [ ] Edge collision may cause brief stuttering at high movement speeds
- [ ] Large model files may cause slow initial loading

---

## 8. Future Roadmap

### v0.1.0-beta.2
- [ ] AI conversation with Ollama integration
- [ ] Performance optimization for multi-character rendering
- [ ] Animation blending improvements

### v0.1.0 (Release)
- [ ] Complete AI integration
- [ ] All productivity modules
- [ ] Settings/preferences system
- [ ] macOS/Linux support

### v0.2.0
- [ ] Voice interaction
- [ ] Custom operator support
- [ ] Plugin system

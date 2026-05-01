const originalWarn = console.warn;
console.warn = function(...args) {
    const msg = args[0];
    if (typeof msg === 'string' && msg.includes('PixiJS Deprecation Warning')) {
        return;
    }
    originalWarn.apply(console, args);
};

const { ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');
const PIXI = require('pixi.js');
const { Spine, TextureAtlas, AtlasAttachmentLoader, SkeletonBinary } = require('@pixi-spine/all-3.8');

const CONFIG = require('./config.json');
const canvasContainer = document.getElementById('canvas-container');

const MOVE_ANIMATION_NAME = 'Move';
const MOVING_SPEED = CONFIG.model.speed || 80;
const MODEL_WIDTH = CONFIG.model.boundary || 150;

const ANIMATIONS = {
    'Relax': { next: ['MoveLeft', 'MoveRight', 'Sit'], weight: [0.3, 0.3, 0.4] },
    'Sit': { next: ['Relax', 'MoveLeft', 'MoveRight'], weight: [0.5, 0.25, 0.25] },
    'MoveLeft': { next: ['Relax', 'MoveRight', 'Sit'], weight: [0.4, 0.3, 0.3] },
    'MoveRight': { next: ['Relax', 'MoveLeft', 'Sit'], weight: [0.4, 0.3, 0.3] }
};

let app = null;
let spineAnimation = null;
let debugBorder = null;
let windowBorder = null;
let currentScale = CONFIG.model.scale || 1;
let isDragging = false;
let isMouseDown = false;
let dragStartX = 0;
let dragStartY = 0;
let modelStartX = 0;
let modelStartY = 0;
let mouseDownX = 0;
let mouseDownY = 0;
let isUserInteracting = false;
let moveDirection = 'right';
let lastFrameTime = 0;
let moveAnimationId = null;
let screenWidth = CONFIG.canvas.width;
let screenHeight = CONFIG.canvas.height;
let currentAnimation = null;
let animationTimer = null;

const DRAG_THRESHOLD = 5;

function playAnimation(name, loop = true) {
    if (!spineAnimation) return;

    let animationName = name;
    if (name === 'MoveLeft' || name === 'MoveRight') {
        animationName = MOVE_ANIMATION_NAME;
    }

    spineAnimation.state.setAnimation(0, animationName, loop);
    currentAnimation = name;
}

function setDirection(dir) {
    moveDirection = dir;
    if (spineAnimation) {
        const scaleX = Math.abs(spineAnimation.scale.x);
        spineAnimation.scale.x = dir === 'left' ? -scaleX : scaleX;
    }
}

function isAtLeftEdge(bounds) {
    return bounds.x <= 0;
}

function isAtRightEdge(bounds) {
    return bounds.x + bounds.width >= screenWidth;
}

function handleEdgeCollision(bounds) {
    const shouldRelax = Math.random() < 0.5;
    if (shouldRelax) {
        playAnimation('Relax', true);
        stopMoving();
        return;
    }

    const nextDirection = moveDirection === 'right' ? 'left' : 'right';
    setDirection(nextDirection);
    const nextAnimation = nextDirection === 'left' ? 'MoveLeft' : 'MoveRight';
    playAnimation(nextAnimation, true);
}

function updateDebugBorder() {
    if (!debugBorder || !spineAnimation) return;

    const bounds = spineAnimation.getBounds();
    debugBorder.clear();
    debugBorder.lineStyle(2, 0xff0000, 1);
    debugBorder.drawRect(bounds.x, bounds.y, bounds.width, bounds.height);
}

function getNextAnimation(current) {
    const transitions = ANIMATIONS[current];
    if (!transitions) {
        return 'Relax';
    }

    const rand = Math.random();
    let sum = 0;
    for (let i = 0; i < transitions.next.length; i++) {
        sum += transitions.weight[i];
        if (rand < sum) {
            return transitions.next[i];
        }
    }
    return transitions.next[0];
}

function scheduleNextAnimation() {
    if (animationTimer) {
        clearTimeout(animationTimer);
    }

    const duration = 3000 + Math.random() * 4000;
    animationTimer = setTimeout(() => {
        if (isUserInteracting) return;

        const nextAnim = getNextAnimation(currentAnimation || CONFIG.model.defaultAnimation || 'Relax');

        if (nextAnim === 'MoveLeft') {
            setDirection('left');
            playAnimation('MoveLeft', true);
            startMoving();
        } else if (nextAnim === 'MoveRight') {
            setDirection('right');
            playAnimation('MoveRight', true);
            startMoving();
        } else {
            stopMoving();
            playAnimation(nextAnim, true);
        }

        scheduleNextAnimation();
    }, duration);
}

function startMoving() {
    if (moveAnimationId) return;

    lastFrameTime = Date.now();

    const moveStep = () => {
        if (isUserInteracting) {
            moveAnimationId = null;
            return;
        }

        const now = Date.now();
        const delta = (now - lastFrameTime) / 1000;
        lastFrameTime = now;

        const movement = MOVING_SPEED * delta;

        if (!spineAnimation) {
            moveAnimationId = null;
            return;
        }

        if (moveDirection === 'right') {
            spineAnimation.x += movement;
            const newBounds = spineAnimation.getBounds();
            if (isAtRightEdge(newBounds)) {
                spineAnimation.x -= Math.max(0, newBounds.x + newBounds.width - screenWidth);
                handleEdgeCollision(newBounds);
            }
        } else {
            spineAnimation.x -= movement;
            const newBounds = spineAnimation.getBounds();
            if (isAtLeftEdge(newBounds)) {
                spineAnimation.x += Math.max(0, 0 - newBounds.x);
                handleEdgeCollision(newBounds);
            }
        }

        if (currentAnimation !== 'MoveLeft' && currentAnimation !== 'MoveRight') {
            stopMoving();
            return;
        }

        moveAnimationId = requestAnimationFrame(moveStep);
        updateDebugBorder();
    };

    moveAnimationId = requestAnimationFrame(moveStep);
}

function stopMoving() {
    if (moveAnimationId) {
        cancelAnimationFrame(moveAnimationId);
        moveAnimationId = null;
    }
}

function isPointInModel(x, y) {
    if (!spineAnimation) return false;
    const bounds = spineAnimation.getBounds();
    return x >= bounds.x && x <= bounds.x + bounds.width &&
           y >= bounds.y && y <= bounds.y + bounds.height;
}

function updateMouseIgnore(x, y) {
    if (!spineAnimation) return;
    const inModel = isPointInModel(x, y);
    ipcRenderer.send('set-ignore-mouse-events', !inModel);
    if (inModel) {
        canvasContainer.classList.add('interactive');
    } else {
        canvasContainer.classList.remove('interactive');
    }
}

function initDrag() {
    document.addEventListener('mousemove', (e) => {
        if (!spineAnimation) return;
        updateMouseIgnore(e.clientX, e.clientY);

        if (!isDragging) return;

        const deltaX = e.clientX - dragStartX;
        const deltaY = e.clientY - dragStartY;

        spineAnimation.x = modelStartX + deltaX;
        spineAnimation.y = modelStartY + deltaY;

        if (spineAnimation.x < MODEL_WIDTH) spineAnimation.x = MODEL_WIDTH;
        if (spineAnimation.x > screenWidth - MODEL_WIDTH) spineAnimation.x = screenWidth - MODEL_WIDTH;
        if (spineAnimation.y < MODEL_WIDTH) spineAnimation.y = MODEL_WIDTH;
        if (spineAnimation.y > screenHeight - MODEL_WIDTH) spineAnimation.y = screenHeight - MODEL_WIDTH;

        updateDebugBorder();
    });

    canvasContainer.addEventListener('mousedown', (e) => {
        if (!spineAnimation) return;
        if (e.button !== 0) return;

        if (!isPointInModel(e.clientX, e.clientY)) {
            return;
        }

        isMouseDown = true;
        mouseDownX = e.clientX;
        mouseDownY = e.clientY;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        modelStartX = spineAnimation.x;
        modelStartY = spineAnimation.y;
    });

    document.addEventListener('mouseup', (e) => {
        if (!isMouseDown) return;

        const moveDistance = Math.sqrt(
            Math.pow(e.clientX - mouseDownX, 2) +
            Math.pow(e.clientY - mouseDownY, 2)
        );

        if (!isDragging && moveDistance < DRAG_THRESHOLD) {
            stopMoving();
            if (animationTimer) {
                clearTimeout(animationTimer);
            }
            isUserInteracting = true;

            playAnimation('Interact', false);

            spineAnimation.state.addListener({
                complete: (trackEntry) => {
                    if (trackEntry.animation.name === 'Interact') {
                        playAnimation('Relax', true);
                        isUserInteracting = false;
                        scheduleNextAnimation();
                    }
                }
            });
        } else if (isDragging) {
            stopMoving();
            playAnimation('Relax', true);
            isUserInteracting = false;
            scheduleNextAnimation();
        }

        isDragging = false;
        isMouseDown = false;
    });

    document.addEventListener('mousemove', (e) => {
        if (!isMouseDown) return;

        const moveDistance = Math.sqrt(
            Math.pow(e.clientX - mouseDownX, 2) +
            Math.pow(e.clientY - mouseDownY, 2)
        );

        if (moveDistance >= DRAG_THRESHOLD && !isDragging) {
            isDragging = true;
            isUserInteracting = true;
            stopMoving();
            if (animationTimer) {
                clearTimeout(animationTimer);
            }
            playAnimation('Relax', true);
        }
    });
}

async function initPixi() {
    screenWidth = CONFIG.canvas.width;
    screenHeight = CONFIG.canvas.height;

    app = new PIXI.Application({
        width: screenWidth,
        height: screenHeight,
        backgroundColor: 0x000000,
        backgroundAlpha: 0,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        transparent: true
    });

    canvasContainer.appendChild(app.view);

    initDrag();
    await loadSpineModel();
}

async function loadSpineModel() {
    const MODEL_PATH = path.join(__dirname, CONFIG.model.path);
    const MODEL_NAME = CONFIG.model.name;

    const skelPath = path.join(MODEL_PATH, `${MODEL_NAME}.skel`);
    const atlasPath = path.join(MODEL_PATH, `${MODEL_NAME}.atlas`);
    const pngPath = path.join(MODEL_PATH, `${MODEL_NAME}.png`);

    if (!fs.existsSync(skelPath)) {
        console.error(`Skeleton file not found: ${skelPath}`);
        return;
    }
    if (!fs.existsSync(atlasPath)) {
        console.error(`Atlas file not found: ${atlasPath}`);
        return;
    }
    if (!fs.existsSync(pngPath)) {
        console.error(`Texture file not found: ${pngPath}`);
        return;
    }

    try {
        const atlasData = fs.readFileSync(atlasPath, 'utf-8');
        const textureData = fs.readFileSync(pngPath);
        const skeletonData = fs.readFileSync(skelPath);

        const textureBase64 = textureData.toString('base64');
        const textureUrl = `data:image/png;base64,${textureBase64}`;

        const baseTexture = PIXI.BaseTexture.from(textureUrl);
        const texture = new PIXI.Texture(baseTexture);

        const textureAtlas = new TextureAtlas(atlasData, (line, callback) => {
            callback(texture.baseTexture);
        });

        const atlasLoader = new AtlasAttachmentLoader(textureAtlas);
        const skeletonBinary = new SkeletonBinary(atlasLoader);
        skeletonBinary.scale = currentScale;

        const skeletonDataParsed = skeletonBinary.readSkeletonData(new Uint8Array(skeletonData));

        spineAnimation = new Spine(skeletonDataParsed);

        spineAnimation.x = CONFIG.model.x;
        spineAnimation.y = CONFIG.model.y;

        spineAnimation.scale.set(1, 1);

        app.stage.addChild(spineAnimation);

        debugBorder = new PIXI.Graphics();
        app.stage.addChild(debugBorder);
        updateDebugBorder();

        windowBorder = new PIXI.Graphics();
        windowBorder.lineStyle(1, 0xffffff, 0.5);
        windowBorder.drawRect(0, 0, screenWidth, screenHeight);
        app.stage.addChild(windowBorder);

        playAnimation('Relax', true);
        setDirection(moveDirection);
        scheduleNextAnimation();

    } catch (error) {
        console.error(`Error loading model: ${error.message}`);
    }
}

document.addEventListener('DOMContentLoaded', initPixi);

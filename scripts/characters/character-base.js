/**
 * Character Base Class
 * Base class for all character modules
 */

const path = require('path');
const fs = require('fs');
const PIXI = require('pixi.js');
const { Spine, TextureAtlas, AtlasAttachmentLoader, SkeletonBinary } = require('@pixi-spine/all-3.8');

// Get the directory of this script file
const characterBaseDir = __dirname;

const { MOVING_SPEED, MODEL_WIDTH } = require(path.join(characterBaseDir, '..', 'shared', 'constants'));

class CharacterBase {
    constructor(config, options = {}) {
        this.config = config;
        this.options = options;
        this.characterId = config.id || config.name?.toLowerCase() || 'unknown';
        
        this.spine = null;
        this.currentAnimation = null;
        this.moveDirection = 'right';
        this.lastFrameTime = 0;
        this.moveAnimationId = null;
        this.animationTimer = null;
        this.isUserInteracting = false;
        this.isEnabled = false;
        this.scale = options.scale || 0.4;
        
        this.screenWidth = options.screenWidth || 1920;
        this.screenHeight = options.screenHeight || 1080;
        this.app = options.app || null;
        
        this.onAnimationComplete = null;
    }

    getModelPath() {
        if (this.options.modelsBasePath) {
            return path.join(this.options.modelsBasePath, this.config.modelFolder);
        }
        // Fallback to characterBaseDir for Electron renderer compatibility
        // characterBaseDir points to scripts/characters/, so we need to go up 2 levels to reach project root
        return path.join(characterBaseDir, '..', '..', 'Models', this.config.modelFolder);
    }

    async load() {
        const modelPath = this.getModelPath();
        const skelPath = path.join(modelPath, `${this.config.modelName}.skel`);
        const atlasPath = path.join(modelPath, `${this.config.modelName}.atlas`);
        const pngPath = path.join(modelPath, `${this.config.modelName}.png`);

        console.log(`[CharacterBase] Loading model: ${this.config.name}`);
        console.log(`[CharacterBase] Model path: ${modelPath}`);
        console.log(`[CharacterBase] Skeleton: ${skelPath}`);
        console.log(`[CharacterBase] Atlas: ${atlasPath}`);
        console.log(`[CharacterBase] Texture: ${pngPath}`);

        if (!fs.existsSync(skelPath) || !fs.existsSync(atlasPath) || !fs.existsSync(pngPath)) {
            const error = `Model files not found in: ${modelPath}`;
            console.error(`[CharacterBase] ${error}`);
            console.error(`[CharacterBase] skel exists: ${fs.existsSync(skelPath)}`);
            console.error(`[CharacterBase] atlas exists: ${fs.existsSync(atlasPath)}`);
            console.error(`[CharacterBase] png exists: ${fs.existsSync(pngPath)}`);
            throw new Error(error);
        }

        try {
            console.log('[CharacterBase] Reading model files...');
            const atlasData = fs.readFileSync(atlasPath, 'utf-8');
            const textureData = fs.readFileSync(pngPath);
            const skeletonData = fs.readFileSync(skelPath);
            console.log('[CharacterBase] Model files read successfully');

            console.log('[CharacterBase] Creating textures...');
            const baseTexture = new PIXI.BaseTexture(`data:image/png;base64,${textureData.toString('base64')}`, {
                resourceOptions: { autoLoad: true }
            });
            const texture = new PIXI.Texture(baseTexture);
            const textureAtlas = new TextureAtlas(atlasData, (line, callback) => {
                callback(texture.baseTexture);
            });
            const atlasLoader = new AtlasAttachmentLoader(textureAtlas);
            const skeletonBinary = new SkeletonBinary(atlasLoader);
            skeletonBinary.scale = this.scale;
            const skeletonDataParsed = skeletonBinary.readSkeletonData(new Uint8Array(skeletonData));
            console.log('[CharacterBase] Textures created successfully');

            console.log('[CharacterBase] Creating Spine instance...');
            this.spine = new Spine(skeletonDataParsed);
            this.spine.x = this.options.startX || this.screenWidth / 2;
            this.spine.y = this.options.startY || this.screenHeight - 80;
            this.spine.scale.set(1, 1);
            this.spine.interactive = true;
            this.spine.buttonMode = true;
            console.log(`[CharacterBase] Spine created at position (${this.spine.x}, ${this.spine.y})`);

            if (this.app) {
                this.app.stage.addChild(this.spine);
                console.log('[CharacterBase] Spine added to stage');
            }

            console.log(`[CharacterBase] Model ${this.config.name} loaded successfully`);
            return this.spine;
        } catch (error) {
            console.error(`[CharacterBase] Error loading model ${this.config.name}:`, error);
            console.error('[CharacterBase] Error stack:', error.stack);
            throw new Error(`Error loading model ${this.config.name}: ${error.message}`);
        }
    }

    show() {
        if (this.spine) {
            this.spine.visible = true;
            this.isEnabled = true;
            this.playAnimation(this.getDefaultIdleAnimation(), true);
            this.scheduleNextAnimation();
        }
    }

    hide() {
        this.isEnabled = false;
        this.stopMoving();
        if (this.animationTimer) {
            clearTimeout(this.animationTimer);
            this.animationTimer = null;
        }
        if (this.spine) {
            this.spine.visible = false;
        }
    }

    isSleepTime(date = new Date()) {
        const hour = date.getHours();
        return hour >= 23 || hour < 7;
    }

    getActiveAnimationMatrix() {
        return this.isSleepTime() ? this.config.animations.sleep : this.config.animations.day;
    }

    getDefaultIdleAnimation() {
        return this.isSleepTime() ? 'Sleep' : 'Relax';
    }

    playAnimation(name, loop = true) {
        if (!this.spine) return;

        let animationName = name;
        if (name === 'MoveLeft' || name === 'MoveRight') {
            animationName = this.config.moveAnimation || 'Move';
        }

        this.spine.state.setAnimation(0, animationName, loop);
        this.currentAnimation = name;
    }

    setDirection(dir) {
        this.moveDirection = dir;
        if (this.spine) {
            const scaleX = Math.abs(this.spine.scale.x);
            this.spine.scale.x = dir === 'left' ? -scaleX : scaleX;
        }
    }

    isAtLeftEdge(bounds) {
        return bounds.x <= 0;
    }

    isAtRightEdge(bounds) {
        return bounds.x + bounds.width >= this.screenWidth;
    }

    handleEdgeCollision(bounds, chatVisible = false) {
        this.stopMoving();
        
        if (chatVisible) {
            return;
        }

        const shouldRelax = Math.random() < 0.5;
        if (shouldRelax) {
            this.playAnimation(this.getDefaultIdleAnimation(), true);
            return;
        }

        const nextDirection = this.moveDirection === 'right' ? 'left' : 'right';
        this.setDirection(nextDirection);
        const nextAnimation = nextDirection === 'left' ? 'MoveLeft' : 'MoveRight';
        this.playAnimation(nextAnimation, true);
        
        setTimeout(() => {
            if (!this.isEnabled || this.isUserInteracting) return;
            this.startMoving(chatVisible);
        }, 100);
    }

    getNextAnimation(current) {
        const transitions = this.getActiveAnimationMatrix()[current];
        if (!transitions) {
            return this.getDefaultIdleAnimation();
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

    scheduleNextAnimation(chatVisible = false) {
        if (this.animationTimer) {
            clearTimeout(this.animationTimer);
        }

        if (chatVisible || !this.isEnabled) {
            return;
        }

        const duration = 3000 + Math.random() * 4000;
        this.animationTimer = setTimeout(() => {
            if (chatVisible || this.isUserInteracting || !this.isEnabled) {
                return;
            }

            const nextAnim = this.getNextAnimation(this.currentAnimation || 'Relax');

            if (nextAnim === 'Move' || nextAnim === 'MoveLeft' || nextAnim === 'MoveRight') {
                const direction = nextAnim === 'Move' ? (Math.random() < 0.5 ? 'left' : 'right') : 
                                 nextAnim === 'MoveLeft' ? 'left' : 'right';
                this.setDirection(direction);
                this.playAnimation(this.config.moveAnimation || 'Move', true);
                this.startMoving(chatVisible);
            } else {
                this.stopMoving();
                this.playAnimation(nextAnim, true);
            }

            this.scheduleNextAnimation(chatVisible);
        }, duration);
    }

    startMoving(chatVisible = false) {
        if (this.moveAnimationId) return;

        this.lastFrameTime = Date.now();

        const moveStep = () => {
            if (chatVisible || this.isUserInteracting || !this.isEnabled) {
                this.moveAnimationId = null;
                return;
            }

            const now = Date.now();
            const delta = (now - this.lastFrameTime) / 1000;
            this.lastFrameTime = now;

            const movement = MOVING_SPEED * delta;

            const bounds = this.spine.getBounds();
            if (this.moveDirection === 'right') {
                this.spine.x += movement;
                const newBounds = this.spine.getBounds();
                if (this.isAtRightEdge(newBounds)) {
                    this.spine.x -= Math.max(0, newBounds.x + newBounds.width - this.screenWidth);
                    this.handleEdgeCollision(newBounds, chatVisible);
                }
            } else {
                this.spine.x -= movement;
                const newBounds = this.spine.getBounds();
                if (this.isAtLeftEdge(newBounds)) {
                    this.spine.x += Math.max(0, 0 - newBounds.x);
                    this.handleEdgeCollision(newBounds, chatVisible);
                }
            }

            const moveAnimName = this.config.moveAnimation || 'Move';
            if (this.currentAnimation !== 'MoveLeft' && this.currentAnimation !== 'MoveRight' && this.currentAnimation !== moveAnimName) {
                this.stopMoving();
                return;
            }

            this.moveAnimationId = requestAnimationFrame(moveStep);
        };

        this.moveAnimationId = requestAnimationFrame(moveStep);
    }

    stopMoving() {
        if (this.moveAnimationId) {
            cancelAnimationFrame(this.moveAnimationId);
            this.moveAnimationId = null;
        }
    }

    playInteract(callback) {
        this.isUserInteracting = true;
        this.stopMoving();
        if (this.animationTimer) {
            clearTimeout(this.animationTimer);
            this.animationTimer = null;
        }

        const interactAnim = this.config.interactAnimation || 'Interact';
        this.playAnimation(interactAnim, false);

        const self = this;
        this.spine.state.addListener({
            complete: (trackEntry) => {
                if (trackEntry.animation.name === interactAnim) {
                    self.playAnimation('Relax', true);
                    self.isUserInteracting = false;
                    if (callback) callback();
                }
            }
        });
    }

    getBounds() {
        return this.spine ? this.spine.getBounds() : null;
    }

    isPointInside(x, y) {
        if (!this.spine || !this.isEnabled || !this.spine.visible) return false;
        const bounds = this.spine.getBounds();
        return x >= bounds.x && x <= bounds.x + bounds.width &&
               y >= bounds.y && y <= bounds.y + bounds.height;
    }

    setPosition(x, y) {
        if (this.spine) {
            this.spine.x = x;
            this.spine.y = y;
        }
    }

    constrainToScreen() {
        if (!this.spine) return;

        const bounds = this.spine.getBounds();
        
        if (bounds.x < 0) {
            this.spine.x -= bounds.x;
        }
        if (bounds.x + bounds.width > this.screenWidth) {
            this.spine.x -= (bounds.x + bounds.width - this.screenWidth);
        }
        if (bounds.y < 0) {
            this.spine.y -= bounds.y;
        }
        if (bounds.y + bounds.height > this.screenHeight) {
            this.spine.y -= (bounds.y + bounds.height - this.screenHeight);
        }
    }

    updateScreenSize(width, height) {
        this.screenWidth = width;
        this.screenHeight = height;
    }

    destroy() {
        this.stopMoving();
        if (this.animationTimer) {
            clearTimeout(this.animationTimer);
        }
        if (this.spine && this.app) {
            this.app.stage.removeChild(this.spine);
        }
        this.spine = null;
    }
}

module.exports = { CharacterBase };

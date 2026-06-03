    /**
 * Muelsyse Character
 * Handles Muelsyse character rendering, animation and movement
 */

const PIXI = require('pixi.js');
const { Spine, TextureAtlas, AtlasAttachmentLoader, SkeletonBinary } = require('@pixi-spine/all-3.8');
const fs = require('fs');
const path = require('path');
const { MUELSYSE_ANIMATIONS, MUELSYSE_SLEEP_ANIMATIONS } = require('./muelsyse-animations');
const { MODEL_WIDTH, MOVING_SPEED } = require('../../../scripts/shared/constants');

const MOVE_ANIMATION_NAME = 'Move';

class MuelsyseCharacter {
    constructor(options = {}) {
        this.app = options.app;
        this.modelPath = options.modelPath;
        this.modelName = options.modelName || 'build_char_249_mlyss';
        this.scale = options.scale || 0.4;
        this.screenWidth = options.screenWidth || 1920;
        this.screenHeight = options.screenHeight || 1080;
        
        this.spine = null;
        this.currentAnimation = null;
        this.moveDirection = 'right';
        this.moveAnimationId = null;
        this.animationTimer = null;
        this.lastFrameTime = 0;
        this.isVisible = false;
        this.isEnabled = false;
        this.isUserInteracting = false;
        
        this.onAnimationChange = options.onAnimationChange || (() => {});
        this.onPositionChange = options.onPositionChange || (() => {});
    }

    isSleepTime(date = new Date()) {
        const hour = date.getHours();
        return hour >= 23 || hour < 7;
    }

    getActiveAnimations() {
        return this.isSleepTime() ? MUELSYSE_SLEEP_ANIMATIONS : MUELSYSE_ANIMATIONS;
    }

    async load() {
        const skelPath = path.join(this.modelPath, `${this.modelName}.skel`);
        const atlasPath = path.join(this.modelPath, `${this.modelName}.atlas`);
        const pngPath = path.join(this.modelPath, `${this.modelName}.png`);

        if (!fs.existsSync(skelPath)) {
            console.error(`Muelsyse skeleton file not found: ${skelPath}`);
            return;
        }
        if (!fs.existsSync(atlasPath)) {
            console.error(`Muelsyse atlas file not found: ${atlasPath}`);
            return;
        }
        if (!fs.existsSync(pngPath)) {
            console.error(`Muelsyse texture file not found: ${pngPath}`);
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
            skeletonBinary.scale = this.scale;

            const skeletonDataParsed = skeletonBinary.readSkeletonData(new Uint8Array(skeletonData));

            this.spine = new Spine(skeletonDataParsed);

            this.spine.x = this.screenWidth / 2;
            this.spine.y = this.screenHeight - 80;

            this.spine.scale.set(1, 1);
            this.spine.visible = false;
            this.spine.interactive = true;
            this.spine.buttonMode = true;

            this.app.stage.addChild(this.spine);

            this.playAnimation(this.getDefaultIdleAnimation(), true);
            this.setDirection(this.moveDirection);

        } catch (error) {
            console.error(`Error loading Muelsyse model: ${error.message}`);
        }
    }

    show() {
        this.isVisible = true;
        this.isEnabled = true;
        if (this.spine) {
            this.spine.visible = true;
        }
        this.playAnimation(this.getDefaultIdleAnimation(), true);
        this.scheduleNextAnimation();
    }

    hide() {
        this.isVisible = false;
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

    playAnimation(name, loop = true) {
        if (!this.spine) return;

        let animationName = name;
        if (name === 'MoveLeft' || name === 'MoveRight') {
            animationName = MOVE_ANIMATION_NAME;
        }

        this.spine.state.setAnimation(0, animationName, loop);
        this.currentAnimation = name;
        this.onAnimationChange(name);
    }

    setDirection(dir) {
        this.moveDirection = dir;
        if (this.spine) {
            const scaleX = Math.abs(this.spine.scale.x);
            this.spine.scale.x = dir === 'left' ? -scaleX : scaleX;
        }
    }

    getDefaultIdleAnimation() {
        if (this.isSleepTime()) return 'Sleep';
        return Math.random() < 0.5 ? 'Relax' : 'Relax_Idle';
    }

    getNextAnimation(current) {
        const animations = this.getActiveAnimations();
        const transitions = animations[current];
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
                this.playAnimation(MOVE_ANIMATION_NAME, true);
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
            if (chatVisible || this.isUserInteracting || !this.isEnabled || !this.isVisible) {
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
                    this.handleEdgeCollision(chatVisible);
                }
            } else {
                this.spine.x -= movement;
                const newBounds = this.spine.getBounds();
                if (this.isAtLeftEdge(newBounds)) {
                    this.spine.x += Math.max(0, 0 - newBounds.x);
                    this.handleEdgeCollision(chatVisible);
                }
            }

            this.onPositionChange(this.spine.x, this.spine.y);

            if (this.currentAnimation !== 'MoveLeft' && this.currentAnimation !== 'MoveRight' && this.currentAnimation !== MOVE_ANIMATION_NAME) {
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

    isAtLeftEdge(bounds) {
        return bounds.x <= 0;
    }

    isAtRightEdge(bounds) {
        return bounds.x + bounds.width >= this.screenWidth;
    }

    handleEdgeCollision(chatVisible = false) {
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

    isPointInside(x, y) {
        if (!this.spine || !this.isVisible || !this.spine.visible) return false;
        const bounds = this.spine.getBounds();
        return x >= bounds.x && x <= bounds.x + bounds.width &&
               y >= bounds.y && y <= bounds.y + bounds.height;
    }

    getBounds() {
        return this.spine ? this.spine.getBounds() : null;
    }

    setPosition(x, y) {
        if (this.spine) {
            this.spine.x = x;
            this.spine.y = y;
        }
    }

    getPosition() {
        return this.spine ? { x: this.spine.x, y: this.spine.y } : { x: 0, y: 0 };
    }

    playInteract(callback) {
        this.isUserInteracting = true;
        this.stopMoving();
        if (this.animationTimer) {
            clearTimeout(this.animationTimer);
            this.animationTimer = null;
        }

        const interactAnim = 'Interact';
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
        if (this.spine) {
            this.app.stage.removeChild(this.spine);
            this.spine = null;
        }
    }
}

module.exports = { MuelsyseCharacter };

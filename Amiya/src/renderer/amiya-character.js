/**
 * Amiya Character
 * Handles Amiya character rendering, animation and movement
 */

const PIXI = require('pixi.js');
const { Spine, TextureAtlas, AtlasAttachmentLoader, SkeletonBinary } = require('@pixi-spine/all-3.8');
const fs = require('fs');
const path = require('path');
const { DAY_ANIMATIONS, SLEEP_ANIMATIONS } = require('./amiya-animations');
const { MODEL_WIDTH, MOVING_SPEED } = require('../../../scripts/shared/constants');

const MOVE_ANIMATION_NAME = 'Move';

class AmiyaCharacter {
    constructor(options = {}) {
        this.app = options.app;
        this.modelPath = options.modelPath;
        this.modelName = options.modelName;
        this.scale = options.scale || 0.4;
        this.screenWidth = options.screenWidth || 1920;
        this.screenHeight = options.screenHeight || 1080;
        
        this.spineAnimation = null;
        this.currentAnimation = null;
        this.moveDirection = 'right';
        this.moveAnimationId = null;
        this.animationTimer = null;
        this.lastFrameTime = 0;
        
        this.onAnimationChange = options.onAnimationChange || (() => {});
        this.onPositionChange = options.onPositionChange || (() => {});
    }

    async load() {
        const skelPath = path.join(this.modelPath, `${this.modelName}.skel`);
        const atlasPath = path.join(this.modelPath, `${this.modelName}.atlas`);
        const pngPath = path.join(this.modelPath, `${this.modelName}.png`);

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
            skeletonBinary.scale = this.scale;

            const skeletonDataParsed = skeletonBinary.readSkeletonData(new Uint8Array(skeletonData));

            this.spineAnimation = new Spine(skeletonDataParsed);

            this.spineAnimation.x = this.screenWidth / 2;
            this.spineAnimation.y = this.screenHeight - 80;

            this.spineAnimation.scale.set(1, 1);

            this.app.stage.addChild(this.spineAnimation);

            // Play default animation
            this.playAnimation(this.getDefaultIdleAnimation(), true);
            this.setDirection(this.moveDirection);

        } catch (error) {
            console.error(`Error loading Amiya model: ${error.message}`);
        }
    }

    playAnimation(name, loop = true) {
        if (!this.spineAnimation) return;

        let animationName = name;
        if (name === 'MoveLeft' || name === 'MoveRight') {
            animationName = MOVE_ANIMATION_NAME;
        }

        this.spineAnimation.state.setAnimation(0, animationName, loop);
        this.currentAnimation = name;
        this.onAnimationChange(name);
    }

    setDirection(dir) {
        this.moveDirection = dir;
        if (this.spineAnimation) {
            const scaleX = Math.abs(this.spineAnimation.scale.x);
            this.spineAnimation.scale.x = dir === 'left' ? -scaleX : scaleX;
        }
    }

    getDefaultIdleAnimation() {
        const hour = new Date().getHours();
        const isSleepTime = hour >= 23 || hour < 7;
        return isSleepTime ? 'Sleep' : 'Relax';
    }

    getActiveAnimationMatrix() {
        const hour = new Date().getHours();
        const isSleepTime = hour >= 23 || hour < 7;
        return isSleepTime ? SLEEP_ANIMATIONS : DAY_ANIMATIONS;
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

    scheduleNextAnimation(isChatVisible, isUserInteracting) {
        if (this.animationTimer) {
            clearTimeout(this.animationTimer);
        }

        if (isChatVisible) {
            return;
        }

        const duration = 3000 + Math.random() * 4000;
        this.animationTimer = setTimeout(() => {
            if (isChatVisible || isUserInteracting) {
                return;
            }

            const nextAnim = this.getNextAnimation(this.currentAnimation || 'Relax');

            if (nextAnim === 'MoveLeft') {
                this.setDirection('left');
                this.playAnimation('MoveLeft', true);
                this.startMoving(isChatVisible, isUserInteracting);
            } else if (nextAnim === 'MoveRight') {
                this.setDirection('right');
                this.playAnimation('MoveRight', true);
                this.startMoving(isChatVisible, isUserInteracting);
            } else {
                this.stopMoving();
                this.playAnimation(nextAnim, true);
            }

            this.scheduleNextAnimation(isChatVisible, isUserInteracting);
        }, duration);
    }

    startMoving(isChatVisible, isUserInteracting) {
        if (this.moveAnimationId) return;

        this.lastFrameTime = Date.now();

        const moveStep = () => {
            if (isChatVisible || isUserInteracting) {
                this.moveAnimationId = null;
                return;
            }

            const now = Date.now();
            const delta = (now - this.lastFrameTime) / 1000;
            this.lastFrameTime = now;

            const movement = MOVING_SPEED * delta;

            const bounds = this.spineAnimation.getBounds();
            if (this.moveDirection === 'right') {
                this.spineAnimation.x += movement;
                const newBounds = this.spineAnimation.getBounds();
                if (this.isAtRightEdge(newBounds)) {
                    this.spineAnimation.x -= Math.max(0, newBounds.x + newBounds.width - this.screenWidth);
                    this.handleEdgeCollision(isChatVisible);
                }
            } else {
                this.spineAnimation.x -= movement;
                const newBounds = this.spineAnimation.getBounds();
                if (this.isAtLeftEdge(newBounds)) {
                    this.spineAnimation.x += Math.max(0, 0 - newBounds.x);
                    this.handleEdgeCollision(isChatVisible);
                }
            }

            this.onPositionChange(this.spineAnimation.x, this.spineAnimation.y);

            if (this.currentAnimation !== 'MoveLeft' && this.currentAnimation !== 'MoveRight') {
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

    handleEdgeCollision(isChatVisible) {
        if (isChatVisible) {
            this.stopMoving();
            return;
        }

        const shouldRelax = Math.random() < 0.5;
        if (shouldRelax) {
            this.playAnimation(this.getDefaultIdleAnimation(), true);
            this.stopMoving();
            return;
        }

        const nextDirection = this.moveDirection === 'right' ? 'left' : 'right';
        this.setDirection(nextDirection);
        const nextAnimation = nextDirection === 'left' ? 'MoveLeft' : 'MoveRight';
        this.playAnimation(nextAnimation, true);
    }

    isPointIn(x, y) {
        if (!this.spineAnimation) return false;
        const bounds = this.spineAnimation.getBounds();
        return x >= bounds.x && x <= bounds.x + bounds.width &&
               y >= bounds.y && y <= bounds.y + bounds.height;
    }

    getBounds() {
        return this.spineAnimation ? this.spineAnimation.getBounds() : null;
    }

    setPosition(x, y) {
        if (this.spineAnimation) {
            this.spineAnimation.x = x;
            this.spineAnimation.y = y;
        }
    }

    getPosition() {
        return this.spineAnimation ? { x: this.spineAnimation.x, y: this.spineAnimation.y } : { x: 0, y: 0 };
    }

    destroy() {
        this.stopMoving();
        if (this.animationTimer) {
            clearTimeout(this.animationTimer);
        }
        if (this.spineAnimation) {
            this.app.stage.removeChild(this.spineAnimation);
            this.spineAnimation = null;
        }
    }
}

module.exports = { AmiyaCharacter };

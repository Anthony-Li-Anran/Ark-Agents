/**
 * Texas Character
 * Handles Texas character rendering, animation and movement
 */

const PIXI = require('pixi.js');
const { Spine, TextureAtlas, AtlasAttachmentLoader, SkeletonBinary } = require('@pixi-spine/all-3.8');
const fs = require('fs');
const path = require('path');
const { TEXAS_ANIMATIONS } = require('./texas-animations');
const { TEXAS_MODEL_WIDTH, MOVING_SPEED } = require('../../../scripts/shared/constants');

const MOVE_ANIMATION_NAME = 'Move';

class TexasCharacter {
    constructor(options = {}) {
        this.app = options.app;
        this.modelPath = options.modelPath;
        this.modelName = options.modelName;
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
        
        this.onAnimationChange = options.onAnimationChange || (() => {});
        this.onPositionChange = options.onPositionChange || (() => {});
    }

    async load() {
        const skelPath = path.join(this.modelPath, `${this.modelName}.skel`);
        const atlasPath = path.join(this.modelPath, `${this.modelName}.atlas`);
        const pngPath = path.join(this.modelPath, `${this.modelName}.png`);

        if (!fs.existsSync(skelPath)) {
            console.error(`Texas skeleton file not found: ${skelPath}`);
            return;
        }
        if (!fs.existsSync(atlasPath)) {
            console.error(`Texas atlas file not found: ${atlasPath}`);
            return;
        }
        if (!fs.existsSync(pngPath)) {
            console.error(`Texas texture file not found: ${pngPath}`);
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

            this.app.stage.addChild(this.spine);

            // Play default animation
            this.playAnimation(this.getDefaultIdleAnimation(), true);
            this.setDirection(this.moveDirection);

        } catch (error) {
            console.error(`Error loading Texas model: ${error.message}`);
        }
    }

    show() {
        this.isVisible = true;
        if (this.spine) {
            this.spine.visible = true;
        }
    }

    hide() {
        this.isVisible = false;
        if (this.spine) {
            this.spine.visible = false;
        }
        this.stopMoving();
    }

    playAnimation(name, loop = true) {
        if (!this.spine) return;

        let animationName = name;
        if (name === 'MoveLeft2' || name === 'MoveRight2') {
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
        return 'Relax2';
    }

    getNextAnimation(current) {
        const transitions = TEXAS_ANIMATIONS[current];
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
        // Auto-animation is disabled - Texas stays in Relax2 only
        // This matches the original renderer.js behavior
        return;
    }

    startMoving(isChatVisible, isUserInteracting) {
        if (this.moveAnimationId) return;

        this.lastFrameTime = Date.now();

        const moveStep = () => {
            if (isChatVisible || isUserInteracting || !this.isVisible) {
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
                    this.handleEdgeCollision(isChatVisible);
                }
            } else {
                this.spine.x -= movement;
                const newBounds = this.spine.getBounds();
                if (this.isAtLeftEdge(newBounds)) {
                    this.spine.x += Math.max(0, 0 - newBounds.x);
                    this.handleEdgeCollision(isChatVisible);
                }
            }

            this.onPositionChange(this.spine.x, this.spine.y);

            if (this.currentAnimation !== 'MoveLeft2' && this.currentAnimation !== 'MoveRight2') {
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
        const nextAnimation = nextDirection === 'left' ? 'MoveLeft2' : 'MoveRight2';
        this.playAnimation(nextAnimation, true);
    }

    isPointIn(x, y) {
        if (!this.spine || !this.isVisible) return false;
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

module.exports = { TexasCharacter };

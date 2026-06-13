/**
 * Svrash Character
 * Handles Svrash character rendering, animation and movement
 * Based on CharacterBase to ensure consistency with other operators
 */

const PIXI = require('pixi.js');
const { Spine, TextureAtlas, AtlasAttachmentLoader, SkeletonBinary } = require('@pixi-spine/all-3.8');
const fs = require('fs');
const path = require('path');
const { MOVING_SPEED } = require('../../../scripts/shared/constants');
const { normalizeAnimationKey, matchAnimationName } = require('../../../scripts/characters/animation-utils');

class SvrashCharacter {
    constructor(options = {}) {
        this.app = options.app;
        this.modelPath = options.modelPath;
        this.modelName = options.modelName;
        this.scale = options.scale || 0.4;
        this.screenWidth = options.screenWidth || 1920;
        this.screenHeight = options.screenHeight || 1080;
        this.startX = options.startX;
        this.startY = options.startY;

        this.spine = null;
        this.currentAnimation = null;
        this.moveDirection = 'right';
        this.moveAnimationId = null;
        this.animationTimer = null;
        this.lastFrameTime = 0;
        this.isVisible = false;
        this.isEnabled = false;
        this.isUserInteracting = false;
        this.availableAnimations = [];
        this.animationNameCache = new Map();
        this.characterId = 'svrash';

        this.onAnimationChange = options.onAnimationChange || (() => {});
        this.onPositionChange = options.onPositionChange || (() => {});
    }

    async load() {
        const skelPath = path.join(this.modelPath, `${this.modelName}.skel`);
        const atlasPath = path.join(this.modelPath, `${this.modelName}.atlas`);
        const pngPath = path.join(this.modelPath, `${this.modelName}.png`);

        if (!fs.existsSync(skelPath)) {
            console.error(`Svrash skeleton file not found: ${skelPath}`);
            return;
        }
        if (!fs.existsSync(atlasPath)) {
            console.error(`Svrash atlas file not found: ${atlasPath}`);
            return;
        }
        if (!fs.existsSync(pngPath)) {
            console.error(`Svrash texture file not found: ${pngPath}`);
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

            this.availableAnimations = this.getAvailableAnimationNames();
            this.animationNameCache = new Map();

            this.spine.x = this.startX || this.screenWidth / 2;
            this.spine.y = this.startY || this.screenHeight - 80;

            this.spine.scale.set(1, 1);
            this.spine.visible = false;

            this.app.stage.addChild(this.spine);

            // Play default animation
            this.playAnimation(this.getDefaultIdleAnimation(), true);
            this.setDirection(this.moveDirection);

        } catch (error) {
            console.error(`Error loading Svrash model: ${error.message}`);
        }
    }

    getAvailableAnimationNames() {
        if (!this.spine) return [];

        const skeletonData = this.spine.skeleton?.data || this.spine.skeletonData || this.spine.spineData;
        const animations = skeletonData?.animations;
        if (!animations) return [];

        if (Array.isArray(animations)) {
            return animations.map(anim => typeof anim === 'string' ? anim : anim.name).filter(Boolean);
        }

        return Object.keys(animations).filter(Boolean);
    }

    show() {
        if (this.spine) {
            this.spine.visible = true;
            this.isEnabled = true;
            this.isVisible = true;
            this.playAnimation(this.getDefaultIdleAnimation(), true);
            this.scheduleNextAnimation();
        }
    }

    hide() {
        this.isEnabled = false;
        this.isVisible = false;
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

        const canonicalName = this.getCanonicalAnimationKey(name);
        let animationName = this.resolveAnimationName(canonicalName);

        if (!animationName || animationName === canonicalName) {
            if (canonicalName === 'MoveLeft' || canonicalName === 'MoveRight' || canonicalName === 'Move') {
                animationName = this.resolveAnimationName('Move');
            }
        }

        this.spine.state.setAnimation(0, animationName, loop);
        this.currentAnimation = canonicalName;
        this.onAnimationChange(canonicalName);
    }

    getCanonicalAnimationKey(name) {
        return normalizeAnimationKey(name);
    }

    resolveAnimationName(name) {
        const canonicalName = this.getCanonicalAnimationKey(name);
        if (!Array.isArray(this.availableAnimations) || this.availableAnimations.length === 0) {
            return canonicalName;
        }

        if (this.animationNameCache.has(canonicalName)) {
            return this.animationNameCache.get(canonicalName);
        }

        let animationName = matchAnimationName(canonicalName, this.availableAnimations);
        if (!animationName && /^Move(?:Left|Right)$/i.test(canonicalName)) {
            animationName = matchAnimationName('Move', this.availableAnimations);
        }
        if (!animationName) {
            animationName = this.availableAnimations.find(anim => typeof anim === 'string' && anim.toLowerCase() === canonicalName.toLowerCase());
        }
        if (!animationName) {
            animationName = canonicalName;
        }

        this.animationNameCache.set(canonicalName, animationName);
        return animationName;
    }

    setDirection(dir) {
        this.moveDirection = dir;
        if (this.spine) {
            const scaleX = Math.abs(this.spine.scale.x);
            this.spine.scale.x = dir === 'left' ? -scaleX : scaleX;
        }
    }

    getDefaultIdleAnimation() {
        return 'Relax';
    }

    getNextAnimation(current) {
        const canonicalCurrent = this.getCanonicalAnimationKey(current || this.getDefaultIdleAnimation());
        const transitions = this.getActiveAnimationMatrix()[canonicalCurrent];
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

    getActiveAnimationMatrix() {
        return {
            'Relax': { next: ['MoveLeft', 'MoveRight', 'Sit'], weight: [0.3, 0.3, 0.4] },
            'Sit': { next: ['Relax', 'MoveLeft', 'MoveRight'], weight: [0.5, 0.25, 0.25] },
            'MoveLeft': { next: ['Relax', 'MoveRight', 'Sit'], weight: [0.4, 0.3, 0.3] },
            'MoveRight': { next: ['Relax', 'MoveLeft', 'Sit'], weight: [0.4, 0.3, 0.3] }
        };
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
                this.playAnimation('Move', true);
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

            this.onPositionChange(this.spine.x, this.spine.y);

            const moveAnimName = 'Move';
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

    playInteract(callback) {
        this.isUserInteracting = true;
        this.stopMoving();
        if (this.animationTimer) {
            clearTimeout(this.animationTimer);
            this.animationTimer = null;
        }

        const interactAnim = 'Interact';
        const actualInteractAnim = this.resolveAnimationName(interactAnim);
        this.playAnimation(interactAnim, false);

        const self = this;
        this.spine.state.addListener({
            complete: (trackEntry) => {
                if (trackEntry.animation.name === actualInteractAnim) {
                    self.playAnimation('Relax', true);
                    self.isUserInteracting = false;
                    if (callback) callback();
                }
            }
        });
    }

    isPointInside(x, y) {
        if (!this.spine || !this.isEnabled || !this.spine.visible) return false;
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

module.exports = { SvrashCharacter };

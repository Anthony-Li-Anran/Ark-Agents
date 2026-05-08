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
const { normalizeAnimationKey, matchAnimationName } = require(path.join(__dirname, 'animation-utils'));

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
        const folder = this.options.modelFolder || this.config.modelFolder;
        const candidatePaths = [];

        if (this.options.modelsBasePath) {
            candidatePaths.push(path.join(this.options.modelsBasePath, folder));
        }

        const projectModelsPath = path.join(characterBaseDir, '..', '..', 'Models', folder);
        const projectModelsPathLower = path.join(characterBaseDir, '..', '..', 'models', folder);
        candidatePaths.push(projectModelsPath, projectModelsPathLower);

        if (process && process.resourcesPath) {
            const resourcesPath = process.resourcesPath;
            candidatePaths.push(
                path.join(resourcesPath, 'app.asar', 'Models', folder),
                path.join(resourcesPath, 'app.asar', 'models', folder),
                path.join(resourcesPath, 'app.asar.unpacked', 'Models', folder),
                path.join(resourcesPath, 'app.asar.unpacked', 'models', folder),
                path.join(resourcesPath, 'Models', folder),
                path.join(resourcesPath, 'models', folder),
                path.join(resourcesPath, '..', 'resources', 'Models', folder),
                path.join(resourcesPath, '..', 'resources', 'models', folder)
            );
        }

        for (const candidate of candidatePaths) {
            if (fs.existsSync(candidate)) {
                console.log(`[CharacterBase] Resolved model folder: ${candidate}`);
                return candidate;
            }
        }

        console.warn(`[CharacterBase] No candidate model folder found. Returning default: ${projectModelsPath}`);
        return projectModelsPath;
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

    getModelName() {
        return this.options.modelName || this.config.modelName;
    }

    async load() {
        const modelPath = this.getModelPath();
        const modelName = this.getModelName();
        const skelPath = path.join(modelPath, `${modelName}.skel`);
        const atlasPath = path.join(modelPath, `${modelName}.atlas`);
        const pngPath = path.join(modelPath, `${modelName}.png`);

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
            this.availableAnimations = this.getAvailableAnimationNames();
            this.animationNameCache = new Map();
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

        const canonicalName = this.getCanonicalAnimationKey(name);
        let animationName = this.resolveAnimationName(canonicalName);

        if (!animationName || animationName === canonicalName) {
            if (canonicalName === 'MoveLeft' || canonicalName === 'MoveRight' || canonicalName === 'Move') {
                animationName = this.resolveAnimationName(this.config.moveAnimation || 'Move');
            }
        }

        this.spine.state.setAnimation(0, animationName, loop);
        this.currentAnimation = canonicalName;
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

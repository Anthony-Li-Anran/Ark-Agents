/**
 * Dialog Bubble Manager
 * Manages dialog bubble display, animations and visual effects
 */

class DialogBubbleManager {
    constructor(options = {}) {
        this.isBrowser = typeof document !== 'undefined';
        this.container = options.container || (this.isBrowser ? document.body : null);
        this.bubbles = new Map();
        this.typingSpeed = options.typingSpeed || 50;
        this.bubbleStyle = {
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            color: '#333333',
            borderRadius: '12px',
            padding: '12px 16px',
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            maxWidth: '280px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            position: 'absolute',
            zIndex: '10000',
            opacity: '0',
            transform: 'scale(0.8)',
            transition: 'opacity 0.3s ease, transform 0.3s ease',
            pointerEvents: 'none'
        };
        this.activeBubbles = [];
        this.operatorBubbleIds = new Map();
        this.listeners = new Map();
    }

    createBubble(operatorId, content, position) {
        const existingBubbleId = this.operatorBubbleIds.get(operatorId);
        if (existingBubbleId && this.bubbles.has(existingBubbleId)) {
            const existing = this.bubbles.get(existingBubbleId);
            existing.position = position;
            existing.content = content;
            return existing;
        }

        const bubbleId = `bubble_${operatorId}`;
        
        if (!this.isBrowser) {
            const bubble = {
                id: bubbleId,
                operatorId,
                element: null,
                contentElement: null,
                position,
                isVisible: false,
                isTyping: false
            };
            
            this.bubbles.set(bubbleId, bubble);
            this.operatorBubbleIds.set(operatorId, bubbleId);
            return bubble;
        }
        
        const bubbleElement = document.createElement('div');
        bubbleElement.id = bubbleId;
        bubbleElement.className = 'dialog-bubble';
        
        Object.assign(bubbleElement.style, this.bubbleStyle);
        
        const contentElement = document.createElement('div');
        contentElement.className = 'bubble-content';
        bubbleElement.appendChild(contentElement);
        
        const tailElement = document.createElement('div');
        tailElement.className = 'bubble-tail';
        tailElement.style.cssText = `
            position: absolute;
            bottom: -8px;
            width: 0;
            height: 0;
            border-left: 8px solid transparent;
            border-right: 8px solid transparent;
            border-top: 8px solid rgba(255, 255, 255, 0.95);
        `;
        bubbleElement.appendChild(tailElement);
        
        if (this.container) {
            this.container.appendChild(bubbleElement);
        }
        
        const bubble = {
            id: bubbleId,
            operatorId,
            element: bubbleElement,
            contentElement,
            position,
            isVisible: false,
            isTyping: false
        };
        
        this.bubbles.set(bubbleId, bubble);
        this.operatorBubbleIds.set(operatorId, bubbleId);
        
        return bubble;
    }

    showBubble(bubbleId, content, position, options = {}) {
        const bubble = this.bubbles.get(bubbleId);
        if (!bubble) return;

        if (position) {
            bubble.position = position;
        }

        if (!this.isBrowser) {
            bubble.isVisible = true;
            if (!this.activeBubbles.includes(bubbleId)) {
                this.activeBubbles.push(bubbleId);
            }
            this.emit('bubbleShown', { bubbleId, operatorId: bubble.operatorId });
            this.emit('typingComplete', { bubbleId });
            return;
        }

        this.positionBubble(bubble);
        
        if (options.typing !== false) {
            this.typeText(bubble, content, options.typingSpeed);
        } else {
            bubble.contentElement.textContent = content;
        }

        requestAnimationFrame(() => {
            bubble.element.style.opacity = '1';
            bubble.element.style.transform = 'scale(1)';
            bubble.isVisible = true;
            
            if (!this.activeBubbles.includes(bubbleId)) {
                this.activeBubbles.push(bubbleId);
            }
            
            this.emit('bubbleShown', { bubbleId, operatorId: bubble.operatorId });
        });
    }

    hideBubble(bubbleId, immediate = false) {
        const bubble = this.bubbles.get(bubbleId);
        if (!bubble) return;

        this.stopTyping(bubble);

        if (!bubble.isVisible) {
            if (this.isBrowser && bubble.element) {
                bubble.element.style.opacity = '0';
                bubble.element.style.transform = 'scale(0.8)';
            }
            return;
        }

        if (!this.isBrowser) {
            bubble.isVisible = false;
            const index = this.activeBubbles.indexOf(bubbleId);
            if (index > -1) {
                this.activeBubbles.splice(index, 1);
            }
            this.emit('bubbleHidden', { bubbleId, operatorId: bubble.operatorId });
            return;
        }

        if (immediate) {
            bubble.element.style.opacity = '0';
            bubble.element.style.transform = 'scale(0.8)';
            bubble.isVisible = false;
            
            const index = this.activeBubbles.indexOf(bubbleId);
            if (index > -1) {
                this.activeBubbles.splice(index, 1);
            }
            
            this.emit('bubbleHidden', { bubbleId, operatorId: bubble.operatorId });
        } else {
            bubble.element.style.opacity = '0';
            bubble.element.style.transform = 'scale(0.8)';
            
            setTimeout(() => {
                bubble.isVisible = false;
                
                const index = this.activeBubbles.indexOf(bubbleId);
                if (index > -1) {
                    this.activeBubbles.splice(index, 1);
                }
                
                this.emit('bubbleHidden', { bubbleId, operatorId: bubble.operatorId });
            }, 300);
        }
    }

    hideAllBubbles(immediate = false) {
        for (const bubbleId of this.bubbles.keys()) {
            this.hideBubble(bubbleId, immediate);
        }
    }

    positionBubble(bubble) {
        if (!this.isBrowser || !bubble.position) return;

        const { x, y, align = 'center' } = bubble.position;
        
        bubble.element.style.left = `${x}px`;
        bubble.element.style.top = `${y}px`;
        
        if (align === 'center') {
            bubble.element.style.transform = 'translateX(-50%)';
        } else if (align === 'right') {
            bubble.element.style.transform = 'translateX(-100%)';
        }
    }

    typeText(bubble, text, speed = this.typingSpeed) {
        if (!this.isBrowser) {
            this.emit('typingComplete', { bubbleId: bubble.id });
            return;
        }

        if (bubble.isTyping) {
            this.stopTyping(bubble);
        }

        bubble.isTyping = true;
        bubble.contentElement.textContent = '';
        
        let index = 0;
        bubble.typingTimer = setInterval(() => {
            if (!bubble.isTyping || index >= text.length) {
                this.stopTyping(bubble);
                bubble.isTyping = false;
                this.emit('typingComplete', { bubbleId: bubble.id });
                return;
            }

            bubble.contentElement.textContent += text[index];
            index++;
        }, speed);
    }

    stopTyping(bubble) {
        if (!bubble) return;
        bubble.isTyping = false;
        if (bubble.typingTimer) {
            clearInterval(bubble.typingTimer);
            bubble.typingTimer = null;
        }
    }

    updateBubblePosition(bubbleId, position) {
        const bubble = this.bubbles.get(bubbleId);
        if (!bubble) return;

        bubble.position = position;
        if (this.isBrowser) {
            this.positionBubble(bubble);
        }
    }

    removeBubble(bubbleId) {
        const bubble = this.bubbles.get(bubbleId);
        if (!bubble) return;

        if (this.isBrowser && bubble.element && bubble.element.parentNode) {
            bubble.element.parentNode.removeChild(bubble.element);
        }
        
        this.bubbles.delete(bubbleId);
        this.operatorBubbleIds.delete(bubble.operatorId);
        
        const index = this.activeBubbles.indexOf(bubbleId);
        if (index > -1) {
            this.activeBubbles.splice(index, 1);
        }
    }

    getActiveBubbles() {
        return this.activeBubbles.map(id => this.bubbles.get(id)).filter(Boolean);
    }

    setTypingSpeed(speed) {
        this.typingSpeed = Math.max(10, Math.min(200, speed));
    }

    setBubbleStyle(style) {
        Object.assign(this.bubbleStyle, style);
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    off(event, callback) {
        if (!this.listeners.has(event)) return;
        
        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
            callbacks.splice(index, 1);
        }
    }

    emit(event, data) {
        if (!this.listeners.has(event)) return;
        
        for (const callback of this.listeners.get(event)) {
            try {
                callback(data);
            } catch (error) {
                console.error(`[DialogBubbleManager] Error in listener for ${event}:`, error);
            }
        }
    }

    destroy() {
        this.hideAllBubbles(true);
        
        for (const [bubbleId, bubble] of this.bubbles) {
            if (this.isBrowser && bubble.element && bubble.element.parentNode) {
                bubble.element.parentNode.removeChild(bubble.element);
            }
        }
        
        this.bubbles.clear();
        this.activeBubbles = [];
        this.operatorBubbleIds.clear();
        this.listeners.clear();
    }
}

module.exports = { DialogBubbleManager };

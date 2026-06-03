/**
 * Selection Handler
 * Text selection detection and question panel management
 */

class SelectionHandler {
    constructor() {
        this.isEnabled = false;
        this.selectedText = '';
        this.selectionRange = null;
        this.onSelection = null;
    }

    enable() {
        this.isEnabled = true;
        document.addEventListener('mouseup', this.handleMouseUp);
        document.addEventListener('selectionchange', this.handleSelectionChange);
    }

    disable() {
        this.isEnabled = false;
        document.removeEventListener('mouseup', this.handleMouseUp);
        document.removeEventListener('selectionchange', this.handleSelectionChange);
        this.selectedText = '';
        this.selectionRange = null;
    }

    handleMouseUp = (event) => {
        if (!this.isEnabled) return;
        
        setTimeout(() => {
            const selection = window.getSelection();
            const text = selection.toString().trim();
            
            if (text.length >= 2 && text.length <= 1000) {
                this.selectedText = text;
                this.selectionRange = selection.getRangeAt(0).getBoundingClientRect();
                
                if (this.onSelection) {
                    this.onSelection({
                        text: this.selectedText,
                        rect: this.selectionRange,
                        x: event.clientX,
                        y: event.clientY
                    });
                }
            }
        }, 10);
    }

    handleSelectionChange = () => {
        const selection = window.getSelection();
        if (!selection.toString().trim()) {
            this.selectedText = '';
            this.selectionRange = null;
        }
    }

    getSelectedText() {
        return this.selectedText;
    }

    clearSelection() {
        window.getSelection().removeAllRanges();
        this.selectedText = '';
        this.selectionRange = null;
    }
}

module.exports = { SelectionHandler };

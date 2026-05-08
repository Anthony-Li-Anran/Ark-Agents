/**
 * Context Menu Module
 * Provides right-click context menu functionality
 */

let contextMenu = null;

function create() {
    if (contextMenu) return contextMenu;

    contextMenu = document.createElement('div');
    contextMenu.id = 'model-context-menu';
    Object.assign(contextMenu.style, {
        position: 'fixed',
        zIndex: '9999',
        display: 'none',
        flexDirection: 'column',
        width: '260px',
        backgroundColor: '#0d1117',
        justifyContent: 'center',
        borderRadius: '10px',
        transition: '1s',
        padding: '10px',
        overflow: 'hidden',
        fontFamily: 'Arial, sans-serif',
        userSelect: 'none',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
    });

    contextMenu.addEventListener('mouseover', (e) => {
        if (e.target.classList.contains('context-menu-item')) {
            const menuItems = contextMenu.querySelectorAll('.context-menu-item');
            menuItems.forEach(item => {
                if (item !== e.target) {
                    item.style.transition = '300ms';
                    item.style.filter = 'blur(1.5px)';
                    item.style.transform = 'scale(0.95, 0.95)';
                }
            });
        }
    });

    contextMenu.addEventListener('mouseout', () => {
        const menuItems = contextMenu.querySelectorAll('.context-menu-item');
        menuItems.forEach(item => {
            item.style.filter = 'none';
            item.style.transform = 'scale(1, 1)';
        });
    });

    document.body.appendChild(contextMenu);
    return contextMenu;
}

function renderMenu(options = {}) {
    const { items = [], onAction, customContent, contentBeforeItems = false } = options;

    contextMenu.innerHTML = '';

    if (customContent && contentBeforeItems) {
        const contentWrapper = document.createElement('div');
        contentWrapper.style.marginBottom = '10px';
        if (typeof customContent === 'string') {
            contentWrapper.innerHTML = customContent;
        } else if (customContent instanceof HTMLElement) {
            contentWrapper.appendChild(customContent);
        }
        contextMenu.appendChild(contentWrapper);
    }

    items.forEach((item, index) => {
        const row = document.createElement('button');
        row.className = 'context-menu-item';
        row.textContent = item.label;
        Object.assign(row.style, {
            fontSize: '15px',
            backgroundColor: 'transparent',
            border: '2px solid transparent',
            padding: '10px',
            color: 'white',
            display: 'flex',
            position: 'relative',
            gap: '5px',
            cursor: 'pointer',
            borderRadius: '10px',
            transition: '1s',
            boxSizing: 'border-box',
            textAlign: 'left',
            width: '100%',
            marginBottom: index < items.length - 1 ? '4px' : '0'
        });

        row.addEventListener('mouseenter', () => {
            row.style.border = '2px solid #1a1f24';
            row.style.color = '#637185';
        });
        row.addEventListener('mouseleave', () => {
            row.style.border = '2px solid transparent';
            row.style.color = 'white';
            row.style.backgroundColor = 'transparent';
            row.style.marginLeft = '0';
        });
        row.addEventListener('mousedown', () => {
            row.style.backgroundColor = '#1a1f24';
            row.style.outline = 'none';
            row.style.marginLeft = '17px';
        });
        row.addEventListener('click', () => {
            if (onAction) onAction(item.id);
        });
        row.dataset.actionId = item.id;
        contextMenu.appendChild(row);
    });

    if (customContent && !contentBeforeItems) {
        const contentWrapper = document.createElement('div');
        contentWrapper.style.marginTop = '10px';
        if (typeof customContent === 'string') {
            contentWrapper.innerHTML = customContent;
        } else if (customContent instanceof HTMLElement) {
            contentWrapper.appendChild(customContent);
        }
        contextMenu.appendChild(contentWrapper);
    }
}

function show(x, y, options = {}) {
    const { screenWidth, screenHeight, bounds } = options;

    create();
    renderMenu(options);

    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${Math.max(10, y)}px`;
    contextMenu.style.display = 'flex';

    const rect = contextMenu.getBoundingClientRect();
    if (rect.right > screenWidth && bounds) {
        contextMenu.style.left = `${Math.max(10, bounds.x - rect.width - 10)}px`;
    }
    if (rect.bottom > screenHeight) {
        contextMenu.style.top = `${Math.max(10, screenHeight - rect.height - 10)}px`;
    }
}

function hide() {
    if (contextMenu) {
        contextMenu.style.display = 'none';
    }
}

function isVisible() {
    return contextMenu && contextMenu.style.display !== 'none';
}

function getElement() {
    return contextMenu;
}

module.exports = {
    create,
    show,
    hide,
    isVisible,
    getElement
};

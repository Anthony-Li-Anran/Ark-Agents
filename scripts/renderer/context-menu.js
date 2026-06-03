/**
 * Context Menu Module
 * Provides right-click context menu functionality
 */

let contextMenu = null;
let activeSubmenu = null;
let currentOptions = null;

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

function createMenuItem(item, index, totalCount, onAction, isSubmenu = false, hasChildren = false) {
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
        marginBottom: index < totalCount - 1 ? '4px' : '0',
        paddingLeft: isSubmenu ? '24px' : '10px',
        justifyContent: 'space-between',
        alignItems: 'center'
    });

    if (hasChildren) {
        const arrow = document.createElement('span');
        arrow.textContent = '›';
        arrow.style.marginLeft = 'auto';
        arrow.style.fontSize = '18px';
        arrow.style.opacity = '0.6';
        row.appendChild(arrow);
    }

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
    });
    row.addEventListener('click', () => {
        if (onAction) onAction(item.id);
    });
    row.dataset.actionId = item.id;
    return row;
}

function renderMenu(options = {}) {
    const { items = [], onAction, customContent, contentBeforeItems = false } = options;
    currentOptions = options;

    contextMenu.innerHTML = '';
    activeSubmenu = null;

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
        const row = createMenuItem(item, index, items.length, onAction, false, Boolean(item.children));
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

function showSubmenu(parentItem, submenuItems, onAction) {
    hideSubmenu();

    const parentBtn = contextMenu.querySelector(`[data-action-id="${parentItem.id}"]`);
    if (!parentBtn) return;

    activeSubmenu = document.createElement('div');
    activeSubmenu.id = 'context-submenu';
    Object.assign(activeSubmenu.style, {
        position: 'fixed',
        zIndex: '10000',
        display: 'flex',
        flexDirection: 'column',
        width: '240px',
        backgroundColor: '#0d1117',
        borderRadius: '10px',
        padding: '10px',
        fontFamily: 'Arial, sans-serif',
        userSelect: 'none',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
    });

    submenuItems.forEach((item, index) => {
        const row = createMenuItem(item, index, submenuItems.length, onAction, true);
        activeSubmenu.appendChild(row);
    });

    document.body.appendChild(activeSubmenu);

    const parentRect = parentBtn.getBoundingClientRect();
    const menuRect = contextMenu.getBoundingClientRect();
    const submenuRect = activeSubmenu.getBoundingClientRect();

    let left = menuRect.right + 8;
    let top = parentRect.top;

    if (left + submenuRect.width > window.innerWidth) {
        left = menuRect.left - submenuRect.width - 8;
    }
    if (top + submenuRect.height > window.innerHeight) {
        top = window.innerHeight - submenuRect.height - 10;
    }

    activeSubmenu.style.left = `${Math.max(10, left)}px`;
    activeSubmenu.style.top = `${Math.max(10, top)}px`;
}

function hideSubmenu() {
    if (activeSubmenu) {
        activeSubmenu.remove();
        activeSubmenu = null;
    }
}

function isSubmenuVisible() {
    return activeSubmenu !== null;
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
    hideSubmenu();
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
    getElement,
    showSubmenu,
    hideSubmenu,
    isSubmenuVisible
};

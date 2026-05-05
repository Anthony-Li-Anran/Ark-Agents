/**
 * Operator Panel Module
 * Provides operator selection panel functionality
 */

let panel = null;

function create(operators, onToggle) {
    if (panel) return panel;

    panel = document.createElement('div');
    panel.className = 'operator-panel';
    panel.innerHTML = `
        <div class="card">
            <div class="content">
                <form class="my-form">
                    ${operators.map(op => `
                        <div>
                            <input type="checkbox" id="operator-${op.id}" name="operator" value="${op.id}" ${op.checked ? 'checked' : ''}>
                            <label for="operator-${op.id}">${op.name}</label>
                        </div>
                    `).join('')}
                </form>
                <div class="operator-card-actions">
                    <button type="button" class="operator-exit-btn">Exit</button>
                </div>
            </div>
        </div>
    `;

    operators.forEach(op => {
        const checkbox = panel.querySelector(`#operator-${op.id}`);
        checkbox.addEventListener('change', (e) => {
            if (onToggle) onToggle(op.id, e.target.checked);
        });
    });

    const exitButton = panel.querySelector('.operator-exit-btn');
    exitButton.addEventListener('click', hide);

    panel.addEventListener('mousedown', (e) => e.stopPropagation());
    panel.addEventListener('click', (e) => e.stopPropagation());

    document.body.appendChild(panel);
    return panel;
}

function show(options = {}) {
    const { operators, onToggle, position, screenWidth, screenHeight } = options;

    if (!panel && operators) {
        create(operators, onToggle);
    }

    if (position) {
        let left = position.right + 12;
        let top = position.top;

        panel.classList.add('visible');
        const rect = panel.getBoundingClientRect();

        if (left + rect.width > screenWidth - 10) {
            left = Math.max(10, position.left - rect.width - 12);
        }
        if (top + rect.height > screenHeight - 10) {
            top = Math.max(10, screenHeight - rect.height - 10);
        }

        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
    } else {
        panel.classList.add('visible');
    }
}

function hide() {
    if (panel) {
        panel.classList.remove('visible');
    }
}

function isVisible() {
    return panel && panel.classList.contains('visible');
}

function setSelectedOperator(operatorId, checked) {
    if (!panel) return;
    const checkbox = panel.querySelector(`#operator-${operatorId}`);
    if (checkbox) checkbox.checked = checked;
}

module.exports = {
    create,
    show,
    hide,
    isVisible,
    setSelectedOperator
};

import { fetchCartridges } from './api.js';

function dotClass(type) {
    if (type === 'py') return 'dot-py';
    if (type === 'pine') return 'dot-pine';
    if (type === 'mq4') return 'dot-mq4';
    if (type === 'mq5') return 'dot-mq5';
    return 'dot-py';
}

function groupLabel(cartridge) {
    if (cartridge.defaults) return 'GAME MODES';
    if (cartridge.type === 'py') return 'CLASSIC CARTRIDGES';
    return 'SCRIPT FORMATS';
}

function isDefaultExpanded(title) {
    return title === 'GAME MODES';
}

function appendGroup(list, title, cartridges, onCartridgeSelected) {
    if (!cartridges.length) {
        return;
    }

    const group = document.createElement('section');
    group.className = 'cartridge-group';
    const expanded = isDefaultExpanded(title);
    group.dataset.expanded = expanded ? 'true' : 'false';

    const heading = document.createElement('button');
    heading.type = 'button';
    heading.className = 'cartridge-group-title';
    heading.innerHTML = `
        <span>${title}</span>
        <span class="cartridge-group-toggle">${expanded ? '−' : '+'}</span>
    `;
    heading.addEventListener('click', () => {
        const nextExpanded = group.dataset.expanded !== 'true';
        group.dataset.expanded = nextExpanded ? 'true' : 'false';
        heading.querySelector('.cartridge-group-toggle').textContent = nextExpanded ? '−' : '+';
    });
    group.appendChild(heading);

    const body = document.createElement('div');
    body.className = 'cartridge-group-body';

    cartridges.forEach((cartridge) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'cartridge-item';
        item.draggable = true;
        const label = cartridge.title || cartridge.name;
        const meta = cartridge.theme || `${cartridge.type.toUpperCase()} CARTRIDGE`;
        const metaClass = cartridge.theme ? 'cartridge-meta' : 'cartridge-meta cartridge-meta-muted';
        item.innerHTML = `
            <span class="cartridge-dot ${dotClass(cartridge.type)}"></span>
            <span class="cartridge-copy">
                <span class="cartridge-name">${label}</span>
                <span class="${metaClass}">${meta}</span>
            </span>
        `;
        item.addEventListener('click', () => onCartridgeSelected(cartridge));
        item.addEventListener('dragstart', (event) => {
            event.dataTransfer.effectAllowed = 'copy';
            event.dataTransfer.setData('application/x-cartridgelab', JSON.stringify(cartridge));
            document.body.classList.add('console-drop-armed');
        });
        item.addEventListener('dragend', () => {
            document.body.classList.remove('console-drop-armed');
        });
        body.appendChild(item);
    });

    group.appendChild(body);
    list.appendChild(group);
}

export async function initMenu(onCartridgeSelected) {
    const list = document.getElementById('cartridge-list');
    if (!list) {
        return;
    }

    list.innerHTML = '';

    try {
        const cartridges = await fetchCartridges();
        const groups = new Map();
        cartridges.forEach((cartridge) => {
            const key = groupLabel(cartridge);
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key).push(cartridge);
        });

        ['GAME MODES', 'CLASSIC CARTRIDGES', 'SCRIPT FORMATS'].forEach((key) => {
            appendGroup(list, key, groups.get(key) || [], onCartridgeSelected);
        });
    } catch (error) {
        const item = document.createElement('div');
        item.className = 'cartridge-item';
        item.textContent = 'Sample cartridges unavailable';
        list.appendChild(item);
    }
}

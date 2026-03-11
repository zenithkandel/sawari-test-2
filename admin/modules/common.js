const API = '../../backend/handlers/api.php';

function byId(id) {
    return document.getElementById(id);
}

async function api(type, method = 'GET', body = null, query = '') {
    const url = `${API}?type=${type}${query}`;
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    return (await fetch(url, opts)).json();
}

function toast(msg) {
    const wrap = byId('toast-wrap');
    if (!wrap) return;
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(() => t.remove(), 2200);
}

function escapeHtml(v) {
    return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function closeModal(backdrop) {
    if (backdrop?.parentNode) backdrop.parentNode.removeChild(backdrop);
}

function buildModal({ title, body, actions }) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
        <div class="modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
            <div class="modal-head">${escapeHtml(title)}</div>
            <div class="modal-body"></div>
            <div class="modal-actions"></div>
        </div>
    `;
    const bodyNode = backdrop.querySelector('.modal-body');
    const actionsNode = backdrop.querySelector('.modal-actions');
    if (typeof body === 'string') bodyNode.innerHTML = body;
    else if (body instanceof Node) bodyNode.appendChild(body);
    actions.forEach((btn) => actionsNode.appendChild(btn));
    document.body.appendChild(backdrop);
    return backdrop;
}

function confirmModal({ title = 'Confirm Action', message = 'Are you sure?', okText = 'Confirm', tone = 'primary' } = {}) {
    return new Promise((resolve) => {
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'ghost';
        cancelBtn.textContent = 'Cancel';

        const okBtn = document.createElement('button');
        okBtn.className = tone === 'warn' ? 'warn' : 'primary';
        okBtn.textContent = okText;

        const backdrop = buildModal({
            title,
            body: `<p>${escapeHtml(message)}</p>`,
            actions: [cancelBtn, okBtn],
        });

        cancelBtn.addEventListener('click', () => {
            closeModal(backdrop);
            resolve(false);
        });
        okBtn.addEventListener('click', () => {
            closeModal(backdrop);
            resolve(true);
        });
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                closeModal(backdrop);
                resolve(false);
            }
        });
    });
}

function textPromptModal({ title = 'Edit Value', label = 'Value', initialValue = '', placeholder = '', okText = 'Save' } = {}) {
    return new Promise((resolve) => {
        const wrap = document.createElement('div');
        const field = document.createElement('input');
        field.placeholder = placeholder;
        field.value = initialValue;
        wrap.innerHTML = `<label>${escapeHtml(label)}</label>`;
        wrap.appendChild(field);

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'ghost';
        cancelBtn.textContent = 'Cancel';

        const okBtn = document.createElement('button');
        okBtn.className = 'primary';
        okBtn.textContent = okText;

        const backdrop = buildModal({ title, body: wrap, actions: [cancelBtn, okBtn] });

        const submit = () => {
            const value = field.value.trim();
            if (!value) {
                field.focus();
                return;
            }
            closeModal(backdrop);
            resolve(value);
        };

        setTimeout(() => field.focus(), 0);
        field.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') {
                closeModal(backdrop);
                resolve(null);
            }
        });
        cancelBtn.addEventListener('click', () => {
            closeModal(backdrop);
            resolve(null);
        });
        okBtn.addEventListener('click', submit);
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                closeModal(backdrop);
                resolve(null);
            }
        });
    });
}

// ============================================================
// Sawari Admin - Notifications Component
// Author: Zenith Kandel — https://zenithkandel.com.np
// License: MIT
// ============================================================
const Notifications = (() => {
    const container = document.getElementById('toast-container');
    const statusSync = document.getElementById('status-sync');
    const statusActions = document.getElementById('status-actions');

    function toast(message, type = 'info') {
        const icons = { success: 'fa-check-circle', error: 'fa-circle-xmark', warn: 'fa-triangle-exclamation', info: 'fa-circle-info' };
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i> ${escapeHtml(message)}`;
        container.appendChild(el);

        setTimeout(() => {
            el.style.opacity = '0';
            el.style.transform = 'translateX(20px)';
            setTimeout(() => el.remove(), 200);
        }, 3000);
    }

    function setSyncing() {
        statusSync.className = 'status-sync saving';
        statusSync.innerHTML = '<i class="fa-solid fa-circle"></i> Saving...';
    }

    function setSynced() {
        statusSync.className = 'status-sync synced';
        statusSync.innerHTML = '<i class="fa-solid fa-circle"></i> Synced';
    }

    function setError() {
        statusSync.className = 'status-sync error';
        statusSync.innerHTML = '<i class="fa-solid fa-circle"></i> Error';
    }

    function addAction(text) {
        const el = document.createElement('span');
        el.className = 'status-action';
        el.textContent = text;
        statusActions.appendChild(el);
        // Keep only last 3
        while (statusActions.children.length > 3) {
            statusActions.firstChild.remove();
        }
    }

    function escapeHtml(str) {
        return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    // Listen for actions to show in status bar
    Store.on('entity:created', ({ type, item }) => addAction(`+ ${type.replace(/s$/, '')}: ${item.name}`));
    Store.on('entity:updated', ({ type, item }) => addAction(`~ ${type.replace(/s$/, '')}: ${item?.name || ''}`));
    Store.on('entity:deleted', ({ type, item }) => addAction(`- ${type.replace(/s$/, '')}: ${item?.name || ''}`));

    return { toast, setSyncing, setSynced, setError, addAction };
})();

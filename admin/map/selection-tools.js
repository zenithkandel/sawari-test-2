// ============================================================
// Sawari Admin - Selection Tools & Context Menus
// Author: Zenith Kandel — https://zenithkandel.com.np
// License: MIT
// ============================================================
const SelectionTools = (() => {
    const ctxMenu = document.getElementById('context-menu');

    function init() {
        // Close context menu on any click
        document.addEventListener('click', () => hideContextMenu());
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') hideContextMenu();
        });

        // Map right-click on empty space
        Store.on('map:contextmenu', ({ latlng, originalEvent }) => {
            const state = Store.get();
            if (state.mode === 'select') {
                showMapContextMenu(originalEvent, latlng);
            }
        });
    }

    function showContextMenu(event, type, id) {
        const entity = Store.findEntity(type, id);
        if (!entity) return;

        Store.select(type, id);

        const items = [];

        // Common actions
        items.push({ label: 'Inspect', icon: 'fa-eye', action: () => { Store.select(type, id); } });
        items.push({ label: 'Pan To', icon: 'fa-crosshairs', action: () => LayerManager.panToEntity(type, id) });
        items.push({ divider: true });

        // Type-specific actions
        if (type === 'stops') {
            items.push({ label: 'Edit Name', icon: 'fa-pen', action: () => editStopInline(id) });
            items.push({ divider: true });
            items.push({ label: 'Delete Stop', icon: 'fa-trash', className: 'danger', action: () => confirmDelete(type, id), hotkey: 'Del' });
        }
        if (type === 'routes') {
            items.push({ label: 'Edit Route', icon: 'fa-pen', action: () => Store.select(type, id) });
            items.push({ divider: true });
            items.push({ label: 'Delete Route', icon: 'fa-trash', className: 'danger', action: () => confirmDelete(type, id), hotkey: 'Del' });
        }
        if (type === 'vehicles') {
            items.push({ label: `${entity.moving ? 'Stop' : 'Start'} Moving`, icon: entity.moving ? 'fa-pause' : 'fa-play', action: () => Commands.updateVehicle(id, { moving: !entity.moving }) });
            items.push({ divider: true });
            items.push({ label: 'Delete Vehicle', icon: 'fa-trash', className: 'danger', action: () => confirmDelete(type, id), hotkey: 'Del' });
        }
        if (type === 'obstructions') {
            items.push({ label: `${entity.active ? 'Deactivate' : 'Activate'}`, icon: entity.active ? 'fa-toggle-off' : 'fa-toggle-on', action: () => Commands.updateObstruction(id, { active: !entity.active }) });
            items.push({ divider: true });
            items.push({ label: 'Delete Obstruction', icon: 'fa-trash', className: 'danger', action: () => confirmDelete(type, id), hotkey: 'Del' });
        }

        renderContextMenu(event, items);
    }

    function showMapContextMenu(event, latlng) {
        const items = [
            { label: 'Add Stop Here', icon: 'fa-location-dot', action: () => { Store.setMode('add', 'stop'); Store.emit('map:click', { latlng }); } },
            { label: 'Add Vehicle Here', icon: 'fa-bus', action: () => { Store.setMode('add', 'vehicle'); Store.emit('map:click', { latlng }); } },
            { label: 'Add Obstruction Here', icon: 'fa-triangle-exclamation', action: () => { Store.setMode('add', 'obstruction'); Store.emit('map:click', { latlng }); } },
            { divider: true },
            { label: `Coords: ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`, icon: 'fa-map-pin', action: () => navigator.clipboard?.writeText(`${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`) },
        ];
        renderContextMenu(event, items);
    }

    function renderContextMenu(event, items) {
        ctxMenu.innerHTML = '';
        items.forEach(item => {
            if (item.divider) {
                ctxMenu.insertAdjacentHTML('beforeend', '<div class="ctx-divider"></div>');
                return;
            }
            const btn = document.createElement('button');
            btn.className = `ctx-item${item.className ? ' ' + item.className : ''}`;
            btn.innerHTML = `<i class="fa-solid ${item.icon}"></i><span>${item.label}</span>${item.hotkey ? `<span class="ctx-hotkey">${item.hotkey}</span>` : ''}`;
            btn.onclick = () => { hideContextMenu(); item.action(); };
            ctxMenu.appendChild(btn);
        });

        // Position
        const x = Math.min(event.clientX, window.innerWidth - 200);
        const y = Math.min(event.clientY, window.innerHeight - items.length * 36);
        ctxMenu.style.left = x + 'px';
        ctxMenu.style.top = y + 'px';
        ctxMenu.style.display = 'block';
    }

    function hideContextMenu() {
        ctxMenu.style.display = 'none';
    }

    async function confirmDelete(type, id) {
        const entity = Store.findEntity(type, id);
        if (!entity) return;

        const backdrop = document.getElementById('confirm-backdrop');
        const title = document.getElementById('confirm-title');
        const message = document.getElementById('confirm-message');
        const deps = document.getElementById('confirm-deps');
        const cancelBtn = document.getElementById('confirm-cancel');
        const okBtn = document.getElementById('confirm-ok');
        const forceBtn = document.getElementById('confirm-force');

        const typeLabel = type.replace(/s$/, '');
        title.textContent = `Delete ${typeLabel}?`;
        message.textContent = `Are you sure you want to delete "${entity.name}"? This action cannot be undone.`;
        deps.innerHTML = '';
        forceBtn.style.display = 'none';

        // Check dependencies
        if (type === 'stops' || type === 'routes') {
            try {
                const depCheck = await ApiClient.checkDeps(type, id);
                if (!depCheck.canDelete) {
                    message.textContent = depCheck.message;
                    deps.innerHTML = depCheck.dependencies.map(d =>
                        `<div class="dep-item"><i class="fa-solid fa-link"></i> ${d.type}: ${d.name}</div>`
                    ).join('');
                    forceBtn.style.display = '';
                    okBtn.style.display = 'none';
                } else {
                    okBtn.style.display = '';
                }
            } catch (e) {
                okBtn.style.display = '';
            }
        } else {
            okBtn.style.display = '';
        }

        backdrop.style.display = 'flex';

        return new Promise((resolve) => {
            const cleanup = () => {
                backdrop.style.display = 'none';
                cancelBtn.onclick = null;
                okBtn.onclick = null;
                forceBtn.onclick = null;
            };

            cancelBtn.onclick = () => { cleanup(); resolve(false); };

            okBtn.onclick = async () => {
                cleanup();
                const deleteFn = {
                    stops: Commands.deleteStop,
                    routes: Commands.deleteRoute,
                    vehicles: Commands.deleteVehicle,
                    obstructions: Commands.deleteObstruction,
                }[type];
                if (deleteFn) await deleteFn(id);
                resolve(true);
            };

            forceBtn.onclick = async () => {
                cleanup();
                const deleteFn = {
                    stops: (id) => Commands.deleteStop(id, true),
                    routes: (id) => Commands.deleteRoute(id, true),
                }[type];
                if (deleteFn) await deleteFn(id);
                resolve(true);
            };

            backdrop.onclick = (e) => {
                if (e.target === backdrop) { cleanup(); resolve(false); }
            };
        });
    }

    function editStopInline(id) {
        // Just open inspector where editing will happen
        Store.select('stops', id);
    }

    return { init, showContextMenu, confirmDelete };
})();

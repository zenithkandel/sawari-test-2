// ============================================================
// Sawari Admin - Command Bar Component
// ============================================================
const CommandBar = (() => {
    function init() {
        // Tool mode buttons
        document.querySelectorAll('#tool-mode-group .cb-tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                Store.setMode(mode, mode === 'add' ? 'stop' : null);
            });
        });

        // Entity type buttons
        document.querySelectorAll('#add-entity-group .cb-entity-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.cb-entity-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                Store.setMode('add', btn.dataset.entity);
            });
        });

        // Search button
        document.getElementById('btn-search').addEventListener('click', openSearch);

        // Undo/Redo
        document.getElementById('btn-undo').addEventListener('click', () => History.undo());
        document.getElementById('btn-redo').addEventListener('click', () => History.redo());

        // Delete
        document.getElementById('btn-delete').addEventListener('click', () => {
            const sel = Store.get('selected');
            if (sel) SelectionTools.confirmDelete(sel.type, sel.id);
        });

        // Sidebar toggle
        document.getElementById('btn-sidebar-toggle').addEventListener('click', () => {
            const panel = document.getElementById('layer-panel');
            panel.classList.toggle('open');
        });

        // React to mode changes
        Store.on('mode', ({ mode, addEntity }) => {
            document.querySelectorAll('#tool-mode-group .cb-tool-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.mode === mode);
            });

            const entityGroup = document.getElementById('add-entity-group');
            const searchBtn = document.getElementById('btn-search');

            if (mode === 'add') {
                entityGroup.style.display = 'flex';
                searchBtn.style.display = 'none';
                // Default to first entity if none selected
                if (addEntity) {
                    document.querySelectorAll('.cb-entity-btn').forEach(b =>
                        b.classList.toggle('active', b.dataset.entity === addEntity)
                    );
                }
            } else {
                entityGroup.style.display = 'none';
                searchBtn.style.display = 'flex';
            }

            // Update status bar mode indicator
            const statusMode = document.getElementById('status-mode');
            if (mode === 'add') {
                const labels = { stop: 'Add Stop', route: 'Build Route', vehicle: 'Add Vehicle', obstruction: 'Add Obstruction' };
                statusMode.innerHTML = `<i class="fa-solid fa-plus"></i> ${labels[addEntity] || 'Add Mode'}`;
            } else {
                statusMode.innerHTML = `<i class="fa-solid fa-arrow-pointer"></i> Select Mode`;
            }
        });

        // React to selection changes
        Store.on('selection', ({ current }) => {
            document.getElementById('btn-delete').disabled = !current;
        });

        // React to history changes
        Store.on('history', ({ canUndo, canRedo }) => {
            document.getElementById('btn-undo').disabled = !canUndo;
            document.getElementById('btn-redo').disabled = !canRedo;
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ignore if inside input/select/textarea
            if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

            if (e.key === 'v' || e.key === 'V') { Store.setMode('select'); }
            if (e.key === 'a' || e.key === 'A') { Store.setMode('add', Store.get('addEntity') || 'stop'); }

            // Add entity shortcuts (only in add mode)
            if (Store.get('mode') === 'add') {
                if (e.key === 's') Store.setMode('add', 'stop');
                if (e.key === 'r') Store.setMode('add', 'route');
                if (e.key === 'w') Store.setMode('add', 'vehicle');
                if (e.key === 'o') Store.setMode('add', 'obstruction');
            }

            // Delete
            if (e.key === 'Delete' || e.key === 'Backspace') {
                const sel = Store.get('selected');
                if (sel) { e.preventDefault(); SelectionTools.confirmDelete(sel.type, sel.id); }
            }

            // Undo/Redo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); History.undo(); }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); History.redo(); }

            // Search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openSearch(); }

            // Toggle sidebar
            if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); document.getElementById('layer-panel').classList.toggle('open'); }

            // Escape
            if (e.key === 'Escape') {
                const routeBuilder = Store.get('routeBuilder');
                if (routeBuilder.active) {
                    RoutesFeature.cancelRouteBuilder();
                    Store.setMode('select');
                } else if (Store.get('mode') === 'add') {
                    Store.setMode('select');
                } else {
                    Store.deselect();
                }
            }
        });
    }

    function openSearch() {
        const modal = document.getElementById('search-modal');
        const input = document.getElementById('search-input');
        const results = document.getElementById('search-results');

        modal.style.display = 'flex';
        input.value = '';
        results.innerHTML = '';
        setTimeout(() => input.focus(), 50);

        let focusIdx = -1;

        input.oninput = () => {
            const items = Store.search(input.value);
            focusIdx = -1;
            results.innerHTML = items.map((item, i) => `
                <div class="search-result-item" data-type="${item.type}" data-id="${item.id}" data-idx="${i}">
                    <i class="fa-solid ${item.icon}"></i>
                    <span class="sr-name">${escapeHtml(item.name)}</span>
                    <span class="sr-type">${item.type.replace(/s$/, '')}</span>
                </div>
            `).join('');

            results.querySelectorAll('.search-result-item').forEach(el => {
                el.onclick = () => selectSearchResult(el.dataset.type, parseInt(el.dataset.id));
            });
        };

        input.onkeydown = (e) => {
            const items = results.querySelectorAll('.search-result-item');
            if (e.key === 'ArrowDown') { e.preventDefault(); focusIdx = Math.min(focusIdx + 1, items.length - 1); updateFocus(items, focusIdx); }
            if (e.key === 'ArrowUp') { e.preventDefault(); focusIdx = Math.max(focusIdx - 1, 0); updateFocus(items, focusIdx); }
            if (e.key === 'Enter' && focusIdx >= 0 && items[focusIdx]) {
                selectSearchResult(items[focusIdx].dataset.type, parseInt(items[focusIdx].dataset.id));
            }
            if (e.key === 'Escape') closeSearch();
        };

        modal.onclick = (e) => { if (e.target === modal) closeSearch(); };
    }

    function updateFocus(items, idx) {
        items.forEach((el, i) => el.classList.toggle('focused', i === idx));
    }

    function selectSearchResult(type, id) {
        closeSearch();
        Store.select(type, id);
        LayerManager.panToEntity(type, id);
    }

    function closeSearch() {
        document.getElementById('search-modal').style.display = 'none';
    }

    function escapeHtml(str) {
        return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    return { init, openSearch };
})();

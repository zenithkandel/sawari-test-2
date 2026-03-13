// ============================================================
// Sawari Admin - Inspector Panel Component
// ============================================================
const Inspector = (() => {
    const panel = document.getElementById('inspector-panel');
    const title = document.getElementById('inspector-title');
    const body = document.getElementById('inspector-body');
    const closeBtn = document.getElementById('btn-close-inspector');

    function init() {
        closeBtn.addEventListener('click', () => {
            Store.deselect();
        });

        Store.on('selection', ({ current }) => {
            if (current) {
                showInspector(current.type, current.id);
            } else {
                hideInspector();
            }
        });

        // Route builder inspector
        Store.on('inspector:routeBuilder', (state) => {
            if (state) {
                showRouteBuilder(state);
            }
        });

        // Re-render on entity updates
        Store.on('entity:updated', ({ type, id }) => {
            const sel = Store.get('selected');
            if (sel && sel.type === type && sel.id === id) {
                showInspector(type, id);
            }
        });
    }

    function showInspector(type, id) {
        const entity = Store.findEntity(type, id);
        if (!entity) { hideInspector(); return; }

        panel.classList.add('open');
        panel.classList.remove('hidden');

        const typeLabel = type.replace(/s$/, '');
        title.textContent = `${capitalize(typeLabel)} Inspector`;

        switch (type) {
            case 'stops': renderStopInspector(entity); break;
            case 'routes': renderRouteInspector(entity); break;
            case 'vehicles': renderVehicleInspector(entity); break;
            case 'obstructions': renderObstructionInspector(entity); break;
        }
    }

    function hideInspector() {
        panel.classList.remove('open');
        panel.classList.add('hidden');
        body.innerHTML = `
            <div class="inspector-empty">
                <i class="fa-solid fa-arrow-pointer"></i>
                <p>Select an object on the map to inspect and edit its properties.</p>
            </div>
        `;
    }

    // ==================== STOP INSPECTOR ====================
    function renderStopInspector(stop) {
        const routes = Store.get('routes').filter(r => (r.stopIds || []).includes(stop.id));

        body.innerHTML = `
            <div class="inspector-form">
                <div class="form-group">
                    <label>Name</label>
                    <input type="text" id="insp-name" value="${esc(stop.name)}">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Latitude</label>
                        <input type="number" id="insp-lat" value="${stop.lat}" step="0.00001">
                    </div>
                    <div class="form-group">
                        <label>Longitude</label>
                        <input type="number" id="insp-lng" value="${stop.lng}" step="0.00001">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Color</label>
                        <div class="color-input-wrap">
                            <input type="color" id="insp-color" value="${stop.color || '#1d4ed8'}">
                            <span>${stop.color || '#1d4ed8'}</span>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Icon</label>
                        <select id="insp-icon">
                            <option value="fa-bus" ${stop.icon === 'fa-bus' ? 'selected' : ''}>Bus</option>
                            <option value="fa-bus-simple" ${stop.icon === 'fa-bus-simple' ? 'selected' : ''}>Bus Simple</option>
                            <option value="fa-location-dot" ${stop.icon === 'fa-location-dot' ? 'selected' : ''}>Location</option>
                            <option value="fa-route" ${stop.icon === 'fa-route' ? 'selected' : ''}>Route</option>
                            <option value="fa-shuttle-van" ${stop.icon === 'fa-shuttle-van' ? 'selected' : ''}>Shuttle</option>
                        </select>
                    </div>
                </div>

                ${routes.length ? `
                <div class="form-section">
                    <div class="form-section-title">Used in Routes (${routes.length})</div>
                    <div class="rel-list">
                        ${routes.map(r => `
                            <div class="rel-item" data-type="routes" data-id="${r.id}">
                                <i class="fa-solid fa-route"></i>
                                <span class="rel-name">${esc(r.name)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                <div class="form-actions">
                    <button class="btn btn-primary btn-full" id="insp-save"><i class="fa-solid fa-check"></i> Save</button>
                    <button class="btn btn-danger btn-sm" id="insp-delete"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;

        bindSave('insp-save', () => Commands.updateStop(stop.id, {
            name: val('insp-name'),
            lat: parseFloat(val('insp-lat')),
            lng: parseFloat(val('insp-lng')),
            color: val('insp-color'),
            icon: val('insp-icon'),
        }));
        bindDelete('insp-delete', 'stops', stop.id);
        bindRelations();
    }

    // ==================== ROUTE INSPECTOR ====================
    function renderRouteInspector(route) {
        const stopsList = Store.get('stops');
        const vehicles = Store.get('vehicles').filter(v => v.routeId === route.id);
        const routeStops = (route.stopIds || []).map(sid => stopsList.find(s => s.id === sid)).filter(Boolean);

        body.innerHTML = `
            <div class="inspector-form">
                <div class="form-group">
                    <label>Name</label>
                    <input type="text" id="insp-name" value="${esc(route.name)}">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Color</label>
                        <div class="color-input-wrap">
                            <input type="color" id="insp-color" value="${route.color || '#1d4ed8'}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Style</label>
                        <select id="insp-style">
                            <option value="solid" ${route.style === 'solid' ? 'selected' : ''}>Solid</option>
                            <option value="dashed" ${route.style === 'dashed' ? 'selected' : ''}>Dashed</option>
                            <option value="dotted" ${route.style === 'dotted' ? 'selected' : ''}>Dotted</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Weight</label>
                        <input type="number" id="insp-weight" value="${route.weight || 5}" min="1" max="10">
                    </div>
                    <div class="form-group">
                        <label>Rating</label>
                        <input type="text" readonly value="${route.ratingAverage || 0}/5 (${route.ratingCount || 0})">
                    </div>
                </div>

                <div class="form-section">
                    <div class="form-section-title">Stops (${routeStops.length})</div>
                    <div class="stop-sequence" id="stop-sequence">
                        ${routeStops.map((s, i) => `
                            <div class="stop-seq-item" data-stop-id="${s.id}" data-idx="${i}">
                                <span class="seq-handle"><i class="fa-solid fa-grip-vertical"></i></span>
                                <span class="seq-num">${i + 1}</span>
                                <span class="seq-name">${esc(s.name)}</span>
                            </div>
                        `).join('')}
                    </div>
                    <button class="btn btn-ghost btn-sm btn-full" id="insp-edit-route" style="margin-top:6px;">
                        <i class="fa-solid fa-pen"></i> Edit Route Stops
                    </button>
                </div>

                ${vehicles.length ? `
                <div class="form-section">
                    <div class="form-section-title">Assigned Vehicles (${vehicles.length})</div>
                    <div class="rel-list">
                        ${vehicles.map(v => `
                            <div class="rel-item" data-type="vehicles" data-id="${v.id}">
                                <i class="fa-solid fa-bus"></i>
                                <span class="rel-name">${esc(v.name)}</span>
                                <span class="severity-badge ${v.moving ? 'low' : 'medium'}">${v.moving ? 'Moving' : 'Idle'}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                <div class="form-actions">
                    <button class="btn btn-primary btn-full" id="insp-save"><i class="fa-solid fa-check"></i> Save</button>
                    <button class="btn btn-danger btn-sm" id="insp-delete"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;

        bindSave('insp-save', () => Commands.updateRoute(route.id, {
            name: val('insp-name'),
            color: val('insp-color'),
            style: val('insp-style'),
            weight: parseInt(val('insp-weight')),
        }));
        bindDelete('insp-delete', 'routes', route.id);
        bindRelations();

        // Edit route button
        const editBtn = document.getElementById('insp-edit-route');
        if (editBtn) {
            editBtn.onclick = () => RoutesFeature.editExistingRoute(route.id);
        }

        // Drag reorder for stop sequence
        initStopDragReorder();
    }

    // ==================== VEHICLE INSPECTOR ====================
    function renderVehicleInspector(vehicle) {
        const routes = Store.get('routes');
        const assignedRoute = routes.find(r => r.id === vehicle.routeId);
        const routeOptions = routes.map(r =>
            `<option value="${r.id}" ${vehicle.routeId === r.id ? 'selected' : ''}>${esc(r.name)}</option>`
        ).join('');

        body.innerHTML = `
            <div class="inspector-form">
                <div class="form-group">
                    <label>Name</label>
                    <input type="text" id="insp-name" value="${esc(vehicle.name)}">
                </div>
                <div class="form-group">
                    <label>Assigned Route</label>
                    <select id="insp-route">
                        <option value="">Unassigned</option>
                        ${routeOptions}
                    </select>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Latitude</label>
                        <input type="number" id="insp-lat" value="${vehicle.lat}" step="0.00001">
                    </div>
                    <div class="form-group">
                        <label>Longitude</label>
                        <input type="number" id="insp-lng" value="${vehicle.lng}" step="0.00001">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Speed (km/h)</label>
                        <input type="number" id="insp-speed" value="${vehicle.speed || 0}" min="0">
                    </div>
                    <div class="form-group">
                        <label>Bearing</label>
                        <input type="number" id="insp-bearing" value="${vehicle.bearing || 0}" min="0" max="359">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Status</label>
                        <div class="toggle-wrap">
                            <div class="toggle ${vehicle.moving ? 'on' : ''}" id="insp-moving"></div>
                            <span>${vehicle.moving ? 'Moving' : 'Idle'}</span>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Color</label>
                        <div class="color-input-wrap">
                            <input type="color" id="insp-color" value="${vehicle.color || '#1d4ed8'}">
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <label>Rating</label>
                    <input type="text" readonly value="${vehicle.ratingAverage || 0}/5 (${vehicle.ratingCount || 0} votes)">
                </div>

                <div class="form-actions">
                    <button class="btn btn-primary btn-full" id="insp-save"><i class="fa-solid fa-check"></i> Save</button>
                    <button class="btn btn-danger btn-sm" id="insp-delete"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;

        // Toggle
        const toggle = document.getElementById('insp-moving');
        let moving = vehicle.moving;
        toggle.onclick = () => {
            moving = !moving;
            toggle.classList.toggle('on', moving);
            toggle.nextElementSibling.textContent = moving ? 'Moving' : 'Idle';
        };

        bindSave('insp-save', () => Commands.updateVehicle(vehicle.id, {
            name: val('insp-name'),
            routeId: val('insp-route') ? parseInt(val('insp-route')) : null,
            lat: parseFloat(val('insp-lat')),
            lng: parseFloat(val('insp-lng')),
            speed: parseFloat(val('insp-speed')),
            bearing: parseInt(val('insp-bearing')),
            moving: moving,
            color: val('insp-color'),
        }));
        bindDelete('insp-delete', 'vehicles', vehicle.id);
    }

    // ==================== OBSTRUCTION INSPECTOR ====================
    function renderObstructionInspector(obs) {
        body.innerHTML = `
            <div class="inspector-form">
                <div class="form-group">
                    <label>Name</label>
                    <input type="text" id="insp-name" value="${esc(obs.name)}">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Latitude</label>
                        <input type="number" id="insp-lat" value="${obs.lat}" step="0.00001">
                    </div>
                    <div class="form-group">
                        <label>Longitude</label>
                        <input type="number" id="insp-lng" value="${obs.lng}" step="0.00001">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Radius (m)</label>
                        <input type="number" id="insp-radius" value="${obs.radiusMeters || 40}" min="1">
                    </div>
                    <div class="form-group">
                        <label>Severity</label>
                        <select id="insp-severity">
                            <option value="low" ${obs.severity === 'low' ? 'selected' : ''}>Low</option>
                            <option value="medium" ${obs.severity === 'medium' ? 'selected' : ''}>Medium</option>
                            <option value="high" ${obs.severity === 'high' ? 'selected' : ''}>High</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label>Active</label>
                    <div class="toggle-wrap">
                        <div class="toggle ${obs.active ? 'on' : ''}" id="insp-active"></div>
                        <span>${obs.active ? 'Active' : 'Inactive'}</span>
                    </div>
                </div>

                <div class="form-actions">
                    <button class="btn btn-primary btn-full" id="insp-save"><i class="fa-solid fa-check"></i> Save</button>
                    <button class="btn btn-danger btn-sm" id="insp-delete"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;

        let active = obs.active;
        const toggle = document.getElementById('insp-active');
        toggle.onclick = () => {
            active = !active;
            toggle.classList.toggle('on', active);
            toggle.nextElementSibling.textContent = active ? 'Active' : 'Inactive';
        };

        bindSave('insp-save', () => Commands.updateObstruction(obs.id, {
            name: val('insp-name'),
            lat: parseFloat(val('insp-lat')),
            lng: parseFloat(val('insp-lng')),
            radiusMeters: parseFloat(val('insp-radius')),
            severity: val('insp-severity'),
            active: active,
        }));
        bindDelete('insp-delete', 'obstructions', obs.id);
    }

    // ==================== ROUTE BUILDER INSPECTOR ====================
    function showRouteBuilder(state) {
        panel.classList.add('open');
        panel.classList.remove('hidden');
        title.textContent = state.editingRouteId ? 'Edit Route' : 'New Route';

        const stops = Store.get('stops');
        const routeStops = state.stopIds.map(sid => stops.find(s => s.id === sid)).filter(Boolean);

        body.innerHTML = `
            <div class="inspector-form">
                <div class="form-group">
                    <label>Route Name</label>
                    <input type="text" id="rb-name" value="${esc(state.name)}" placeholder="Enter route name...">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Color</label>
                        <div class="color-input-wrap">
                            <input type="color" id="rb-color" value="${state.color}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Style</label>
                        <select id="rb-style">
                            <option value="solid" ${state.style === 'solid' ? 'selected' : ''}>Solid</option>
                            <option value="dashed" ${state.style === 'dashed' ? 'selected' : ''}>Dashed</option>
                            <option value="dotted" ${state.style === 'dotted' ? 'selected' : ''}>Dotted</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label>Weight</label>
                    <input type="number" id="rb-weight" value="${state.weight}" min="1" max="10">
                </div>

                <div class="form-section">
                    <div class="form-section-title">Stop Sequence (${routeStops.length})</div>
                    <div class="stop-sequence">
                        ${routeStops.length === 0 ? '<p style="color:var(--text-muted);font-size:11px;padding:8px 0;">Click stops on the map to add them to this route.</p>' : ''}
                        ${routeStops.map((s, i) => `
                            <div class="stop-seq-item">
                                <span class="seq-num">${i + 1}</span>
                                <span class="seq-name">${esc(s.name)}</span>
                                <button class="seq-remove" data-idx="${i}"><i class="fa-solid fa-xmark"></i></button>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="form-actions" style="flex-direction:column;">
                    <button class="btn btn-primary btn-full" id="rb-save">
                        <i class="fa-solid fa-check"></i> ${state.editingRouteId ? 'Update Route' : 'Save Route'}
                    </button>
                    <button class="btn btn-ghost btn-full" id="rb-cancel">Cancel</button>
                </div>
            </div>
        `;

        // Bind field changes back to state
        const nameInput = document.getElementById('rb-name');
        const colorInput = document.getElementById('rb-color');
        const styleInput = document.getElementById('rb-style');
        const weightInput = document.getElementById('rb-weight');

        [nameInput, colorInput, styleInput, weightInput].forEach(el => {
            if (el) el.oninput = () => {
                const s = Store.get('routeBuilder');
                s.name = nameInput.value;
                s.color = colorInput.value;
                s.style = styleInput.value;
                s.weight = parseInt(weightInput.value) || 5;
                Store.set('routeBuilder', s);
                RoutesFeature.updatePreview();
            };
        });

        // Remove stop buttons
        document.querySelectorAll('.seq-remove').forEach(btn => {
            btn.onclick = () => RoutesFeature.removeStopFromRoute(parseInt(btn.dataset.idx));
        });

        document.getElementById('rb-save').onclick = () => RoutesFeature.saveRoute();
        document.getElementById('rb-cancel').onclick = () => {
            RoutesFeature.cancelRouteBuilder();
            Store.setMode('select');
        };
    }

    // ==================== HELPERS ====================
    function val(id) { return document.getElementById(id)?.value || ''; }
    function esc(str) { return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
    function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

    function bindSave(btnId, action) {
        const btn = document.getElementById(btnId);
        if (btn) btn.onclick = action;
    }

    function bindDelete(btnId, type, id) {
        const btn = document.getElementById(btnId);
        if (btn) btn.onclick = () => SelectionTools.confirmDelete(type, id);
    }

    function bindRelations() {
        document.querySelectorAll('.rel-item').forEach(el => {
            el.onclick = () => {
                Store.select(el.dataset.type, parseInt(el.dataset.id));
                LayerManager.panToEntity(el.dataset.type, parseInt(el.dataset.id));
            };
        });
    }

    function initStopDragReorder() {
        const container = document.getElementById('stop-sequence');
        if (!container) return;

        let dragItem = null;
        let dragIdx = -1;

        container.querySelectorAll('.stop-seq-item').forEach(item => {
            item.draggable = true;

            item.addEventListener('dragstart', (e) => {
                dragItem = item;
                dragIdx = parseInt(item.dataset.idx);
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                dragItem = null;
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                const toIdx = parseInt(item.dataset.idx);
                if (dragIdx !== toIdx && dragIdx >= 0) {
                    // Get current route and reorder stopIds
                    const sel = Store.get('selected');
                    if (sel && sel.type === 'routes') {
                        const route = Store.findEntity('routes', sel.id);
                        if (route) {
                            const newStopIds = [...route.stopIds];
                            const [moved] = newStopIds.splice(dragIdx, 1);
                            newStopIds.splice(toIdx, 0, moved);
                            Commands.updateRoute(sel.id, { stopIds: newStopIds });
                        }
                    }
                }
            });
        });
    }

    return { init, showInspector, hideInspector };
})();

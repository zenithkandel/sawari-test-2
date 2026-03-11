// ============================================================
// Sawari - admin/workspace.js
// Admin panel: stops, routes, vehicles CRUD with tables & sorting
// ============================================================

const API = '../backend/handlers/api.php';
const DEFAULT_CENTER = [27.7172, 85.3240];
const DEFAULT_ZOOM = 13;
const STORAGE = {
    activeTab: 'sawari_admin_active_tab',
    activity: 'sawari_admin_activity'
};

let allStops = [], allRoutes = [], allVehicles = [];
let allIcons = { fontawesome: [] };
let hiddenStops = new Set(), hiddenRoutes = new Set();
let addStopMode = false, pendingStopLatLng = null, editingStopLatLng = null;
let routeBuilding = false, routeStopIds = [], editRouteStopIds = [];
let newVehicleLatLng = null, vehicleMarkers = {}, movingIntervals = {};
let mapMarkers = [], mapPolylines = [];
let expandedRouteId = null;
let activityFeed = [];

async function saveStopPosition(stop, latlng) {
    const update = {
        id: stop.id,
        name: stop.name,
        icon: stop.icon,
        color: stop.color,
        lat: latlng.lat,
        lng: latlng.lng
    };

    await api(`${API}?type=stops`, 'PUT', update);
    stop.lat = latlng.lat;
    stop.lng = latlng.lng;

    const editingId = +document.getElementById('edit-stop-id').value;
    if (!document.getElementById('edit-stop-modal').classList.contains('hidden') && editingId === stop.id) {
        editingStopLatLng = latlng;
        document.getElementById('edit-stop-pos').innerHTML = `<i class="fa-solid fa-check" style="color:#2ecc71"></i> New: ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
    }

    renderMap();
    renderStopsTable();
    renderRoutesList();
    showToast(`${stop.name} repositioned`, 'success', 1500);
}

// ---- Toast ----
function showToast(msg, type = 'info', ms = 3000) {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    const ic = { info: 'fa-circle-info', success: 'fa-circle-check', error: 'fa-circle-exclamation', warning: 'fa-triangle-exclamation' };
    t.innerHTML = `<i class="fa-solid ${ic[type] || ic.info}"></i><span>${msg}</span>`;
    c.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, ms);
    logActivity(msg, type);
}

function renderActivity() {
    const list = document.getElementById('activity-list');
    if (!list) return;
    if (!activityFeed.length) {
        list.innerHTML = '<li class="activity-empty">No activity yet. Actions will appear here.</li>';
        return;
    }
    list.innerHTML = activityFeed.slice(0, 40).map(item => `
        <li class="activity-item activity-${item.type}">
            <span class="activity-time">${item.time}</span>
            <span class="activity-msg">${item.msg}</span>
        </li>
    `).join('');
}

function logActivity(msg, type = 'info') {
    const entry = {
        msg,
        type,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    activityFeed.unshift(entry);
    activityFeed = activityFeed.slice(0, 120);
    localStorage.setItem(STORAGE.activity, JSON.stringify(activityFeed));
    renderActivity();
}

function restoreActivity() {
    try {
        activityFeed = JSON.parse(localStorage.getItem(STORAGE.activity) || '[]');
    } catch {
        activityFeed = [];
    }
    renderActivity();
}

// ---- API ----
async function api(url, method = 'GET', body = null) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    return (await fetch(url, opts)).json();
}

// ---- Icons ----
function createFAIcon(ic, color, size = 28) {
    return L.divIcon({
        className: 'custom-marker-icon',
        html: `<div style="width:${size}px;height:${size}px;background:${color};display:flex;align-items:center;justify-content:center;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)"><i class="fa-solid ${ic}" style="color:#fff;font-size:${size * .45}px"></i></div>`,
        iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2]
    });
}
function createImageIcon(src, size = 36) {
    return L.divIcon({
        className: 'custom-marker-icon',
        html: `<div style="width:${size}px;height:${size}px;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4);overflow:hidden"><img src="../assets/icons/${src}" style="width:100%;height:100%;object-fit:cover"/></div>`,
        iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2]
    });
}
function createStopIcon(s, size = 24) {
    return s.iconType === 'image' ? createImageIcon(s.icon, size) : createFAIcon(s.icon || 'fa-bus', s.color || '#e74c3c', size);
}
function getLineStyle(r) {
    const s = { color: r.color || '#e74c3c', weight: r.weight || 4, opacity: 0.85 };
    if (r.style === 'dashed') s.dashArray = '12, 8';
    else if (r.style === 'dotted') s.dashArray = '3, 8';
    return s;
}

// ---- Sort helper ----
function sortItems(items, sortKey) {
    const copy = [...items];
    switch (sortKey) {
        case 'name-asc': return copy.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        case 'name-desc': return copy.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
        case 'id-asc': return copy.sort((a, b) => a.id - b.id);
        case 'id-desc': return copy.sort((a, b) => b.id - a.id);
        case 'stops-desc': return copy.sort((a, b) => (b.stopIds?.length || 0) - (a.stopIds?.length || 0));
        case 'stops-asc': return copy.sort((a, b) => (a.stopIds?.length || 0) - (b.stopIds?.length || 0));
        case 'speed-desc': return copy.sort((a, b) => (b.speed || 0) - (a.speed || 0));
        case 'speed-asc': return copy.sort((a, b) => (a.speed || 0) - (b.speed || 0));
        default: return copy;
    }
}

// ---- Map ----
const map = L.map('admin-map').setView(DEFAULT_CENTER, DEFAULT_ZOOM);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap', maxZoom: 19 }).addTo(map);
L.control.scale({ position: 'bottomleft', imperial: false }).addTo(map);

// ---- Tabs ----
function activateTab(tabId) {
    const target = document.getElementById(tabId);
    if (!target) return false;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (btn) btn.classList.add('active');
    target.classList.add('active');
    localStorage.setItem(STORAGE.activeTab, tabId);
    return true;
}

function activateTabFromHash() {
    const hash = (window.location.hash || '').replace('#', '').trim();
    if (!hash) {
        const savedTab = localStorage.getItem(STORAGE.activeTab);
        if (savedTab) activateTab(savedTab);
        return;
    }
    const map = {
        stops: 'stops-tab',
        routes: 'routes-tab',
        vehicles: 'vehicles-tab',
        'stops-tab': 'stops-tab',
        'routes-tab': 'routes-tab',
        'vehicles-tab': 'vehicles-tab'
    };
    activateTab(map[hash] || 'stops-tab');
}

document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => {
    activateTab(btn.dataset.tab);
}));

window.addEventListener('hashchange', activateTabFromHash);

// ---- Load Data ----
async function loadAll() {
    try {
        [allStops, allRoutes, allVehicles, allIcons] = await Promise.all([
            api(`${API}?type=stops`), api(`${API}?type=routes`),
            api(`${API}?type=vehicles`), api(`${API}?type=icons`)
        ]);
        renderMap();
        renderStopsTable();
        renderRoutesList();
        renderVehiclesTable();
        populateIconSelects();
        populateRouteSelects();
        updateCounts();
    } catch { showToast('Failed to load data', 'error'); }
}

function updateCounts() {
    document.getElementById('stops-count').textContent = allStops.length;
    document.getElementById('routes-count').textContent = allRoutes.length;
    document.getElementById('vehicles-count').textContent = allVehicles.length;
    document.getElementById('stat-total-stops').textContent = allStops.length;
    document.getElementById('stat-total-routes').textContent = allRoutes.length;
    document.getElementById('stat-total-vehicles').textContent = allVehicles.length;
    document.getElementById('stat-moving-vehicles').textContent = allVehicles.filter(v => v.moving).length;
}

// ---- Map Rendering ----
function renderMap() {
    mapMarkers.forEach(m => map.removeLayer(m));
    mapPolylines.forEach(p => map.removeLayer(p));
    mapMarkers = []; mapPolylines = [];

    allStops.forEach(s => {
        if (hiddenStops.has(s.id)) return;
        const m = L.marker([s.lat, s.lng], { icon: createStopIcon(s), draggable: true })
            .addTo(map)
            .bindPopup(`<b>${s.name}</b><br><small>ID: ${s.id} &middot; ${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}</small>`)
            .on('click', () => { if (routeBuilding) addStopToRoute(s); })
            .on('dragend', async e => {
                try {
                    await saveStopPosition(s, e.target.getLatLng());
                } catch {
                    showToast(`Failed to move ${s.name}`, 'error');
                    renderMap();
                }
            });
        mapMarkers.push(m);
    });

    renderRoutePolylines();

    allVehicles.forEach(v => {
        const key = 'v_' + v.id;
        const icon = v.iconType === 'image' ? createImageIcon(v.icon, 40) : createFAIcon(v.icon || 'fa-bus', v.color || '#e74c3c', 40);
        if (vehicleMarkers[key]) {
            vehicleMarkers[key].setLatLng([v.lat, v.lng]).setIcon(icon);
        } else {
            const m = L.marker([v.lat, v.lng], { icon, draggable: true, zIndexOffset: 500 })
                .addTo(map)
                .bindPopup(`<b>${v.name}</b><br><small>${v.speed} km/h</small>`)
                .bindTooltip(v.name, { permanent: true, direction: 'top', className: 'vehicle-label', offset: [0, -20] });
            m.on('dragend', async e => {
                const p = e.target.getLatLng();
                await api(`${API}?type=vehicles`, 'PUT', { id: v.id, lat: p.lat, lng: p.lng });
                v.lat = p.lat; v.lng = p.lng;
                showToast(`${v.name} repositioned`, 'success', 1500);
            });
            vehicleMarkers[key] = m;
            mapMarkers.push(m);
        }
    });
}

async function renderRoutePolylines() {
    const snap = document.getElementById('snap-toggle').checked;
    for (const r of allRoutes) {
        if (hiddenRoutes.has(r.id)) continue;
        const stops = r.stopIds.map(id => allStops.find(s => s.id === id)).filter(Boolean);
        if (stops.length < 2) continue;
        const coords = (snap || r.snapToRoad) ? await snapRouteToRoad(stops) : stops.map(s => [s.lat, s.lng]);
        const poly = L.polyline(coords, getLineStyle(r)).addTo(map)
            .bindPopup(`<b>${r.name}</b><br><small>${r.stopIds.length} stops</small>`);
        mapPolylines.push(poly);
    }
}

// ---- Map Click ----
map.on('click', e => {
    if (addStopMode) {
        pendingStopLatLng = e.latlng;
        document.getElementById('stop-coords').innerHTML = `<i class="fa-solid fa-check" style="color:#2ecc71"></i> ${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
    } else if (!document.getElementById('edit-stop-modal').classList.contains('hidden')) {
        editingStopLatLng = e.latlng;
        document.getElementById('edit-stop-pos').innerHTML = `<i class="fa-solid fa-check" style="color:#2ecc71"></i> New: ${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
    } else {
        newVehicleLatLng = e.latlng;
        document.getElementById('v-pos').innerHTML = `<i class="fa-solid fa-check" style="color:#2ecc71"></i> ${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
    }
});

// ====================== STOPS TAB ======================

// How many routes use each stop
function getStopRouteCount(stopId) {
    return allRoutes.filter(r => r.stopIds.includes(stopId)).length;
}
function getStopRouteNames(stopId) {
    return allRoutes.filter(r => r.stopIds.includes(stopId)).map(r => r.name);
}

document.getElementById('stop-search').addEventListener('input', renderStopsTable);
document.getElementById('stop-sort').addEventListener('change', renderStopsTable);

function renderStopsTable() {
    const q = (document.getElementById('stop-search').value || '').toLowerCase();
    const sortKey = document.getElementById('stop-sort').value;
    let filtered = allStops.filter(s => !q || s.name.toLowerCase().includes(q));
    filtered = sortItems(filtered, sortKey);

    document.getElementById('stop-search-count').textContent = q ? `${filtered.length}/${allStops.length}` : '';

    const tbody = document.getElementById('stops-tbody');
    if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="td-empty">${q ? 'No stops match' : 'No stops yet'}</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(s => {
        const vis = !hiddenStops.has(s.id);
        const routeCount = getStopRouteCount(s.id);
        const routeNames = getStopRouteNames(s.id);
        const routeTooltip = routeNames.length ? routeNames.join(', ') : 'Not in any route';
        return `<tr class="${vis ? '' : 'row-hidden'}" data-id="${s.id}">
            <td><input type="checkbox" class="vis-cb" ${vis ? 'checked' : ''} onchange="toggleStop(${s.id})" /></td>
            <td class="td-id">${s.id}</td>
            <td><i class="fa-solid ${s.icon || 'fa-bus'}" style="color:${s.color};font-size:14px"></i></td>
            <td class="td-name">${s.name}</td>
            <td class="td-coords">${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}</td>
            <td class="td-routes" title="${routeTooltip}"><span class="badge ${routeCount ? 'badge-info' : 'badge-muted'}">${routeCount}</span></td>
            <td class="td-actions">
                <button onclick="zoomStop(${s.id})" title="Zoom to stop"><i class="fa-solid fa-crosshairs"></i></button>
                <button onclick="editStop(${s.id})" title="Edit stop"><i class="fa-solid fa-pen"></i></button>
                <button class="del" onclick="deleteStop(${s.id})" title="Delete stop"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>`;
    }).join('');
}

// Add stop form
document.getElementById('btn-add-stop').addEventListener('click', () => {
    addStopMode = !addStopMode;
    document.getElementById('stop-form').classList.toggle('hidden', !addStopMode);
    if (addStopMode) {
        const sel = document.getElementById('stop-icon');
        sel.innerHTML = allIcons.fontawesome.map(ic => `<option value="${ic}">${ic}</option>`).join('');
        document.getElementById('stop-name').focus();
    }
});

document.getElementById('btn-cancel-stop').addEventListener('click', () => {
    document.getElementById('stop-form').classList.add('hidden');
    addStopMode = false; pendingStopLatLng = null;
});

document.getElementById('btn-save-stop').addEventListener('click', async () => {
    const name = document.getElementById('stop-name').value.trim();
    if (!name) { showToast('Enter a stop name', 'warning'); return; }
    if (!pendingStopLatLng) { showToast('Click map to place the stop', 'warning'); return; }
    await api(`${API}?type=stops`, 'POST', {
        name, lat: pendingStopLatLng.lat, lng: pendingStopLatLng.lng,
        icon: document.getElementById('stop-icon').value, iconType: 'fontawesome',
        color: document.getElementById('stop-color').value
    });
    document.getElementById('stop-form').classList.add('hidden');
    document.getElementById('stop-name').value = '';
    addStopMode = false; pendingStopLatLng = null;
    showToast(`Stop "${name}" created`, 'success');
    loadAll();
});

// Toggle all
document.getElementById('btn-toggle-all-stops').addEventListener('click', () => {
    if (hiddenStops.size === 0) { allStops.forEach(s => hiddenStops.add(s.id)); showToast('All stops hidden', 'info', 1500); }
    else { hiddenStops.clear(); showToast('All stops visible', 'info', 1500); }
    renderMap(); renderStopsTable();
});

document.getElementById('btn-refresh-stops').addEventListener('click', () => { loadAll(); showToast('Refreshed', 'info', 1000); });

window.toggleStop = id => { hiddenStops.has(id) ? hiddenStops.delete(id) : hiddenStops.add(id); renderMap(); renderStopsTable(); };
window.zoomStop = id => { const s = allStops.find(x => x.id === id); if (s) map.flyTo([s.lat, s.lng], 17); };
window.deleteStop = async id => {
    const s = allStops.find(x => x.id === id);
    if (!confirm(`Delete "${s?.name}"?`)) return;
    await api(`${API}?type=stops&id=${id}`, 'DELETE');
    showToast(`"${s?.name}" deleted`, 'success'); loadAll();
};
window.editStop = id => {
    const s = allStops.find(x => x.id === id); if (!s) return;
    document.getElementById('edit-stop-id').value = s.id;
    document.getElementById('edit-stop-name').value = s.name;
    document.getElementById('edit-stop-color').value = s.color || '#e74c3c';
    document.getElementById('edit-stop-pos').innerHTML = `<i class="fa-solid fa-location-dot"></i> ${s.lat.toFixed(5)}, ${s.lng.toFixed(5)} — drag marker or click map to update`;
    editingStopLatLng = null;
    const sel = document.getElementById('edit-stop-icon');
    sel.innerHTML = allIcons.fontawesome.map(ic => `<option value="${ic}">${ic}</option>`).join('');
    sel.value = s.icon || 'fa-bus';
    document.getElementById('edit-stop-modal').classList.remove('hidden');
};

document.getElementById('btn-save-edit-stop').addEventListener('click', async () => {
    const id = +document.getElementById('edit-stop-id').value;
    const update = {
        id, name: document.getElementById('edit-stop-name').value.trim(),
        icon: document.getElementById('edit-stop-icon').value, color: document.getElementById('edit-stop-color').value
    };
    if (editingStopLatLng) { update.lat = editingStopLatLng.lat; update.lng = editingStopLatLng.lng; }
    if (!update.name) { showToast('Name required', 'warning'); return; }
    await api(`${API}?type=stops`, 'PUT', update);
    document.getElementById('edit-stop-modal').classList.add('hidden');
    editingStopLatLng = null;
    showToast(`"${update.name}" updated`, 'success'); loadAll();
});

document.getElementById('btn-cancel-edit-stop').addEventListener('click', () => {
    document.getElementById('edit-stop-modal').classList.add('hidden'); editingStopLatLng = null;
});

// ====================== ROUTES TAB ======================

document.getElementById('route-search').addEventListener('input', renderRoutesList);
document.getElementById('route-sort').addEventListener('change', renderRoutesList);

function renderRoutesList() {
    const q = (document.getElementById('route-search').value || '').toLowerCase();
    const sortKey = document.getElementById('route-sort').value;
    let filtered = allRoutes.filter(r => !q || r.name.toLowerCase().includes(q));
    filtered = sortItems(filtered, sortKey);

    document.getElementById('route-search-count').textContent = q ? `${filtered.length}/${allRoutes.length}` : '';
    const el = document.getElementById('routes-list');

    if (!filtered.length) {
        el.innerHTML = `<p class="empty-msg">${q ? 'No routes match' : 'No routes yet'}</p>`;
        return;
    }

    el.innerHTML = filtered.map(r => {
        const vis = !hiddenRoutes.has(r.id);
        const expanded = expandedRouteId === r.id;
        const stopNames = r.stopIds.map(sid => allStops.find(s => s.id === sid)).filter(Boolean);
        return `<div class="route-card ${vis ? '' : 'route-hidden'} ${expanded ? 'expanded' : ''}">
            <div class="route-card-header" onclick="toggleRouteExpand(${r.id})">
                <input type="checkbox" class="vis-cb" ${vis ? 'checked' : ''} onclick="event.stopPropagation()" onchange="toggleRoute(${r.id})" />
                <span class="route-color-bar" style="background:${r.color}"></span>
                <div class="route-info">
                    <span class="route-title">${r.name}</span>
                    <span class="route-meta">${r.stopIds.length} stops &middot; ${r.style}${r.snapToRoad ? ' &middot; snapped' : ''}</span>
                </div>
                <div class="route-card-actions" onclick="event.stopPropagation()">
                    <button onclick="zoomRoute(${r.id})" title="Zoom"><i class="fa-solid fa-crosshairs"></i></button>
                    <button onclick="editRoute(${r.id})" title="Edit"><i class="fa-solid fa-pen"></i></button>
                    <button class="del" onclick="deleteRoute(${r.id})" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </div>
                <i class="fa-solid fa-chevron-${expanded ? 'up' : 'down'} expand-arrow"></i>
            </div>
            ${expanded ? `<div class="route-detail">
                <div class="route-stop-list">
                    ${stopNames.map((s, i) => `<div class="route-stop-row">
                        <span class="stop-num">${i + 1}</span>
                        <i class="fa-solid ${s.icon || 'fa-bus'}" style="color:${s.color};font-size:11px"></i>
                        <span class="stop-link" onclick="zoomStop(${s.id})">${s.name}</span>
                    </div>`).join('')}
                </div>
            </div>` : ''}
        </div>`;
    }).join('');
}

window.toggleRouteExpand = id => {
    expandedRouteId = expandedRouteId === id ? null : id;
    renderRoutesList();
};

// Add route form
document.getElementById('btn-add-route').addEventListener('click', () => {
    routeBuilding = true; routeStopIds = [];
    document.getElementById('route-form').classList.remove('hidden');
    document.getElementById('route-form-title').innerHTML = '<i class="fa-solid fa-plus-circle"></i> Create Route';
    document.getElementById('route-chips').innerHTML = '';
    document.getElementById('route-name').value = '';
    document.getElementById('route-name').focus();
    showToast('Click stops on map to add them', 'info');
});

function addStopToRoute(s) {
    routeStopIds.push(s.id);
    renderRouteChips();
    document.getElementById('route-stop-info').innerHTML = `<i class="fa-solid fa-check" style="color:#2ecc71"></i> ${routeStopIds.length} stop(s) selected`;
    showToast(`Added "${s.name}"`, 'info', 1000);
}

function renderRouteChips() {
    document.getElementById('route-chips').innerHTML = routeStopIds.map((id, i) => {
        const s = allStops.find(x => x.id === id);
        return `<span class="route-chip"><span class="chip-num">${i + 1}</span>${s ? s.name : id}<span class="remove-chip" onclick="removeRouteChip(${i})">&times;</span></span>`;
    }).join('');
}
window.removeRouteChip = i => {
    routeStopIds.splice(i, 1); renderRouteChips();
    document.getElementById('route-stop-info').innerHTML = `<i class="fa-solid fa-hand-pointer"></i> ${routeStopIds.length} stop(s) selected`;
};

document.getElementById('route-weight').addEventListener('input', e => document.getElementById('route-weight-val').textContent = e.target.value);

document.getElementById('btn-save-route').addEventListener('click', async () => {
    const name = document.getElementById('route-name').value.trim();
    if (!name) { showToast('Enter route name', 'warning'); return; }
    if (routeStopIds.length < 2) { showToast('Need at least 2 stops', 'warning'); return; }
    await api(`${API}?type=routes`, 'POST', {
        name, stopIds: routeStopIds, color: document.getElementById('route-color').value,
        style: document.getElementById('route-style').value,
        weight: +document.getElementById('route-weight').value,
        snapToRoad: document.getElementById('route-snap').checked
    });
    document.getElementById('route-form').classList.add('hidden');
    routeBuilding = false; routeStopIds = [];
    showToast(`Route "${name}" created`, 'success'); loadAll();
});

document.getElementById('btn-cancel-route').addEventListener('click', () => {
    document.getElementById('route-form').classList.add('hidden');
    routeBuilding = false; routeStopIds = []; renderMap();
});

document.getElementById('btn-toggle-all-routes').addEventListener('click', () => {
    if (hiddenRoutes.size === 0) { allRoutes.forEach(r => hiddenRoutes.add(r.id)); showToast('All routes hidden', 'info', 1500); }
    else { hiddenRoutes.clear(); showToast('All routes visible', 'info', 1500); }
    renderMap(); renderRoutesList();
});

document.getElementById('btn-refresh-routes').addEventListener('click', () => { loadAll(); showToast('Refreshed', 'info', 1000); });
document.getElementById('snap-toggle').addEventListener('change', () => renderMap());

window.toggleRoute = id => { hiddenRoutes.has(id) ? hiddenRoutes.delete(id) : hiddenRoutes.add(id); renderMap(); renderRoutesList(); };
window.zoomRoute = id => {
    const r = allRoutes.find(x => x.id === id); if (!r) return;
    const coords = r.stopIds.map(sid => allStops.find(s => s.id === sid)).filter(Boolean).map(s => [s.lat, s.lng]);
    if (coords.length) map.fitBounds(coords, { padding: [40, 40] });
};
window.deleteRoute = async id => {
    const r = allRoutes.find(x => x.id === id);
    if (!confirm(`Delete "${r?.name}"?`)) return;
    await api(`${API}?type=routes&id=${id}`, 'DELETE');
    showToast(`"${r?.name}" deleted`, 'success'); loadAll();
};

// Edit route
window.editRoute = id => {
    const r = allRoutes.find(x => x.id === id); if (!r) return;
    document.getElementById('edit-route-id').value = r.id;
    document.getElementById('edit-route-name').value = r.name;
    document.getElementById('edit-route-color').value = r.color || '#e74c3c';
    document.getElementById('edit-route-style').value = r.style || 'solid';
    document.getElementById('edit-route-weight').value = r.weight || 4;
    document.getElementById('edit-route-weight-val').textContent = r.weight || 4;
    document.getElementById('edit-route-snap').checked = !!r.snapToRoad;
    editRouteStopIds = [...r.stopIds];
    renderEditRouteChips();
    document.getElementById('edit-route-modal').classList.remove('hidden');
};

document.getElementById('edit-route-weight').addEventListener('input', e => document.getElementById('edit-route-weight-val').textContent = e.target.value);

function renderEditRouteChips() {
    document.getElementById('edit-route-chips').innerHTML = editRouteStopIds.map((id, i) => {
        const s = allStops.find(x => x.id === id);
        return `<span class="route-chip"><span class="chip-num">${i + 1}</span>${s ? s.name : id}<span class="remove-chip" onclick="removeEditRouteChip(${i})">&times;</span></span>`;
    }).join('');
}
window.removeEditRouteChip = i => { editRouteStopIds.splice(i, 1); renderEditRouteChips(); };

document.getElementById('btn-save-edit-route').addEventListener('click', async () => {
    const id = +document.getElementById('edit-route-id').value;
    const name = document.getElementById('edit-route-name').value.trim();
    if (!name) { showToast('Name required', 'warning'); return; }
    if (editRouteStopIds.length < 2) { showToast('Need 2+ stops', 'warning'); return; }
    await api(`${API}?type=routes`, 'PUT', {
        id, name, stopIds: editRouteStopIds, color: document.getElementById('edit-route-color').value,
        style: document.getElementById('edit-route-style').value,
        weight: +document.getElementById('edit-route-weight').value,
        snapToRoad: document.getElementById('edit-route-snap').checked
    });
    document.getElementById('edit-route-modal').classList.add('hidden');
    showToast(`"${name}" updated`, 'success'); loadAll();
});
document.getElementById('btn-cancel-edit-route').addEventListener('click', () => document.getElementById('edit-route-modal').classList.add('hidden'));

// ====================== VEHICLES TAB ======================

document.getElementById('vehicle-search').addEventListener('input', renderVehiclesTable);
document.getElementById('vehicle-sort').addEventListener('change', renderVehiclesTable);

document.getElementById('btn-show-add-vehicle').addEventListener('click', () => {
    document.getElementById('vehicle-form').classList.toggle('hidden');
    if (!document.getElementById('vehicle-form').classList.contains('hidden')) {
        document.getElementById('v-name').focus();
    }
});
document.getElementById('btn-cancel-vehicle').addEventListener('click', () => {
    document.getElementById('vehicle-form').classList.add('hidden');
});
document.getElementById('btn-refresh-vehicles').addEventListener('click', () => { loadAll(); showToast('Refreshed', 'info', 1000); });

function populateIconSelects() {
    populateIconSelect('v-icon-type', 'v-icon');
    document.getElementById('v-icon-type').addEventListener('change', () => populateIconSelect('v-icon-type', 'v-icon'));
    document.getElementById('edit-v-icon-type').addEventListener('change', () => populateIconSelect('edit-v-icon-type', 'edit-v-icon'));
}
function populateIconSelect(typeId, iconId) {
    const type = document.getElementById(typeId).value;
    const sel = document.getElementById(iconId);
    const list = type === 'fontawesome' ? allIcons.fontawesome : (allIcons.images || []);
    sel.innerHTML = list.map(ic => `<option value="${ic}">${ic}</option>`).join('');
}
function populateRouteSelects() {
    const opts = '<option value="0">No route</option>' + allRoutes.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
    document.getElementById('v-route').innerHTML = opts;
    document.getElementById('edit-v-route').innerHTML = opts;
}

document.getElementById('btn-add-vehicle').addEventListener('click', async () => {
    const name = document.getElementById('v-name').value.trim();
    if (!name) { showToast('Enter name', 'warning'); return; }
    if (!newVehicleLatLng) { showToast('Click map to set position', 'warning'); return; }
    await api(`${API}?type=vehicles`, 'POST', {
        name, lat: newVehicleLatLng.lat, lng: newVehicleLatLng.lng,
        iconType: document.getElementById('v-icon-type').value, icon: document.getElementById('v-icon').value,
        color: document.getElementById('v-color').value, speed: +document.getElementById('v-speed').value || 40,
        routeId: +document.getElementById('v-route').value || 0, moving: false, bearing: 0
    });
    document.getElementById('v-name').value = ''; newVehicleLatLng = null;
    document.getElementById('v-pos').innerHTML = '<i class="fa-solid fa-location-dot"></i> Click map to set position';
    document.getElementById('vehicle-form').classList.add('hidden');
    showToast(`"${name}" created`, 'success'); loadAll();
});

function renderVehiclesTable() {
    const q = (document.getElementById('vehicle-search').value || '').toLowerCase();
    const sortKey = document.getElementById('vehicle-sort').value;
    let filtered = allVehicles.filter(v => !q || v.name.toLowerCase().includes(q));
    filtered = sortItems(filtered, sortKey);

    const tbody = document.getElementById('vehicles-tbody');
    if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="td-empty">${q ? 'No vehicles match' : 'No vehicles yet'}</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(v => {
        const routeName = allRoutes.find(r => r.id === v.routeId)?.name || '—';
        const statusClass = v.moving ? 'status-active' : 'status-idle';
        const statusLabel = v.moving ? 'Moving' : 'Idle';
        return `<tr>
            <td><i class="fa-solid ${v.iconType === 'fontawesome' ? v.icon : 'fa-image'}" style="color:${v.color};font-size:14px"></i></td>
            <td class="td-name">${v.name}</td>
            <td class="td-speed">${v.speed} km/h</td>
            <td class="td-route-name" title="${routeName}">${routeName}</td>
            <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
            <td class="td-actions">
                <button onclick="${v.moving ? 'stopMotion' : 'startMotion'}(${v.id})" title="${v.moving ? 'Stop' : 'Start'}">
                    <i class="fa-solid ${v.moving ? 'fa-pause' : 'fa-play'}"></i>
                </button>
                <button onclick="zoomVehicle(${v.id})" title="Zoom"><i class="fa-solid fa-crosshairs"></i></button>
                <button onclick="editVehicle(${v.id})" title="Edit"><i class="fa-solid fa-pen"></i></button>
                <button class="del" onclick="deleteVehicle(${v.id})" title="Delete"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>`;
    }).join('');
}

window.editVehicle = id => {
    const v = allVehicles.find(x => x.id === id); if (!v) return;
    document.getElementById('edit-v-id').value = v.id;
    document.getElementById('edit-v-name').value = v.name;
    document.getElementById('edit-v-icon-type').value = v.iconType || 'fontawesome';
    populateIconSelect('edit-v-icon-type', 'edit-v-icon');
    document.getElementById('edit-v-icon').value = v.icon;
    document.getElementById('edit-v-color').value = v.color || '#e74c3c';
    document.getElementById('edit-v-speed').value = v.speed;
    document.getElementById('edit-v-route').value = v.routeId || 0;
    document.getElementById('edit-modal').classList.remove('hidden');
};

document.getElementById('btn-save-edit').addEventListener('click', async () => {
    const id = +document.getElementById('edit-v-id').value;
    const name = document.getElementById('edit-v-name').value.trim();
    if (!name) { showToast('Name required', 'warning'); return; }
    await api(`${API}?type=vehicles`, 'PUT', {
        id, name, iconType: document.getElementById('edit-v-icon-type').value,
        icon: document.getElementById('edit-v-icon').value, color: document.getElementById('edit-v-color').value,
        speed: +document.getElementById('edit-v-speed').value || 40,
        routeId: +document.getElementById('edit-v-route').value || 0
    });
    document.getElementById('edit-modal').classList.add('hidden');
    const key = 'v_' + id;
    if (vehicleMarkers[key]) { map.removeLayer(vehicleMarkers[key]); delete vehicleMarkers[key]; }
    showToast(`"${name}" updated`, 'success'); loadAll();
});
document.getElementById('btn-cancel-edit').addEventListener('click', () => document.getElementById('edit-modal').classList.add('hidden'));

window.zoomVehicle = id => { const v = allVehicles.find(x => x.id === id); if (v) map.flyTo([v.lat, v.lng], 16); };
window.deleteVehicle = async id => {
    const v = allVehicles.find(x => x.id === id);
    if (!confirm(`Delete "${v?.name}"?`)) return;
    if (movingIntervals[id]) { cancelAnimationFrame(movingIntervals[id]); delete movingIntervals[id]; }
    const key = 'v_' + id;
    if (vehicleMarkers[key]) { map.removeLayer(vehicleMarkers[key]); delete vehicleMarkers[key]; }
    await api(`${API}?type=vehicles&id=${id}`, 'DELETE');
    showToast(`"${v?.name}" deleted`, 'success'); loadAll();
};

// ---- Vehicle Motion ----
window.startMotion = async id => {
    const v = allVehicles.find(x => x.id === id); if (!v) return;
    await api(`${API}?type=vehicles`, 'PUT', { id, moving: true });
    v.moving = true;
    const route = allRoutes.find(r => r.id === v.routeId);
    if (route) {
        const coords = route.stopIds.map(sid => allStops.find(s => s.id === sid)).filter(Boolean).map(s => [s.lat, s.lng]);
        if (coords.length >= 2) { startRouteMotion(v, coords); showToast(`${v.name} moving`, 'success', 1500); renderVehiclesTable(); return; }
    }
    startLinearMotion(v); showToast(`${v.name} moving`, 'success', 1500); renderVehiclesTable();
};
window.stopMotion = async id => {
    if (movingIntervals[id]) { cancelAnimationFrame(movingIntervals[id]); delete movingIntervals[id]; }
    await api(`${API}?type=vehicles`, 'PUT', { id, moving: false });
    const v = allVehicles.find(x => x.id === id); if (v) v.moving = false;
    showToast(`${v?.name} stopped`, 'info', 1500); renderVehiclesTable();
};

function startLinearMotion(v) {
    const dps = (v.speed / 111) / 3600, br = (v.bearing || 0) * Math.PI / 180;
    let lt = performance.now(), ls = Date.now();
    function step(now) {
        const dt = (now - lt) / 1000; lt = now;
        v.lat += Math.cos(br) * dps * dt; v.lng += Math.sin(br) * dps * dt;
        const k = 'v_' + v.id; if (vehicleMarkers[k]) vehicleMarkers[k].setLatLng([v.lat, v.lng]);
        if (Date.now() - ls > 2000) { api(`${API}?type=vehicles`, 'PUT', { id: v.id, lat: v.lat, lng: v.lng }); ls = Date.now(); }
        movingIntervals[v.id] = requestAnimationFrame(step);
    }
    movingIntervals[v.id] = requestAnimationFrame(step);
}

function startRouteMotion(v, coords) {
    let si = 0, pr = 0, dir = 1, lt = performance.now(), ls = Date.now();
    function step(now) {
        const dt = (now - lt) / 1000; lt = now;
        const from = coords[si], to = coords[si + dir > 0 ? si + 1 : si - 1] || from;
        const sd = Math.sqrt((to[0] - from[0]) ** 2 + (to[1] - from[1]) ** 2) * 111;
        pr += dt / (sd > 0 ? (sd / v.speed) * 3600 : 1);
        if (pr >= 1) { pr = 0; si += dir; if (si >= coords.length - 1) { dir = -1; si = coords.length - 1; } if (si <= 0) { dir = 1; si = 0; } }
        const cf = coords[si], ni = si + (dir > 0 ? 1 : -1);
        const ct = coords[Math.max(0, Math.min(coords.length - 1, ni))];
        v.lat = cf[0] + (ct[0] - cf[0]) * pr; v.lng = cf[1] + (ct[1] - cf[1]) * pr;
        const k = 'v_' + v.id; if (vehicleMarkers[k]) vehicleMarkers[k].setLatLng([v.lat, v.lng]);
        if (Date.now() - ls > 2000) { api(`${API}?type=vehicles`, 'PUT', { id: v.id, lat: v.lat, lng: v.lng }); ls = Date.now(); }
        movingIntervals[v.id] = requestAnimationFrame(step);
    }
    movingIntervals[v.id] = requestAnimationFrame(step);
}

// ---- Modals ----
document.addEventListener('keydown', e => { if (e.key === 'Escape') { document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden')); editingStopLatLng = null; } });
document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m) { m.classList.add('hidden'); editingStopLatLng = null; } }));

function applyGlobalQuickSearch(raw) {
    const q = (raw || '').trim().toLowerCase();
    if (!q) return;

    if (q.includes('route')) {
        activateTab('routes-tab');
        document.getElementById('route-search').value = q.replace('route', '').trim();
        renderRoutesList();
        return;
    }
    if (q.includes('vehicle') || q.includes('fleet') || q.includes('bus')) {
        activateTab('vehicles-tab');
        document.getElementById('vehicle-search').value = q.replace(/vehicle|fleet|bus/g, '').trim();
        renderVehiclesTable();
        return;
    }
    activateTab('stops-tab');
    document.getElementById('stop-search').value = q.replace('stop', '').trim();
    renderStopsTable();
}

const commandCatalog = [
    { key: 'open stops', run: () => activateTab('stops-tab') },
    { key: 'open routes', run: () => activateTab('routes-tab') },
    { key: 'open vehicles', run: () => activateTab('vehicles-tab') },
    { key: 'new stop', run: () => document.getElementById('btn-add-stop').click() },
    { key: 'new route', run: () => document.getElementById('btn-add-route').click() },
    { key: 'new vehicle', run: () => document.getElementById('btn-show-add-vehicle').click() },
    { key: 'refresh all', run: () => loadAll() },
    { key: 'toggle map focus', run: () => document.getElementById('btn-map-focus').click() }
];

function openCommandPalette() {
    document.getElementById('command-palette').classList.remove('hidden');
    const input = document.getElementById('command-input');
    input.value = '';
    renderCommandResults('');
    input.focus();
}

function closeCommandPalette() {
    document.getElementById('command-palette').classList.add('hidden');
}

function renderCommandResults(query) {
    const q = (query || '').toLowerCase();
    const list = document.getElementById('command-results');
    const matches = commandCatalog.filter(cmd => !q || cmd.key.includes(q));
    list.innerHTML = matches.map(cmd => `<button class="palette-item" data-command="${cmd.key}">${cmd.key}</button>`).join('') || '<p class="palette-empty">No matching commands</p>';
}

document.getElementById('command-results').addEventListener('click', e => {
    const btn = e.target.closest('[data-command]');
    if (!btn) return;
    const cmd = commandCatalog.find(c => c.key === btn.dataset.command);
    if (!cmd) return;
    cmd.run();
    showToast(`Executed: ${cmd.key}`, 'info', 1400);
    closeCommandPalette();
});

document.getElementById('command-input').addEventListener('input', e => renderCommandResults(e.target.value));
document.getElementById('btn-open-command').addEventListener('click', openCommandPalette);
document.getElementById('btn-close-command').addEventListener('click', closeCommandPalette);
document.getElementById('command-palette').addEventListener('click', e => {
    if (e.target.id === 'command-palette') closeCommandPalette();
});

document.getElementById('global-quick-search').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    applyGlobalQuickSearch(e.target.value);
    showToast('Quick filter applied', 'info', 1200);
});

document.getElementById('btn-map-focus').addEventListener('click', e => {
    const focused = document.body.classList.toggle('map-focus-mode');
    e.currentTarget.innerHTML = focused
        ? '<i class="fa-solid fa-compress"></i> Exit Focus'
        : '<i class="fa-solid fa-expand"></i> Focus Map';
    map.invalidateSize();
});

document.getElementById('btn-clear-activity').addEventListener('click', () => {
    activityFeed = [];
    localStorage.removeItem(STORAGE.activity);
    renderActivity();
});

document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openCommandPalette();
    }
    if (e.altKey && e.key === '1') activateTab('stops-tab');
    if (e.altKey && e.key === '2') activateTab('routes-tab');
    if (e.altKey && e.key === '3') activateTab('vehicles-tab');
});

// ---- Init ----
restoreActivity();
loadAll();
activateTabFromHash();

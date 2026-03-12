// ============================================================
// Sawari - app.js
// Main transit navigation application
// ============================================================

const API = 'backend/handlers/api.php';
const DEFAULT_CENTER = [27.7172, 85.3240];
const DEFAULT_ZOOM = 13;

// ---- State ----
let allStops = [];
let publicStops = [];
let allRoutes = [];
let allVehicles = [];
let startPoint = null;   // { lat, lng }
let endPoint = null;      // { lat, lng }
let startMarker = null;
let endMarker = null;
let pickingMode = null;   // 'start' | 'end' | null
let journeyLayers = [];   // polylines + markers for current journey
let contextRouteLayers = [];
let contextStopLayers = [];
let vehicleMarkers = {};
let vehiclePollTimer = null;
let currentJourney = null;
let panelCollapsed = false;

const uiPrefs = {
    showRoutes: true,
    showStops: true,
    showVehicles: true,
    followGPS: false
};

let suppressAutoCenter = false;

// GPS state
let gpsActive = false;
let gpsWatchId = null;
let gpsMarker = null;
let gpsHeadingMarker = null;
let gpsAccuracyCircle = null;
let currentHeading = null;
let orientationListening = false;

// ---- API Cache ----
const apiCache = {
    _store: {}, _ttl: {},
    set(key, data, ttl = 30000) {
        this._store[key] = JSON.parse(JSON.stringify(data));
        this._ttl[key] = Date.now() + ttl;
    },
    get(key) {
        if (!this._store[key] || Date.now() > this._ttl[key]) {
            delete this._store[key]; delete this._ttl[key]; return null;
        }
        return JSON.parse(JSON.stringify(this._store[key]));
    },
    invalidatePrefix(prefix) {
        for (const k of Object.keys(this._store)) {
            if (k.startsWith(prefix)) { delete this._store[k]; delete this._ttl[k]; }
        }
    }
};

async function api(url, method = 'GET', body = null) {
    if (method === 'GET') { const c = apiCache.get(url); if (c) return c; }
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const data = await (await fetch(url, opts)).json();
    if (method === 'GET') {
        apiCache.set(url, data, url.includes('vehicles') ? 5000 : 30000);
    } else {
        apiCache.invalidatePrefix(url.split('?')[0]);
    }
    return data;
}

// ---- Toast Notifications ----
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = { info: 'fa-circle-info', success: 'fa-circle-check', error: 'fa-circle-exclamation', warning: 'fa-triangle-exclamation' };
    toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${message}</span>`;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ---- Map Setup ----
const map = L.map('map', {
    zoomControl: false,
    attributionControl: true
}).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

map.createPane('labels');
map.getPane('labels').style.zIndex = 450;
map.getPane('labels').style.pointerEvents = 'none';

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 20
}).addTo(map);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 20,
    pane: 'labels'
}).addTo(map);

L.control.zoom({ position: 'topright' }).addTo(map);
L.control.scale({ position: 'bottomleft', imperial: false, maxWidth: 150 }).addTo(map);

map.on('dragstart zoomstart', () => {
    if (uiPrefs.followGPS && gpsActive) {
        suppressAutoCenter = true;
    }
});

// ---- Right-click Context Menu ----
map.on('contextmenu', (e) => {
    L.popup({ className: 'context-popup', closeButton: false })
        .setLatLng(e.latlng)
        .setContent(`
            <div class="ctx-menu">
                <button onclick="setStartFromCtx(${e.latlng.lat}, ${e.latlng.lng})"><i class="fa-solid fa-circle-dot" style="color:#2ecc71"></i> Set as Start</button>
                <button onclick="setEndFromCtx(${e.latlng.lat}, ${e.latlng.lng})"><i class="fa-solid fa-flag-checkered" style="color:#e74c3c"></i> Set as Destination</button>
                <div class="ctx-coords">${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}</div>
            </div>
        `)
        .openOn(map);
});

window.setStartFromCtx = (lat, lng) => {
    map.closePopup();
    setStartPoint(lat, lng);
    showToast('Start location set', 'success');
};
window.setEndFromCtx = (lat, lng) => {
    map.closePopup();
    setEndPoint(lat, lng);
    showToast('Destination set', 'success');
};

// ---- Icon Factories ----
function createFAIcon(iconClass, color, size = 30) {
    return L.divIcon({
        className: 'custom-marker-icon',
        html: `<div style="width:${size}px;height:${size}px;background:${color};display:flex;align-items:center;justify-content:center;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);"><i class="fa-solid ${iconClass}" style="color:#fff;font-size:${size * 0.45}px;"></i></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2]
    });
}

function createImageIcon(imageSrc, size = 36) {
    return L.divIcon({
        className: 'custom-marker-icon',
        html: `<div style="width:${size}px;height:${size}px;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);overflow:hidden;"><img src="assets/icons/${imageSrc}" style="width:100%;height:100%;object-fit:cover;" /></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2]
    });
}

function createStopIcon(stop, size = 22) {
    if (stop.iconType === 'image') return createImageIcon(stop.icon, size);
    return createFAIcon(stop.icon || 'fa-bus', stop.color || '#e74c3c', size);
}

function smoothMoveMarker(marker, targetLatLng, durationMs = 1500) {
    const start = marker.getLatLng();
    const dLat = targetLatLng[0] - start.lat;
    const dLng = targetLatLng[1] - start.lng;
    if (Math.abs(dLat) < 0.00001 && Math.abs(dLng) < 0.00001) return;
    const startTime = performance.now();
    if (marker._smoothAnim) cancelAnimationFrame(marker._smoothAnim);
    function step(now) {
        const t = Math.min((now - startTime) / durationMs, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        marker.setLatLng([start.lat + dLat * ease, start.lng + dLng * ease]);
        if (t < 1) marker._smoothAnim = requestAnimationFrame(step);
        else marker._smoothAnim = null;
    }
    marker._smoothAnim = requestAnimationFrame(step);
}

// ---- Point Marker Icons ----
const startIcon = L.divIcon({
    className: 'custom-marker-icon',
    html: '<div style="width:38px;height:38px;background:#2ecc71;display:flex;align-items:center;justify-content:center;border-radius:50%;border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,0.4);"><i class="fa-solid fa-person" style="color:#fff;font-size:18px;"></i></div>',
    iconSize: [38, 38], iconAnchor: [19, 19]
});

const endIcon = L.divIcon({
    className: 'custom-marker-icon',
    html: '<div style="width:38px;height:38px;background:#e74c3c;display:flex;align-items:center;justify-content:center;border-radius:50%;border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,0.4);"><i class="fa-solid fa-flag-checkered" style="color:#fff;font-size:16px;"></i></div>',
    iconSize: [38, 38], iconAnchor: [19, 19]
});

const nearStopIcon = L.divIcon({
    className: 'custom-marker-icon',
    html: '<div style="width:32px;height:32px;background:#f39c12;display:flex;align-items:center;justify-content:center;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);"><i class="fa-solid fa-bus" style="color:#fff;font-size:14px;"></i></div>',
    iconSize: [32, 32], iconAnchor: [16, 16]
});

// ---- Data Loading ----
async function loadData() {
    try {
        [allStops, allRoutes, allVehicles] = await Promise.all([
            api(`${API}?type=stops`),
            api(`${API}?type=routes`),
            api(`${API}?type=vehicles`)
        ]);
        publicStops = allStops.filter(s => (s.type || 'actual') !== 'road-helper');
        renderContextLayers();
        applyLayerVisibility();
        showToast(`Loaded ${publicStops.length} stops, ${allRoutes.length} routes`, 'info', 2000);
    } catch (err) {
        showToast('Failed to load data. Is the server running?', 'error', 5000);
    }
}

function renderContextLayers() {
    contextRouteLayers.forEach(l => map.removeLayer(l));
    contextStopLayers.forEach(l => map.removeLayer(l));
    contextRouteLayers = [];
    contextStopLayers = [];

    // Draw routes as thin context lines
    allRoutes.forEach(route => {
        const coords = route.stopIds
            .map(id => allStops.find(s => s.id === id))
            .filter(Boolean)
            .map(s => [s.lat, s.lng]);
        if (coords.length >= 2) {
            const poly = L.polyline(coords, {
                color: route.color || '#555',
                weight: 3,
                opacity: 0.25,
                dashArray: route.style === 'dashed' ? '12, 8' : route.style === 'dotted' ? '3, 8' : null
            }).addTo(map).bindPopup(`<b>${route.name}</b><br><small>${route.stopIds.length} stops</small>`);
            contextRouteLayers.push(poly);
        }
    });

    // Draw stops as small markers with hover tooltips
    publicStops.forEach(s => {
        const m = L.marker([s.lat, s.lng], { icon: createStopIcon(s, 18), opacity: 0.6 })
            .addTo(map)
            .bindPopup(`<b>${s.name}</b><br><small>ID: ${s.id}</small>`)
            .bindTooltip(s.name, { direction: 'top', className: 'stop-tooltip', offset: [0, -10] });
        contextStopLayers.push(m);
    });
}

function applyLayerVisibility() {
    contextRouteLayers.forEach(layer => {
        if (uiPrefs.showRoutes) {
            if (!map.hasLayer(layer)) layer.addTo(map);
        } else if (map.hasLayer(layer)) {
            map.removeLayer(layer);
        }
    });

    contextStopLayers.forEach(layer => {
        if (uiPrefs.showStops) {
            if (!map.hasLayer(layer)) layer.addTo(map);
        } else if (map.hasLayer(layer)) {
            map.removeLayer(layer);
        }
    });
}

function getFitPadding() {
    if (window.innerWidth <= 640) {
        return [56, 56];
    }
    return [60, 420, 60, 60];
}

// ---- Panel Collapse ----
document.getElementById('btn-collapse').addEventListener('click', () => {
    panelCollapsed = !panelCollapsed;
    document.getElementById('search-panel').classList.toggle('collapsed', panelCollapsed);
    document.getElementById('btn-collapse').setAttribute('aria-expanded', String(!panelCollapsed));
    document.getElementById('btn-collapse').innerHTML = panelCollapsed ? '<i class="fa-solid fa-chevron-down"></i>' : '<i class="fa-solid fa-chevron-up"></i>';
});

function expandPanelIfCollapsed() {
    if (!panelCollapsed) return;
    panelCollapsed = false;
    document.getElementById('search-panel').classList.remove('collapsed');
    document.getElementById('btn-collapse').setAttribute('aria-expanded', 'true');
    document.getElementById('btn-collapse').innerHTML = '<i class="fa-solid fa-chevron-up"></i>';
}

document.getElementById('toggle-routes').addEventListener('change', (e) => {
    uiPrefs.showRoutes = e.target.checked;
    applyLayerVisibility();
    showToast(uiPrefs.showRoutes ? 'Route overlays enabled' : 'Route overlays hidden', 'info', 1200);
});

document.getElementById('toggle-stops').addEventListener('change', (e) => {
    uiPrefs.showStops = e.target.checked;
    applyLayerVisibility();
    showToast(uiPrefs.showStops ? 'Stop markers enabled' : 'Stop markers hidden', 'info', 1200);
});

document.getElementById('toggle-vehicles').addEventListener('change', (e) => {
    uiPrefs.showVehicles = e.target.checked;
    if (!uiPrefs.showVehicles) {
        stopVehiclePolling();
        showToast('Live vehicles hidden', 'info', 1200);
        return;
    }
    if (currentJourney) startVehiclePolling();
    else pollVehicles();
    showToast('Live vehicles enabled', 'success', 1200);
});

document.getElementById('toggle-follow-gps').addEventListener('change', (e) => {
    uiPrefs.followGPS = e.target.checked;
    if (uiPrefs.followGPS && !gpsActive) {
        showToast('Enable GPS to use follow mode', 'warning', 1500);
    } else {
        showToast(uiPrefs.followGPS ? 'GPS follow enabled' : 'GPS follow disabled', 'info', 1200);
    }
});

document.getElementById('btn-clear-global').addEventListener('click', () => {
    const input = document.getElementById('input-global-search');
    input.value = '';
    document.getElementById('suggestions-global').classList.add('hidden');
    document.getElementById('suggestions-global').innerHTML = '';
    input.focus();
});

// ---- Pick Mode & Markers ----

document.getElementById('btn-pick-start').addEventListener('click', () => {
    pickingMode = pickingMode === 'start' ? null : 'start';
    updatePickButtons();
    setStatus(pickingMode === 'start' ? 'Click on the map to set your starting location.' : 'Pick your start and destination on the map.');
    if (pickingMode) showToast('Click on the map to set start', 'info', 2000);
});

document.getElementById('btn-pick-end').addEventListener('click', () => {
    pickingMode = pickingMode === 'end' ? null : 'end';
    updatePickButtons();
    setStatus(pickingMode === 'end' ? 'Click on the map to set your destination.' : 'Pick your start and destination on the map.');
    if (pickingMode) showToast('Click on the map to set destination', 'info', 2000);
});

function updatePickButtons() {
    document.getElementById('btn-pick-start').classList.toggle('active', pickingMode === 'start');
    document.getElementById('btn-pick-end').classList.toggle('active', pickingMode === 'end');
    map.getContainer().style.cursor = pickingMode ? 'crosshair' : '';
}

map.on('click', (e) => {
    if (!pickingMode) return;
    const { lat, lng } = e.latlng;
    if (pickingMode === 'start') {
        setStartPoint(lat, lng);
        showToast('Start location set', 'success', 1500);
    } else {
        setEndPoint(lat, lng);
        showToast('Destination set', 'success', 1500);
    }
    pickingMode = null;
    updatePickButtons();
});

function setStartPoint(lat, lng, name) {
    startPoint = { lat, lng };
    if (startMarker) map.removeLayer(startMarker);
    startMarker = L.marker([lat, lng], { icon: startIcon, draggable: true, zIndexOffset: 1000 }).addTo(map);
    startMarker.on('dragend', (e) => {
        const p = e.target.getLatLng();
        startPoint = { lat: p.lat, lng: p.lng };
        document.getElementById('input-start').value = `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
    });
    document.getElementById('input-start').value = name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    setStatus(endPoint ? 'Ready to navigate. Click Navigate!' : 'Now set your destination.');
}

function setEndPoint(lat, lng, name) {
    endPoint = { lat, lng };
    if (endMarker) map.removeLayer(endMarker);
    endMarker = L.marker([lat, lng], { icon: endIcon, draggable: true, zIndexOffset: 1000 }).addTo(map);
    endMarker.on('dragend', (e) => {
        const p = e.target.getLatLng();
        endPoint = { lat: p.lat, lng: p.lng };
        document.getElementById('input-end').value = `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
    });
    document.getElementById('input-end').value = name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    setStatus(startPoint ? 'Ready to navigate. Click Navigate!' : 'Now set your starting location.');
}

// ---- Swap ----
document.getElementById('btn-swap').addEventListener('click', () => {
    if (!startPoint && !endPoint) return;
    const tmpPt = startPoint;
    startPoint = endPoint;
    endPoint = tmpPt;

    const tmpMarker = startMarker;
    startMarker = endMarker;
    endMarker = tmpMarker;

    if (startMarker) startMarker.setIcon(startIcon);
    if (endMarker) endMarker.setIcon(endIcon);

    if (startMarker) {
        startMarker.off('dragend');
        startMarker.on('dragend', (e) => {
            const p = e.target.getLatLng();
            startPoint = { lat: p.lat, lng: p.lng };
            document.getElementById('input-start').value = `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
        });
    }
    if (endMarker) {
        endMarker.off('dragend');
        endMarker.on('dragend', (e) => {
            const p = e.target.getLatLng();
            endPoint = { lat: p.lat, lng: p.lng };
            document.getElementById('input-end').value = `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
        });
    }

    document.getElementById('input-start').value = startPoint ? `${startPoint.lat.toFixed(5)}, ${startPoint.lng.toFixed(5)}` : '';
    document.getElementById('input-end').value = endPoint ? `${endPoint.lat.toFixed(5)}, ${endPoint.lng.toFixed(5)}` : '';
    showToast('Locations swapped', 'info', 1500);
});

// ---- Clear ----
document.getElementById('btn-clear').addEventListener('click', clearAll);

function clearAll() {
    if (startMarker) { map.removeLayer(startMarker); startMarker = null; }
    if (endMarker) { map.removeLayer(endMarker); endMarker = null; }
    startPoint = null;
    endPoint = null;
    currentJourney = null;
    clearJourneyLayers();
    document.getElementById('input-start').value = '';
    document.getElementById('input-end').value = '';
    document.getElementById('journey-results').classList.add('hidden');
    document.getElementById('journey-results').innerHTML = '';
    setStatus('Pick your start and destination on the map.');
    stopVehiclePolling();
}

function clearJourneyLayers() {
    journeyLayers.forEach(l => map.removeLayer(l));
    journeyLayers = [];
    Object.values(vehicleMarkers).forEach(m => map.removeLayer(m));
    vehicleMarkers = {};
}

function setStatus(msg, type = '') {
    const el = document.getElementById('search-status');
    el.textContent = msg;
    el.className = 'status-msg' + (type ? ' ' + type : '');
}

// ---- Navigate ----
document.getElementById('btn-navigate').addEventListener('click', navigate);

async function navigate() {
    if (!startPoint || !endPoint) {
        setStatus('Please set both start and destination.', 'error');
        showToast('Set both start and destination first', 'warning');
        return;
    }

    clearJourneyLayers();
    const resultsEl = document.getElementById('journey-results');
    resultsEl.classList.remove('hidden');
    resultsEl.innerHTML = '<div class="loading-overlay"><div class="loading-spinner"></div>Finding your route...</div>';
    setStatus('Calculating journey...', '');

    const navBtn = document.getElementById('btn-navigate');
    navBtn.classList.add('loading');
    navBtn.innerHTML = '<div class="loading-spinner small" style="display:inline-block;"></div> Finding...';

    try {
        // 1. Find nearest stops
        const startResult = findNearestStop(startPoint.lat, startPoint.lng, publicStops);
        const endResult = findNearestStop(endPoint.lat, endPoint.lng, publicStops);

        if (!startResult.stop || !endResult.stop) {
            await showWalkingFallback('No bus stops found in the area.');
            return;
        }

        // 2. Find connecting route
        const directRoutes = findConnectingRoutes(startResult.stop.id, endResult.stop.id, allRoutes);
        let journey;

        if (directRoutes.length > 0) {
            journey = await buildDirectJourney(startResult, endResult, directRoutes[0]);
        } else {
            // Try transfer
            const transfer = findTransferRoutes(startResult.stop.id, endResult.stop.id, allRoutes, publicStops);
            if (transfer) {
                journey = await buildTransferJourney(startResult, endResult, transfer);
            } else {
                // FALLBACK: Show walking route
                await showWalkingFallback('No bus route connects these locations.');
                return;
            }
        }

        currentJourney = journey;
        displayJourney(journey);
        startVehiclePolling();
        setStatus('Route found!', 'success');
        showToast('Transit route found!', 'success');

    } catch (err) {
        console.error('Navigation error:', err);
        await showWalkingFallback('An error occurred while finding your route.');
    } finally {
        navBtn.classList.remove('loading');
        navBtn.innerHTML = '<i class="fa-solid fa-route"></i> Navigate';
    }
}

// ---- Walking Fallback ----
async function showWalkingFallback(reason) {
    setStatus('No transit route found. Showing walking directions.', 'warning');

    try {
        const walkRoute = await getOSRMRoute(
            [[startPoint.lat, startPoint.lng], [endPoint.lat, endPoint.lng]],
            'foot'
        );

        if (walkRoute && walkRoute.coords.length >= 2) {
            clearJourneyLayers();

            const poly = L.polyline(walkRoute.coords, {
                color: '#2ecc71', weight: 5, opacity: 0.85, dashArray: '8, 10'
            }).addTo(map);
            journeyLayers.push(poly);

            map.fitBounds(walkRoute.coords, { padding: getFitPadding() });

            const resultsEl = document.getElementById('journey-results');
            resultsEl.innerHTML = `
                <div class="fallback-banner">
                    <div class="fallback-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
                    <div class="fallback-text">
                        <strong>${reason}</strong>
                        <p>Here's the walking route instead:</p>
                    </div>
                </div>
                <div class="leg-card walk">
                    <div class="leg-header">
                        <div class="leg-icon"><i class="fa-solid fa-person-walking"></i></div>
                        <span class="leg-title">Walk to destination</span>
                    </div>
                    <div class="leg-details">
                        <span><i class="fa-solid fa-ruler"></i> ${formatDistance(walkRoute.distance)}</span>
                        <span><i class="fa-solid fa-clock"></i> ${formatDuration(walkRoute.duration)}</span>
                        <span><i class="fa-solid fa-location-dot"></i> Your location &rarr; Destination</span>
                    </div>
                </div>
                <div class="fallback-tip">
                    <i class="fa-solid fa-lightbulb"></i>
                    Try picking locations closer to a bus route for transit directions.
                </div>
            `;
            showToast('No transit route - showing walking route', 'warning', 4000);
        } else {
            showNoRoute(reason);
        }
    } catch (err) {
        showNoRoute(reason);
    }
}

async function buildDirectJourney(startResult, endResult, routeMatch) {
    const { route, subStopIds } = routeMatch;

    const subStops = subStopIds.map(id => allStops.find(s => s.id === id)).filter(Boolean);
    const visibleSubStops = subStops.filter(s => (s.type || 'actual') !== 'road-helper');

    const [walkLeg1, busLeg, walkLeg2] = await Promise.all([
        getOSRMRoute([[startPoint.lat, startPoint.lng], [startResult.stop.lat, startResult.stop.lng]], 'foot'),
        snapRouteToRoad(subStops),
        getOSRMRoute([[endResult.stop.lat, endResult.stop.lng], [endPoint.lat, endPoint.lng]], 'foot')
    ]);

    return {
        type: 'direct',
        legs: [
            { type: 'walk', label: 'Walk to bus stop', from: 'Your location', to: startResult.stop.name, route: walkLeg1, distance: walkLeg1?.distance || startResult.distance, duration: walkLeg1?.duration || 0, stop: startResult.stop },
            { type: 'bus', label: `${route.name}`, from: startResult.stop.name, to: endResult.stop.name, coords: busLeg, stops: visibleSubStops, route, distance: 0, duration: 0 },
            { type: 'walk', label: 'Walk to destination', from: endResult.stop.name, to: 'Your destination', route: walkLeg2, distance: walkLeg2?.distance || endResult.distance, duration: walkLeg2?.duration || 0, stop: endResult.stop }
        ],
        startStop: startResult.stop,
        endStop: endResult.stop
    };
}

async function buildTransferJourney(startResult, endResult, transfer) {
    const { legs: [leg1Match, leg2Match], transferStop } = transfer;

    const subStops1 = leg1Match.subStopIds.map(id => allStops.find(s => s.id === id)).filter(Boolean);
    const subStops2 = leg2Match.subStopIds.map(id => allStops.find(s => s.id === id)).filter(Boolean);
    const visibleSubStops1 = subStops1.filter(s => (s.type || 'actual') !== 'road-helper');
    const visibleSubStops2 = subStops2.filter(s => (s.type || 'actual') !== 'road-helper');

    const [walkLeg1, busLeg1, busLeg2, walkLeg2] = await Promise.all([
        getOSRMRoute([[startPoint.lat, startPoint.lng], [startResult.stop.lat, startResult.stop.lng]], 'foot'),
        snapRouteToRoad(subStops1),
        snapRouteToRoad(subStops2),
        getOSRMRoute([[endResult.stop.lat, endResult.stop.lng], [endPoint.lat, endPoint.lng]], 'foot')
    ]);

    return {
        type: 'transfer',
        legs: [
            { type: 'walk', label: 'Walk to bus stop', from: 'Your location', to: startResult.stop.name, route: walkLeg1, distance: walkLeg1?.distance || startResult.distance, duration: walkLeg1?.duration || 0, stop: startResult.stop },
            { type: 'bus', label: `${leg1Match.route.name}`, from: startResult.stop.name, to: transferStop.name, coords: busLeg1, stops: visibleSubStops1, route: leg1Match.route, distance: 0, duration: 0 },
            { type: 'walk', label: `Transfer at ${transferStop.name}`, from: transferStop.name, to: transferStop.name, route: null, distance: 0, duration: 60, stop: transferStop, isTransfer: true },
            { type: 'bus', label: `${leg2Match.route.name}`, from: transferStop.name, to: endResult.stop.name, coords: busLeg2, stops: visibleSubStops2, route: leg2Match.route, distance: 0, duration: 0 },
            { type: 'walk', label: 'Walk to destination', from: endResult.stop.name, to: 'Your destination', route: walkLeg2, distance: walkLeg2?.distance || endResult.distance, duration: walkLeg2?.duration || 0, stop: endResult.stop }
        ],
        startStop: startResult.stop,
        endStop: endResult.stop,
        transferStop
    };
}

// ---- Display Journey on Map ----

function displayJourney(journey) {
    clearJourneyLayers();
    const allBounds = [];

    journey.legs.forEach(leg => {
        if (leg.type === 'walk' && !leg.isTransfer) {
            const coords = leg.route ? leg.route.coords : [[startPoint.lat, startPoint.lng], [leg.stop.lat, leg.stop.lng]];
            if (coords && coords.length >= 2) {
                const poly = L.polyline(coords, {
                    color: '#2ecc71', weight: 5, opacity: 0.85, dashArray: '8, 10'
                }).addTo(map);
                journeyLayers.push(poly);
                allBounds.push(...coords);
            }
        } else if (leg.type === 'bus') {
            if (leg.coords && leg.coords.length >= 2) {
                const poly = L.polyline(leg.coords, {
                    color: leg.route.color || '#3498db', weight: 6, opacity: 0.9
                }).addTo(map).bindPopup(`<b>${leg.route.name}</b>`);
                journeyLayers.push(poly);
                allBounds.push(...leg.coords);

                // Direction arrows
                addDirectionArrows(leg.coords, leg.route.color || '#3498db');
            }

            leg.stops.forEach((s, i) => {
                const isEndpoint = i === 0 || i === leg.stops.length - 1;
                const m = L.marker([s.lat, s.lng], {
                    icon: isEndpoint ? nearStopIcon : createStopIcon(s, 16),
                    zIndexOffset: isEndpoint ? 500 : 0
                }).addTo(map).bindPopup(`<b>${s.name}</b>`);
                if (isEndpoint) {
                    m.bindTooltip(s.name, { permanent: true, direction: 'top', className: 'stop-label', offset: [0, -16] });
                }
                journeyLayers.push(m);
            });
        }
    });

    if (allBounds.length > 0) {
        map.fitBounds(allBounds, { padding: getFitPadding() });
    }

    renderJourneyPanel(journey);
}

function addDirectionArrows(coords, color) {
    if (coords.length < 4) return;
    const step = Math.max(Math.floor(coords.length / 8), 3);
    for (let i = step; i < coords.length - 1; i += step) {
        const point = coords[i];
        const next = coords[Math.min(i + 1, coords.length - 1)];
        const angle = Math.atan2(next[1] - point[1], next[0] - point[0]) * 180 / Math.PI;
        const arrowIcon = L.divIcon({
            className: 'route-arrow',
            html: `<div style="transform:rotate(${90 - angle}deg);color:${color};font-size:14px;text-shadow:0 0 3px rgba(0,0,0,0.5);"><i class="fa-solid fa-chevron-up"></i></div>`,
            iconSize: [14, 14], iconAnchor: [7, 7]
        });
        const m = L.marker(point, { icon: arrowIcon, interactive: false }).addTo(map);
        journeyLayers.push(m);
    }
}

function renderJourneyPanel(journey) {
    const resultsEl = document.getElementById('journey-results');

    let totalWalkDist = 0, totalWalkTime = 0, busLegs = 0, totalBusDist = 0;
    journey.legs.forEach(leg => {
        if (leg.type === 'walk') { totalWalkDist += leg.distance; totalWalkTime += leg.duration; }
        if (leg.type === 'bus') { busLegs++; if (leg.coords) totalBusDist += estimatePolylineDistance(leg.coords); }
    });

    let html = '';

    const routeType = journey.type === 'transfer' ? 'Transfer Route' : 'Direct Route';
    html += `
        <div class="journey-summary">
            <div class="summary-icon"><i class="fa-solid fa-route"></i></div>
            <div class="summary-info">
                <div class="summary-title">${routeType} Found</div>
                <div class="summary-stats">
                    <i class="fa-solid fa-person-walking"></i> ${formatDistance(totalWalkDist)} walking &nbsp;&middot;&nbsp;
                    <i class="fa-solid fa-bus"></i> ${busLegs} bus${busLegs > 1 ? 'es' : ''} &nbsp;&middot;&nbsp;
                    <i class="fa-solid fa-road"></i> ~${formatDistance(totalBusDist)} by bus &nbsp;&middot;&nbsp;
                    <i class="fa-solid fa-clock"></i> ~${formatDuration(totalWalkTime + 60 * busLegs * 5)}
                </div>
            </div>
        </div>`;

    journey.legs.forEach((leg) => {
        if (leg.isTransfer) {
            html += `
                <div class="leg-card transfer">
                    <div class="leg-header">
                        <div class="leg-icon"><i class="fa-solid fa-arrows-turn-to-dots"></i></div>
                        <span class="leg-title">${leg.label}</span>
                    </div>
                    <div class="leg-details">
                        <span><i class="fa-solid fa-clock"></i> ~1 min wait</span>
                    </div>
                </div>`;
            return;
        }

        const cardClass = leg.type === 'walk' ? 'walk' : 'bus';
        const icon = leg.type === 'walk' ? 'fa-person-walking' : 'fa-bus';

        html += `
            <div class="leg-card ${cardClass}">
                <div class="leg-header">
                    <div class="leg-icon"><i class="fa-solid ${icon}"></i></div>
                    <span class="leg-title">${leg.label}</span>
                    ${leg.type === 'bus' ? `<span class="leg-badge" style="background:${leg.route.color}">${leg.stops.length} stops</span>` : ''}
                </div>
                <div class="leg-details">
                    ${leg.distance > 0 ? `<span><i class="fa-solid fa-ruler"></i> ${formatDistance(leg.distance)}</span>` : ''}
                    ${leg.duration > 0 ? `<span><i class="fa-solid fa-clock"></i> ${formatDuration(leg.duration)}</span>` : ''}
                    <span><i class="fa-solid fa-location-dot"></i> ${leg.from} &rarr; ${leg.to}</span>
                </div>`;

        if (leg.type === 'bus' && leg.stops) {
            html += '<div class="leg-stops">';
            leg.stops.forEach((s, j) => {
                const highlight = j === 0 || j === leg.stops.length - 1;
                html += `<div class="stop-name ${highlight ? 'highlight' : ''}"><span class="stop-dot"></span>${s.name}</div>`;
            });
            html += '</div>';
        }

        html += '</div>';
    });

    resultsEl.innerHTML = html;
}

function estimatePolylineDistance(coords) {
    let total = 0;
    for (let i = 1; i < coords.length; i++) {
        total += haversineDistanceMeters(coords[i - 1], coords[i]);
    }
    return total;
}

function showNoRoute(msg) {
    const resultsEl = document.getElementById('journey-results');
    resultsEl.classList.remove('hidden');
    resultsEl.innerHTML = `
        <div class="no-route-card">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <p>${msg}</p>
        </div>`;
    setStatus('No route found.', 'error');
}

// ---- Vehicle Tracking ----

function startVehiclePolling() {
    if (!uiPrefs.showVehicles) return;
    stopVehiclePolling();
    pollVehicles();
    vehiclePollTimer = setInterval(pollVehicles, 3000);
}

function stopVehiclePolling() {
    if (vehiclePollTimer) { clearInterval(vehiclePollTimer); vehiclePollTimer = null; }
    Object.values(vehicleMarkers).forEach(m => map.removeLayer(m));
    vehicleMarkers = {};
}

async function pollVehicles() {
    if (!uiPrefs.showVehicles) return;
    try {
        allVehicles = await api(`${API}?type=vehicles`);
    } catch { return; }

    const routeIds = new Set();
    if (currentJourney) {
        currentJourney.legs.forEach(leg => {
            if (leg.type === 'bus' && leg.route) routeIds.add(leg.route.id);
        });
    }

    allVehicles.forEach(v => {
        if (routeIds.size > 0 && !routeIds.has(v.routeId)) return;

        const key = 'v_' + v.id;
        const icon = v.iconType === 'image'
            ? createImageIcon(v.icon, 40)
            : createFAIcon(v.icon || 'fa-bus', v.color || '#61dafb', 40);

        if (vehicleMarkers[key]) {
            smoothMoveMarker(vehicleMarkers[key], [v.lat, v.lng], 2500);
            vehicleMarkers[key].setIcon(icon);
        } else {
            const m = L.marker([v.lat, v.lng], { icon, zIndexOffset: 800 }).addTo(map)
                .bindPopup(`<b>${v.name}</b>`)
                .bindTooltip(v.name, { permanent: true, direction: 'top', className: 'vehicle-label', offset: [0, -20] });
            vehicleMarkers[key] = m;
        }
    });

    const activeKeys = new Set(allVehicles
        .filter(v => routeIds.size === 0 || routeIds.has(v.routeId))
        .map(v => 'v_' + v.id));
    Object.keys(vehicleMarkers).forEach(key => {
        if (!activeKeys.has(key)) { map.removeLayer(vehicleMarkers[key]); delete vehicleMarkers[key]; }
    });
}

// ---- GPS Tracking ----

function createArrowIcon(heading) {
    const r = heading != null ? heading : 0;
    return L.divIcon({
        className: 'geo-arrow-icon',
        html: `<div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;">
            <div style="width:36px;height:36px;background:rgba(52,152,219,0.85);border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;position:relative;">
                <div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:10px solid #fff;position:absolute;top:2px;transform:rotate(${r}deg);transform-origin:50% 16px;"></div>
                <i class="fa-solid fa-circle" style="color:#fff;font-size:5px;position:relative;z-index:1;"></i>
            </div>
        </div>`,
        iconSize: [44, 44], iconAnchor: [22, 22]
    });
}

function createLocationIcon() {
    return L.divIcon({
        className: 'geo-pulse-icon',
        html: '<div class="geo-pulse-dot"></div>',
        iconSize: [20, 20], iconAnchor: [10, 10]
    });
}

document.getElementById('btn-gps').addEventListener('click', () => {
    if (gpsActive) stopGPS(); else startGPS();
});

document.getElementById('btn-center-gps').addEventListener('click', () => {
    if (gpsMarker) map.flyTo(gpsMarker.getLatLng(), 17);
    suppressAutoCenter = false;
});

document.getElementById('btn-use-gps-start').addEventListener('click', () => {
    if (gpsMarker) {
        const pos = gpsMarker.getLatLng();
        setStartPoint(pos.lat, pos.lng);
        showToast('GPS location set as start', 'success');
    } else {
        showToast('Enable GPS first', 'warning');
    }
});

function startGPS() {
    if (!navigator.geolocation) {
        document.getElementById('gps-status').textContent = 'GPS not available';
        showToast('GPS not available on this device', 'error');
        return;
    }
    gpsActive = true;
    document.getElementById('btn-gps').classList.add('active');
    document.getElementById('btn-gps').style.background = '#2ecc71';
    document.getElementById('btn-gps').style.color = '#0f1117';
    document.getElementById('gps-status').textContent = 'Locating...';
    document.getElementById('gps-status').className = 'gps-info active';
    document.getElementById('btn-use-gps-start').classList.remove('hidden');

    gpsWatchId = navigator.geolocation.watchPosition(onGPSUpdate, onGPSError, {
        enableHighAccuracy: true, maximumAge: 2000, timeout: 10000
    });
    startOrientationListening();
}

function stopGPS() {
    gpsActive = false;
    if (gpsWatchId != null) { navigator.geolocation.clearWatch(gpsWatchId); gpsWatchId = null; }
    stopOrientationListening();
    if (gpsMarker) { map.removeLayer(gpsMarker); gpsMarker = null; }
    if (gpsHeadingMarker) { map.removeLayer(gpsHeadingMarker); gpsHeadingMarker = null; }
    if (gpsAccuracyCircle) { map.removeLayer(gpsAccuracyCircle); gpsAccuracyCircle = null; }
    document.getElementById('btn-gps').classList.remove('active');
    document.getElementById('btn-gps').style.background = '';
    document.getElementById('btn-gps').style.color = '';
    document.getElementById('gps-status').textContent = 'GPS off';
    document.getElementById('gps-status').className = 'gps-info';
    document.getElementById('btn-use-gps-start').classList.add('hidden');
    suppressAutoCenter = false;
}

function onGPSUpdate(position) {
    const { latitude: lat, longitude: lng, accuracy, heading } = position.coords;
    if (heading != null && !isNaN(heading)) currentHeading = heading;

    document.getElementById('gps-status').textContent = `${Math.round(accuracy)}m accuracy`;

    if (!gpsMarker) {
        gpsMarker = L.marker([lat, lng], { icon: createLocationIcon(), zIndexOffset: 900 }).addTo(map);
        gpsHeadingMarker = L.marker([lat, lng], { icon: createArrowIcon(currentHeading), zIndexOffset: 901 }).addTo(map);
        gpsAccuracyCircle = L.circle([lat, lng], { radius: accuracy, color: '#3498db', fillColor: '#3498db', fillOpacity: 0.1, weight: 1 }).addTo(map);
        map.flyTo([lat, lng], 17);
    } else {
        gpsMarker.setLatLng([lat, lng]);
        gpsHeadingMarker.setLatLng([lat, lng]);
        gpsHeadingMarker.setIcon(createArrowIcon(currentHeading));
        gpsAccuracyCircle.setLatLng([lat, lng]);
        gpsAccuracyCircle.setRadius(accuracy);
        if (uiPrefs.followGPS && !suppressAutoCenter) {
            map.flyTo([lat, lng], Math.max(map.getZoom(), 16), { animate: true, duration: 0.5 });
        }
    }
}

function onGPSError(err) {
    const msgs = { 1: 'Permission denied', 2: 'Location unavailable', 3: 'Timeout' };
    document.getElementById('gps-status').textContent = msgs[err.code] || 'GPS error';
    showToast('GPS error: ' + (msgs[err.code] || 'Unknown'), 'error');
}

function startOrientationListening() {
    if (orientationListening) return;
    orientationListening = true;
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission().then(state => {
            if (state === 'granted') {
                window.addEventListener('deviceorientationabsolute', onOrientation, true);
                window.addEventListener('deviceorientation', onOrientation, true);
            }
        }).catch(() => { });
    } else {
        window.addEventListener('deviceorientationabsolute', onOrientation, true);
        window.addEventListener('deviceorientation', onOrientation, true);
    }
}

function stopOrientationListening() {
    orientationListening = false;
    window.removeEventListener('deviceorientationabsolute', onOrientation, true);
    window.removeEventListener('deviceorientation', onOrientation, true);
}

function onOrientation(e) {
    let heading = null;
    if (e.webkitCompassHeading != null) heading = e.webkitCompassHeading;
    else if (e.alpha != null) heading = (360 - e.alpha) % 360;
    if (heading != null) {
        currentHeading = heading;
        if (gpsHeadingMarker) gpsHeadingMarker.setIcon(createArrowIcon(heading));
    }
}

// ---- Keyboard Shortcuts ----
document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !e.target.matches('input,textarea')) {
        e.preventDefault();
        expandPanelIfCollapsed();
        document.getElementById('input-global-search').focus();
        return;
    }

    if (e.key === 'Escape') {
        if (pickingMode) {
            pickingMode = null;
            updatePickButtons();
            setStatus('Pick your start and destination on the map.');
        }
    }
    if (e.key === 'Enter' && startPoint && endPoint && !e.target.matches('input,textarea')) {
        navigate();
    }
});

// ---- Station Autocomplete ----

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function highlightText(name, query) {
    const safe = escapeHtml(name);
    if (!query) return safe;
    const idx = name.toLowerCase().indexOf(query.toLowerCase());
    if (idx < 0) return safe;
    const a = escapeHtml(name.slice(0, idx));
    const b = escapeHtml(name.slice(idx, idx + query.length));
    const c = escapeHtml(name.slice(idx + query.length));
    return `${a}<mark>${b}</mark>${c}`;
}

function scoreNameMatch(text, query) {
    const q = query.toLowerCase();
    const t = text.toLowerCase();
    const idx = t.indexOf(q);
    if (idx === -1) return -1;
    if (idx === 0) return 100 - t.length * 0.05;
    return 65 - idx * 1.25;
}

function rankedStopMatches(query, limit = 8) {
    if (!query || !publicStops.length) return [];
    const results = publicStops
        .map(stop => ({
            stop,
            score: scoreNameMatch(stop.name, query)
        }))
        .filter(item => item.score >= 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(item => item.stop);
    return results;
}

function setupAutocomplete(inputId, suggestionsId, onSelect) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(suggestionsId);
    let activeIndex = -1;
    let currentMatches = [];

    function hideDropdown() {
        dropdown.classList.add('hidden');
        dropdown.innerHTML = '';
        activeIndex = -1;
        currentMatches = [];
    }

    function showSuggestions(query) {
        const q = query.trim();
        if (!q) {
            hideDropdown();
            return;
        }

        currentMatches = rankedStopMatches(q, 9);
        if (!currentMatches.length) {
            hideDropdown();
            return;
        }

        activeIndex = -1;
        dropdown.innerHTML = currentMatches.map((stop, i) => {
            return `<div class="suggestion-item" data-index="${i}">
                <div class="suggestion-icon" style="background:${stop.color || '#0ea5e9'}"><i class="fa-solid ${stop.icon || 'fa-bus'}"></i></div>
                <span class="suggestion-name">${highlightText(stop.name, q)}</span>
            </div>`;
        }).join('');
        dropdown.classList.remove('hidden');

        dropdown.querySelectorAll('.suggestion-item').forEach((item, i) => {
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                selectMatch(currentMatches[i]);
            });
        });
    }

    function selectMatch(stop) {
        if (!stop) return;
        input.value = stop.name;
        hideDropdown();
        onSelect(stop);
    }

    function updateActive(items) {
        items.forEach((el, i) => el.classList.toggle('active', i === activeIndex));
        if (activeIndex >= 0 && items[activeIndex]) {
            items[activeIndex].scrollIntoView({ block: 'nearest' });
        }
    }

    input.addEventListener('input', () => showSuggestions(input.value));

    input.addEventListener('keydown', (e) => {
        const items = dropdown.querySelectorAll('.suggestion-item');
        if (!items.length) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeIndex = Math.min(activeIndex + 1, items.length - 1);
            updateActive(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeIndex = Math.max(activeIndex - 1, 0);
            updateActive(items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const index = activeIndex >= 0 ? activeIndex : 0;
            selectMatch(currentMatches[index]);
        } else if (e.key === 'Escape') {
            hideDropdown();
        }
    });

    input.addEventListener('blur', () => setTimeout(hideDropdown, 120));
    input.addEventListener('focus', () => {
        if (input.value.trim().length > 0) showSuggestions(input.value);
    });
}

function getRouteStops(route) {
    return route.stopIds
        .map(id => allStops.find(s => s.id === id))
        .filter(Boolean);
}

function setupGlobalSearch() {
    const input = document.getElementById('input-global-search');
    const dropdown = document.getElementById('suggestions-global');
    let activeIndex = -1;
    let currentMatches = [];

    function hide() {
        dropdown.classList.add('hidden');
        dropdown.innerHTML = '';
        activeIndex = -1;
        currentMatches = [];
    }

    function queryGlobal(q) {
        const stopResults = rankedStopMatches(q, 5).map(stop => ({
            kind: 'stop',
            title: stop.name,
            meta: 'Stop',
            icon: stop.icon || 'fa-location-dot',
            color: stop.color || '#0ea5e9',
            data: stop,
            score: scoreNameMatch(stop.name, q) + 12
        }));

        const routeResults = allRoutes
            .map(route => {
                const routeScore = Math.max(
                    scoreNameMatch(route.name || '', q),
                    scoreNameMatch((route.code || '').toString(), q)
                );
                if (routeScore < 0) return null;
                return {
                    kind: 'route',
                    title: route.name,
                    meta: `${route.stopIds.length} stops`,
                    icon: 'fa-route',
                    color: route.color || '#0f766e',
                    data: route,
                    score: routeScore + 4
                };
            })
            .filter(Boolean)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);

        return [...stopResults, ...routeResults]
            .sort((a, b) => b.score - a.score)
            .slice(0, 8);
    }

    function render(q) {
        const query = q.trim();
        if (!query) {
            hide();
            return;
        }

        currentMatches = queryGlobal(query);
        if (!currentMatches.length) {
            hide();
            return;
        }

        dropdown.innerHTML = currentMatches.map((item, i) => {
            return `<div class="suggestion-item" data-index="${i}">
                <div class="suggestion-icon" style="background:${item.color}"><i class="fa-solid ${item.icon}"></i></div>
                <div class="suggestion-name">${highlightText(item.title, query)}</div>
                <div class="suggestion-meta">${item.meta}</div>
            </div>`;
        }).join('');
        dropdown.classList.remove('hidden');

        dropdown.querySelectorAll('.suggestion-item').forEach((item, i) => {
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                select(currentMatches[i]);
            });
        });
    }

    function select(item) {
        if (!item) return;
        expandPanelIfCollapsed();
        input.value = item.title;
        hide();

        if (item.kind === 'stop') {
            const stop = item.data;
            map.flyTo([stop.lat, stop.lng], Math.max(map.getZoom(), 15));
            L.popup()
                .setLatLng([stop.lat, stop.lng])
                .setContent(`<b>${escapeHtml(stop.name)}</b><br/><small>Stop</small>`)
                .openOn(map);

            if (!startPoint) {
                setStartPoint(stop.lat, stop.lng, stop.name);
                showToast(`Start set to ${stop.name}`, 'success', 1300);
            } else if (!endPoint) {
                setEndPoint(stop.lat, stop.lng, stop.name);
                showToast(`Destination set to ${stop.name}`, 'success', 1300);
            } else {
                showToast(`Centered on ${stop.name}`, 'info', 1300);
            }
            return;
        }

        if (item.kind === 'route') {
            const route = item.data;
            const stops = getRouteStops(route);
            if (stops.length >= 2) {
                const coords = stops.map(s => [s.lat, s.lng]);
                map.fitBounds(coords, { padding: getFitPadding() });
            }
            setStatus(`Viewing route: ${route.name}`, 'success');
            showToast(`Showing ${route.name}`, 'success', 1400);
        }
    }

    input.addEventListener('input', () => render(input.value));
    input.addEventListener('focus', () => {
        if (input.value.trim()) render(input.value);
    });
    input.addEventListener('blur', () => setTimeout(hide, 120));

    input.addEventListener('keydown', (e) => {
        const items = dropdown.querySelectorAll('.suggestion-item');
        if (!items.length) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeIndex = Math.min(activeIndex + 1, items.length - 1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeIndex = Math.max(activeIndex - 1, 0);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const idx = activeIndex >= 0 ? activeIndex : 0;
            select(currentMatches[idx]);
            return;
        } else if (e.key === 'Escape') {
            hide();
            return;
        }

        items.forEach((el, i) => el.classList.toggle('active', i === activeIndex));
        if (activeIndex >= 0 && items[activeIndex]) {
            items[activeIndex].scrollIntoView({ block: 'nearest' });
        }
    });
}

setupAutocomplete('input-start', 'suggestions-start', (stop) => {
    setStartPoint(stop.lat, stop.lng, stop.name);
    showToast(`Start set to ${stop.name}`, 'success', 1500);
});

setupAutocomplete('input-end', 'suggestions-end', (stop) => {
    setEndPoint(stop.lat, stop.lng, stop.name);
    showToast(`Destination set to ${stop.name}`, 'success', 1500);
});

setupGlobalSearch();

// ---- Init ----
loadData();

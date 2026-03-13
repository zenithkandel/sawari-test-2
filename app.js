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
let assignedVehiclesByLeg = {};
let availableVehiclesByLeg = {};
let selectedVehicleIdsByLeg = {};
let activeRouteBounds = null;
let routeFocusMode = false;
let globalSearchMarker = null;

const selectedPlaces = {
    start: null,
    end: null,
    global: null
};

const uiPrefs = {
    showRoutes: true,
    showStops: true,
    showVehicles: true,
    followGPS: false
};

let suppressAutoCenter = false;

const DEFAULT_BUS_SPEED_KMH = 28;
const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org/search';
const KATHMANDU_VIEWBOX = '85.28,27.75,85.36,27.67';
const PLACE_AUTOCOMPLETE_LIMIT = 5;
const PLACE_AUTOCOMPLETE_MIN_QUERY = 3;
const PLACE_CACHE_TTL_MS = 10 * 60 * 1000;
const PLACE_CACHE_MAX_SIZE = 100;

const placeSearchCache = {
    _store: new Map(),
    get(query) {
        const entry = this._store.get(query);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            this._store.delete(query);
            return null;
        }
        this._store.delete(query);
        this._store.set(query, entry);
        return entry.results.map((place) => ({ ...place }));
    },
    set(query, results) {
        if (this._store.has(query)) this._store.delete(query);
        this._store.set(query, {
            results: results.map((place) => ({ ...place })),
            expiresAt: Date.now() + PLACE_CACHE_TTL_MS
        });
        while (this._store.size > PLACE_CACHE_MAX_SIZE) {
            const oldestKey = this._store.keys().next().value;
            this._store.delete(oldestKey);
        }
    }
};

const placeSearchInFlight = new Map();

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

const TILE_URLS = {
    dark: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
    light: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
    darkLabels: 'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png',
    lightLabels: 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png',
};
const currentTheme = () => document.documentElement.getAttribute('data-theme') || 'dark';

const baseLayer = L.tileLayer(TILE_URLS[currentTheme()], {
    subdomains: 'abcd',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 20
}).addTo(map);

const labelsLayer = L.tileLayer(TILE_URLS[currentTheme() + 'Labels'], {
    subdomains: 'abcd',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 20,
    pane: 'labels'
}).addTo(map);

function setMapTheme(theme) {
    baseLayer.setUrl(TILE_URLS[theme] || TILE_URLS.dark);
    labelsLayer.setUrl(TILE_URLS[theme + 'Labels'] || TILE_URLS.darkLabels);
}

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

function getVehicleRenderType(vehicle) {
    const meta = `${vehicle.name || ''} ${vehicle.icon || ''}`.toLowerCase();
    if (/micro|tempo|van|shuttle/.test(meta)) return 'micro';
    return 'bus';
}

function getVehicleImagePath(vehicle) {
    const explicit = String(vehicle?.vehicle_image || '').trim();
    if (explicit) return explicit;

    if (vehicle?.iconType === 'image' && vehicle?.icon) {
        return `assets/icons/${vehicle.icon}`;
    }

    return '';
}

function createVehicleTileIcon(vehicle, size = 42, isAssigned = false) {
    const type = getVehicleRenderType(vehicle);
    const color = vehicle.color || '#0ea5e9';
    const glyph = type === 'micro' ? 'fa-shuttle-van' : 'fa-bus';
    const imagePath = getVehicleImagePath(vehicle);
    const visual = imagePath
        ? `<img src="${escapeHtml(imagePath)}" alt="${escapeHtml(vehicle.name || 'Vehicle')}" />`
        : `<i class="fa-solid ${glyph}"></i>`;

    return L.divIcon({
        className: 'custom-marker-icon vehicle-tile-marker',
        html: `
            <div class="vehicle-tile ${type} ${imagePath ? 'image' : ''} ${isAssigned ? 'assigned' : ''}" style="--vehicle-size:${size}px;--vehicle-color:${color};">
                ${visual}
            </div>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2]
    });
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

function getDistanceMetersBetween(lat1, lng1, lat2, lng2) {
    return haversineDistanceMeters([lat1, lng1], [lat2, lng2]);
}

function computeEtaSeconds(distanceMeters, speedKmh) {
    const speedMs = Math.max((speedKmh || DEFAULT_BUS_SPEED_KMH) * 1000 / 3600, 1);
    return Math.max(distanceMeters / speedMs, 0);
}

function getLegBoardingStop(leg) {
    if (!leg || leg.type !== 'bus') return null;
    if (leg.boardingStop) return leg.boardingStop;
    if (leg.stops && leg.stops.length) return leg.stops[0];
    return null;
}

function getLegKey(leg, index) {
    const routeId = leg?.route?.id || 'route';
    const boardStopId = getLegBoardingStop(leg)?.id || 'unknown';
    return `${routeId}_${boardStopId}_${index}`;
}

function getEntityRatingAverage(entity) {
    return Number(entity?.ratingAverage) || 0;
}

function getEntityRatingCount(entity) {
    return Number(entity?.ratingCount) || 0;
}

function formatRatingSummary(entity) {
    const count = getEntityRatingCount(entity);
    if (!count) return 'No ratings yet';
    return `${getEntityRatingAverage(entity).toFixed(1)} / 5 (${count})`;
}

function renderStars(value, max = 5) {
    const rounded = Math.round(value);
    let html = '';
    for (let i = 1; i <= max; i++) {
        html += `<i class="fa-solid fa-star ${i <= rounded ? 'filled' : ''}"></i>`;
    }
    return html;
}

function buildRatingControl(type, id, entity, label) {
    return `
        <div class="rating-block">
            <div class="rating-block-head">
                <span>${label}</span>
                <strong>${formatRatingSummary(entity)}</strong>
            </div>
            <div class="rating-display">${renderStars(getEntityRatingAverage(entity))}</div>
            <div class="rating-actions">
                ${[1, 2, 3, 4, 5].map((value) => `<button class="rating-btn" data-rate-type="${type}" data-rate-id="${id}" data-rate-value="${value}" title="Rate ${value} star${value > 1 ? 's' : ''}">${value}</button>`).join('')}
            </div>
        </div>`;
}

async function submitEntityRating(type, id, value) {
    const list = type === 'vehicle' ? allVehicles : allRoutes;
    const entity = list.find((item) => item.id === id);
    if (!entity) return;

    const ratingValue = Math.max(1, Math.min(5, Number(value) || 0));
    if (!ratingValue) return;

    const currentCount = getEntityRatingCount(entity);
    const currentAverage = getEntityRatingAverage(entity);
    const ratingCount = currentCount + 1;
    const ratingAverage = Number((((currentAverage * currentCount) + ratingValue) / ratingCount).toFixed(2));

    const payload = { ...entity, ratingAverage, ratingCount };
    await api(`${API}?type=${type === 'vehicle' ? 'vehicles' : 'routes'}`, 'PUT', payload);

    entity.ratingAverage = ratingAverage;
    entity.ratingCount = ratingCount;

    if (currentJourney) {
        assignVehiclesToJourney(currentJourney);
        renderJourneyPanel(currentJourney);
    }

    showToast(`${type === 'vehicle' ? 'Vehicle' : 'Route'} rated ${ratingValue}/5`, 'success', 1400);
}

function assignVehiclesToJourney(journey) {
    assignedVehiclesByLeg = {};
    availableVehiclesByLeg = {};
    if (!journey) return;

    journey.legs.forEach((leg, index) => {
        if (leg.type !== 'bus' || !leg.route) return;

        const boardingStop = getLegBoardingStop(leg);
        if (!boardingStop) return;

        const legKey = getLegKey(leg, index);
        const candidates = allVehicles.filter(v => v.routeId === leg.route.id);
        if (!candidates.length) return;

        const ranked = [];
        for (const vehicle of candidates) {
            const distanceToBoarding = getDistanceMetersBetween(vehicle.lat, vehicle.lng, boardingStop.lat, boardingStop.lng);
            const etaSeconds = computeEtaSeconds(distanceToBoarding, vehicle.speed);
            const score = etaSeconds + distanceToBoarding * 0.015;
            ranked.push({
                legIndex: index,
                legKey,
                vehicleId: vehicle.id,
                vehicleName: vehicle.name,
                vehicleImage: vehicle.vehicle_image || (vehicle.icon ? `assets/icons/${vehicle.icon}` : ''),
                routeId: leg.route.id,
                boardingStop,
                distanceToBoarding,
                etaSeconds,
                speedKmh: vehicle.speed || DEFAULT_BUS_SPEED_KMH,
                score,
                ratingAverage: getEntityRatingAverage(vehicle),
                ratingCount: getEntityRatingCount(vehicle)
            });
        }

        ranked.sort((a, b) => a.score - b.score);
        availableVehiclesByLeg[legKey] = ranked;

        const preferredVehicleId = selectedVehicleIdsByLeg[legKey];
        const selectedVehicle = ranked.find((item) => item.vehicleId === preferredVehicleId) || ranked[0];
        if (!selectedVehicle) return;

        selectedVehicleIdsByLeg[legKey] = selectedVehicle.vehicleId;
        assignedVehiclesByLeg[legKey] = selectedVehicle;
    });
}

function getAssignedVehicleForLeg(leg, index) {
    const key = getLegKey(leg, index);
    return assignedVehiclesByLeg[key] || null;
}

function getAvailableVehiclesForLeg(leg, index) {
    const key = getLegKey(leg, index);
    return availableVehiclesByLeg[key] || [];
}

function selectVehicleForLeg(leg, index, vehicleId) {
    const legKey = getLegKey(leg, index);
    selectedVehicleIdsByLeg[legKey] = vehicleId;
    if (!currentJourney) return;
    assignVehiclesToJourney(currentJourney);
    renderJourneyPanel(currentJourney);
    renderVisibleJourneyVehicles();
}

function getAssignedVehicleIds() {
    return new Set(Object.values(assignedVehiclesByLeg).map(item => item.vehicleId));
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
        // Initial vehicle poll since toggle defaults to on
        if (uiPrefs.showVehicles) pollVehicles();
        updateStatsBar();
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
    if (routeFocusMode) {
        contextRouteLayers.forEach(layer => {
            if (map.hasLayer(layer)) map.removeLayer(layer);
        });
        contextStopLayers.forEach(layer => {
            if (map.hasLayer(layer)) map.removeLayer(layer);
        });
        return;
    }

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

function openRouteSidebar() {
    const sidebar = document.getElementById('route-sidebar');
    sidebar.classList.remove('hidden');
    document.getElementById('search-panel').classList.add('hidden');
}

function closeRouteSidebar() {
    const sidebar = document.getElementById('route-sidebar');
    sidebar.classList.add('hidden');
    document.getElementById('search-panel').classList.remove('hidden');
}

function updateMapInfoToggleButton() {
    const btn = document.getElementById('btn-reset-focus');
    if (!btn) return;

    const allInfoShown = !routeFocusMode;
    btn.classList.toggle('active', allInfoShown);
    btn.setAttribute('aria-pressed', String(allInfoShown));

    if (allInfoShown) {
        btn.title = 'Show only selected route and related vehicles';
        btn.innerHTML = '<i class="fa-solid fa-route"></i>';
    } else {
        btn.title = 'Show all map info';
        btn.innerHTML = '<i class="fa-solid fa-layer-group"></i>';
    }
}

function enableRouteFocusMode() {
    routeFocusMode = true;
    applyLayerVisibility();
    updateMapInfoToggleButton();
}

function disableRouteFocusMode() {
    routeFocusMode = false;
    applyLayerVisibility();
    updateMapInfoToggleButton();
}

document.getElementById('btn-close-sidebar').addEventListener('click', () => {
    disableRouteFocusMode();
    closeRouteSidebar();
});

document.getElementById('btn-reset-focus').addEventListener('click', () => {
    if (routeFocusMode) {
        disableRouteFocusMode();
        showToast('All map information is now visible', 'info', 1400);
    } else {
        enableRouteFocusMode();
        showToast('Focused on selected route', 'success', 1400);
    }
});

document.getElementById('btn-recenter-route').addEventListener('click', () => {
    if (activeRouteBounds && activeRouteBounds.length) {
        map.fitBounds(activeRouteBounds, { padding: getFitPadding() });
    }
});

updateMapInfoToggleButton();

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

// ---- Theme Toggle ----
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    setMapTheme(theme);
    const icon = document.querySelector('#btn-theme-toggle i');
    if (icon) icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}

document.getElementById('btn-theme-toggle').addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('sawari-theme', next);
});

// ---- Explore Routes Panel ----
const explorePanel = document.getElementById('explore-panel');
const exploreList = document.getElementById('explore-list');
const exploreFilter = document.getElementById('explore-filter');
let exploreHighlightLayers = [];

document.getElementById('btn-explore').addEventListener('click', () => {
    explorePanel.classList.toggle('hidden');
    if (!explorePanel.classList.contains('hidden')) {
        renderExploreRoutes();
        exploreFilter.focus();
    }
});

document.getElementById('btn-close-explore').addEventListener('click', () => {
    explorePanel.classList.add('hidden');
    clearExploreHighlight();
});

exploreFilter.addEventListener('input', () => renderExploreRoutes());

function renderExploreRoutes() {
    const q = exploreFilter.value.toLowerCase().trim();
    const filtered = allRoutes.filter(r => !q || r.name.toLowerCase().includes(q));

    if (!filtered.length) {
        exploreList.innerHTML = '<div class="explore-empty"><i class="fa-solid fa-circle-info"></i> No routes found</div>';
        return;
    }

    exploreList.innerHTML = filtered.map(r => {
        const stopCount = (r.stopIds || []).length;
        return `
            <button class="explore-route-item" data-route-id="${r.id}">
                <span class="explore-route-swatch" style="background:${r.color || '#555'}"></span>
                <div class="explore-route-info">
                    <span class="explore-route-name">${escapeHtml(r.name)}</span>
                    <span class="explore-route-meta">${stopCount} stop${stopCount !== 1 ? 's' : ''}</span>
                </div>
                <i class="fa-solid fa-chevron-right" style="color:var(--text-muted);font-size:11px;"></i>
            </button>`;
    }).join('');
}

exploreList.addEventListener('click', (e) => {
    const item = e.target.closest('[data-route-id]');
    if (!item) return;
    const routeId = Number(item.dataset.routeId);
    showExploreRoute(routeId);
});

function showExploreRoute(routeId) {
    clearExploreHighlight();
    const route = allRoutes.find(r => r.id === routeId);
    if (!route) return;

    const coords = (route.stopIds || [])
        .map(id => allStops.find(s => s.id === id))
        .filter(Boolean)
        .map(s => [s.lat, s.lng]);

    if (coords.length >= 2) {
        const poly = L.polyline(coords, {
            color: route.color || '#555',
            weight: 5,
            opacity: 0.85
        }).addTo(map);
        exploreHighlightLayers.push(poly);

        // Add stop markers along the route
        (route.stopIds || []).forEach(id => {
            const stop = publicStops.find(s => s.id === id);
            if (!stop) return;
            const m = L.marker([stop.lat, stop.lng], { icon: createStopIcon(stop, 24) })
                .addTo(map)
                .bindPopup(`<b>${stop.name}</b>`);
            exploreHighlightLayers.push(m);
        });

        map.fitBounds(poly.getBounds(), { padding: getFitPadding() });
    }

    // Highlight active item
    exploreList.querySelectorAll('.explore-route-item').forEach(el => {
        el.classList.toggle('active', Number(el.dataset.routeId) === routeId);
    });

    showToast(`Showing: ${route.name}`, 'info', 2000);
}

function clearExploreHighlight() {
    exploreHighlightLayers.forEach(l => map.removeLayer(l));
    exploreHighlightLayers = [];
    exploreList.querySelectorAll('.explore-route-item.active').forEach(el => el.classList.remove('active'));
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
    selectedPlaces.global = null;
    if (globalSearchMarker) {
        map.removeLayer(globalSearchMarker);
        globalSearchMarker = null;
    }
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
    selectedPlaces.start = {
        name: name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        lat,
        lon: lng
    };
    startPoint = { lat, lng };
    if (startMarker) map.removeLayer(startMarker);
    startMarker = L.marker([lat, lng], { icon: startIcon, draggable: true, zIndexOffset: 1000 }).addTo(map);
    startMarker.on('dragend', (e) => {
        const p = e.target.getLatLng();
        startPoint = { lat: p.lat, lng: p.lng };
        selectedPlaces.start = {
            name: `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`,
            lat: p.lat,
            lon: p.lng
        };
        document.getElementById('input-start').value = `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
    });
    document.getElementById('input-start').value = name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    setStatus(endPoint ? 'Ready to navigate. Click Navigate!' : 'Now set your destination.');
}

function setEndPoint(lat, lng, name) {
    selectedPlaces.end = {
        name: name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        lat,
        lon: lng
    };
    endPoint = { lat, lng };
    if (endMarker) map.removeLayer(endMarker);
    endMarker = L.marker([lat, lng], { icon: endIcon, draggable: true, zIndexOffset: 1000 }).addTo(map);
    endMarker.on('dragend', (e) => {
        const p = e.target.getLatLng();
        endPoint = { lat: p.lat, lng: p.lng };
        selectedPlaces.end = {
            name: `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`,
            lat: p.lat,
            lon: p.lng
        };
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

    const tmpPlace = selectedPlaces.start;
    selectedPlaces.start = selectedPlaces.end;
    selectedPlaces.end = tmpPlace;

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

    document.getElementById('input-start').value = selectedPlaces.start?.name || (startPoint ? `${startPoint.lat.toFixed(5)}, ${startPoint.lng.toFixed(5)}` : '');
    document.getElementById('input-end').value = selectedPlaces.end?.name || (endPoint ? `${endPoint.lat.toFixed(5)}, ${endPoint.lng.toFixed(5)}` : '');
    showToast('Locations swapped', 'info', 1500);
});

// ---- Clear ----
document.getElementById('btn-clear').addEventListener('click', clearAll);

function clearAll() {
    if (startMarker) { map.removeLayer(startMarker); startMarker = null; }
    if (endMarker) { map.removeLayer(endMarker); endMarker = null; }
    if (globalSearchMarker) { map.removeLayer(globalSearchMarker); globalSearchMarker = null; }
    startPoint = null;
    endPoint = null;
    selectedPlaces.start = null;
    selectedPlaces.end = null;
    selectedPlaces.global = null;
    currentJourney = null;
    activeRouteBounds = null;
    assignedVehiclesByLeg = {};
    availableVehiclesByLeg = {};
    selectedVehicleIdsByLeg = {};
    disableRouteFocusMode();
    closeRouteSidebar();
    clearJourneyLayers();
    document.getElementById('input-start').value = '';
    document.getElementById('input-end').value = '';
    document.getElementById('input-global-search').value = '';
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
    resultsEl.innerHTML = `
        <div class="skeleton">
            <div class="skeleton-card"><div class="skeleton-line w80"></div><div class="skeleton-line w60"></div></div>
            <div class="skeleton-card"><div class="skeleton-line w90"></div><div class="skeleton-line w40"></div><div class="skeleton-line w70"></div></div>
            <div class="skeleton-card"><div class="skeleton-line w50"></div><div class="skeleton-line w80"></div></div>
        </div>`;
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
        openRouteSidebar();
        enableRouteFocusMode();
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
            activeRouteBounds = walkRoute.coords;
            openRouteSidebar();
            enableRouteFocusMode();

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
            { type: 'bus', label: `${route.name}`, from: startResult.stop.name, to: endResult.stop.name, coords: busLeg, stops: visibleSubStops, route, distance: 0, duration: 0, boardingStop: startResult.stop, dropoffStop: endResult.stop },
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
            { type: 'bus', label: `${leg1Match.route.name}`, from: startResult.stop.name, to: transferStop.name, coords: busLeg1, stops: visibleSubStops1, route: leg1Match.route, distance: 0, duration: 0, boardingStop: startResult.stop, dropoffStop: transferStop },
            { type: 'walk', label: `Transfer at ${transferStop.name}`, from: transferStop.name, to: transferStop.name, route: null, distance: 0, duration: 60, stop: transferStop, isTransfer: true },
            { type: 'bus', label: `${leg2Match.route.name}`, from: transferStop.name, to: endResult.stop.name, coords: busLeg2, stops: visibleSubStops2, route: leg2Match.route, distance: 0, duration: 0, boardingStop: transferStop, dropoffStop: endResult.stop },
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
    window._expandedLegs = new Set();
    assignVehiclesToJourney(journey);
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
        activeRouteBounds = allBounds;
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
    const subtitle = document.getElementById('route-sidebar-subtitle');
    if (subtitle) {
        const now = new Date();
        subtitle.textContent = `Live trip guidance · Updated ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }

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

    const busLegsForAssignments = journey.legs
        .map((leg, legIndex) => ({ leg, legIndex }))
        .filter(({ leg }) => leg.type === 'bus' && leg.route);
    if (busLegsForAssignments.length) {
        html += '<div class="assignment-section">';
        busLegsForAssignments.forEach(({ leg, legIndex }, idx) => {
            const selectedVehicle = getAssignedVehicleForLeg(leg, legIndex);
            const vehiclesOnLeg = getAvailableVehiclesForLeg(leg, legIndex);
            html += `
                <div class="assignment-card">
                    <div class="assignment-head">
                        ${selectedVehicle?.vehicleImage ? `<img class="assignment-vehicle-image" src="${escapeHtml(selectedVehicle.vehicleImage)}" alt="${escapeHtml(selectedVehicle.vehicleName)}" />` : ''}
                        <span class="assignment-chip">Route Vehicles ${busLegsForAssignments.length > 1 ? idx + 1 : ''}</span>
                        <strong>${leg.route.name}</strong>
                    </div>
                    <div class="assignment-stats">
                        <span><i class="fa-solid fa-route"></i> ${leg.from} to ${leg.to}</span>
                        <span><i class="fa-solid fa-location-dot"></i> Board at ${leg.boardingStop?.name || leg.from}</span>
                        <span><i class="fa-solid fa-bus"></i> ${vehiclesOnLeg.length} live vehicle${vehiclesOnLeg.length === 1 ? '' : 's'}</span>
                    </div>
                    ${buildRatingControl('route', leg.route.id, leg.route, 'Rate this route recommendation')}
                    <div class="assignment-vehicle-list">
                        ${vehiclesOnLeg.length ? vehiclesOnLeg.map((item) => `
                            <button class="assignment-vehicle-option ${selectedVehicle?.vehicleId === item.vehicleId ? 'selected' : ''}" data-select-leg-key="${item.legKey}" data-select-leg-index="${item.legIndex}" data-select-vehicle-id="${item.vehicleId}">
                                ${item.vehicleImage ? `<img class="assignment-vehicle-thumb" src="${escapeHtml(item.vehicleImage)}" alt="${escapeHtml(item.vehicleName)}" />` : '<span class="assignment-vehicle-thumb placeholder"><i class="fa-solid fa-bus"></i></span>'}
                                <span class="assignment-vehicle-meta">
                                    <strong>${item.vehicleName}</strong>
                                    <span>ETA ${formatDuration(item.etaSeconds)} · ${formatDistance(item.distanceToBoarding)}</span>
                                    <span class="rating-inline">${renderStars(item.ratingAverage)}<em>${item.ratingCount ? `${item.ratingAverage.toFixed(1)} (${item.ratingCount})` : 'No ratings'}</em></span>
                                </span>
                            </button>
                        `).join('') : '<div class="assignment-card assignment-card-empty compact"><div class="assignment-stats"><span><i class="fa-solid fa-circle-info"></i> No live vehicles currently reported on this route.</span></div></div>'}
                    </div>
                    ${selectedVehicle ? buildRatingControl('vehicle', selectedVehicle.vehicleId, selectedVehicle, `Rate ${selectedVehicle.vehicleName}`) : ''}
                </div>`;
        });
        html += '</div>';
    } else {
        html += `
            <div class="assignment-card assignment-card-empty">
                <div class="assignment-head">
                    <span class="assignment-chip">Assigned Bus</span>
                    <strong>No active bus found on this route yet</strong>
                </div>
                <div class="assignment-stats">
                    <span><i class="fa-solid fa-circle-info"></i> Waiting for a vehicle update on your route.</span>
                </div>
            </div>`;
    }

    journey.legs.forEach((leg, legIndex) => {
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
        const assignedForLeg = leg.type === 'bus' ? getAssignedVehicleForLeg(leg, legIndex) : null;
        const vehiclesOnLeg = leg.type === 'bus' ? getAvailableVehiclesForLeg(leg, legIndex) : [];

        html += `
            <div class="leg-card ${cardClass}">
                <div class="leg-header" data-leg-toggle="${legIndex}">
                    <div class="leg-icon"><i class="fa-solid ${icon}"></i></div>
                    <span class="leg-title">${leg.label}</span>
                    ${leg.type === 'bus' ? `<span class="leg-badge" style="background:${leg.route.color}">${leg.stops.length} stops</span>` : ''}
                    <span class="leg-chevron"><i class="fa-solid fa-chevron-down"></i></span>
                </div>
                <div class="leg-body">
                <div class="leg-details">
                    ${leg.distance > 0 ? `<span><i class="fa-solid fa-ruler"></i> ${formatDistance(leg.distance)}</span>` : ''}
                    ${leg.duration > 0 ? `<span><i class="fa-solid fa-clock"></i> ${formatDuration(leg.duration)}</span>` : ''}
                    <span><i class="fa-solid fa-location-dot"></i> ${leg.from} &rarr; ${leg.to}</span>
                </div>`;

        if (leg.type === 'bus' && leg.stops) {
            if (assignedForLeg) {
                html += `
                    <div class="leg-assigned">
                        ${assignedForLeg.vehicleImage ? `<img class="leg-assigned-image" src="${escapeHtml(assignedForLeg.vehicleImage)}" alt="${escapeHtml(assignedForLeg.vehicleName)}" />` : ''}
                        <span><i class="fa-solid fa-bus"></i> ${assignedForLeg.vehicleName}</span>
                        <span><i class="fa-solid fa-clock"></i> ETA to ${assignedForLeg.boardingStop.name}: ${formatDuration(assignedForLeg.etaSeconds)}</span>
                        <span><i class="fa-solid fa-star"></i> ${formatRatingSummary(assignedForLeg)}</span>
                    </div>`;
            }
            html += `<div class="leg-route-meta"><span><i class="fa-solid fa-bus"></i> ${vehiclesOnLeg.length} vehicle${vehiclesOnLeg.length === 1 ? '' : 's'} on this route right now</span><span><i class="fa-solid fa-star"></i> ${formatRatingSummary(leg.route)}</span></div>`;
            html += '<div class="leg-stops">';
            leg.stops.forEach((s, j) => {
                const highlight = j === 0 || j === leg.stops.length - 1;
                html += `<div class="stop-name ${highlight ? 'highlight' : ''}"><span class="stop-dot"></span>${s.name}</div>`;
            });
            html += '</div>';
        }

        html += '</div></div>';
    });

    resultsEl.innerHTML = html;

    // Restore expanded state for leg cards
    if (window._expandedLegs && window._expandedLegs.size > 0) {
        resultsEl.querySelectorAll('[data-leg-toggle]').forEach(toggle => {
            const idx = toggle.getAttribute('data-leg-toggle');
            if (window._expandedLegs.has(idx)) {
                const card = toggle.closest('.leg-card');
                if (card) card.classList.add('expanded');
            }
        });
    }
}

document.getElementById('journey-results').addEventListener('click', async (event) => {
    // Collapsible leg toggle
    const legToggle = event.target.closest('[data-leg-toggle]');
    if (legToggle) {
        const card = legToggle.closest('.leg-card');
        if (card) {
            card.classList.toggle('expanded');
            // Track expanded state across re-renders
            if (!window._expandedLegs) window._expandedLegs = new Set();
            const idx = legToggle.getAttribute('data-leg-toggle');
            if (card.classList.contains('expanded')) {
                window._expandedLegs.add(idx);
            } else {
                window._expandedLegs.delete(idx);
            }
        }
        return;
    }

    const selectVehicleButton = event.target.closest('[data-select-vehicle-id]');
    if (selectVehicleButton && currentJourney) {
        const legIndex = Number(selectVehicleButton.dataset.selectLegIndex);
        const vehicleId = Number(selectVehicleButton.dataset.selectVehicleId);
        const busLeg = currentJourney.legs[legIndex];
        if (busLeg) {
            selectVehicleForLeg(busLeg, legIndex, vehicleId);
        }
        return;
    }

    const rateButton = event.target.closest('[data-rate-type]');
    if (rateButton) {
        const type = rateButton.dataset.rateType;
        const id = Number(rateButton.dataset.rateId);
        const value = Number(rateButton.dataset.rateValue);
        await submitEntityRating(type, id, value);
    }
});

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
    openRouteSidebar();
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

function renderVisibleJourneyVehicles() {
    const routeIds = new Set();
    if (currentJourney) {
        currentJourney.legs.forEach(leg => {
            if (leg.type === 'bus' && leg.route) routeIds.add(leg.route.id);
        });
    }

    const assignedVehicleIds = getAssignedVehicleIds();

    allVehicles.forEach(v => {
        if (routeIds.size > 0 && !routeIds.has(v.routeId)) return;

        const key = 'v_' + v.id;
        const isAssigned = assignedVehicleIds.has(v.id);
        const icon = createVehicleTileIcon(v, isAssigned ? 48 : 42, isAssigned);

        const assignedLeg = Object.values(assignedVehiclesByLeg).find(item => item.vehicleId === v.id);
        const etaInfo = assignedLeg
            ? `<br/><small>ETA to ${assignedLeg.boardingStop.name}: ${formatDuration(assignedLeg.etaSeconds)}</small>`
            : '';
        const ratingInfo = `<br/><small>Rating: ${formatRatingSummary(v)}</small>`;

        if (vehicleMarkers[key]) {
            smoothMoveMarker(vehicleMarkers[key], [v.lat, v.lng], 2500);
            vehicleMarkers[key].setIcon(icon);
            if (assignedLeg) {
                vehicleMarkers[key].setPopupContent(`<b>${v.name}</b>${etaInfo}${ratingInfo}`);
                vehicleMarkers[key].setZIndexOffset(1200);
            } else {
                vehicleMarkers[key].setPopupContent(`<b>${v.name}</b>${ratingInfo}`);
                vehicleMarkers[key].setZIndexOffset(800);
            }
        } else {
            const tooltipText = assignedLeg ? `${v.name} (Selected)` : v.name;
            const m = L.marker([v.lat, v.lng], { icon, zIndexOffset: assignedLeg ? 1200 : 800 }).addTo(map)
                .bindPopup(`<b>${v.name}</b>${etaInfo}${ratingInfo}`)
                .bindTooltip(tooltipText, { permanent: true, direction: 'top', className: 'vehicle-label', offset: [0, -20] });
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

async function pollVehicles() {
    if (!uiPrefs.showVehicles) return;
    try {
        allVehicles = await api(`${API}?type=vehicles`);
    } catch { return; }

    if (currentJourney) {
        assignVehiclesToJourney(currentJourney);
    }
    renderVisibleJourneyVehicles();
    if (typeof updateStatsBar === 'function') updateStatsBar();

    if (currentJourney) {
        renderJourneyPanel(currentJourney);
    }
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
    document.getElementById('btn-nearby-stops').classList.remove('hidden');

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
    document.getElementById('btn-nearby-stops').classList.add('hidden');
    document.getElementById('nearby-panel').classList.add('hidden');
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

function normalizePlaceResult(place) {
    const lat = Number.parseFloat(place.lat);
    const lon = Number.parseFloat(place.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    return {
        name: place.display_name || place.name || 'Unnamed place',
        lat,
        lon
    };
}

async function searchPlaces(query) {
    const trimmedQuery = query.trim();
    const normalizedQuery = trimmedQuery.toLowerCase();

    if (normalizedQuery.length < PLACE_AUTOCOMPLETE_MIN_QUERY) return [];

    const cached = placeSearchCache.get(normalizedQuery);
    if (cached) return cached;

    if (placeSearchInFlight.has(normalizedQuery)) {
        return placeSearchInFlight.get(normalizedQuery);
    }

    const params = new URLSearchParams({
        q: trimmedQuery,
        format: 'json',
        limit: String(PLACE_AUTOCOMPLETE_LIMIT),
        viewbox: KATHMANDU_VIEWBOX,
        bounded: '1',
        addressdetails: '0'
    });

    const request = fetch(`${NOMINATIM_BASE_URL}?${params.toString()}`, {
        headers: { Accept: 'application/json' }
    })
        .then(async (response) => {
            if (!response.ok) {
                throw new Error(`Place search failed with status ${response.status}`);
            }
            return response.json();
        })
        .then((results) => results
            .map(normalizePlaceResult)
            .filter(Boolean)
            .slice(0, PLACE_AUTOCOMPLETE_LIMIT))
        .then((results) => {
            placeSearchCache.set(normalizedQuery, results);
            return results;
        })
        .finally(() => {
            placeSearchInFlight.delete(normalizedQuery);
        });

    placeSearchInFlight.set(normalizedQuery, request);
    return request;
}

function renderSuggestions(container, results, options = {}) {
    const { query = '', activeIndex = -1, onSelect = null, localMode = false } = options;

    if (!results.length) {
        container.innerHTML = '';
        container.classList.add('hidden');
        return;
    }

    // Check if we have mixed sources (local + online)
    const hasLocal = results.some(r => r._source === 'local');
    const hasOnline = results.some(r => r._source === 'online');
    const showHeaders = hasLocal && hasOnline;

    let html = '';
    let inSection = null;

    results.forEach((place, index) => {
        const source = place._source || 'online';

        if (showHeaders && source !== inSection) {
            inSection = source;
            const label = source === 'local' ? 'Stops' : 'Places';
            const sectionIcon = source === 'local' ? 'fa-bus' : 'fa-globe';
            html += `<div class="suggestion-section"><i class="fa-solid ${sectionIcon}"></i> ${label}</div>`;
        }

        const icon = place._icon || 'fa-location-dot';
        const color = place._color || '#0ea5e9';
        const typeLabel = place._type === 'route' ? 'Route' : place._type === 'stop' ? 'Stop' : '';
        html += `
        <div class="suggestion-item ${index === activeIndex ? 'active' : ''}" data-index="${index}">
            <div class="suggestion-icon" style="background:${color}"><i class="fa-solid ${icon}"></i></div>
            <span class="suggestion-name">${highlightText(place.name, query)}</span>
            ${typeLabel ? `<span class="suggestion-type">${typeLabel}</span>` : ''}
        </div>`;
    });

    container.innerHTML = html;
    container.classList.remove('hidden');

    if (typeof onSelect === 'function') {
        container.querySelectorAll('.suggestion-item').forEach((item, index) => {
            item.addEventListener('mousedown', (event) => {
                event.preventDefault();
                onSelect(results[index]);
            });
        });
    }
}

function debounce(fn, delayMs) {
    let timerId = null;

    return (...args) => {
        window.clearTimeout(timerId);
        timerId = window.setTimeout(() => fn(...args), delayMs);
    };
}

function attachAutocomplete(inputElement, dropdownElement, onSelect, options = {}) {
    let activeIndex = -1;
    let currentMatches = [];
    let requestToken = 0;

    const { onEmpty = null, localSearch = false } = options;

    function hideDropdown() {
        dropdownElement.classList.add('hidden');
        dropdownElement.innerHTML = '';
        activeIndex = -1;
        currentMatches = [];
    }

    function selectMatch(place) {
        if (!place) return;
        inputElement.value = place.name;
        hideDropdown();
        onSelect(place);
    }

    function updateActive(items) {
        items.forEach((el, index) => el.classList.toggle('active', index === activeIndex));
        if (activeIndex >= 0 && items[activeIndex]) {
            items[activeIndex].scrollIntoView({ block: 'nearest' });
        }
    }

    function searchLocalStops(q) {
        const ql = q.toLowerCase();
        const results = [];
        publicStops.forEach(s => {
            if (s.name && s.name.toLowerCase().includes(ql)) {
                results.push({
                    name: s.name,
                    lat: s.lat,
                    lon: s.lng,
                    lng: s.lng,
                    _type: 'stop',
                    _id: s.id,
                    _icon: 'fa-bus',
                    _color: s.color || '#e74c3c',
                    _source: 'local'
                });
            }
        });
        return results;
    }

    function searchLocalRoutes(q) {
        const ql = q.toLowerCase();
        const results = [];
        allRoutes.forEach(r => {
            if (r.name && r.name.toLowerCase().includes(ql)) {
                const stops = (r.stopIds || []).map(id => allStops.find(s => s.id === id)).filter(Boolean);
                const mid = stops.length > 0 ? stops[Math.floor(stops.length / 2)] : null;
                if (mid) {
                    results.push({
                        name: r.name,
                        lat: mid.lat,
                        lon: mid.lng,
                        lng: mid.lng,
                        _type: 'route',
                        _id: r.id,
                        _icon: 'fa-route',
                        _color: r.color || '#555',
                        _source: 'local'
                    });
                }
            }
        });
        return results;
    }

    async function showSuggestions(query) {
        const q = query.trim();
        if (!q) {
            hideDropdown();
            if (typeof onEmpty === 'function') onEmpty();
            return;
        }

        if (q.length < PLACE_AUTOCOMPLETE_MIN_QUERY) {
            hideDropdown();
            return;
        }

        const currentToken = ++requestToken;

        if (localSearch) {
            // Local-only mode (global search bar): stops + routes, no Nominatim
            const localResults = [...searchLocalStops(q), ...searchLocalRoutes(q)];
            if (localResults.length > 0) {
                currentMatches = localResults.slice(0, 8);
                if (currentToken !== requestToken) return;
                activeIndex = -1;
                renderSuggestions(dropdownElement, currentMatches, {
                    query: q,
                    activeIndex,
                    onSelect: selectMatch,
                    localMode: true
                });
                return;
            }
            hideDropdown();
            return;
        }

        // Mixed mode (start/end inputs): show local stops immediately, then fetch Nominatim
        const localStopResults = searchLocalStops(q).slice(0, 4);

        // Show local results right away while Nominatim loads
        if (localStopResults.length > 0) {
            currentMatches = localStopResults;
            activeIndex = -1;
            renderSuggestions(dropdownElement, currentMatches, {
                query: q,
                activeIndex,
                onSelect: selectMatch,
                localMode: false
            });
        }

        // Fetch Nominatim results in parallel
        let onlineResults = [];
        try {
            onlineResults = await searchPlaces(q);
        } catch (error) {
            console.warn('Place autocomplete error:', error.message);
        }

        if (currentToken !== requestToken || inputElement.value.trim() !== q) return;

        // Merge: local stops first, then online results (deduplicated)
        const merged = [...localStopResults];
        onlineResults.forEach(r => {
            r._source = 'online';
            merged.push(r);
        });

        if (!merged.length) {
            hideDropdown();
            return;
        }

        currentMatches = merged;
        activeIndex = -1;
        renderSuggestions(dropdownElement, currentMatches, {
            query: q,
            activeIndex,
            onSelect: selectMatch,
            localMode: false
        });
    }

    const debouncedShowSuggestions = debounce((value) => {
        showSuggestions(value);
    }, 250);

    inputElement.addEventListener('input', () => {
        const value = inputElement.value.trim();
        if (!value) {
            requestToken += 1;
            hideDropdown();
            if (typeof onEmpty === 'function') onEmpty();
            return;
        }
        debouncedShowSuggestions(inputElement.value);
    });

    inputElement.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideDropdown();
            return;
        }

        const items = dropdownElement.querySelectorAll('.suggestion-item');
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
        }
    });

    inputElement.addEventListener('focus', () => {
        const value = inputElement.value.trim();
        if (value.length >= PLACE_AUTOCOMPLETE_MIN_QUERY) {
            debouncedShowSuggestions(inputElement.value);
        }
    });

    inputElement.addEventListener('blur', () => setTimeout(hideDropdown, 120));

    document.addEventListener('click', (event) => {
        const target = event.target;
        if (target !== inputElement && !dropdownElement.contains(target)) {
            hideDropdown();
        }
    });
}

attachAutocomplete(
    document.getElementById('input-start'),
    document.getElementById('suggestions-start'),
    (place) => {
        setStartPoint(place.lat, place.lon, place.name);
        showToast(`Start set to ${place.name}`, 'success', 1500);
    }
);

attachAutocomplete(
    document.getElementById('input-end'),
    document.getElementById('suggestions-end'),
    (place) => {
        setEndPoint(place.lat, place.lon, place.name);
        showToast(`Destination set to ${place.name}`, 'success', 1500);
    }
);

attachAutocomplete(
    document.getElementById('input-global-search'),
    document.getElementById('suggestions-global'),
    (place) => {
        selectedPlaces.global = { ...place };
        if (globalSearchMarker) map.removeLayer(globalSearchMarker);
        globalSearchMarker = L.marker([place.lat, place.lon || place.lng], { zIndexOffset: 900 }).addTo(map);
        map.flyTo([place.lat, place.lon || place.lng], Math.max(map.getZoom(), 16));
        globalSearchMarker.bindPopup(`<b>${escapeHtml(place.name)}</b>`).openPopup();
        setStatus(`Showing ${place.name}`, 'success');

        // If it's a route, highlight it
        if (place._type === 'route') {
            showExploreRoute(place._id);
        }
    },
    {
        onEmpty: () => {
            selectedPlaces.global = null;
            if (globalSearchMarker) {
                map.removeLayer(globalSearchMarker);
                globalSearchMarker = null;
            }
        },
        localSearch: true
    }
);

// ---- Nearby Stops ----
document.getElementById('btn-nearby-stops').addEventListener('click', () => {
    const panel = document.getElementById('nearby-panel');
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) renderNearbyStops();
});

document.getElementById('btn-close-nearby').addEventListener('click', () => {
    document.getElementById('nearby-panel').classList.add('hidden');
});

function renderNearbyStops() {
    const list = document.getElementById('nearby-list');
    if (!gpsMarker) {
        list.innerHTML = '<div class="explore-empty"><i class="fa-solid fa-circle-info"></i> GPS not active</div>';
        return;
    }
    const pos = gpsMarker.getLatLng();
    const withDist = publicStops.map(s => ({
        ...s,
        dist: haversineDistanceMeters([pos.lat, pos.lng], [s.lat, s.lng])
    })).sort((a, b) => a.dist - b.dist).slice(0, 10);

    if (!withDist.length) {
        list.innerHTML = '<div class="explore-empty"><i class="fa-solid fa-circle-info"></i> No stops found</div>';
        return;
    }

    // Find which routes serve each stop
    const stopRouteMap = {};
    allRoutes.forEach(r => {
        (r.stopIds || []).forEach(id => {
            if (!stopRouteMap[id]) stopRouteMap[id] = [];
            stopRouteMap[id].push(r.name);
        });
    });

    list.innerHTML = withDist.map(s => {
        const routes = stopRouteMap[s.id] || [];
        const routeLabel = routes.length ? routes.slice(0, 2).join(', ') + (routes.length > 2 ? ` +${routes.length - 2}` : '') : 'No routes';
        return `
            <div class="nearby-item" data-stop-lat="${s.lat}" data-stop-lng="${s.lng}" data-stop-name="${escapeHtml(s.name)}">
                <div>
                    <div class="nearby-name">${escapeHtml(s.name)}</div>
                    <div class="nearby-routes">${escapeHtml(routeLabel)}</div>
                </div>
                <span class="nearby-dist">${formatDistance(s.dist)}</span>
                <div class="nearby-actions">
                    <button data-nearby-action="start" title="Set as start"><i class="fa-solid fa-play"></i></button>
                    <button data-nearby-action="end" title="Set as destination"><i class="fa-solid fa-flag"></i></button>
                </div>
            </div>`;
    }).join('');
}

document.getElementById('nearby-list').addEventListener('click', (e) => {
    const action = e.target.closest('[data-nearby-action]');
    const item = e.target.closest('.nearby-item');
    if (!item) return;

    const lat = parseFloat(item.dataset.stopLat);
    const lng = parseFloat(item.dataset.stopLng);
    const name = item.dataset.stopName;

    if (action) {
        if (action.dataset.nearbyAction === 'start') {
            setStartPoint(lat, lng, name);
            showToast(`Start: ${name}`, 'success', 1500);
        } else {
            setEndPoint(lat, lng, name);
            showToast(`Destination: ${name}`, 'success', 1500);
        }
    } else {
        map.flyTo([lat, lng], 17);
    }
});

// ---- Stats Bar ----
function updateStatsBar() {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    document.getElementById('stats-clock').innerHTML = `<i class="fa-regular fa-clock"></i> ${time}`;
    document.getElementById('stats-stops').innerHTML = `<i class="fa-solid fa-bus"></i> ${publicStops.length} stops`;
    document.getElementById('stats-routes').innerHTML = `<i class="fa-solid fa-route"></i> ${allRoutes.length} routes`;
    document.getElementById('stats-vehicles').innerHTML = `<i class="fa-solid fa-van-shuttle"></i> ${allVehicles.length} live`;
}
setInterval(updateStatsBar, 1000);

// ---- Keyboard Shortcuts ----
function toggleShortcutsModal() {
    document.getElementById('shortcuts-modal').classList.toggle('hidden');
}

document.getElementById('btn-close-shortcuts').addEventListener('click', toggleShortcutsModal);
document.querySelector('.shortcuts-backdrop').addEventListener('click', toggleShortcutsModal);

document.addEventListener('keydown', (e) => {
    // Don't trigger shortcuts when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch (e.key) {
        case '?':
            e.preventDefault();
            toggleShortcutsModal();
            break;
        case 't':
        case 'T':
            e.preventDefault();
            document.getElementById('btn-theme-toggle').click();
            break;
        case 'e':
        case 'E':
            e.preventDefault();
            document.getElementById('btn-explore').click();
            break;
        case 'g':
        case 'G':
            e.preventDefault();
            document.getElementById('btn-gps').click();
            break;
        case 'n':
        case 'N':
            if (gpsActive) {
                e.preventDefault();
                document.getElementById('btn-nearby-stops').click();
            }
            break;
        case 'Escape':
            if (!document.getElementById('shortcuts-modal').classList.contains('hidden')) {
                toggleShortcutsModal();
            }
            break;
    }
});

// ---- Share Journey ----
document.getElementById('btn-share-route').addEventListener('click', () => {
    if (!currentJourney) {
        showToast('No journey to share', 'warning');
        return;
    }

    const legs = currentJourney.legs;
    let summary = 'Sawari Transit Route\n';
    summary += '---\n';

    legs.forEach(leg => {
        if (leg.isTransfer) {
            summary += `Transfer\n`;
            return;
        }
        if (leg.type === 'walk') {
            summary += `Walk: ${leg.from} → ${leg.to} (${formatDistance(leg.distance)})\n`;
        } else {
            summary += `Bus [${leg.route?.name || 'Unknown'}]: ${leg.from} → ${leg.to}`;
            if (leg.stops) summary += ` (${leg.stops.length} stops)`;
            summary += '\n';
        }
    });

    summary += '---\nPlanned with Sawari';

    if (navigator.clipboard) {
        navigator.clipboard.writeText(summary).then(() => {
            showToast('Journey copied to clipboard!', 'success');
        }).catch(() => {
            showToast('Could not copy', 'error');
        });
    } else {
        showToast('Clipboard not supported', 'error');
    }
});

// ---- Init ----
loadData();
// Auto-start GPS on page load
startGPS();

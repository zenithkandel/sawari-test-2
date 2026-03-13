// ============================================================
// Sawari - routing.js
// OSRM routing utilities for transit navigation
// Adapted from sawari-test/routing.js
// ============================================================

const routeCache = {
    _store: {},
    _maxSize: 200,
    _keys: [],
    _makeKey(waypoints, profile, type) {
        const coordKey = waypoints.map(wp => `${wp[0].toFixed(5)},${wp[1].toFixed(5)}`).join('|');
        return `${type}:${profile}:${coordKey}`;
    },
    set(waypoints, profile, type, data) {
        const key = this._makeKey(waypoints, profile, type);
        if (this._keys.length >= this._maxSize) {
            const oldest = this._keys.shift();
            delete this._store[oldest];
        }
        this._store[key] = data;
        this._keys.push(key);
    },
    get(waypoints, profile, type) {
        const key = this._makeKey(waypoints, profile, type);
        return this._store[key] || null;
    },
    clear() { this._store = {}; this._keys = []; }
};

const OSRM_SERVERS = {
    driving: 'https://routing.openstreetmap.de/routed-car',
    foot: 'https://routing.openstreetmap.de/routed-foot',
    cycling: 'https://routing.openstreetmap.de/routed-bike'
};
const OSRM_FALLBACK = 'https://router.project-osrm.org';

function getAppRootPath() {
    const match = window.location.pathname.match(/^(.*\/sawari)\//i);
    return match ? match[1] : '';
}

const ROUTE_PLAN_API = getAppRootPath()
    ? `${getAppRootPath()}/backend/handlers/api.php?type=route-plan`
    : 'backend/handlers/api.php?type=route-plan';

function getOSRMBaseUrl(profile) {
    return OSRM_SERVERS[profile] || OSRM_FALLBACK;
}

function haversineDistanceMeters(pointA, pointB) {
    const toRad = v => v * Math.PI / 180;
    const R = 6371000;
    const dLat = toRad(pointB[0] - pointA[0]);
    const dLng = toRad(pointB[1] - pointA[1]);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(pointA[0])) * Math.cos(toRad(pointB[0])) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchWithTimeout(url, timeoutMs = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        return res;
    } catch (err) {
        clearTimeout(timer);
        throw err;
    }
}

async function getOSRMRoute(waypoints, profile = 'driving', options = {}) {
    if (waypoints.length < 2) return null;
    const avoidObstructions = options.avoidObstructions !== false;
    const routeType = avoidObstructions ? 'route-safe' : 'route';
    const cached = routeCache.get(waypoints, profile, routeType);
    if (cached) return cached;

    if (avoidObstructions) {
        try {
            const response = await fetch(ROUTE_PLAN_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ waypoints, profile, avoidObstructions: true })
            });
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data.coords) && data.coords.length >= 2) {
                    const result = {
                        coords: data.coords,
                        distance: data.distance,
                        duration: data.duration,
                        obstructed: !!data.obstructed,
                        obstructionHits: data.obstructionHits || [],
                        selectedBy: data.selectedBy || 'fastest'
                    };
                    routeCache.set(waypoints, profile, routeType, result);
                    return result;
                }
            }
        } catch (err) {
            console.warn('Backend route-plan failed, falling back to OSRM:', err.message);
        }
    }

    const coordsStr = waypoints.map(wp => `${wp[1]},${wp[0]}`).join(';');
    const urls = [
        `${getOSRMBaseUrl(profile)}/route/v1/${profile}/${coordsStr}?overview=full&geometries=geojson&steps=false&continue_straight=true`,
        `${OSRM_FALLBACK}/route/v1/${profile}/${coordsStr}?overview=full&geometries=geojson&steps=false&continue_straight=true`
    ];

    for (const url of urls) {
        try {
            const res = await fetchWithTimeout(url, 8000);
            const data = await res.json();
            if (data.code !== 'Ok' || !data.routes?.length) continue;
            const route = data.routes[0];
            const result = {
                coords: route.geometry.coordinates.map(c => [c[1], c[0]]),
                distance: route.distance,
                duration: route.duration
            };
            routeCache.set(waypoints, profile, routeType, result);
            return result;
        } catch (err) {
            console.warn('OSRM fetch error:', err.message);
        }
    }
    return null;
}

async function getOSRMAlternatives(waypoints, profile = 'foot') {
    if (waypoints.length < 2) return [];
    const cached = routeCache.get(waypoints, profile, 'alternatives');
    if (cached) return cached;

    const coordsStr = waypoints.map(wp => `${wp[1]},${wp[0]}`).join(';');
    const urls = [
        `${getOSRMBaseUrl(profile)}/route/v1/${profile}/${coordsStr}?overview=full&geometries=geojson&steps=true&alternatives=true`,
        `${OSRM_FALLBACK}/route/v1/${profile}/${coordsStr}?overview=full&geometries=geojson&steps=true&alternatives=true`
    ];

    for (const url of urls) {
        try {
            const res = await fetchWithTimeout(url, 10000);
            const data = await res.json();
            if (data.code !== 'Ok' || !data.routes?.length) continue;
            const results = data.routes.map(route => ({
                coords: route.geometry.coordinates.map(c => [c[1], c[0]]),
                distance: route.distance,
                duration: route.duration,
                steps: route.legs ? route.legs.flatMap(leg => leg.steps || []) : []
            }));
            routeCache.set(waypoints, profile, 'alternatives', results);
            return results;
        } catch (err) {
            console.warn('OSRM alternatives error:', err.message);
        }
    }
    return [];
}

async function snapRouteToRoad(stationCoords, onSegmentDone) {
    if (stationCoords.length < 2) return stationCoords.map(s => [s.lat, s.lng]);
    const pairs = [];
    for (let i = 0; i < stationCoords.length - 1; i++) {
        pairs.push([
            [stationCoords[i].lat, stationCoords[i].lng],
            [stationCoords[i + 1].lat, stationCoords[i + 1].lng]
        ]);
    }
    const results = await Promise.all(pairs.map(async pair => {
        const result = await getOSRMRoute(pair, 'cycling');
        if (onSegmentDone) onSegmentDone();
        return result;
    }));
    const allCoords = [];
    for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result && result.coords.length > 0) {
            const segment = i === 0 ? result.coords : result.coords.slice(1);
            allCoords.push(...segment);
        } else {
            if (i === 0) allCoords.push([stationCoords[i].lat, stationCoords[i].lng]);
            allCoords.push([stationCoords[i + 1].lat, stationCoords[i + 1].lng]);
        }
    }
    return allCoords.length >= 2 ? allCoords : stationCoords.map(s => [s.lat, s.lng]);
}

// ---- Transit-specific helpers ----

function findNearestStop(lat, lng, stops) {
    let nearest = null;
    let minDist = Infinity;
    for (const s of stops) {
        const d = haversineDistanceMeters([lat, lng], [s.lat, s.lng]);
        if (d < minDist) { minDist = d; nearest = s; }
    }
    return { stop: nearest, distance: minDist };
}

function findConnectingRoutes(startStopId, endStopId, routes) {
    const results = [];
    for (const route of routes) {
        const ids = route.stopIds;
        const startIdx = ids.indexOf(startStopId);
        const endIdx = ids.indexOf(endStopId);
        if (startIdx === -1 || endIdx === -1) continue;
        const fromIdx = Math.min(startIdx, endIdx);
        const toIdx = Math.max(startIdx, endIdx);
        const subStopIds = ids.slice(fromIdx, toIdx + 1);
        if (startIdx > endIdx) subStopIds.reverse();
        results.push({
            route,
            subStopIds,
            stopCount: subStopIds.length,
            reversed: startIdx > endIdx
        });
    }
    results.sort((a, b) => a.stopCount - b.stopCount);
    return results;
}

function findTransferRoutes(startStopId, endStopId, routes, stops) {
    const startRoutes = routes.filter(r => r.stopIds.includes(startStopId));
    const endRoutes = routes.filter(r => r.stopIds.includes(endStopId));

    let best = null;
    for (const sr of startRoutes) {
        for (const er of endRoutes) {
            if (sr.id === er.id) continue;
            const shared = sr.stopIds.filter(id => er.stopIds.includes(id));
            for (const transferId of shared) {
                const leg1 = findConnectingRoutes(startStopId, transferId, [sr]);
                const leg2 = findConnectingRoutes(transferId, endStopId, [er]);
                if (leg1.length && leg2.length) {
                    const totalStops = leg1[0].stopCount + leg2[0].stopCount;
                    if (!best || totalStops < best.totalStops) {
                        const transferStop = stops.find(s => s.id === transferId);
                        best = {
                            legs: [leg1[0], leg2[0]],
                            transferStop,
                            totalStops
                        };
                    }
                }
            }
        }
    }
    return best;
}

function formatDistance(meters) {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds) {
    if (seconds < 60) return `${Math.round(seconds)} sec`;
    if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return `${h}h ${m}m`;
}

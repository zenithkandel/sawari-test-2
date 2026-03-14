// ============================================================
// Sawari Admin - Routes Feature
// Author: Zenith Kandel — https://zenithkandel.com.np
// License: MIT
// ============================================================
const RoutesFeature = (() => {
    let previewLine = null;
    let clickHandler = null;

    function init() {
        Store.on('mode', ({ mode, addEntity }) => {
            if (mode === 'add' && addEntity === 'route') {
                startRouteBuilder();
            } else if (Store.get('routeBuilder').active && addEntity !== 'route') {
                cancelRouteBuilder();
            }
        });
    }

    function startRouteBuilder() {
        const state = Store.get('routeBuilder');
        state.active = true;
        state.stopIds = [];
        state.name = '';
        state.color = '#1d4ed8';
        state.style = 'solid';
        state.weight = 5;
        state.editingRouteId = null;
        Store.set('routeBuilder', state);

        // Show route builder in inspector
        Store.set('inspectorOpen', true);
        Store.emit('inspector:routeBuilder', state);

        // Listen for map clicks on stops
        clickHandler = Store.on('map:click', ({ latlng }) => {
            // Find nearest stop
            const stops = Store.get('stops');
            let nearest = null;
            let minDist = Infinity;
            stops.forEach(s => {
                const d = Math.sqrt(Math.pow(s.lat - latlng.lat, 2) + Math.pow(s.lng - latlng.lng, 2));
                if (d < minDist && d < 0.003) { // ~300m threshold
                    minDist = d;
                    nearest = s;
                }
            });

            if (nearest) {
                addStopToRoute(nearest.id);
            }
        });

        updatePreview();
    }

    function addStopToRoute(stopId) {
        const state = Store.get('routeBuilder');
        // Don't add duplicate consecutive stops
        if (state.stopIds[state.stopIds.length - 1] === stopId) return;
        state.stopIds.push(stopId);
        Store.set('routeBuilder', state);
        Store.emit('inspector:routeBuilder', state);
        updatePreview();
    }

    function removeStopFromRoute(index) {
        const state = Store.get('routeBuilder');
        state.stopIds.splice(index, 1);
        Store.set('routeBuilder', state);
        Store.emit('inspector:routeBuilder', state);
        updatePreview();
    }

    function reorderStop(fromIdx, toIdx) {
        const state = Store.get('routeBuilder');
        const [item] = state.stopIds.splice(fromIdx, 1);
        state.stopIds.splice(toIdx, 0, item);
        Store.set('routeBuilder', state);
        Store.emit('inspector:routeBuilder', state);
        updatePreview();
    }

    function updatePreview() {
        const map = MapEngine.getMap();
        if (previewLine) {
            map.removeLayer(previewLine);
            previewLine = null;
        }

        const state = Store.get('routeBuilder');
        const stops = Store.get('stops');
        const coords = state.stopIds
            .map(sid => stops.find(s => s.id === sid))
            .filter(Boolean)
            .map(s => [s.lat, s.lng]);

        if (coords.length >= 2) {
            previewLine = L.polyline(coords, {
                color: state.color,
                weight: state.weight,
                opacity: 0.8,
                dashArray: '8 6',
            }).addTo(map);
        }
    }

    async function saveRoute() {
        const state = Store.get('routeBuilder');

        if (!state.name.trim()) {
            Notifications.toast('Route name is required', 'error');
            return;
        }
        if (state.stopIds.length < 2) {
            Notifications.toast('Route needs at least 2 stops', 'error');
            return;
        }

        try {
            if (state.editingRouteId) {
                await Commands.updateRoute(state.editingRouteId, {
                    name: state.name,
                    stopIds: state.stopIds,
                    color: state.color,
                    style: state.style,
                    weight: state.weight,
                });
            } else {
                await Commands.createRoute({
                    name: state.name,
                    stopIds: state.stopIds,
                    color: state.color,
                    style: state.style,
                    weight: state.weight,
                    snapToRoad: true,
                });
            }
            cancelRouteBuilder();
            Store.setMode('select');
        } catch (e) {
            // Error handling done by Commands
        }
    }

    function cancelRouteBuilder() {
        const state = Store.get('routeBuilder');
        state.active = false;
        state.stopIds = [];
        Store.set('routeBuilder', state);

        if (previewLine) {
            MapEngine.getMap().removeLayer(previewLine);
            previewLine = null;
        }

        if (clickHandler) {
            clickHandler();
            clickHandler = null;
        }

        Store.emit('inspector:routeBuilder', null);
    }

    function editExistingRoute(routeId) {
        const route = Store.findEntity('routes', routeId);
        if (!route) return;

        Store.setMode('add', 'route');

        const state = Store.get('routeBuilder');
        state.active = true;
        state.editingRouteId = routeId;
        state.name = route.name;
        state.color = route.color || '#1d4ed8';
        state.style = route.style || 'solid';
        state.weight = route.weight || 5;
        state.stopIds = [...(route.stopIds || [])];
        Store.set('routeBuilder', state);
        Store.emit('inspector:routeBuilder', state);
        updatePreview();
    }

    return {
        init, startRouteBuilder, cancelRouteBuilder,
        addStopToRoute, removeStopFromRoute, reorderStop,
        saveRoute, editExistingRoute, updatePreview,
    };
})();

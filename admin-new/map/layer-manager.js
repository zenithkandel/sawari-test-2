// ============================================================
// Sawari Admin - Layer Manager
// ============================================================
const LayerManager = (() => {
    const layers = {
        stops: L.layerGroup(),
        routes: L.layerGroup(),
        vehicles: L.layerGroup(),
        obstructions: L.layerGroup(),
    };
    const markerRefs = {
        stops: new Map(),
        routes: new Map(),
        vehicles: new Map(),
        obstructions: new Map(),
    };

    function init(map) {
        Object.values(layers).forEach(lg => lg.addTo(map));

        // Listen for data and selection changes
        Store.on('entities:stops', () => renderStops());
        Store.on('entities:routes', () => renderRoutes());
        Store.on('entities:vehicles', () => renderVehicles());
        Store.on('entities:obstructions', () => renderObstructions());
        Store.on('selection', () => updateSelectionVisuals());
        Store.on('layer', ({ layer, visible }) => {
            if (visible) layers[layer].addTo(MapEngine.getMap());
            else MapEngine.getMap().removeLayer(layers[layer]);
        });
        Store.on('filter', () => {
            renderVehicles();
            renderObstructions();
        });
    }

    function createStopIcon(stop, selected) {
        const cls = `stop-marker${selected ? ' selected' : ''}`;
        return L.divIcon({
            className: '',
            html: `<div class="${cls}" style="background:${stop.color}" data-id="${stop.id}"><i class="fa-solid ${stop.icon || 'fa-bus'}"></i></div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
        });
    }

    function renderStops() {
        layers.stops.clearLayers();
        markerRefs.stops.clear();
        const selected = Store.get('selected');
        const stops = Store.get('stops');

        stops.forEach(stop => {
            const isSel = selected?.type === 'stops' && selected?.id === stop.id;
            const isRouteBuilding = Store.get('routeBuilder')?.active;
            const marker = L.marker([stop.lat, stop.lng], {
                icon: createStopIcon(stop, isSel),
                draggable: !isRouteBuilding,
            });

            marker.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                // If route builder is active, add this stop to the route
                const rb = Store.get('routeBuilder');
                if (rb && rb.active) {
                    RoutesFeature.addStopToRoute(stop.id);
                    return;
                }
                Store.select('stops', stop.id);
            });

            marker.on('contextmenu', (e) => {
                L.DomEvent.stopPropagation(e);
                e.originalEvent.preventDefault();
                SelectionTools.showContextMenu(e.originalEvent, 'stops', stop.id);
            });

            marker.on('dragend', (e) => {
                const pos = e.target.getLatLng();
                Commands.updateStop(stop.id, { lat: pos.lat, lng: pos.lng });
            });

            marker.addTo(layers.stops);
            markerRefs.stops.set(stop.id, marker);
        });

        updateCounts();
    }

    function renderRoutes() {
        layers.routes.clearLayers();
        markerRefs.routes.clear();
        const selected = Store.get('selected');
        const routes = Store.get('routes');
        const stops = Store.get('stops');

        routes.forEach(route => {
            const isSel = selected?.type === 'routes' && selected?.id === route.id;
            const coords = (route.stopIds || [])
                .map(sid => stops.find(s => s.id === sid))
                .filter(Boolean)
                .map(s => [s.lat, s.lng]);

            if (coords.length < 2) return;

            const dashArray = route.style === 'dashed' ? '12 8' : route.style === 'dotted' ? '4 6' : null;
            const polyline = L.polyline(coords, {
                color: route.color || '#1d4ed8',
                weight: isSel ? (route.weight || 5) + 2 : (route.weight || 5),
                opacity: isSel ? 1 : 0.7,
                dashArray,
            });

            polyline.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                Store.select('routes', route.id);
            });

            polyline.on('contextmenu', (e) => {
                L.DomEvent.stopPropagation(e);
                e.originalEvent.preventDefault();
                SelectionTools.showContextMenu(e.originalEvent, 'routes', route.id);
            });

            polyline.addTo(layers.routes);
            markerRefs.routes.set(route.id, polyline);
        });

        updateCounts();
    }

    function renderVehicles() {
        layers.vehicles.clearLayers();
        markerRefs.vehicles.clear();
        const selected = Store.get('selected');
        const filter = Store.get('filter');
        let vehicles = Store.get('vehicles');

        if (filter === 'moving') vehicles = vehicles.filter(v => v.moving);

        vehicles.forEach(v => {
            const isSel = selected?.type === 'vehicles' && selected?.id === v.id;
            const movingCls = v.moving ? ' moving' : '';
            const selCls = isSel ? ' selected' : '';

            let iconHtml;
            if (v.iconType === 'image' && v.vehicle_image) {
                iconHtml = `<div class="vehicle-marker${movingCls}${selCls}" style="background-image:url(../${v.vehicle_image})" data-id="${v.id}"></div>`;
            } else {
                iconHtml = `<div class="vehicle-marker-icon${movingCls}${selCls}" style="background:${v.color}" data-id="${v.id}"><i class="fa-solid fa-bus"></i></div>`;
            }

            const marker = L.marker([v.lat, v.lng], {
                icon: L.divIcon({
                    className: '',
                    html: iconHtml,
                    iconSize: [36, 36],
                    iconAnchor: [18, 18],
                }),
                draggable: true,
            });

            marker.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                Store.select('vehicles', v.id);
            });

            marker.on('contextmenu', (e) => {
                L.DomEvent.stopPropagation(e);
                e.originalEvent.preventDefault();
                SelectionTools.showContextMenu(e.originalEvent, 'vehicles', v.id);
            });

            marker.on('dragend', (e) => {
                const pos = e.target.getLatLng();
                Commands.updateVehicle(v.id, { lat: pos.lat, lng: pos.lng });
            });

            marker.addTo(layers.vehicles);
            markerRefs.vehicles.set(v.id, marker);
        });

        updateCounts();
    }

    function renderObstructions() {
        layers.obstructions.clearLayers();
        markerRefs.obstructions.clear();
        const selected = Store.get('selected');
        const filter = Store.get('filter');
        let obstructions = Store.get('obstructions');

        if (filter === 'active') obstructions = obstructions.filter(o => o.active);

        const severityColors = { low: '#22c55e', medium: '#f59e0b', high: '#ef4444' };

        obstructions.forEach(obs => {
            const isSel = selected?.type === 'obstructions' && selected?.id === obs.id;
            const color = severityColors[obs.severity] || severityColors.medium;

            const circle = L.circle([obs.lat, obs.lng], {
                radius: obs.radiusMeters || 40,
                color: color,
                fillColor: color,
                fillOpacity: isSel ? 0.3 : 0.15,
                weight: isSel ? 3 : 2,
                dashArray: obs.active ? null : '6 4',
            });

            circle.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                Store.select('obstructions', obs.id);
            });

            circle.on('contextmenu', (e) => {
                L.DomEvent.stopPropagation(e);
                e.originalEvent.preventDefault();
                SelectionTools.showContextMenu(e.originalEvent, 'obstructions', obs.id);
            });

            // Center marker for dragging
            const centerMarker = L.marker([obs.lat, obs.lng], {
                icon: L.divIcon({
                    className: '',
                    html: `<div class="stop-marker${isSel ? ' selected' : ''}" style="background:${color}; width:20px; height:20px; font-size:9px;"><i class="fa-solid fa-triangle-exclamation"></i></div>`,
                    iconSize: [20, 20],
                    iconAnchor: [10, 10],
                }),
                draggable: true,
            });

            centerMarker.on('dragend', (e) => {
                const pos = e.target.getLatLng();
                Commands.updateObstruction(obs.id, { lat: pos.lat, lng: pos.lng });
            });

            centerMarker.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                Store.select('obstructions', obs.id);
            });

            circle.addTo(layers.obstructions);
            centerMarker.addTo(layers.obstructions);
            markerRefs.obstructions.set(obs.id, { circle, marker: centerMarker });
        });

        updateCounts();
    }

    function updateSelectionVisuals() {
        renderStops();
        renderRoutes();
        renderVehicles();
        renderObstructions();
    }

    function updateCounts() {
        const s = Store.get();
        document.querySelector('[data-count="stops"]').textContent = s.stops.length;
        document.querySelector('[data-count="routes"]').textContent = s.routes.length;
        document.querySelector('[data-count="vehicles"]').textContent = s.vehicles.length;
        document.querySelector('[data-count="obstructions"]').textContent = s.obstructions.length;
        document.getElementById('stat-stops').textContent = s.stops.length;
        document.getElementById('stat-routes').textContent = s.routes.length;
        document.getElementById('stat-vehicles').textContent = s.vehicles.length;
        document.getElementById('stat-obstructions').textContent = s.obstructions.length;
    }

    function panToEntity(type, id) {
        const entity = Store.findEntity(type, id);
        if (!entity) return;
        if (entity.lat !== undefined && entity.lng !== undefined) {
            MapEngine.panTo(entity.lat, entity.lng, 15);
        } else if (type === 'routes') {
            const stops = Store.get('stops');
            const coords = (entity.stopIds || [])
                .map(sid => stops.find(s => s.id === sid))
                .filter(Boolean)
                .map(s => [s.lat, s.lng]);
            if (coords.length) {
                MapEngine.fitBounds(L.latLngBounds(coords));
            }
        }
    }

    function getMarker(type, id) {
        return markerRefs[type]?.get(id);
    }

    return { init, renderStops, renderRoutes, renderVehicles, renderObstructions, panToEntity, getMarker };
})();

// ============================================================
// Sawari Admin - Main Application Bootstrap
// ============================================================
(async function App() {
    'use strict';

    // Initialize map
    MapEngine.init();

    // Initialize all modules
    LayerManager.init(MapEngine.getMap());
    DrawTools.init();
    SelectionTools.init();
    StopsFeature.init();
    RoutesFeature.init();
    VehiclesFeature.init();
    ObstructionsFeature.init();
    CommandBar.init();
    LayerPanel.init();
    Inspector.init();

    // Load initial data
    await loadAllData();

    // Set initial mode
    Store.setMode('select');

    async function loadAllData() {
        try {
            Notifications.setSyncing();

            const [stops, routes, vehicles, obstructions, icons] = await Promise.all([
                ApiClient.getAll('stops'),
                ApiClient.getAll('routes'),
                ApiClient.getAll('vehicles'),
                ApiClient.getAll('obstructions'),
                ApiClient.getIcons(),
            ]);

            Store.setEntities('stops', stops);
            Store.setEntities('routes', routes);
            Store.setEntities('vehicles', vehicles);
            Store.setEntities('obstructions', obstructions);
            Store.set('icons', icons);

            Notifications.setSynced();
            Notifications.toast('Data loaded successfully', 'success');

            // Fit map to show all markers
            const allCoords = [
                ...stops.map(s => [s.lat, s.lng]),
                ...vehicles.map(v => [v.lat, v.lng]),
                ...obstructions.map(o => [o.lat, o.lng]),
            ];
            if (allCoords.length > 0) {
                MapEngine.fitBounds(L.latLngBounds(allCoords));
            }
        } catch (e) {
            console.error('Failed to load data:', e);
            Notifications.toast('Failed to load data: ' + e.message, 'error');
            Notifications.setError();
        }
    }
})();

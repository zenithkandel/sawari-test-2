// ============================================================
// Sawari Admin - Map Engine (Leaflet Adapter)
// Author: Zenith Kandel — https://zenithkandel.com.np
// License: MIT
// ============================================================
const MapEngine = (() => {
    let map = null;
    let tileLayer = null;
    const DEFAULT_CENTER = [27.7172, 85.3240];
    const DEFAULT_ZOOM = 13;

    const TILE_URLS = {
        dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    };

    function init() {
        map = L.map('map', {
            center: DEFAULT_CENTER,
            zoom: DEFAULT_ZOOM,
            zoomControl: false,
        });

        const theme = document.documentElement.getAttribute('data-theme') || 'dark';
        tileLayer = L.tileLayer(TILE_URLS[theme] || TILE_URLS.dark, {
            attribution: '&copy; OpenStreetMap &copy; CARTO',
            maxZoom: 19,
        }).addTo(map);

        L.control.zoom({ position: 'bottomright' }).addTo(map);

        // Track mouse position for status bar
        map.on('mousemove', (e) => {
            const el = document.getElementById('status-coords');
            if (el) el.textContent = `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
        });

        // Map click handler - delegates to draw tools
        map.on('click', (e) => {
            Store.emit('map:click', { latlng: e.latlng, originalEvent: e.originalEvent });
        });

        map.on('contextmenu', (e) => {
            e.originalEvent.preventDefault();
            Store.emit('map:contextmenu', { latlng: e.latlng, originalEvent: e.originalEvent });
        });

        return map;
    }

    function getMap() { return map; }

    function panTo(lat, lng, zoom) {
        if (zoom) map.setView([lat, lng], zoom);
        else map.panTo([lat, lng]);
    }

    function fitBounds(bounds, padding = 60) {
        if (bounds && bounds.isValid()) {
            map.fitBounds(bounds, { padding: [padding, padding] });
        }
    }

    function invalidateSize() {
        if (map) setTimeout(() => map.invalidateSize(), 100);
    }

    function setThemeTiles(theme) {
        if (!tileLayer) return;
        tileLayer.setUrl(TILE_URLS[theme] || TILE_URLS.dark);
    }

    return { init, getMap, panTo, fitBounds, invalidateSize, setThemeTiles };
})();

// ============================================================
// Sawari Admin - Centralized State Store
// ============================================================
const Store = (() => {
    const state = {
        stops: [],
        routes: [],
        vehicles: [],
        obstructions: [],
        icons: { fontawesome: [], images: [] },

        // UI state
        mode: 'select',        // 'select' | 'add'
        addEntity: null,       // 'stop' | 'route' | 'vehicle' | 'obstruction'
        selected: null,        // { type, id } or null
        layers: { stops: true, routes: true, vehicles: true, obstructions: true },
        filter: 'all',
        inspectorOpen: false,

        // Route builder state
        routeBuilder: {
            active: false,
            name: '',
            color: '#1d4ed8',
            style: 'solid',
            weight: 5,
            stopIds: [],
            editingRouteId: null,
        },
    };

    const listeners = new Map();

    function emit(event, data) {
        const cbs = listeners.get(event) || [];
        cbs.forEach(cb => cb(data));
        // Also emit wildcard
        const wcbs = listeners.get('*') || [];
        wcbs.forEach(cb => cb(event, data));
    }

    function on(event, cb) {
        if (!listeners.has(event)) listeners.set(event, []);
        listeners.get(event).push(cb);
        return () => {
            const arr = listeners.get(event);
            const idx = arr.indexOf(cb);
            if (idx > -1) arr.splice(idx, 1);
        };
    }

    function get(key) { return key ? state[key] : state; }

    function set(key, value) {
        const old = state[key];
        state[key] = value;
        emit('change:' + key, { value, old });
        emit('change', { key, value, old });
    }

    // Entity helpers
    function setEntities(type, items) {
        state[type] = items;
        emit('entities:' + type, items);
        emit('entities', { type, items });
    }

    function addEntity(type, item) {
        state[type] = [...state[type], item];
        emit('entity:created', { type, item });
        emit('entities:' + type, state[type]);
    }

    function updateEntity(type, id, fields) {
        state[type] = state[type].map(item =>
            item.id === id ? { ...item, ...fields } : item
        );
        const updated = state[type].find(i => i.id === id);
        emit('entity:updated', { type, id, item: updated });
        emit('entities:' + type, state[type]);
        return updated;
    }

    function removeEntity(type, id) {
        const item = state[type].find(i => i.id === id);
        state[type] = state[type].filter(i => i.id !== id);
        emit('entity:deleted', { type, id, item });
        emit('entities:' + type, state[type]);
    }

    function findEntity(type, id) {
        return state[type].find(i => i.id === id) || null;
    }

    function select(type, id) {
        const prev = state.selected;
        state.selected = type && id ? { type, id } : null;
        state.inspectorOpen = !!state.selected;
        emit('selection', { current: state.selected, previous: prev });
    }

    function deselect() { select(null, null); }

    function getSelected() {
        if (!state.selected) return null;
        return findEntity(state.selected.type, state.selected.id);
    }

    function setMode(mode, addEntity = null) {
        state.mode = mode;
        state.addEntity = addEntity;
        emit('mode', { mode, addEntity });
    }

    function setLayer(layer, visible) {
        state.layers[layer] = visible;
        emit('layer', { layer, visible });
    }

    function setFilter(filter) {
        state.filter = filter;
        emit('filter', filter);
    }

    // Search across all entities
    function search(query) {
        const q = query.toLowerCase().trim();
        if (!q) return [];
        const results = [];

        state.stops.forEach(s => {
            if (s.name.toLowerCase().includes(q))
                results.push({ type: 'stops', id: s.id, name: s.name, icon: 'fa-location-dot' });
        });
        state.routes.forEach(r => {
            if (r.name.toLowerCase().includes(q))
                results.push({ type: 'routes', id: r.id, name: r.name, icon: 'fa-route' });
        });
        state.vehicles.forEach(v => {
            if (v.name.toLowerCase().includes(q))
                results.push({ type: 'vehicles', id: v.id, name: v.name, icon: 'fa-bus' });
        });
        state.obstructions.forEach(o => {
            if (o.name.toLowerCase().includes(q))
                results.push({ type: 'obstructions', id: o.id, name: o.name, icon: 'fa-triangle-exclamation' });
        });

        return results;
    }

    return {
        get, set, on, emit,
        setEntities, addEntity, updateEntity, removeEntity, findEntity,
        select, deselect, getSelected,
        setMode, setLayer, setFilter,
        search,
    };
})();

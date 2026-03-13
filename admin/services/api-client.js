// ============================================================
// Sawari Admin - API Client
// ============================================================
const ApiClient = (() => {
    const BASE = '../backend/admin/handlers/api.php';

    async function request(type, method = 'GET', body = null, query = '') {
        const url = `${BASE}?type=${type}${query}`;
        const opts = { method, headers: { 'Content-Type': 'application/json' } };
        if (body) opts.body = JSON.stringify(body);

        const res = await fetch(url, opts);
        const data = await res.json();

        if (!res.ok) {
            const err = new Error(data.error || `Request failed (${res.status})`);
            err.status = res.status;
            err.data = data;
            throw err;
        }
        return data;
    }

    return {
        // Generic CRUD
        getAll: (type) => request(type),
        getById: (type, id) => request(type, 'GET', null, `&id=${id}`),
        create: (type, body) => request(type, 'POST', body),
        update: (type, body) => request(type, 'PUT', body),
        remove: (type, id, force = false) => request(type, 'DELETE', null, `&id=${id}${force ? '&force=true' : ''}`),

        // Dependencies check
        checkDeps: (entityType, id) => request('dependencies', 'GET', null, `&entity=${entityType}&id=${id}`),

        // Icons catalog
        getIcons: () => request('icons'),

        // Upload image
        uploadImage: async (file) => {
            const form = new FormData();
            form.append('image', file);
            const res = await fetch(`${BASE}?type=upload`, { method: 'POST', body: form });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Upload failed');
            return data;
        },
    };
})();

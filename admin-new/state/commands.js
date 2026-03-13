// ============================================================
// Sawari Admin - Command Bus
// ============================================================
const Commands = (() => {

    async function createStop(data) {
        Notifications.setSyncing();
        try {
            const created = await ApiClient.create('stops', data);
            Store.addEntity('stops', created);
            History.push({
                label: `Created stop "${created.name}"`,
                undo: async () => {
                    await ApiClient.remove('stops', created.id, true);
                    Store.removeEntity('stops', created.id);
                },
                redo: async () => {
                    const re = await ApiClient.create('stops', { ...data });
                    Store.addEntity('stops', re);
                }
            });
            Notifications.toast(`Stop "${created.name}" created`, 'success');
            Notifications.setSynced();
            return created;
        } catch (e) {
            Notifications.toast(e.message, 'error');
            Notifications.setError();
            throw e;
        }
    }

    async function updateStop(id, fields) {
        const prev = { ...Store.findEntity('stops', id) };
        Notifications.setSyncing();
        try {
            const updated = await ApiClient.update('stops', { id, ...fields });
            Store.updateEntity('stops', id, updated);
            History.push({
                label: `Updated stop "${updated.name}"`,
                undo: async () => {
                    await ApiClient.update('stops', prev);
                    Store.updateEntity('stops', id, prev);
                },
                redo: async () => {
                    await ApiClient.update('stops', { id, ...fields });
                    Store.updateEntity('stops', id, fields);
                }
            });
            Notifications.toast(`Stop updated`, 'success');
            Notifications.setSynced();
            return updated;
        } catch (e) {
            Notifications.toast(e.message, 'error');
            Notifications.setError();
            throw e;
        }
    }

    async function deleteStop(id, force = false) {
        const prev = { ...Store.findEntity('stops', id) };
        Notifications.setSyncing();
        try {
            await ApiClient.remove('stops', id, force);
            Store.removeEntity('stops', id);
            Store.deselect();
            History.push({
                label: `Deleted stop "${prev.name}"`,
                undo: async () => {
                    const re = await ApiClient.create('stops', { ...prev, id: undefined });
                    Store.addEntity('stops', re);
                },
                redo: async () => {
                    await ApiClient.remove('stops', re?.id || id, true);
                    Store.removeEntity('stops', re?.id || id);
                }
            });
            Notifications.toast(`Stop "${prev.name}" deleted`, 'success');
            Notifications.setSynced();
        } catch (e) {
            if (e.status === 409) {
                return e.data; // Return dependency info for UI
            }
            Notifications.toast(e.message, 'error');
            Notifications.setError();
            throw e;
        }
    }

    async function createRoute(data) {
        Notifications.setSyncing();
        try {
            const created = await ApiClient.create('routes', data);
            Store.addEntity('routes', created);
            History.push({
                label: `Created route "${created.name}"`,
                undo: async () => {
                    await ApiClient.remove('routes', created.id, true);
                    Store.removeEntity('routes', created.id);
                },
                redo: async () => {
                    const re = await ApiClient.create('routes', { ...data });
                    Store.addEntity('routes', re);
                }
            });
            Notifications.toast(`Route "${created.name}" created`, 'success');
            Notifications.setSynced();
            return created;
        } catch (e) {
            Notifications.toast(e.message, 'error');
            Notifications.setError();
            throw e;
        }
    }

    async function updateRoute(id, fields) {
        const prev = { ...Store.findEntity('routes', id) };
        Notifications.setSyncing();
        try {
            const updated = await ApiClient.update('routes', { id, ...fields });
            Store.updateEntity('routes', id, updated);
            History.push({
                label: `Updated route "${updated.name}"`,
                undo: async () => {
                    await ApiClient.update('routes', prev);
                    Store.updateEntity('routes', id, prev);
                },
                redo: async () => {
                    await ApiClient.update('routes', { id, ...fields });
                    Store.updateEntity('routes', id, fields);
                }
            });
            Notifications.toast(`Route updated`, 'success');
            Notifications.setSynced();
            return updated;
        } catch (e) {
            Notifications.toast(e.message, 'error');
            Notifications.setError();
            throw e;
        }
    }

    async function deleteRoute(id, force = false) {
        const prev = { ...Store.findEntity('routes', id) };
        Notifications.setSyncing();
        try {
            await ApiClient.remove('routes', id, force);
            Store.removeEntity('routes', id);
            Store.deselect();
            History.push({
                label: `Deleted route "${prev.name}"`,
                undo: async () => {
                    const re = await ApiClient.create('routes', { ...prev, id: undefined });
                    Store.addEntity('routes', re);
                },
                redo: async () => {
                    await ApiClient.remove('routes', re?.id || id, true);
                    Store.removeEntity('routes', re?.id || id);
                }
            });
            Notifications.toast(`Route "${prev.name}" deleted`, 'success');
            Notifications.setSynced();
        } catch (e) {
            if (e.status === 409) return e.data;
            Notifications.toast(e.message, 'error');
            Notifications.setError();
            throw e;
        }
    }

    async function createVehicle(data) {
        Notifications.setSyncing();
        try {
            const created = await ApiClient.create('vehicles', data);
            Store.addEntity('vehicles', created);
            History.push({
                label: `Created vehicle "${created.name}"`,
                undo: async () => {
                    await ApiClient.remove('vehicles', created.id);
                    Store.removeEntity('vehicles', created.id);
                },
                redo: async () => {
                    const re = await ApiClient.create('vehicles', { ...data });
                    Store.addEntity('vehicles', re);
                }
            });
            Notifications.toast(`Vehicle "${created.name}" created`, 'success');
            Notifications.setSynced();
            return created;
        } catch (e) {
            Notifications.toast(e.message, 'error');
            Notifications.setError();
            throw e;
        }
    }

    async function updateVehicle(id, fields) {
        const prev = { ...Store.findEntity('vehicles', id) };
        Notifications.setSyncing();
        try {
            const updated = await ApiClient.update('vehicles', { id, ...fields });
            Store.updateEntity('vehicles', id, updated);
            History.push({
                label: `Updated vehicle "${updated.name}"`,
                undo: async () => {
                    await ApiClient.update('vehicles', prev);
                    Store.updateEntity('vehicles', id, prev);
                },
                redo: async () => {
                    await ApiClient.update('vehicles', { id, ...fields });
                    Store.updateEntity('vehicles', id, fields);
                }
            });
            Notifications.toast(`Vehicle updated`, 'success');
            Notifications.setSynced();
            return updated;
        } catch (e) {
            Notifications.toast(e.message, 'error');
            Notifications.setError();
            throw e;
        }
    }

    async function deleteVehicle(id) {
        const prev = { ...Store.findEntity('vehicles', id) };
        Notifications.setSyncing();
        try {
            await ApiClient.remove('vehicles', id);
            Store.removeEntity('vehicles', id);
            Store.deselect();
            Notifications.toast(`Vehicle "${prev.name}" deleted`, 'success');
            Notifications.setSynced();
        } catch (e) {
            Notifications.toast(e.message, 'error');
            Notifications.setError();
            throw e;
        }
    }

    async function createObstruction(data) {
        Notifications.setSyncing();
        try {
            const created = await ApiClient.create('obstructions', data);
            Store.addEntity('obstructions', created);
            Notifications.toast(`Obstruction "${created.name}" created`, 'success');
            Notifications.setSynced();
            return created;
        } catch (e) {
            Notifications.toast(e.message, 'error');
            Notifications.setError();
            throw e;
        }
    }

    async function updateObstruction(id, fields) {
        const prev = { ...Store.findEntity('obstructions', id) };
        Notifications.setSyncing();
        try {
            const updated = await ApiClient.update('obstructions', { id, ...fields });
            Store.updateEntity('obstructions', id, updated);
            Notifications.toast(`Obstruction updated`, 'success');
            Notifications.setSynced();
            return updated;
        } catch (e) {
            Notifications.toast(e.message, 'error');
            Notifications.setError();
            throw e;
        }
    }

    async function deleteObstruction(id) {
        const prev = { ...Store.findEntity('obstructions', id) };
        Notifications.setSyncing();
        try {
            await ApiClient.remove('obstructions', id);
            Store.removeEntity('obstructions', id);
            Store.deselect();
            Notifications.toast(`Obstruction "${prev.name}" deleted`, 'success');
            Notifications.setSynced();
        } catch (e) {
            Notifications.toast(e.message, 'error');
            Notifications.setError();
            throw e;
        }
    }

    return {
        createStop, updateStop, deleteStop,
        createRoute, updateRoute, deleteRoute,
        createVehicle, updateVehicle, deleteVehicle,
        createObstruction, updateObstruction, deleteObstruction,
    };
})();

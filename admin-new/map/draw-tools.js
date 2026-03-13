// ============================================================
// Sawari Admin - Draw Tools
// ============================================================
const DrawTools = (() => {
    let tempMarker = null;

    function init() {
        Store.on('map:click', handleMapClick);
        Store.on('mode', updateCursor);
    }

    function handleMapClick({ latlng }) {
        const state = Store.get();

        if (state.mode === 'select') {
            // If route builder is active, clicking a stop should add it
            if (state.routeBuilder.active) return; // handled by route feature
            // Click on empty map = deselect
            Store.deselect();
            return;
        }

        if (state.mode === 'add') {
            switch (state.addEntity) {
                case 'stop': addStopAtPoint(latlng); break;
                case 'vehicle': addVehicleAtPoint(latlng); break;
                case 'obstruction': addObstructionAtPoint(latlng); break;
                case 'route': /* handled by route feature */ break;
            }
        }
    }

    async function addStopAtPoint(latlng) {
        // Show inline popup to get name
        const popup = L.popup({ closeOnClick: false, autoClose: false })
            .setLatLng(latlng)
            .setContent(createStopPopup(latlng))
            .openOn(MapEngine.getMap());

        // Focus the input
        setTimeout(() => {
            const input = document.getElementById('popup-stop-name');
            if (input) input.focus();
        }, 50);
    }

    function createStopPopup(latlng) {
        const div = document.createElement('div');
        div.className = 'inline-popup';
        div.innerHTML = `
            <div class="popup-title">New Stop</div>
            <div class="form-group">
                <label>Name</label>
                <input type="text" id="popup-stop-name" placeholder="Stop name..." autocomplete="off">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Color</label>
                    <input type="color" id="popup-stop-color" value="#1d4ed8">
                </div>
                <div class="form-group">
                    <label>Icon</label>
                    <select id="popup-stop-icon">
                        <option value="fa-bus">Bus</option>
                        <option value="fa-bus-simple">Bus Simple</option>
                        <option value="fa-location-dot">Location</option>
                        <option value="fa-route">Route</option>
                        <option value="fa-shuttle-van">Shuttle</option>
                    </select>
                </div>
            </div>
            <div class="popup-actions">
                <button class="btn btn-ghost btn-sm" onclick="MapEngine.getMap().closePopup()">Cancel</button>
                <button class="btn btn-primary btn-sm" id="popup-stop-save">Save</button>
            </div>
        `;

        setTimeout(() => {
            const saveBtn = document.getElementById('popup-stop-save');
            const nameInput = document.getElementById('popup-stop-name');
            if (saveBtn) {
                saveBtn.onclick = async () => {
                    const name = nameInput.value.trim();
                    if (!name) { nameInput.focus(); return; }
                    MapEngine.getMap().closePopup();
                    await Commands.createStop({
                        name,
                        lat: latlng.lat,
                        lng: latlng.lng,
                        color: document.getElementById('popup-stop-color').value,
                        icon: document.getElementById('popup-stop-icon').value,
                    });
                };
            }
            if (nameInput) {
                nameInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') saveBtn?.click();
                    if (e.key === 'Escape') MapEngine.getMap().closePopup();
                });
            }
        }, 0);

        return div;
    }

    async function addVehicleAtPoint(latlng) {
        const popup = L.popup({ closeOnClick: false, autoClose: false })
            .setLatLng(latlng)
            .setContent(createVehiclePopup(latlng))
            .openOn(MapEngine.getMap());

        setTimeout(() => {
            const input = document.getElementById('popup-vehicle-name');
            if (input) input.focus();
        }, 50);
    }

    function createVehiclePopup(latlng) {
        const routes = Store.get('routes');
        const routeOptions = routes.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
        const icons = Store.get('icons');
        const imageOptions = (icons.images || []).map(img =>
            `<option value="${img}">${img}</option>`
        ).join('');

        const div = document.createElement('div');
        div.className = 'inline-popup';
        div.innerHTML = `
            <div class="popup-title">New Vehicle</div>
            <div class="form-group">
                <label>Name</label>
                <input type="text" id="popup-vehicle-name" placeholder="Vehicle name..." autocomplete="off">
            </div>
            <div class="form-group">
                <label>Route</label>
                <select id="popup-vehicle-route">
                    <option value="">Unassigned</option>
                    ${routeOptions}
                </select>
            </div>
            <div class="form-group">
                <label>Vehicle Image</label>
                <select id="popup-vehicle-image">
                    <option value="">None (use icon)</option>
                    ${imageOptions}
                </select>
                <div id="popup-vehicle-image-preview" class="image-preview-small" style="display:none;"></div>
            </div>
            <div class="form-group">
                <label>Or upload image</label>
                <input type="file" id="popup-vehicle-upload" accept="image/*" class="file-input">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Speed (km/h)</label>
                    <input type="number" id="popup-vehicle-speed" value="28" min="0">
                </div>
                <div class="form-group">
                    <label>Color</label>
                    <input type="color" id="popup-vehicle-color" value="#1d4ed8">
                </div>
            </div>
            <div class="popup-actions">
                <button class="btn btn-ghost btn-sm" onclick="MapEngine.getMap().closePopup()">Cancel</button>
                <button class="btn btn-primary btn-sm" id="popup-vehicle-save">Save</button>
            </div>
        `;

        setTimeout(() => {
            const saveBtn = document.getElementById('popup-vehicle-save');
            const nameInput = document.getElementById('popup-vehicle-name');
            const imageSelect = document.getElementById('popup-vehicle-image');
            const uploadInput = document.getElementById('popup-vehicle-upload');
            const preview = document.getElementById('popup-vehicle-image-preview');

            // Image preview on select
            if (imageSelect) {
                imageSelect.onchange = () => {
                    const val = imageSelect.value;
                    if (val) {
                        preview.style.display = 'block';
                        preview.innerHTML = `<img src="../assets/${val}" alt="${val}">`;
                    } else {
                        preview.style.display = 'none';
                        preview.innerHTML = '';
                    }
                };
            }

            // Upload handler
            if (uploadInput) {
                uploadInput.onchange = async () => {
                    const file = uploadInput.files[0];
                    if (!file) return;
                    try {
                        const result = await ApiClient.uploadImage(file);
                        // Refresh icons list
                        const icons = await ApiClient.getIcons();
                        Store.set('icons', icons);
                        // Select the newly uploaded file
                        const opt = document.createElement('option');
                        opt.value = result.filename;
                        opt.textContent = result.filename;
                        opt.selected = true;
                        imageSelect.appendChild(opt);
                        imageSelect.value = result.filename;
                        imageSelect.dispatchEvent(new Event('change'));
                        Notifications.toast('Image uploaded', 'success');
                    } catch (e) {
                        Notifications.toast('Upload failed: ' + e.message, 'error');
                    }
                };
            }

            if (saveBtn) {
                saveBtn.onclick = async () => {
                    const name = nameInput.value.trim();
                    if (!name) { nameInput.focus(); return; }
                    MapEngine.getMap().closePopup();
                    const routeId = document.getElementById('popup-vehicle-route').value;
                    const selectedImage = imageSelect.value;
                    await Commands.createVehicle({
                        name,
                        lat: latlng.lat,
                        lng: latlng.lng,
                        routeId: routeId ? parseInt(routeId) : null,
                        speed: parseFloat(document.getElementById('popup-vehicle-speed').value) || 28,
                        color: document.getElementById('popup-vehicle-color').value,
                        icon: selectedImage || 'fa-bus',
                        iconType: selectedImage ? 'image' : 'fontawesome',
                        vehicle_image: selectedImage ? `assets/${selectedImage}` : '',
                    });
                };
            }
            if (nameInput) {
                nameInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') saveBtn?.click();
                    if (e.key === 'Escape') MapEngine.getMap().closePopup();
                });
            }
        }, 0);

        return div;
    }

    async function addObstructionAtPoint(latlng) {
        const popup = L.popup({ closeOnClick: false, autoClose: false })
            .setLatLng(latlng)
            .setContent(createObstructionPopup(latlng))
            .openOn(MapEngine.getMap());

        setTimeout(() => {
            const input = document.getElementById('popup-obs-name');
            if (input) input.focus();
        }, 50);
    }

    function createObstructionPopup(latlng) {
        const div = document.createElement('div');
        div.className = 'inline-popup';
        div.innerHTML = `
            <div class="popup-title">New Obstruction</div>
            <div class="form-group">
                <label>Name</label>
                <input type="text" id="popup-obs-name" placeholder="Issue description..." autocomplete="off">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Radius (m)</label>
                    <input type="number" id="popup-obs-radius" value="40" min="1">
                </div>
                <div class="form-group">
                    <label>Severity</label>
                    <select id="popup-obs-severity">
                        <option value="low">Low</option>
                        <option value="medium" selected>Medium</option>
                        <option value="high">High</option>
                    </select>
                </div>
            </div>
            <div class="popup-actions">
                <button class="btn btn-ghost btn-sm" onclick="MapEngine.getMap().closePopup()">Cancel</button>
                <button class="btn btn-primary btn-sm" id="popup-obs-save">Save</button>
            </div>
        `;

        setTimeout(() => {
            const saveBtn = document.getElementById('popup-obs-save');
            const nameInput = document.getElementById('popup-obs-name');
            if (saveBtn) {
                saveBtn.onclick = async () => {
                    const name = nameInput.value.trim();
                    if (!name) { nameInput.focus(); return; }
                    MapEngine.getMap().closePopup();
                    await Commands.createObstruction({
                        name,
                        lat: latlng.lat,
                        lng: latlng.lng,
                        radiusMeters: parseFloat(document.getElementById('popup-obs-radius').value) || 40,
                        severity: document.getElementById('popup-obs-severity').value,
                        active: true,
                    });
                };
            }
            if (nameInput) {
                nameInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') saveBtn?.click();
                    if (e.key === 'Escape') MapEngine.getMap().closePopup();
                });
            }
        }, 0);

        return div;
    }

    function updateCursor({ mode, addEntity }) {
        const container = document.getElementById('map');
        const hint = document.getElementById('map-mode-hint');
        const crosshair = document.getElementById('map-crosshair');

        if (mode === 'add') {
            container.style.cursor = 'crosshair';
            crosshair.style.display = 'block';
            const labels = { stop: 'Click map to place a stop', route: 'Click stops to build route', vehicle: 'Click map to place a vehicle', obstruction: 'Click map to place obstruction center' };
            hint.textContent = labels[addEntity] || '';
            hint.style.display = 'block';
        } else {
            container.style.cursor = '';
            crosshair.style.display = 'none';
            hint.style.display = 'none';
        }
    }

    function clearTemp() {
        if (tempMarker) {
            MapEngine.getMap().removeLayer(tempMarker);
            tempMarker = null;
        }
    }

    return { init, clearTemp };
})();

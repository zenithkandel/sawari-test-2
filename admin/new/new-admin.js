const API = "../../backend/handlers/api.php";

const state = {
    mode: "select",
    selected: null,
    data: {
        stops: [],
        routes: [],
        vehicles: [],
        obstructions: []
    },
    layersVisible: {
        stops: true,
        routes: true,
        vehicles: true,
        obstructions: true
    },
    markers: {
        stops: new Map(),
        routes: new Map(),
        vehicles: new Map(),
        obstructions: new Map()
    }
};

const map = L.map("map", { zoomControl: true }).setView([27.695, 85.32], 13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap"
}).addTo(map);

const groupStops = L.layerGroup().addTo(map);
const groupRoutes = L.layerGroup().addTo(map);
const groupVehicles = L.layerGroup().addTo(map);
const groupObs = L.layerGroup().addTo(map);

function logStatus(msg) {
    const ul = document.getElementById("status-list");
    const li = document.createElement("li");
    li.textContent = `${new Date().toLocaleTimeString()} - ${msg}`;
    ul.prepend(li);
    while (ul.children.length > 12) ul.removeChild(ul.lastChild);
}

function setMode(mode) {
    state.mode = mode;
    document.querySelectorAll(".tool[data-mode]").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.mode === mode);
    });
    const label =
        mode === "add-stop"
            ? "Mode: Add Stop (click map)"
            : mode === "add-obstruction"
                ? "Mode: Add Obstruction (click map)"
                : "Mode: Select";
    document.getElementById("hint").textContent = label;
}

async function api(type, method = "GET", body = null, query = "") {
    const response = await fetch(`${API}?type=${type}${query}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined
    });
    return response.json();
}

function stopIcon(stop) {
    const color = stop.color || "#1d4ed8";
    return L.divIcon({
        html: `<div style="width:18px;height:18px;background:${color};border:2px solid #fff;border-radius:50%;box-shadow:0 0 0 2px rgba(0,0,0,0.2)"></div>`,
        className: "",
        iconSize: [18, 18],
        iconAnchor: [9, 9]
    });
}

function renderStops() {
    groupStops.clearLayers();
    state.markers.stops.clear();
    if (!state.layersVisible.stops) return;

    state.data.stops.forEach((stop) => {
        const m = L.marker([stop.lat, stop.lng], { icon: stopIcon(stop), draggable: true })
            .addTo(groupStops)
            .on("click", () => selectEntity("stops", stop.id))
            .on("dragend", async (ev) => {
                const ll = ev.target.getLatLng();
                stop.lat = Number(ll.lat.toFixed(6));
                stop.lng = Number(ll.lng.toFixed(6));
                await api("stops", "PUT", stop);
                logStatus(`Stop moved: ${stop.name}`);
                renderInspector();
            });

        m.bindPopup(
            `<strong>${stop.name}</strong><br/>` +
            `<button data-act="rename-stop" data-id="${stop.id}">Rename</button> ` +
            `<button data-act="delete-stop" data-id="${stop.id}">Delete</button>`
        );

        state.markers.stops.set(stop.id, m);
    });
}

function renderRoutes() {
    groupRoutes.clearLayers();
    state.markers.routes.clear();
    if (!state.layersVisible.routes) return;

    const stopById = new Map(state.data.stops.map((s) => [s.id, s]));
    state.data.routes.forEach((route) => {
        const points = (route.stopIds || [])
            .map((id) => stopById.get(id))
            .filter(Boolean)
            .map((s) => [s.lat, s.lng]);

        if (points.length < 2) return;

        const line = L.polyline(points, {
            color: route.color || "#1d4ed8",
            weight: route.weight || 5,
            dashArray: route.style === "dashed" ? "10 6" : ""
        })
            .addTo(groupRoutes)
            .on("click", () => selectEntity("routes", route.id));

        state.markers.routes.set(route.id, line);
    });
}

function renderVehicles() {
    groupVehicles.clearLayers();
    state.markers.vehicles.clear();
    if (!state.layersVisible.vehicles) return;

    state.data.vehicles.forEach((v) => {
        const marker = L.circleMarker([v.lat, v.lng], {
            radius: 6,
            color: v.color || "#444",
            fillColor: v.color || "#444",
            fillOpacity: 0.9
        })
            .addTo(groupVehicles)
            .on("click", () => selectEntity("vehicles", v.id));

        marker.bindTooltip(v.name);
        state.markers.vehicles.set(v.id, marker);
    });
}

function severityColor(severity, active) {
    if (!active) return "#9ca3af";
    if (severity === "high") return "#b91c1c";
    if (severity === "medium") return "#b45309";
    return "#1d4ed8";
}

function renderObstructions() {
    groupObs.clearLayers();
    state.markers.obstructions.clear();
    if (!state.layersVisible.obstructions) return;

    state.data.obstructions.forEach((obs) => {
        const color = severityColor(obs.severity, obs.active);
        const circle = L.circle([obs.lat, obs.lng], {
            radius: obs.radiusMeters || 40,
            color,
            fillColor: color,
            fillOpacity: obs.active ? 0.2 : 0.08,
            weight: 2,
            dashArray: obs.active ? "" : "6 6"
        })
            .addTo(groupObs)
            .on("click", () => selectEntity("obstructions", obs.id));

        circle.bindPopup(
            `<strong>${obs.name}</strong><br/>` +
            `<button data-act="toggle-obs" data-id="${obs.id}">${obs.active ? "Deactivate" : "Activate"}</button> ` +
            `<button data-act="delete-obs" data-id="${obs.id}">Delete</button>`
        );

        state.markers.obstructions.set(obs.id, circle);
    });
}

function renderAll() {
    renderStops();
    renderRoutes();
    renderVehicles();
    renderObstructions();
    renderSearchResults();
}

function findByTypeAndId(type, id) {
    return (state.data[type] || []).find((x) => Number(x.id) === Number(id));
}

function selectEntity(type, id) {
    const item = findByTypeAndId(type, id);
    if (!item) return;
    state.selected = { type, id };

    if (type === "stops") {
        const m = state.markers.stops.get(id);
        if (m) map.flyTo(m.getLatLng(), 15, { duration: 0.4 });
    }
    if (type === "vehicles") {
        const m = state.markers.vehicles.get(id);
        if (m) map.flyTo(m.getLatLng(), 15, { duration: 0.4 });
    }
    if (type === "obstructions") {
        const c = state.markers.obstructions.get(id);
        if (c) map.flyTo(c.getLatLng(), 15, { duration: 0.4 });
    }

    renderInspector();
}

function inspectorRow(label, value) {
    return `<div>${label}</div><div>${value ?? "-"}</div>`;
}

function renderInspector() {
    const node = document.getElementById("inspector");
    if (!state.selected) {
        node.className = "inspector-empty";
        node.textContent = "Select an item on map.";
        return;
    }

    const item = findByTypeAndId(state.selected.type, state.selected.id);
    if (!item) {
        state.selected = null;
        node.className = "inspector-empty";
        node.textContent = "Selection is no longer available.";
        return;
    }

    node.className = "";
    const grid = [];
    Object.entries(item).forEach(([k, v]) => {
        if (Array.isArray(v)) grid.push(inspectorRow(k, v.join(", ")));
        else grid.push(inspectorRow(k, String(v)));
    });

    let actions = "";
    if (state.selected.type === "stops") {
        actions =
            '<button class="action-btn" id="insp-rename-stop">Rename</button>' +
            '<button class="action-btn warn" id="insp-delete-stop">Delete</button>';
    }
    if (state.selected.type === "obstructions") {
        actions =
            '<button class="action-btn" id="insp-toggle-obs">Toggle Active</button>' +
            '<button class="action-btn" id="insp-radius-obs">Edit Radius</button>' +
            '<button class="action-btn warn" id="insp-delete-obs">Delete</button>';
    }

    node.innerHTML =
        `<div class="inspector-grid">${grid.join("")}</div>` +
        (actions ? `<div class="inspector-actions">${actions}</div>` : "");

    wireInspectorActions();
}

async function refreshData() {
    const [stops, routes, vehicles, obstructions] = await Promise.all([
        api("stops"),
        api("routes"),
        api("vehicles"),
        api("obstructions")
    ]);
    state.data.stops = Array.isArray(stops) ? stops : [];
    state.data.routes = Array.isArray(routes) ? routes : [];
    state.data.vehicles = Array.isArray(vehicles) ? vehicles : [];
    state.data.obstructions = Array.isArray(obstructions) ? obstructions : [];
    renderAll();
    renderInspector();
    logStatus("Data refreshed");
}

function renderSearchResults() {
    const query = document.getElementById("search").value.trim().toLowerCase();
    const out = document.getElementById("search-results");
    out.innerHTML = "";
    if (!query) return;

    const groups = ["stops", "routes", "vehicles", "obstructions"];
    const matches = [];
    groups.forEach((type) => {
        (state.data[type] || []).forEach((item) => {
            const name = String(item.name || "").toLowerCase();
            if (name.includes(query)) matches.push({ type, id: item.id, name: item.name || "(unnamed)" });
        });
    });

    matches.slice(0, 40).forEach((m) => {
        const el = document.createElement("button");
        el.className = "result-item";
        el.textContent = `${m.name} [${m.type}]`;
        el.addEventListener("click", () => selectEntity(m.type, m.id));
        out.appendChild(el);
    });
}

async function createStopAt(latlng) {
    const name = window.prompt("Stop name:", "New Stop");
    if (!name) return;
    const color = window.prompt("Color hex:", "#1d4ed8") || "#1d4ed8";

    await api("stops", "POST", {
        name,
        lat: Number(latlng.lat.toFixed(6)),
        lng: Number(latlng.lng.toFixed(6)),
        icon: "fa-bus",
        iconType: "fontawesome",
        color
    });

    logStatus(`Stop created: ${name}`);
    await refreshData();
}

async function createObstructionAt(latlng) {
    const name = window.prompt("Obstruction name:", "Road issue");
    if (!name) return;
    const radius = Number(window.prompt("Radius meters:", "40") || "40");
    const severity = (window.prompt("Severity (low/medium/high):", "medium") || "medium").toLowerCase();

    await api("obstructions", "POST", {
        name,
        lat: Number(latlng.lat.toFixed(6)),
        lng: Number(latlng.lng.toFixed(6)),
        radiusMeters: Number.isFinite(radius) && radius > 0 ? radius : 40,
        severity: ["low", "medium", "high"].includes(severity) ? severity : "medium",
        active: true
    });

    logStatus(`Obstruction created: ${name}`);
    await refreshData();
}

async function renameSelectedStop() {
    if (!state.selected || state.selected.type !== "stops") return;
    const stop = findByTypeAndId("stops", state.selected.id);
    if (!stop) return;
    const next = window.prompt("Rename stop:", stop.name || "");
    if (!next) return;
    stop.name = next;
    await api("stops", "PUT", stop);
    logStatus(`Stop renamed: ${next}`);
    await refreshData();
}

async function deleteSelectedStop() {
    if (!state.selected || state.selected.type !== "stops") return;
    const stop = findByTypeAndId("stops", state.selected.id);
    if (!stop) return;

    const affected = state.data.routes.filter((r) => (r.stopIds || []).includes(stop.id));
    const warn = affected.length
        ? `This stop is used in ${affected.length} route(s). Delete anyway?`
        : "Delete this stop?";
    if (!window.confirm(warn)) return;

    await api("stops", "DELETE", null, `&id=${encodeURIComponent(stop.id)}`);
    state.selected = null;
    logStatus(`Stop deleted: ${stop.name}`);
    await refreshData();
}

async function toggleSelectedObstruction() {
    if (!state.selected || state.selected.type !== "obstructions") return;
    const obs = findByTypeAndId("obstructions", state.selected.id);
    if (!obs) return;
    obs.active = !obs.active;
    await api("obstructions", "PUT", obs);
    logStatus(`Obstruction ${obs.active ? "activated" : "deactivated"}: ${obs.name}`);
    await refreshData();
}

async function editSelectedObstructionRadius() {
    if (!state.selected || state.selected.type !== "obstructions") return;
    const obs = findByTypeAndId("obstructions", state.selected.id);
    if (!obs) return;
    const radius = Number(window.prompt("New radius (m):", String(obs.radiusMeters || 40)));
    if (!Number.isFinite(radius) || radius <= 0) return;
    obs.radiusMeters = radius;
    await api("obstructions", "PUT", obs);
    logStatus(`Obstruction radius updated: ${obs.name}`);
    await refreshData();
}

async function deleteSelectedObstruction() {
    if (!state.selected || state.selected.type !== "obstructions") return;
    const obs = findByTypeAndId("obstructions", state.selected.id);
    if (!obs) return;
    if (!window.confirm("Delete this obstruction?")) return;
    await api("obstructions", "DELETE", null, `&id=${encodeURIComponent(obs.id)}`);
    state.selected = null;
    logStatus(`Obstruction deleted: ${obs.name}`);
    await refreshData();
}

function wireInspectorActions() {
    const a = document.getElementById("insp-rename-stop");
    if (a) a.addEventListener("click", renameSelectedStop);

    const b = document.getElementById("insp-delete-stop");
    if (b) b.addEventListener("click", deleteSelectedStop);

    const c = document.getElementById("insp-toggle-obs");
    if (c) c.addEventListener("click", toggleSelectedObstruction);

    const d = document.getElementById("insp-radius-obs");
    if (d) d.addEventListener("click", editSelectedObstructionRadius);

    const e = document.getElementById("insp-delete-obs");
    if (e) e.addEventListener("click", deleteSelectedObstruction);
}

map.on("click", async (ev) => {
    if (state.mode === "add-stop") {
        await createStopAt(ev.latlng);
        return;
    }
    if (state.mode === "add-obstruction") {
        await createObstructionAt(ev.latlng);
        return;
    }
});

document.getElementById("tool-select").addEventListener("click", () => setMode("select"));
document.getElementById("tool-add-stop").addEventListener("click", () => setMode("add-stop"));
document.getElementById("tool-add-obs").addEventListener("click", () => setMode("add-obstruction"));
document.getElementById("btn-refresh").addEventListener("click", refreshData);

document.getElementById("search").addEventListener("input", renderSearchResults);

const layerCheckboxMap = {
    stops: document.getElementById("layer-stops"),
    routes: document.getElementById("layer-routes"),
    vehicles: document.getElementById("layer-vehicles"),
    obstructions: document.getElementById("layer-obstructions")
};

Object.entries(layerCheckboxMap).forEach(([type, checkbox]) => {
    checkbox.addEventListener("change", () => {
        state.layersVisible[type] = checkbox.checked;
        renderAll();
    });
});

document.addEventListener("click", async (ev) => {
    const target = ev.target;
    if (!(target instanceof HTMLElement)) return;

    const act = target.dataset.act;
    if (!act) return;

    const id = Number(target.dataset.id);
    if (act === "rename-stop") {
        selectEntity("stops", id);
        await renameSelectedStop();
    }
    if (act === "delete-stop") {
        selectEntity("stops", id);
        await deleteSelectedStop();
    }
    if (act === "toggle-obs") {
        selectEntity("obstructions", id);
        await toggleSelectedObstruction();
    }
    if (act === "delete-obs") {
        selectEntity("obstructions", id);
        await deleteSelectedObstruction();
    }
});

refreshData();
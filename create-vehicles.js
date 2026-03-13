const fs = require('fs');
const path = require('path');


const routes = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'routes.json'), 'utf8'));
const vehicles = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'vehicles.json'), 'utf8'));
const stops = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'stops.json'), 'utf8'));

// Available images
const assetsDir = path.join(__dirname, 'assets');
const allowedExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif'];
const images = fs.readdirSync(assetsDir).filter(f => {
    const ext = path.extname(f).slice(1).toLowerCase();
    return allowedExts.includes(ext) && fs.statSync(path.join(assetsDir, f)).isFile();
});

console.log('Available images:', images);

// Collect operator -> routes mapping
const operatorRoutes = {};
routes.forEach(r => {
    if (r.operator && r.operator.length > 0) {
        r.operator.forEach(op => {
            if (operatorRoutes[op] === undefined) operatorRoutes[op] = [];
            operatorRoutes[op].push(r);
        });
    }
});

console.log('\nOperators and their routes:');
for (const [op, rts] of Object.entries(operatorRoutes)) {
    console.log(`  ${op}: ${rts.length} routes`);
    rts.forEach(r => console.log(`    - [${r.id}] ${r.name}`));
}

// For each operator, create one vehicle per route they operate
// Place each vehicle at the first stop of its route
let nextVehicleId = Math.max(...vehicles.map(v => v.id), 0) + 1;
const newVehicles = [...vehicles];

function randomImage() {
    return images[Math.floor(Math.random() * images.length)];
}

let vehicleNum = 1;
for (const [operator, rts] of Object.entries(operatorRoutes)) {
    rts.forEach((route, idx) => {
        // Place vehicle at a stop along the route (spread them out)
        const stopIdx = Math.floor(route.stopIds.length * (idx / rts.length));
        const stopId = route.stopIds[stopIdx];
        const stop = stops.find(s => s.id === stopId);
        if (stop === undefined) return;

        const img = randomImage();
        const vehicle = {
            name: `${operator} #${vehicleNum}`,
            lat: stop.lat + (Math.random() - 0.5) * 0.002, // slight offset so they don't overlap
            lng: stop.lng + (Math.random() - 0.5) * 0.002,
            routeId: route.id,
            speed: 20 + Math.floor(Math.random() * 20),
            color: route.color,
            icon: img,
            iconType: 'image',
            vehicle_image: `assets/${img}`,
            moving: false,
            bearing: Math.floor(Math.random() * 360),
            ratingAverage: 0,
            ratingCount: 0,
            id: nextVehicleId,
        };
        newVehicles.push(vehicle);
        nextVehicleId++;
        vehicleNum++;
    });
}

console.log(`\nCreated ${newVehicles.length - vehicles.length} new vehicles (total: ${newVehicles.length})`);
newVehicles.slice(1).forEach(v => {
    console.log(`  [${v.id}] ${v.name} -> route ${v.routeId}, image: ${v.icon}`);
});

fs.writeFileSync(path.join(__dirname, 'data', 'vehicles.json'), JSON.stringify(newVehicles, null, 4));
console.log('\nWritten to data/vehicles.json');

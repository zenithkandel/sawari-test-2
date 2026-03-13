/**
 * Import script: merges found.js data into data/stops.json and data/routes.json
 * Run with: node import-found-data.js
 */
const fs = require('fs');
const path = require('path');

// Load found data
const foundContent = fs.readFileSync(path.join(__dirname, 'found.js'), 'utf8');
// Extract the two JSON.parse calls
const stopsMatch = foundContent.match(/const a = JSON\.parse\('(.+?)'\);/s);
const routesMatch = foundContent.match(/const b = JSON\.parse\('(.+?)'\);/s);

if (!stopsMatch || !routesMatch) {
    console.error('Could not parse found.js');
    process.exit(1);
}

const foundStops = JSON.parse(stopsMatch[1]);
const foundRoutes = JSON.parse(routesMatch[1]);

console.log(`Found data: ${foundStops.length} stops, ${foundRoutes.length} routes`);

// Load existing data
const existingStops = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'stops.json'), 'utf8'));
const existingRoutes = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'routes.json'), 'utf8'));

console.log(`Existing data: ${existingStops.length} stops, ${existingRoutes.length} routes`);

// Distance in meters between two lat/lng points (Haversine)
function distanceMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Build a mapping from found string IDs to our integer IDs
// First, try to match existing stops by proximity (< 150m)
const PROXIMITY_THRESHOLD = 150; // meters
const foundIdToIntId = new Map();
let nextId = Math.max(...existingStops.map(s => s.id), 0) + 1;
const mergedStops = [...existingStops];

for (const fs of foundStops) {
    // Check if an existing stop is close enough
    let matched = null;
    for (const es of mergedStops) {
        const dist = distanceMeters(fs.lat, fs.lng, es.lat, es.lng);
        if (dist < PROXIMITY_THRESHOLD) {
            matched = es;
            break;
        }
    }

    if (matched) {
        foundIdToIntId.set(fs.id, matched.id);
    } else {
        // Add as new stop
        const newStop = {
            name: fs.name,
            lat: fs.lat,
            lng: fs.lng,
            color: '#1d4ed8',
            icon: 'fa-bus',
            iconType: 'fontawesome',
            id: nextId,
        };
        mergedStops.push(newStop);
        foundIdToIntId.set(fs.id, nextId);
        nextId++;
    }
}

const newStopsCount = mergedStops.length - existingStops.length;
console.log(`After merge: ${mergedStops.length} stops (${newStopsCount} new, ${foundStops.length - newStopsCount} matched to existing)`);

// Also handle stop IDs referenced in routes that might not be in foundStops list
// (e.g. "8db96f28" appears in routes but not in stops array)
// We'll collect missing ones and skip them

// Convert routes
let nextRouteId = Math.max(...existingRoutes.map(r => r.id), 0) + 1;
const mergedRoutes = [...existingRoutes];

let skippedRoutes = 0;
for (const fr of foundRoutes) {
    // Convert stop IDs
    const stopIds = [];
    let hasUnresolved = false;

    for (const sid of fr.stops) {
        if (foundIdToIntId.has(sid)) {
            stopIds.push(foundIdToIntId.get(sid));
        } else {
            hasUnresolved = true;
            // Try to find this stop ID in the found stops list
            // If not found, skip this stop reference
        }
    }

    // Remove consecutive duplicates (from dedup matching)
    const dedupedStopIds = stopIds.filter((id, i) => i === 0 || id !== stopIds[i - 1]);

    if (dedupedStopIds.length < 2) {
        skippedRoutes++;
        continue;
    }

    const newRoute = {
        name: fr.name,
        stopIds: dedupedStopIds,
        color: fr.lineColor || '#1d4ed8',
        style: 'solid',
        weight: 5,
        snapToRoad: true,
        ratingAverage: 0,
        ratingCount: 0,
        id: nextRouteId,
    };

    if (fr.operator) {
        newRoute.operator = fr.operator;
    }
    if (fr.isVerifiedRoute) {
        newRoute.isVerifiedRoute = true;
    }
    if (fr.details) {
        newRoute.details = fr.details;
    }

    mergedRoutes.push(newRoute);
    nextRouteId++;
}

const newRoutesCount = mergedRoutes.length - existingRoutes.length;
console.log(`After merge: ${mergedRoutes.length} routes (${newRoutesCount} new, ${skippedRoutes} skipped)`);

// Write output
fs.writeFileSync(path.join(__dirname, 'data', 'stops.json'), JSON.stringify(mergedStops, null, 4));
fs.writeFileSync(path.join(__dirname, 'data', 'routes.json'), JSON.stringify(mergedRoutes, null, 4));

console.log('Done! Data written to data/stops.json and data/routes.json');

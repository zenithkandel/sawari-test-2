# Sawari - Constants, Ranges & Fixed Values Reference

Every hardcoded constant, threshold, range, and default used in the system.

---

## Map & Geography

| Constant                 | Value                     | Location                      | Description                 |
| ------------------------ | ------------------------- | ----------------------------- | --------------------------- |
| Default center latitude  | `27.7172`                 | `app.js:7`, `map-engine.js:7` | Kathmandu center            |
| Default center longitude | `85.3240`                 | `app.js:7`, `map-engine.js:7` | Kathmandu center            |
| Default zoom level       | `13`                      | `app.js:8`, `map-engine.js:8` | Initial map zoom            |
| Max zoom (public)        | `20`                      | `app.js:163`                  | Tile layer max zoom         |
| Max zoom (admin)         | `19`                      | `map-engine.js:26`            | Admin tile layer max zoom   |
| GPS flyTo zoom           | `17`                      | `app.js:1713`                 | Zoom when centering on GPS  |
| GPS follow min zoom      | `16`                      | `app.js:1721`                 | Min zoom when following GPS |
| Earth radius             | `6,371,000` m             | `routing.js:53`               | Haversine formula constant  |
| Meters per degree lat    | `111,320.0`               | `backend/handlers/api.php:61` | Geo-math constant           |
| Kathmandu viewbox        | `85.28,27.75,85.36,27.67` | `app.js:51`                   | Nominatim search bounds     |

## Validation Ranges

| Field              | Min    | Max   | Applies To                    | Location                       |
| ------------------ | ------ | ----- | ----------------------------- | ------------------------------ |
| Latitude           | `-90`  | `90`  | Stops, vehicles, obstructions | All validators                 |
| Longitude          | `-180` | `180` | Stops, vehicles, obstructions | All validators                 |
| Route weight       | `1`    | `10`  | Routes                        | `route-validator.php:25-28`    |
| Rating average     | `0`    | `5`   | Routes, vehicles              | Route & vehicle validators     |
| Rating count       | `0`    | ∞     | Routes, vehicles              | Route & vehicle validators     |
| Speed              | `0`    | ∞     | Vehicles                      | `vehicle-validator.php:31`     |
| Bearing            | `0`    | `359` | Vehicles                      | `vehicle-validator.php:37`     |
| Obstruction radius | `> 0`  | ∞     | Obstructions                  | `obstruction-validator.php:31` |
| Severity values    | —      | —     | Obstructions                  | `low`, `medium`, `high` only   |
| Route min stops    | `2`    | ∞     | Routes                        | `route-validator.php:19`       |
| User rating input  | `1`    | `5`   | Rating UI                     | `app.js:358`                   |

## Default Values (Set by Validators)

| Field           | Default         | Entity                  | Location                    |
| --------------- | --------------- | ----------------------- | --------------------------- |
| `icon`          | `'fa-bus'`      | Stops                   | `stop-validator.php`        |
| `iconType`      | `'fontawesome'` | Stops                   | `stop-validator.php`        |
| `color`         | `'#1d4ed8'`     | Stops, routes, vehicles | All validators              |
| `style`         | `'solid'`       | Routes                  | `route-validator.php`       |
| `weight`        | `5`             | Routes                  | `route-validator.php`       |
| `snapToRoad`    | `true`          | Routes                  | `route-validator.php`       |
| `ratingAverage` | `0`             | Routes, vehicles        | Route & vehicle validators  |
| `ratingCount`   | `0`             | Routes, vehicles        | Route & vehicle validators  |
| `speed`         | `0`             | Vehicles                | `vehicle-validator.php`     |
| `moving`        | `false`         | Vehicles                | `vehicle-validator.php`     |
| `bearing`       | `0`             | Vehicles                | `vehicle-validator.php`     |
| `routeId`       | `null`          | Vehicles                | `vehicle-validator.php`     |
| `radiusMeters`  | `40`            | Obstructions            | `obstruction-validator.php` |
| `severity`      | `'medium'`      | Obstructions            | `obstruction-validator.php` |
| `active`        | `true`          | Obstructions            | `obstruction-validator.php` |

## Transit & Routing Constants

| Constant                  | Value                       | Location      | Description                        |
| ------------------------- | --------------------------- | ------------- | ---------------------------------- |
| Default bus speed         | `28` km/h                   | `app.js:49`   | Used for ETA calculations          |
| Max walking distance      | `800` m                     | `app.js:989`  | Max walk to reach a stop           |
| Transfer wait time        | `60` s                      | `app.js:1160` | Time added at transfer stops       |
| Vehicle score formula     | `etaSeconds + dist * 0.015` | `app.js:399`  | Ranks vehicles for leg assignment  |
| Map fit padding (desktop) | `[60, 60]`                  | `app.js:553`  | Padding when fitting route to view |
| Map fit padding (mobile)  | `[30, 30]`                  | `app.js:553`  | Padding on screens ≤640px          |

## Fare Constants (Nepal DoTM Tariff)

| Constant                   | Value               | Location      | Description                         |
| -------------------------- | ------------------- | ------------- | ----------------------------------- |
| Regular minimum fare       | `Rs 20`             | `app.js:1298` | Minimum fare for regular passengers |
| Student/elderly minimum    | `Rs 15`             | `app.js:1299` | Minimum fare for students/elderly   |
| Base distance              | `5` km              | `app.js:1300` | Distance covered by minimum fare    |
| Bus rate (after base)      | `Rs 1.80` /km       | `app.js:1301` | Per-km rate for regular bus         |
| Microbus rate (after base) | `Rs 2.35` /km       | `app.js:1302` | Per-km rate for microbus            |
| Fare rounding              | Multiples of `Rs 5` | `app.js:1304` | `Math.ceil(amount / 5) * 5`         |

## Carbon Emission Constants

| Constant       | Value      | Location      | Description           |
| -------------- | ---------- | ------------- | --------------------- |
| Car CO2 per km | `170` g/km | `app.js:1273` | Average car emissions |
| Bus CO2 per km | `50` g/km  | `app.js:1274` | Average bus emissions |

## API & Network

| Constant                  | Value                                 | Location                   | Description                     |
| ------------------------- | ------------------------------------- | -------------------------- | ------------------------------- |
| Public API path           | `'backend/handlers/api.php'`          | `app.js:6`                 | Public API endpoint             |
| Admin API path            | `'../backend/admin/handlers/api.php'` | `api-client.js:5`          | Admin API endpoint              |
| Vehicle cache TTL         | `5,000` ms                            | `app.js:120`               | How long vehicle data is cached |
| General cache TTL         | `30,000` ms                           | `app.js:120`               | How long other data is cached   |
| Fetch timeout             | `8,000` ms                            | `routing.js:61`            | Default network request timeout |
| OSRM alternatives timeout | `10,000` ms                           | `routing.js:147`           | Timeout for route alternatives  |
| PHP OSRM timeout          | `8` s (default) / `10` s (route-plan) | `backend/handlers/api.php` | Server-side OSRM requests       |
| Vehicle poll interval     | `3,000` ms                            | `app.js:1545`              | Live vehicle position refresh   |

### OSRM Server URLs

| Profile | Primary URL                                    | Fallback URL                      |
| ------- | ---------------------------------------------- | --------------------------------- |
| Driving | `https://routing.openstreetmap.de/routed-car`  | `https://router.project-osrm.org` |
| Walking | `https://routing.openstreetmap.de/routed-foot` | `https://router.project-osrm.org` |
| Cycling | `https://routing.openstreetmap.de/routed-bike` | `https://router.project-osrm.org` |

### Tile Server URLs

| Variant             | URL                                                                      |
| ------------------- | ------------------------------------------------------------------------ |
| Dark (no labels)    | `https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png`     |
| Light (no labels)   | `https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png`    |
| Dark (labels only)  | `https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png`  |
| Light (labels only) | `https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png` |
| Dark (admin, all)   | `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`          |
| Light (admin, all)  | `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png`         |

## Search & Autocomplete

| Constant                 | Value                                        | Location       | Description                       |
| ------------------------ | -------------------------------------------- | -------------- | --------------------------------- |
| Nominatim URL            | `https://nominatim.openstreetmap.org/search` | `app.js:50`    | Geocoding API endpoint            |
| Max autocomplete results | `5`                                          | `app.js:52`    | Nominatim result limit            |
| Min query length         | `3` chars                                    | `app.js:53`    | Before triggering online search   |
| Place cache TTL          | `600,000` ms (10 min)                        | `app.js:54`    | How long place results are cached |
| Place cache max size     | `100` entries                                | `app.js:55`    | Max cached place queries          |
| Route cache max size     | `200` entries                                | `routing.js:9` | Max cached OSRM routes            |

## AI / LLM Constants

| Constant                         | Value                                             | Location                     | Description                       |
| -------------------------------- | ------------------------------------------------- | ---------------------------- | --------------------------------- |
| Groq API URL                     | `https://api.groq.com/openai/v1/chat/completions` | `ai-assistant.js:216`        | LLM inference endpoint            |
| Model                            | `llama-3.3-70b-versatile`                         | `ai-assistant.js:223`        | LLM model ID                      |
| Max tokens (admin AI)            | `1,200`                                           | `ai-assistant.js:224`        | Max response length               |
| Temperature (admin AI)           | `0.1`                                             | `ai-assistant.js:225`        | Near-deterministic output         |
| Max tokens (location extractor)  | `200`                                             | `location-extractor.html:89` | Short extraction results          |
| Temperature (location extractor) | `0`                                               | `location-extractor.html:90` | Fully deterministic               |
| Default AI coordinates           | `27.7172, 85.3240`                                | `ai-assistant.js:386-387`    | Fallback lat/lng for new entities |

## Animation & Timing

| Duration   | Context                                 | Location           |
| ---------- | --------------------------------------- | ------------------ |
| `1,500` ms | Default smooth marker animation         | `app.js:277`       |
| `2,500` ms | Vehicle marker animation                | `app.js:1578`      |
| `3,000` ms | Default toast display time              | `app.js:128`       |
| `1,200` ms | Toggle feedback toasts                  | `app.js`           |
| `1,400` ms | Rating success toast                    | `app.js`           |
| `2,000` ms | Data load toast                         | `app.js`           |
| `4,000` ms | Walking fallback toast                  | `app.js`           |
| `5,000` ms | Error toast                             | `app.js`           |
| `200` ms   | Toast fade out animation                | `notifications.js` |
| `150` ms   | CSS transition default (`--transition`) | `style.css`        |

## Marker Sizes (pixels)

| Marker                  | Size      | Location                    |
| ----------------------- | --------- | --------------------------- |
| Start/End point         | `38 × 38` | `app.js:455-462`            |
| Near stop icon          | `32 × 32` | `app.js:467`                |
| Context stop markers    | `18 × 18` | `app.js:516`                |
| Explore route stop      | `24 × 24` | `app.js:726`                |
| Vehicle tile (normal)   | `42 × 42` | `app.js:1569`               |
| Vehicle tile (assigned) | `48 × 48` | `app.js:1569`               |
| GPS location dot        | `20 × 20` | `app.js:1641`               |
| GPS arrow icon          | `44 × 44` | `app.js:1633`               |
| Admin stop marker       | `28 × 28` | `admin/styles/main.css:569` |
| Admin vehicle marker    | `36 × 36` | `admin/styles/main.css:609` |

## File Upload Limits

| Constraint                        | Value                                                  | Location                       |
| --------------------------------- | ------------------------------------------------------ | ------------------------------ |
| Max file size                     | `10` MB                                                | `admin/api.php:95`             |
| Allowed extensions (admin upload) | `png, jpg, jpeg, gif, svg, webp, avif`                 | `admin/api.php:91`             |
| Allowed extensions (public icons) | `png, jpg, jpeg, gif, svg, webp, avif, bmp, ico, tiff` | `backend/handlers/api.php:266` |

## CSS Design Tokens

### Colors (Dark Theme)

| Variable           | Value     | Purpose                  |
| ------------------ | --------- | ------------------------ |
| `--bg`             | `#0f1117` | Page background          |
| `--bg-surface`     | `#181a20` | Card/panel background    |
| `--bg-elevated`    | `#1e2028` | Elevated surface         |
| `--bg-hover`       | `#262830` | Hover state              |
| `--bg-active`      | `#2e3040` | Active/pressed state     |
| `--border`         | `#2a2d38` | Primary border           |
| `--border-light`   | `#363944` | Light border             |
| `--text`           | `#e8eaed` | Primary text             |
| `--text-secondary` | `#9aa0ad` | Secondary text           |
| `--text-muted`     | `#6b7280` | Muted/hint text          |
| `--accent`         | `#3b82f6` | Primary accent (blue)    |
| `--accent-hover`   | `#2563eb` | Accent hover state       |
| `--success`        | `#22c55e` | Success state (green)    |
| `--warn`           | `#f59e0b` | Warning state (amber)    |
| `--danger`         | `#ef4444` | Error/danger state (red) |

### Colors (Light Theme)

| Variable           | Value     |
| ------------------ | --------- |
| `--bg`             | `#f0f2f5` |
| `--bg-surface`     | `#ffffff` |
| `--bg-elevated`    | `#f8f9fa` |
| `--bg-hover`       | `#e9ecef` |
| `--bg-active`      | `#dee2e6` |
| `--border`         | `#d1d5db` |
| `--border-light`   | `#e5e7eb` |
| `--text`           | `#1f2937` |
| `--text-secondary` | `#4b5563` |
| `--text-muted`     | `#9ca3af` |
| `--accent`         | `#2563eb` |
| `--accent-hover`   | `#1d4ed8` |
| `--success`        | `#16a34a` |
| `--warn`           | `#d97706` |
| `--danger`         | `#dc2626` |

### Layout Tokens

| Variable           | Value                                           | Scope                       |
| ------------------ | ----------------------------------------------- | --------------------------- |
| `--radius`         | `8px`                                           | Default border radius       |
| `--radius-sm`      | `4px`                                           | Small border radius         |
| `--radius-lg`      | `12px`                                          | Large border radius         |
| `--transition`     | `150ms ease`                                    | Default transition          |
| `--font`           | `'Inter', system-ui, -apple-system, sans-serif` | Primary font                |
| `--command-bar-h`  | `48px`                                          | Admin command bar height    |
| `--status-strip-h` | `28px`                                          | Admin status bar height     |
| `--panel-w`        | `260px`                                         | Admin layer panel width     |
| `--inspector-w`    | `320px`                                         | Admin inspector panel width |

### Responsive Breakpoints

| Breakpoint | Location              | Effect                                 |
| ---------- | --------------------- | -------------------------------------- |
| `≤ 1100px` | `admin/main.css:1790` | Inspector collapses                    |
| `≤ 860px`  | `admin/main.css:1798` | Panels overlay map, text labels hidden |
| `≤ 640px`  | `app.js:553`          | Reduced map fit padding                |
| `≤ 600px`  | `admin/main.css:1847` | Panels go full width                   |

## Authentication

| Constant               | Value                 | Location                      |
| ---------------------- | --------------------- | ----------------------------- |
| Default admin password | `sawari@111`          | `.env` / `admin/index.php:17` |
| Session key            | `admin_authenticated` | `admin/index.php`             |
| Logout param           | `?logout=1`           | `admin/index.php`             |

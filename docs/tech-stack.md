# Sawari - Tech Stack & System Workflow

## Architecture Overview

Sawari is a full-stack web application with a clear separation between the public transit navigator and the admin management portal. Everything runs on a standard LAMP stack (XAMPP) with no build tools, no bundlers, and no frameworks — just vanilla code.

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT (Browser)                       │
│                                                             │
│  ┌─────────────────────┐    ┌────────────────────────────┐  │
│  │   Public Navigator  │    │    Admin Dashboard         │  │
│  │   (index.php)       │    │    (admin/index.php)       │  │
│  │   app.js            │    │    12+ IIFE JS modules     │  │
│  │   routing.js        │    │    AI Assistant (Groq)     │  │
│  │   style.css         │    │    main.css                │  │
│  └────────┬────────────┘    └──────────┬─────────────────┘  │
│           │                            │                    │
└───────────┼────────────────────────────┼────────────────────┘
            │ fetch()                    │ fetch()
            ▼                            ▼
┌───────────────────────┐    ┌────────────────────────────────┐
│  Public API           │    │  Admin API                     │
│  backend/handlers/    │    │  backend/admin/handlers/       │
│  api.php              │    │  api.php                       │
│  suggestions.php      │    │  + validators/                 │
│                       │    │  + services/relation-guard     │
│                       │    │  + repositories/file-store     │
└───────────┬───────────┘    └──────────┬─────────────────────┘
            │                            │
            ▼                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    data/ (JSON files)                        │
│  stops.json  routes.json  vehicles.json  obstructions.json  │
│  suggestions.json  icons.json                              │
└─────────────────────────────────────────────────────────────┘
```

## Frontend Technologies

### Public Navigator

| Technology                | Version      | Purpose                                                    |
| ------------------------- | ------------ | ---------------------------------------------------------- |
| **Leaflet**               | 1.9.4        | Interactive map rendering, markers, polylines, popups      |
| **Font Awesome**          | 6.5.1        | Icons throughout the UI (stop markers, buttons, status)    |
| **Inter** (Google Fonts)  | wght 400-800 | Primary typeface                                           |
| **CARTO Basemaps**        | —            | Map tiles in dark/light variants (with and without labels) |
| **Vanilla JavaScript**    | ES2020+      | No framework — single `app.js` and `routing.js`            |
| **CSS Custom Properties** | —            | Theming (dark/light) via CSS variables                     |
| **PHP** (index.php)       | —            | Server-side `.env` injection (API key → JS constant)       |

### Admin Dashboard

| Technology              | Purpose                                                                          |
| ----------------------- | -------------------------------------------------------------------------------- |
| **IIFE Module Pattern** | 12+ self-contained modules (`Store`, `MapEngine`, `Commands`, `Inspector`, etc.) |
| **Event Bus**           | `Store.on()` / `Store.emit()` for decoupled inter-module communication           |
| **Command Pattern**     | All mutations go through `Commands` module with undo/redo via `History`          |
| **Leaflet**             | Same map engine as public side, with admin-specific tools                        |
| **Font Awesome**        | Same icon library                                                                |

### Admin JS Modules

```
admin/
├── app.js                    # Bootstrap & keyboard shortcuts
├── services/
│   └── api-client.js         # ApiClient — all fetch() calls to admin API
├── state/
│   ├── store.js              # Store — event bus + state container
│   ├── commands.js           # Commands — CRUD operations + undo/redo
│   └── history.js            # History — undo/redo stack
├── map/
│   ├── map-engine.js         # MapEngine — Leaflet init, themes, layers
│   ├── draw-tools.js         # DrawTools — add mode, map clicks → entity creation
│   └── selection-tools.js    # SelectionTools — click-to-select on map
├── entities/
│   ├── stops.js              # Stops — marker rendering, CRUD hooks
│   ├── routes.js             # Routes — polyline rendering, route builder
│   ├── vehicles.js           # Vehicles — marker rendering, image support
│   └── obstructions.js       # Obstructions — circle rendering, severity colors
├── components/
│   ├── command-bar/
│   │   └── command-bar.js    # CommandBar — toolbar, mode switching, search
│   ├── layer-panel/
│   │   └── layer-panel.js    # LayerPanel — entity type filters, stats
│   ├── inspector/
│   │   └── inspector.js      # Inspector — property editor panel
│   ├── notifications/
│   │   └── notifications.js  # Notifications — toast system, sync status
│   ├── ai-assistant/
│   │   └── ai-assistant.js   # AiAssistant — NL commands via Groq LLM
│   └── suggestions/
│       └── suggestions.js    # Suggestions — community feedback with task execution
└── styles/
    └── main.css              # All admin styles
```

## Backend Technologies

### PHP Backend

| Component        | Details                                               |
| ---------------- | ----------------------------------------------------- |
| **Runtime**      | PHP 8+ on XAMPP (Apache)                              |
| **Data Storage** | Flat JSON files — no database                         |
| **File Locking** | `flock(LOCK_EX)` prevents concurrent write corruption |
| **Auth**         | PHP sessions (`$_SESSION['admin_authenticated']`)     |
| **Config**       | `.env` file parsed at runtime                         |
| **CORS**         | Fully open (`Access-Control-Allow-Origin: *`)         |

### Backend File Structure

```
backend/
├── handlers/
│   ├── api.php               # Public API (read-heavy, basic CRUD, route planning)
│   └── suggestions.php       # Suggestions API (CRUD + Groq AI task extraction)
├── admin/
│   ├── handlers/
│   │   └── api.php           # Admin API (full CRUD + validation + relations)
│   ├── repositories/json/
│   │   └── file-store.php    # FileStore — JSON file read/write with locking
│   ├── services/
│   │   └── relation-guard.php # RelationGuard — dependency checks, cascade detach
│   └── validators/
│       ├── stop-validator.php
│       ├── route-validator.php
│       ├── vehicle-validator.php
│       └── obstruction-validator.php
```

### Key Backend Patterns

**FileStore** (Repository Pattern):

- `readAll(type)` — loads and parses `data/{type}.json`
- `findById(type, id)` — linear scan for matching ID
- `create(type, data)` — auto-increment ID, append, write with `LOCK_EX`
- `update(type, id, data)` — find-and-replace by ID
- `delete(type, id)` — filter out by ID

**RelationGuard** (Referential Integrity):

- `canDelete(type, id)` — checks if entity has dependents
- `validateStopIds(ids)` — verifies all stop IDs exist
- `validateRouteId(id)` — verifies route ID exists
- `cascadeDetach(type, id)` — removes references (e.g., nullifies `routeId` on vehicles when deleting a route)

**Validators** (per entity type):

- `validate(data, isUpdate)` — returns array of error strings
- `defaults(data)` — fills missing fields with defaults, casts types

## External APIs

| API                     | Provider                                                | Usage                                                      |
| ----------------------- | ------------------------------------------------------- | ---------------------------------------------------------- |
| **OSRM Routing**        | openstreetmap.de (primary), project-osrm.org (fallback) | Road-snapped routes for walking, driving, cycling profiles |
| **Nominatim Geocoding** | openstreetmap.org                                       | Place name → coordinates (autocomplete search)             |
| **Groq Cloud**          | groq.com                                                | LLM inference (Llama 3.3 70B) for AI features              |

## Data Flow Workflows

### 1. User Navigates (A → B)

```
User types "Ratnapark to Lagankhel"
    │
    ▼
AI (Groq) extracts: {start: "Ratnapark", end: "Lagankhel"}
    │
    ▼
Nominatim geocodes both to lat/lng
    │
    ▼
findNearbyStops() — all stops within 800m of start & end
    │
    ▼
Try all start/end stop pairs:
  1. findConnectingRoutes() — direct routes (single bus)
  2. findTransferRoutes() — transfer routes (two buses via shared stop)
  3. Walking fallback (last resort)
    │
    ▼
OSRM fetches road-snapped polylines for each leg
    │
    ▼
Journey rendered: walk → bus → [transfer → bus] → walk
    │
    ▼
Fare calculated per leg (Nepal DoTM tariff)
CO2 savings calculated (car vs bus comparison)
Live vehicles assigned to bus legs (nearest by ETA)
```

### 2. Admin Creates a Route

```
Admin opens Route Builder → picks stops on map
    │
    ▼
Stop IDs collected in sequence → preview polyline drawn
    │
    ▼
Admin sets color, style, weight, snapToRoad
    │
    ▼
Commands.createRoute(data) called
    │
    ▼
ApiClient.create('routes', body)
    │
    ▼
POST → admin/api.php?type=routes
    │
    ▼
RouteValidator::validate() — checks name, ≥2 stops, weight 1-10
RouteValidator::defaults() — fills color, style, weight defaults
    │
    ▼
RelationGuard::validateStopIds() — all stop IDs must exist
    │
    ▼
FileStore::create() — assigns ID, writes to routes.json with LOCK_EX
    │
    ▼
201 Created → Store.emit('routes:created') → map updates
```

### 3. Admin Deletes a Stop

```
Admin selects stop → clicks Delete
    │
    ▼
ApiClient.checkDeps('stops', id) → GET dependencies endpoint
    │
    ▼
RelationGuard::canDelete() checks routes.json for stopIds containing this ID
    │
    ▼
If dependencies exist:
  → UI shows warning: "Used by Route X, Route Y"
  → User confirms → DELETE with ?force=true
  → cascadeDetach() removes stop ID from all routes' stopIds arrays
    │
    ▼
FileStore::delete() — removes from stops.json
```

### 4. Route Planning with Obstruction Avoidance

```
POST api.php?type=route-plan with start/end coords
    │
    ▼
PHP fetches OSRM route with alternatives=true
    │
    ▼
For each alternative route:
  Score against active obstructions (point-to-segment distance check)
  Count how many obstructions each route intersects
    │
    ▼
Return route with fewest obstruction intersections
Include obstruction hit details in response
```

### 5. Community Suggestion → Task Execution

```
User submits suggestion on landing page
    │
    ▼
POST suggestions.php with {name, category, message}
    │
    ▼
Groq AI analyses message with current stops/routes context
    │
    ▼
Extracts structured task (or null if vague/general):
  {action: "add_stop_to_route", summary: "...", details: {route_id, stop_id, ...}}
    │
    ▼
Suggestion + task saved to data/suggestions.json
    │
    ▼
Admin opens Suggestions modal → sees pending suggestions
    │
    ▼
If task extracted:
  → Admin clicks Approve → confirm dialog → executeTask()
  → Task runs via Commands.updateRoute() / Commands.updateStop()
  → Transit data updated in real time
  → Suggestion marked as "completed"
    │
If no task (null):
  → Admin reviews raw message manually
  → Can dismiss or handle outside the system
```

## Storage Format

All data lives in `data/*.json` as arrays of objects with auto-incremented `id` fields:

```json
// stops.json
[
  {"id": 1, "name": "Ratnapark", "lat": 27.7055, "lng": 85.3147, "color": "#1d4ed8", "icon": "fa-bus", "iconType": "fontawesome"}
]

// routes.json
[
  {"id": 1, "name": "Lagankhel-Ratnapark", "stopIds": [1, 5, 12, 18], "color": "#ef4444", "style": "solid", "weight": 5, "snapToRoad": true, "ratingAverage": 0, "ratingCount": 0}
]

// vehicles.json
[
  {"id": 1, "name": "Bus #101", "lat": 27.71, "lng": 85.32, "routeId": 1, "speed": 28, "moving": true, "bearing": 90, "color": "#1d4ed8"}
]

// obstructions.json
[
  {"id": 1, "name": "Road block at Thapathali", "lat": 27.69, "lng": 85.32, "radiusMeters": 40, "severity": "high", "active": true}
]
```

## Security Model

| Aspect           | Implementation                                                     |
| ---------------- | ------------------------------------------------------------------ |
| Admin auth       | Session-based, single shared password from `.env`                  |
| Public API       | No authentication (read-heavy, open access)                        |
| Admin API        | No API-level auth (relies on session from admin page)              |
| CORS             | Open (`*`) — suitable for local/development use                    |
| File uploads     | Extension whitelist, size limit (10MB), filename sanitization      |
| Input validation | Server-side validators per entity type                             |
| XSS prevention   | HTML escaping (`escapeHtml()`) on all user-generated content in JS |
| SQL injection    | N/A — no SQL database                                              |

## Development Setup

```bash
# Prerequisites
- XAMPP (Apache + PHP 8+)
- A browser

# Setup
1. Clone repo into htdocs/sawari/
2. Copy .env.example or create .env with:
   ADMIN_PASSWORD=sawari@111
   GROQ_API_KEY=your_groq_key_here
3. Start Apache in XAMPP
4. Open http://localhost/sawari/ (public) or http://localhost/sawari/admin/ (admin)

# No build step, no npm install, no compilation needed
```

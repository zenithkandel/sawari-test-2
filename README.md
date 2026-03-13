# Sawari

A full-featured public transit navigation and management platform for Kathmandu Valley. Includes a public-facing journey planner with live vehicle tracking and a map-first admin dashboard for managing stops, routes, vehicles, and obstructions.

Built with vanilla JavaScript, PHP, Leaflet, and flat-file JSON storage. No frameworks, no build step, no dependencies to install.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Setup](#setup)
- [Public Frontend](#public-frontend)
- [Admin Dashboard](#admin-dashboard)
- [Backend API](#backend-api)
- [Data Storage](#data-storage)
- [Theming](#theming)
- [Utility Scripts](#utility-scripts)

---

## Features

### Public Transit Navigator

- Multi-leg journey planning (direct routes and 1-transfer journeys)
- Place autocomplete via Nominatim geocoding (Kathmandu-bounded)
- Local stop suggestions merged with online geocoding results
- AI-powered natural language location input (Groq/LLaMA)
- Live vehicle tracking with 5-second polling and smooth marker animation
- Obstruction-aware routing via OSRM
- GPS integration with heading, accuracy circle, and "Use as Start"
- Nearby stops discovery
- Route explorer with full path visualization
- Dark/light theme toggle

### Admin Dashboard

- Password-protected (PHP sessions, password from `.env`)
- Interactive map workspace for managing all transit entities
- Full CRUD with undo/redo (50-level history)
- Route builder with ordered stop selection and road-snapping
- Drag-to-reposition stops, vehicles, and obstructions
- Image upload for vehicle icons
- Referential integrity enforcement (stops referenced by routes, routes by vehicles)
- Dependency-aware deletion with force-delete cascade
- Entity search (Ctrl+K) and keyboard shortcuts
- AI Assistant (Ctrl+I) — natural language commands and data queries via Groq/LLaMA
- Context menus, inspector panel, layer toggles, and quick filters

---

## Tech Stack

| Layer     | Technology                                          |
| --------- | --------------------------------------------------- |
| Frontend  | Vanilla JavaScript (ES6+ IIFEs), HTML, CSS          |
| Maps      | Leaflet 1.9.4, CartoDB tile layers                  |
| Routing   | OSRM (openstreetmap.de + project-osrm.org fallback) |
| Geocoding | Nominatim (OpenStreetMap)                           |
| AI        | Groq API (LLaMA 3.3 70B) for NL extraction/queries |
| Icons     | Font Awesome 6.5.1                                  |
| Fonts     | Inter (Google Fonts)                                |
| Backend   | Vanilla PHP                                         |
| Data      | JSON flat files with file locking                   |
| Auth      | PHP native sessions                                 |
| Server    | Apache (XAMPP)                                      |

---

## Project Structure

```
sawari/
├── .env                            # ADMIN_PASSWORD, GROQ_API_KEY config
├── .gitignore                      # Excludes .env
├── index.php                       # Public transit navigator (PHP for env injection)
├── app.js                          # Public frontend logic
├── style.css                       # Public frontend styles
├── routing.js                      # OSRM routing utilities
├── location-extractor.html         # Standalone AI location extractor prototype
│
├── admin/
│   ├── index.php                   # Admin entry (auth gate + workspace)
│   ├── app.js                      # Admin bootstrap
│   ├── styles/main.css             # Admin styles
│   ├── services/
│   │   └── api-client.js           # HTTP client for admin API
│   ├── state/
│   │   ├── store.js                # Reactive state store (event bus)
│   │   ├── history.js              # Undo/redo stack
│   │   └── commands.js             # CRUD command bus
│   ├── map/
│   │   ├── map-engine.js           # Leaflet map adapter
│   │   ├── layer-manager.js        # Entity layer rendering
│   │   ├── draw-tools.js           # Map click → entity creation
│   │   └── selection-tools.js      # Context menus, delete confirmation
│   ├── features/
│   │   ├── stops/stops.js          # Stops feature module
│   │   ├── routes/routes.js        # Route builder workflow
│   │   ├── vehicles/vehicles.js    # Vehicles feature module
│   │   └── obstructions/obstructions.js
│   └── components/
│       ├── command-bar/command-bar.js     # Toolbar + keyboard shortcuts
│       ├── layer-panel/layer-panel.js     # Layer toggles + filters
│       ├── inspector/inspector.js         # Property editor panel
│       ├── notifications/notifications.js # Toasts + sync status
│       └── ai-assistant/ai-assistant.js   # AI chat assistant (NL commands + queries)
│
├── backend/
│   ├── handlers/
│   │   └── api.php                 # Public REST API
│   └── admin/
│       ├── handlers/api.php        # Admin REST API (validated)
│       ├── repositories/json/
│       │   └── file-store.php      # JSON CRUD with file locking
│       ├── services/
│       │   └── relation-guard.php  # Referential integrity
│       └── validators/
│           ├── stop-validator.php
│           ├── route-validator.php
│           ├── vehicle-validator.php
│           └── obstruction-validator.php
│
├── data/
│   ├── stops.json                  # Stop records
│   ├── routes.json                 # Route records
│   ├── vehicles.json               # Vehicle records
│   ├── obstructions.json           # Obstruction records
│   └── icons.json                  # Font Awesome icon catalog
│
└── assets/                         # Uploaded vehicle images
```

---

## Setup

### Prerequisites

- Apache with PHP 8.1+ (XAMPP recommended)
- `mod_rewrite` enabled (optional, for clean URLs)

### Installation

1. Clone the repo into your web server's document root:

   ```bash
   git clone <repo-url> /path/to/htdocs/sawari
   ```

2. Create a `.env` file in the project root:

   ```
   ADMIN_PASSWORD=sawari@111
   GROQ_API_KEY=your_groq_api_key_here
   ```

   Get a free Groq API key from [console.groq.com](https://console.groq.com).

3. Ensure the `data/` and `assets/` directories are writable by the web server.

4. Open in browser:
   - Public app: `http://localhost/sawari/`
   - Admin dashboard: `http://localhost/sawari/admin/`

### Default Credentials

- **Admin password:** `sawari@111` (configured in `.env`)

---

## Public Frontend

**Entry point:** `index.php` + `app.js` + `style.css` + `routing.js`

### AI Location Input

Type a natural language prompt (e.g., "take me from bagbazar to basundhara") into the AI input at the top of the search panel. The app calls the Groq API to extract start/destination, resolves them against known stops or Nominatim, auto-fills both inputs, and triggers navigation. Requires `GROQ_API_KEY` in `.env`.

### Journey Planning

1. Enter a start and destination via the search inputs (place autocomplete via Nominatim + local stop suggestions) or by clicking the map (right-click context menu), or use the AI input for natural language.
2. The app finds stops near both points, then searches for:
   - **Direct routes** — routes that pass through stops near both start and end
   - **Transfer routes** — pairs of routes connected via a shared transfer stop
3. Results show each leg with walking + transit segments, estimated distance/duration/ETA, and boarding/alighting stops.

### Vehicle Tracking

- Polls `GET /backend/handlers/api.php?type=vehicles` every 5 seconds
- Markers animate smoothly between positions using cubic ease-out interpolation
- Vehicles render as SVG bus/micro-van templates or custom uploaded images

### Obstruction-Aware Routing

- The `route-plan` backend endpoint checks OSRM alternatives against active obstructions
- Routes passing within an obstruction's radius are penalized
- The least-obstructed, fastest route is selected

### Keyboard Shortcuts

| Key     | Action            |
| ------- | ----------------- |
| `/`     | Focus search      |
| `Enter` | Navigate / select |
| `Esc`   | Cancel / close    |
| `T`     | Toggle theme      |
| `E`     | Explore routes    |
| `G`     | Toggle GPS        |
| `N`     | Nearby stops      |
| `?`     | Show shortcuts    |

---

## Admin Dashboard

**Entry point:** `admin/index.php`

### Authentication

- PHP session-based login. Password loaded from `.env` (`ADMIN_PASSWORD`).
- Login page shows a centered card with password input.
- Session persists across page refreshes. Logout via the icon in the command bar or `?logout=1`.

### Workspace Layout

```
┌─────────────────────────────────────────────────┐
│  Command Bar  [Select|Add]  [Search]  [⟲ ⟳ 🗑 ⏻] │
├────────┬──────────────────────────┬─────────────┤
│ Layers │                         │  Inspector  │
│        │       Map Canvas        │  (context-  │
│ Filters│      (Leaflet)          │  sensitive  │
│        │                         │  editor)    │
│ Stats  │                         │             │
├────────┴──────────────────────────┴─────────────┤
│  Status Strip  [Mode] [Coords] [Sync Status]   │
└─────────────────────────────────────────────────┘
```

### Entity Types

#### Stops

| Field      | Type   | Default       | Notes                    |
| ---------- | ------ | ------------- | ------------------------ |
| `id`       | int    | auto          | Auto-incremented         |
| `name`     | string | —             | Required                 |
| `lat`      | float  | —             | Required, [-90, 90]      |
| `lng`      | float  | —             | Required, [-180, 180]    |
| `color`    | string | `#1d4ed8`     | Hex color                |
| `icon`     | string | `fa-bus`      | Font Awesome class       |
| `iconType` | string | `fontawesome` | `fontawesome` or `image` |

- Create by clicking the map in Add > Stop mode
- Drag marker to reposition
- Deletion blocked if referenced by routes (force-delete removes from routes)

#### Routes

| Field           | Type   | Default   | Notes                       |
| --------------- | ------ | --------- | --------------------------- |
| `id`            | int    | auto      | Auto-incremented            |
| `name`          | string | —         | Required                    |
| `stopIds`       | int[]  | —         | Required, min 2 stops       |
| `color`         | string | `#1d4ed8` | Hex color                   |
| `style`         | string | `solid`   | `solid`, `dashed`, `dotted` |
| `weight`        | int    | `5`       | Line width, 1-10            |
| `snapToRoad`    | bool   | `true`    | Snap to OSRM road geometry  |
| `ratingAverage` | float  | `0`       | 0-5, read-only in admin     |
| `ratingCount`   | int    | `0`       | Read-only in admin          |

- Created via route builder: click stops sequentially to build ordered stop list
- Stops can be drag-reordered in the inspector
- Deletion blocked if vehicles are assigned (force-delete unassigns them)

#### Vehicles

| Field           | Type      | Default       | Notes                    |
| --------------- | --------- | ------------- | ------------------------ |
| `id`            | int       | auto          | Auto-incremented         |
| `name`          | string    | —             | Required                 |
| `lat`           | float     | —             | Required                 |
| `lng`           | float     | —             | Required                 |
| `routeId`       | int\|null | `null`        | FK to routes, nullable   |
| `speed`         | float     | `0`           | km/h, >= 0               |
| `moving`        | bool      | `false`       | Moving/idle toggle       |
| `bearing`       | int       | `0`           | 0-359 degrees            |
| `color`         | string    | `#1d4ed8`     | Hex color                |
| `icon`          | string    | —             | Font Awesome class       |
| `iconType`      | string    | `fontawesome` | `fontawesome` or `image` |
| `vehicle_image` | string    | `""`          | Uploaded image path      |
| `ratingAverage` | float     | `0`           | 0-5                      |
| `ratingCount`   | int       | `0`           |                          |

- Create by clicking the map in Add > Vehicle mode
- Image upload: select existing or upload new (max 10MB, png/jpg/gif/svg/webp/avif)
- No inbound foreign keys, so deletion is always allowed

#### Obstructions

| Field          | Type   | Default  | Notes                   |
| -------------- | ------ | -------- | ----------------------- |
| `id`           | int    | auto     | Auto-incremented        |
| `name`         | string | —        | Required                |
| `lat`          | float  | —        | Required                |
| `lng`          | float  | —        | Required                |
| `radiusMeters` | float  | `40`     | > 0                     |
| `severity`     | string | `medium` | `low`, `medium`, `high` |
| `active`       | bool   | `true`   | Active/inactive toggle  |

- Rendered as colored circles (green=low, amber=medium, red=high)
- Inactive obstructions shown with dashed border
- Used by the public frontend's route planner to avoid blocked roads

### Keyboard Shortcuts

| Key      | Action                        |
| -------- | ----------------------------- |
| `V`      | Select mode                   |
| `A`      | Add mode                      |
| `S`      | Add Stop (in add mode)        |
| `R`      | Add Route (in add mode)       |
| `W`      | Add Vehicle (in add mode)     |
| `O`      | Add Obstruction (in add mode) |
| `Delete` | Delete selected               |
| `Ctrl+Z` | Undo                          |
| `Ctrl+Y` | Redo                          |
| `Ctrl+K` | Search entities               |
| `Ctrl+I` | Open AI Assistant             |
| `Ctrl+B` | Toggle sidebar                |
| `Esc`    | Cancel / deselect             |

### AI Assistant

Open via the wand icon in the command bar or `Ctrl+I`. Provides two capabilities powered by Groq API (LLaMA 3.3 70B):

**Natural Language Commands:**
- "Add a stop called New Baneshwor" → creates a stop with AI-suggested coordinates
- "Rename stop #5 to Kalanki Chowk" → generates an update action card
- "Delete the obstruction at Thapathali" → generates a delete action card with confirmation

All destructive actions show a confirmation card — the admin clicks "Create", "Update", or "Delete" to execute, or "Skip" to dismiss.

**Natural Language Queries:**
- "Which routes pass through Ratnapark?" → answers from current data
- "How many vehicles are moving right now?" → real-time count
- "Show me all active obstructions" → lists matching entities

The AI receives a snapshot of all current entities as context, so answers are always based on live data.

---

## Backend API

### Public API

**Endpoint:** `GET /backend/handlers/api.php?type={type}`

| Method   | `type`                                        | Description                                      |
| -------- | --------------------------------------------- | ------------------------------------------------ |
| `GET`    | `stops`, `routes`, `vehicles`, `obstructions` | List all records                                 |
| `POST`   | `stops`, `routes`, `vehicles`, `obstructions` | Create record (JSON body)                        |
| `PUT`    | `stops`, `routes`, `vehicles`, `obstructions` | Update record (JSON body with `id`)              |
| `DELETE` | `stops`, `routes`, `vehicles`, `obstructions` | Delete by `?id=`                                 |
| `GET`    | `icons`                                       | Icon catalog (`{ fontawesome: [], images: [] }`) |
| `POST`   | `route-plan`                                  | Obstruction-aware routing                        |

#### Route Plan Request

```json
{
  "waypoints": [
    [27.71, 85.32],
    [27.72, 85.33]
  ],
  "profile": "driving",
  "avoidObstructions": true
}
```

#### Route Plan Response

```json
{
  "coords": [[27.71, 85.32], ...],
  "distance": 1234.5,
  "duration": 180.2,
  "obstructed": false,
  "obstructionHits": 0,
  "selectedBy": "no_obstructions",
  "alternativesChecked": 3
}
```

### Admin API

**Endpoint:** `GET /backend/admin/handlers/api.php?type={type}`

Same CRUD methods as the public API, plus:

| Method | `type`         | Description                               |
| ------ | -------------- | ----------------------------------------- |
| `GET`  | `dependencies` | Check dependencies (`?entity=stops&id=1`) |
| `POST` | `upload`       | Upload image (multipart/form-data)        |

**Differences from public API:**

- Input validation on create/update (returns `422` with error details)
- Referential integrity checks (stop IDs in routes must exist, route IDs in vehicles must exist)
- File locking (`flock LOCK_EX`) for concurrent write safety
- Dependency-aware delete (returns `409 Conflict` with dependency info)
- Force delete with `?force=true` to cascade-detach dependencies

### Status Codes

| Code  | Meaning                                        |
| ----- | ---------------------------------------------- |
| `200` | Success                                        |
| `201` | Created                                        |
| `400` | Bad request (invalid JSON, missing params)     |
| `404` | Entity not found                               |
| `405` | Method not allowed                             |
| `409` | Conflict (has dependencies, use `?force=true`) |
| `422` | Validation failed (details in response)        |

---

## Data Storage

All data lives as JSON files in the `data/` directory. The admin API's `FileStore` class handles CRUD with exclusive file locking (`flock`):

1. Opens the file with `fopen('c+')` (read/write, create if missing, no truncation)
2. Acquires `LOCK_EX` (exclusive lock, blocks other writers)
3. Reads current content, modifies, writes back
4. Releases the lock

IDs are auto-incremented integers (max existing ID + 1).

### Referential Integrity

```
stops.id  ←──  routes.stopIds[]
routes.id ←──  vehicles.routeId
```

- Creating/updating a route validates all `stopIds` exist
- Creating/updating a vehicle validates `routeId` exists (or is null)
- Deleting a stop with route references returns 409 unless `?force=true` (removes stop from routes)
- Deleting a route with vehicle references returns 409 unless `?force=true` (unassigns vehicles)

---

## Theming

Both frontends support dark and light themes using CSS custom properties.

| Property       | Dark (default) | Light     |
| -------------- | -------------- | --------- |
| `--bg`         | `#0f1117`      | `#f0f2f5` |
| `--bg-surface` | `#181a20`      | `#ffffff` |
| `--text`       | `#e8eaed`      | `#1f2937` |
| `--accent`     | `#3b82f6`      | `#3b82f6` |

Theme is stored in `localStorage` (`sawari-theme` for public, `sawari-admin-theme` for admin). An inline script in `<head>` applies the theme before first paint to prevent flash. Map tiles switch between CartoDB dark and light tile sets.

---

## Utility Scripts

### `create-vehicles.js`

Node.js script that auto-generates vehicle records based on route and operator data. Distributes vehicles evenly across route stops, assigns random speeds/bearings, and picks images from `assets/`.

```bash
node create-vehicles.js
```

### `verify-import.js`

Node.js script that validates data integrity — checks for broken stop references in routes, prints counts and ID ranges.

```bash
node verify-import.js
```

### `testgemini.php`

Prototype AI location extractor. Parses "from X to Y" natural language input and geocodes both locations via Nominatim.

---

## License

This project does not currently specify a license.

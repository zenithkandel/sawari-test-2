# Sawari - Complete Features List

Every feature in the system, from minor to major.

---

## Public Navigator

### Navigation & Route Finding

- [x] Set start/end by clicking the map
- [x] Set start/end by typing location names (autocomplete)
- [x] Set start/end via right-click context menu
- [x] Natural language input — "take me from X to Y" (Groq AI)
- [x] Direct route finding (single bus, no transfers)
- [x] Transfer route finding (two buses via shared stop)
- [x] Multi-candidate stop search (tries all stops within 800m)
- [x] Walking fallback as last resort when no bus route exists
- [x] OSRM road-snapped polylines for all route segments
- [x] Direction arrows rendered along bus route polylines
- [x] Swap start and end locations
- [x] Draggable start/end markers on map
- [x] Clear all (reset navigation state)
- [x] Route focus mode (hides unrelated map elements during navigation)
- [x] Recenter/fit route to screen button

### Fare Estimation

- [x] Nepal DoTM tariff-based fare calculation
- [x] Bus and microbus fare range display
- [x] Student/elderly discount fare display (~25% off)
- [x] Fares rounded to nearest Rs 5 (realistic Nepal pricing)
- [x] Per-leg fare breakdown for transfer routes
- [x] Smart display — shows single price when bus = microbus fare

### Carbon Savings

- [x] CO2 comparison: car (170 g/km) vs bus (50 g/km)
- [x] Displays grams or kilograms saved per trip
- [x] Green-themed card alongside fare info

### Vehicle Tracking

- [x] Live vehicle positions polled every 3 seconds
- [x] Smooth animated marker movement (cubic easing, 2.5s duration)
- [x] Vehicle assignment to journey legs (ranked by ETA + distance)
- [x] User-selectable vehicles per leg from available options
- [x] Vehicle type detection (bus/micro/tempo/van) from name/icon
- [x] Vehicle images displayed on markers
- [x] Vehicle images in journey panel leg details
- [x] ETA calculation from vehicle speed and haversine distance

### Rating System

- [x] Rate routes on 1–5 star scale
- [x] Rate vehicles on 1–5 star scale
- [x] Running average maintained server-side
- [x] Visual star display in journey panel

### Search & Autocomplete

- [x] Local stop name search (instant, offline)
- [x] Local route name search (instant, offline)
- [x] Online place search via Nominatim (geocoding)
- [x] Kathmandu viewbox bounded search results
- [x] Mixed results with section headers (Stops / Routes / Places)
- [x] Matched text highlighting in results
- [x] Debounced input with in-flight request cancellation
- [x] LRU cache with TTL for place search results (10 min, 100 entries)
- [x] Min 3 characters before online search triggers

### Explore Routes

- [x] Scrollable list of all routes
- [x] Filter/search routes by name
- [x] Click route to highlight on map with stop markers
- [x] Color swatches per route
- [x] Close/deselect explored route

### GPS Features

- [x] Real-time GPS tracking (`watchPosition` API)
- [x] Compass heading via `DeviceOrientation` API
- [x] Accuracy circle display on map
- [x] Follow GPS mode (auto-centers map on movement)
- [x] "Use as Start" button — set GPS location as start point
- [x] Nearby stops panel (stops within walking distance)
- [x] GPS status/accuracy display
- [x] Fly-to GPS location on first fix

### Map Features

- [x] Dark and light theme with matched tile layers
- [x] Separate labels pane (labels render above route lines)
- [x] Right-click context menu (set start / set end)
- [x] Zoom controls (top-right corner)
- [x] Scale bar (bottom-left, metric)
- [x] Fit bounds with responsive padding (mobile-aware)
- [x] Stop markers with FontAwesome icons
- [x] Route polylines with configurable color and weight
- [x] Custom start/end point markers with icons

### UI & UX

- [x] Collapsible search/navigation panel
- [x] Journey detail sidebar with expandable leg cards
- [x] Skeleton loading states during data fetch
- [x] Toast notification system (info, success, error, warning)
- [x] Dark / Light theme toggle with localStorage persistence
- [x] Stats bar: live clock, stop count, route count, vehicle count
- [x] Share/copy route summary button
- [x] Responsive layout (adapts to mobile/tablet/desktop)
- [x] SVG bus and microbus vehicle templates

### Keyboard Shortcuts

- [x] `/` — Focus search input
- [x] `?` — Show keyboard shortcuts modal
- [x] `Enter` — Navigate (when start and end are set)
- [x] `Escape` — Close panel / cancel navigation
- [x] `T` — Toggle dark/light theme
- [x] `E` — Toggle explore routes panel
- [x] `G` — Toggle GPS tracking
- [x] `N` — Toggle nearby stops panel

### Obstruction Awareness

- [x] Backend route planning avoids active obstructions
- [x] OSRM alternatives scored against obstruction positions
- [x] Fallback to fastest route if obstruction-free path unavailable
- [x] Obstruction hit details included in route response

---

## Admin Dashboard

### Authentication

- [x] Password-based login screen
- [x] Session-based authentication (PHP sessions)
- [x] Password loaded from `.env` file
- [x] Logout button in command bar
- [x] Login page styled with admin dark theme

### Workspace Layout

- [x] Command bar (top toolbar)
- [x] Layer panel (left sidebar)
- [x] Map canvas (center)
- [x] Inspector panel (right sidebar)
- [x] Status strip (bottom bar)
- [x] Panels collapse to overlays on tablet (≤860px)
- [x] Full-width panels on mobile (≤600px)

### Map Tools

- [x] Select mode (`V` key) — click to select entities
- [x] Add mode (`A` key) — click map to place new entities
- [x] Entity type picker: Stop (`S`), Route (`R`), Vehicle (`W`), Obstruction (`O`)
- [x] Right-click context menu with entity-specific actions
- [x] Crosshair cursor in add mode
- [x] Dark/Light theme toggle

### Stops Management

- [x] Create stops (name, lat, lng, color, icon)
- [x] Edit stop properties in inspector
- [x] Delete stops with dependency check
- [x] FontAwesome icon picker grid
- [x] Image-based icon support (upload custom icons)
- [x] Color picker for stop markers
- [x] Stop markers rendered on map with labels

### Routes Management

- [x] Multi-step Route Builder (pick stops by clicking map)
- [x] Drag-and-drop stop reordering in route sequence
- [x] Remove individual stops from sequence
- [x] Route color picker
- [x] Route line style selector (solid, dashed, dotted)
- [x] Route line weight slider (1–10)
- [x] Snap to road toggle
- [x] Preview polyline while building route
- [x] Route displayed as polyline connecting stops on map
- [x] Related vehicles shown in inspector

### Vehicles Management

- [x] Create vehicles (name, lat, lng, routeId, speed, color, icon, image)
- [x] Assign vehicles to routes (dropdown)
- [x] Toggle moving state
- [x] Set bearing (0–359 degrees)
- [x] Vehicle image upload
- [x] Vehicle markers on map (with image or icon)
- [x] Color picker for vehicle markers

### Obstructions Management

- [x] Create obstructions (name, lat, lng, radius, severity)
- [x] Three severity levels: low, medium, high (color-coded)
- [x] Active/inactive toggle
- [x] Displayed as circles on map with radius visualization
- [x] Severity badges in inspector

### AI Assistant

- [x] Toggle with `Ctrl+I` keyboard shortcut
- [x] Natural language entity creation (e.g., "create a stop called Balaju")
- [x] Natural language entity updates
- [x] Natural language entity deletion (with confirmation)
- [x] Natural language entity selection (pans map to entity)
- [x] Full system context (current stops, routes, vehicles, obstructions)
- [x] Supports single and batch actions (JSON arrays)
- [x] Confirmation cards before executing actions
- [x] Example prompts as conversation starters
- [x] Powered by Groq API (Llama 3.3 70B Versatile)
- [x] Dependency-aware (breaks multi-step operations into logical order)

### Search

- [x] Global search with `Ctrl+K`
- [x] Search across all entity types
- [x] Keyboard navigation of results (arrow keys + Enter)
- [x] Select and pan to entity on map

### State Management

- [x] Event-driven store (`Store.on()` / `Store.emit()`)
- [x] Undo (`Ctrl+Z`)
- [x] Redo (`Ctrl+Y`)
- [x] Command pattern for all data mutations

### Layer Management

- [x] Toggle visibility per entity type (stops, routes, vehicles, obstructions)
- [x] Quick filters: All, Active Only, Moving Vehicles
- [x] Layer counts displayed per type
- [x] Stats dashboard with entity counts

### Inspector Panel

- [x] Dynamic form rendering per entity type
- [x] Image preview for vehicle images
- [x] Color picker integration
- [x] Icon picker grid (FontAwesome)
- [x] Relationship display (routes using a stop, vehicles on a route)
- [x] Click-to-navigate to related entities
- [x] Delete button with dependency warning

### Notifications & Status

- [x] Toast notifications (success, error, warn, info)
- [x] Sync status indicator (Synced / Saving / Error)
- [x] Action history in status bar (last 3 actions)

---

## Backend API

### Public API Endpoints

- [x] `GET ?type=stops` — List all stops
- [x] `GET ?type=routes` — List all routes
- [x] `GET ?type=vehicles` — List all vehicles
- [x] `GET ?type=obstructions` — List all obstructions
- [x] `GET ?type=icons` — List available icons (FontAwesome + image files)
- [x] `POST ?type=stops/routes/vehicles` — Create entity
- [x] `PUT ?type=stops/routes/vehicles` — Update entity
- [x] `DELETE ?type=stops/routes/vehicles&id=N` — Delete entity
- [x] `POST ?type=route-plan` — Obstruction-aware route planning

### Admin API Endpoints

- [x] All public CRUD operations with server-side validation
- [x] `GET ?type=dependencies&entity=X&id=N` — Check deletion dependencies
- [x] `POST ?type=upload` — Image file upload (10MB limit)
- [x] `DELETE ?type=X&id=N&force=true` — Force delete with cascade detach

### Data Integrity

- [x] Server-side validation per entity type (dedicated validator classes)
- [x] Referential integrity via RelationGuard
- [x] Cascade detach on force delete (e.g., nullify vehicle routeId when route deleted)
- [x] File locking (`LOCK_EX`) for concurrent write safety
- [x] Auto-increment ID generation

### File Uploads

- [x] Extension whitelist (png, jpg, jpeg, gif, svg, webp, avif)
- [x] File size limit (10 MB)
- [x] Filename sanitization (non-alphanumeric → hyphens)
- [x] Duplicate filename handling (auto-increment suffix)

---

## Utility Scripts

- [x] `create-vehicles.js` — Bulk vehicle creation from operator-route mappings (Node.js)
- [x] `verify-import.js` — Data integrity verification (stop counts, broken refs)
- [x] `found.js` — Raw JSON data for stops and route definitions
- [x] `location-extractor.html` — Standalone Groq-powered location extraction tool
- [x] `testgemini.php` — PHP location extractor using Nominatim geocoding

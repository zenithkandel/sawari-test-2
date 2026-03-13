# Sawari New Admin Panel Architecture (Map-First)

## 1. Overview

This redesign replaces the current iframe-and-module admin flow with a single map-first workspace optimized for high-frequency operations.

Core goals:

- Keep operators on the map for most tasks.
- Reduce multi-step form workflows into context actions and inline editing.
- Protect data integrity across stops, routes, vehicles, and obstructions.
- Keep implementation simple: Leaflet + PHP + JSON (phase 1), with a clean migration path later.

Result:

- One visual control surface for network operations.
- Faster CRUD operations (target: most tasks in 1-2 interactions).
- Better maintainability through feature-based architecture.

## 2. Current System Summary and Limitations

### Current behavior

- Admin shell: `admin/index.html` + `admin/portal.js` loads module pages into an iframe.
- CRUD modules:
  - `admin/modules/stops.html`
  - `admin/modules/routes.html`
  - `admin/modules/issues.html`
  - `admin/modules/fleet.html`
- Data API: `backend/handlers/api.php`
- Data storage: JSON files in `data/`

### Existing strengths

- Leaflet map already used in modules.
- Basic CRUD exists for core entities.
- Route planning endpoint already exists (`type=route-plan`).

### Current limitations

- Fragmented UX across pages/modules.
- Backend lacks strict schema and relationship validation.
- Full-file writes without lock/version checks can overwrite edits.
- Limited dependency-aware deletion behavior.
- No undo/redo transaction history.
- Repetitive form-heavy flows for frequent map tasks.

## 3. Data Datasets and Purpose

### `data/stops.json`

Transit stops/stations with map marker appearance.

- Fields: `id`, `name`, `lat`, `lng`, `icon`, `iconType`, `color`

### `data/routes.json`

Transit routes represented as ordered stop references.

- Fields: `id`, `name`, `stopIds[]`, `color`, `style`, `weight`, `snapToRoad`, rating fields

### `data/vehicles.json`

Fleet vehicles with assignment and movement state.

- Fields: `id`, `name`, `lat`, `lng`, `routeId`, `speed`, `moving`, `bearing`, icon/image metadata

### `data/obstructions.json`

Road issues with impact radius and severity.

- Fields: `id`, `name`, `lat`, `lng`, `radiusMeters`, `severity`, `active`

### `data/icons.json`

Font Awesome icon catalog used by marker styling.

## 4. Required CRUD by Dataset

## Stops CRUD

- Create:
  - Click map in Add Stop mode.
  - Inline popup asks only for essential fields (name, optional color/icon).
- Read:
  - Render as marker layer, searchable and filterable.
- Update:
  - Drag marker to update coordinates.
  - Inline rename/style edit from popup or inspector.
- Delete:
  - Context action with dependency warning if referenced by routes.

Dependencies:

- Referenced by `routes.stopIds[]`.

## Routes CRUD

- Create:
  - Create route shell then draw/select ordered stops directly on map.
- Read:
  - Render route polylines + linked stop previews.
- Update:
  - Reorder stop sequence visually.
  - Edit style/weight/metadata inline.
  - Geometry adjustment with route handles.
- Delete:
  - Guarded delete with vehicle impact summary.

Dependencies:

- Depends on `stops.id` via `stopIds[]`.
- Referenced by `vehicles.routeId`.

## Vehicles CRUD

- Create:
  - Place vehicle on map and assign route in one flow.
- Read:
  - Live marker with assignment/status metadata.
- Update:
  - Drag position, quick route reassignment, status toggles.
- Delete:
  - Remove with assignment impact confirmation.

Dependencies:

- Depends on `routes.id` via `routeId`.

## Obstructions CRUD

- Create:
  - Click map to place center, drag radius handle.
- Read:
  - Circle overlays by severity and active state.
- Update:
  - Move center, adjust radius, toggle active, change severity.
- Delete:
  - Remove with immediate route impact refresh.

Dependencies:

- No strict FK; used in route planning impact logic.

## Icons CRUD

- Recommended phase 1: read-only catalog in admin.
- Optional phase 2: icon catalog management.

## 5. Relationship and Validation Rules

Mandatory constraints:

- `routes.stopIds[]` must reference existing `stops.id`.
- `vehicles.routeId` must reference existing `routes.id` (or null for explicit unassigned state).
- Lat/lng bounds validation for operational map area.
- Numeric constraints:
  - `speed >= 0`
  - `bearing in [0, 359]`
  - `radiusMeters > 0`
- Rating constraints:
  - `ratingCount >= 0`
  - `ratingAverage in [0, 5]`
  - if `ratingCount == 0`, force `ratingAverage = 0`

Delete policy:

- Default: reject destructive delete if dependencies exist.
- Advanced option: explicit detach/cascade action after warning.

## 6. New UX Principles (Map-First)

1. Map is the primary editing surface, not a secondary preview.
2. Selection drives UI: selecting an object opens context-specific inspector/actions.
3. Minimal forms: only use compact inline editors for required metadata.
4. Interaction consistency:

- Left click: select/edit
- Right click: context actions
- Drag: geometry updates
- Enter: save inline edits
- Delete key: guarded delete

5. Immediate visual confirmation after each action.
6. Keyboard shortcuts for high-frequency actions.

## 7. New UI Layout

Single workspace layout:

- Top command bar:
  - tool mode selector (select/add/edit)
  - quick actions (undo/redo, duplicate, delete)
  - search / command palette launcher
- Left rail:
  - layer toggles (stops/routes/vehicles/obstructions)
  - filters and saved views
- Center:
  - Leaflet map canvas (dominant area)
- Right inspector panel:
  - selected object details
  - editable metadata fields
  - relationship section (linked routes/stops/vehicles)
- Bottom status strip:
  - recent actions, warnings, sync state

## 8. System Architecture

### Frontend architecture

- Feature-based modules around entities and map interactions.
- Shared store for normalized entity state and selection state.
- Command bus for user actions (`createStop`, `updateRouteStops`, etc.)
- Map adapter layer encapsulates Leaflet primitives.

### Backend architecture (phase 1 JSON)

- Keep `backend/handlers/api.php` entrypoint.
- Internally split into:
  - type handlers
  - validators
  - relationship guard service
  - JSON repository with lock + safe-write
- Add optimistic version token per file or entity to prevent silent overwrite.

### API/data flow

1. User action on map.
2. Client command validates input and dependencies.
3. Request to API with operation payload.
4. Backend validates schema + relationships.
5. Backend writes with lock/version checks.
6. Response includes updated entity + warnings/meta.
7. UI store updates and re-renders layers.

## 9. Scalable File Structure

Recommended target structure:

```text
  admin-new/
    index.html
    app.js
    styles/
    components/
      command-bar/
      layer-panel/
      inspector/
      notifications/
    map/
      map-engine.js
      layer-manager.js
      draw-tools.js
      selection-tools.js
    features/
      stops/
      routes/
      vehicles/
      obstructions/
    services/
      api-client.js
      validation-client.js
    state/
      store.js
      commands.js
      history.js
    utils/


backend/
  admin/
    handlers/
      api.php
      entities/
        stops.php
        routes.php
        vehicles.php
        obstructions.php
    validators/
      stop-validator.php
      route-validator.php
      vehicle-validator.php
      obstruction-validator.php
    repositories/
      json/
        file-store.php
        locks.php
    services/
      relation-guard.php
      route-planner.php
```

## 10. Map Editing Workflows

## Stops workflow

1. Press Add Stop.
2. Click target map point.
3. Enter stop name in inline popup.
4. Save.

Edit:

- Drag marker to move.
- Click marker -> quick edit popup (name/color/icon).

Delete:

- Right click marker -> Delete Stop.
- Dialog shows affected routes before final confirmation.

## Routes workflow

1. Press Add Route.
2. Enter route name/color.
3. Click stops in map order to build route.
4. Save route.

Edit:

- Select route -> Show handles and stop sequence.
- Drag reorder handles or remove/insert stop inline.
- Optional obstruction-aware preview via route-plan endpoint.

## Vehicles workflow

1. Press Add Vehicle.
2. Click map to place.
3. Select route from inline picker.
4. Save.

Edit:

- Drag marker to update position.
- Quick toggle moving/idle.
- Reassign route from inspector.

## Obstructions workflow

1. Press Add Obstruction.
2. Click map center.
3. Drag radius handle.
4. Pick severity and active status.

Edit:

- Drag center marker or radius handle.
- Toggle active from popup.

## 11. Workflow Optimization Rules

Target: common operations in 1-2 interactions.

Optimization mechanisms:

- Context menus on map objects.
- Inline popups instead of full-page forms.
- Batch select and apply (route assignment, severity, style).
- Command palette for keyboard-driven users.
- Smart defaults per dataset (icon, color, radius, speed).

## 12. Example User Workflows

### Example A - Add a new stop and include it in a route

1. Add Stop mode -> click map -> name stop -> save.
2. Select route -> Add stop handle -> click new stop -> save route.

### Example B - Reroute around a road obstruction

1. Select route.
2. Open obstruction overlay and route alternatives.
3. Apply suggested least-obstructed path.
4. Save with dependency check.

### Example C - Reassign vehicle fleet quickly

1. Multi-select vehicles from map/list.
2. Bulk Assign Route action.
3. Confirm and apply.

## 13. Future Extensibility

Planned extensions:

- Role-based authentication and audit logs.
- WebSocket live updates for multi-operator sessions.
- DB migration (SQLite/PostgreSQL/PostGIS) with same service contracts.
- Rule engine for scheduling and conflict detection.
- Historical playback and operational analytics.

## 14. Implementation Roadmap

Phase 1:

- Build new map-first shell.
- Implement stop CRUD map interactions.
- Add basic layer controls and inspector.

Phase 2:

- Implement route visual editor + dependency guards.
- Integrate route-plan preview into route editing.

Phase 3:

- Implement vehicles + obstruction advanced interactions.
- Add batch actions and keyboard command palette.

Phase 4:

- Add undo/redo transaction history.
- Add optimistic conflict handling and robust validation.

Phase 5:

- Add auth/audit and optional DB adapter.

## 15. Success Criteria

- Most frequent operations can be performed directly on map with <=2 interactions.
- Data integrity constraints enforced by backend, not only frontend.
- No silent overwrite on concurrent edits.
- Faster operator workflow than current multi-module admin.
- Architecture supports gradual evolution without rewrite.

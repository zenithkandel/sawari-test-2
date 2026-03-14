<?php
// ============================================================
// Sawari - Relation Guard Service
// Author: Zenith Kandel — https://zenithkandel.com.np
// ============================================================

class RelationGuard
{
    private FileStore $store;

    public function __construct(FileStore $store)
    {
        $this->store = $store;
    }

    // Check if a stop is referenced by any routes
    public function stopDependencies(int $stopId): array
    {
        $routes = $this->store->readAll('routes');
        $deps = [];
        foreach ($routes as $route) {
            $stopIds = $route['stopIds'] ?? [];
            if (in_array($stopId, $stopIds)) {
                $deps[] = ['type' => 'route', 'id' => $route['id'], 'name' => $route['name'] ?? ''];
            }
        }
        return $deps;
    }

    // Check if a route is referenced by any vehicles
    public function routeDependencies(int $routeId): array
    {
        $vehicles = $this->store->readAll('vehicles');
        $deps = [];
        foreach ($vehicles as $v) {
            if (($v['routeId'] ?? null) == $routeId) {
                $deps[] = ['type' => 'vehicle', 'id' => $v['id'], 'name' => $v['name'] ?? ''];
            }
        }
        return $deps;
    }

    // Validate that all stopIds in a route reference existing stops
    public function validateStopIds(array $stopIds): array
    {
        $stops = $this->store->readAll('stops');
        $validIds = array_column($stops, 'id');
        $invalid = [];
        foreach ($stopIds as $sid) {
            if (!in_array($sid, $validIds)) {
                $invalid[] = $sid;
            }
        }
        return $invalid;
    }

    // Validate that a routeId references an existing route
    public function validateRouteId($routeId): bool
    {
        if ($routeId === null || $routeId === '')
            return true; // null = unassigned
        $route = $this->store->findById('routes', (int) $routeId);
        return $route !== null;
    }

    // Check dependencies before delete, returns blocking info
    public function canDelete(string $type, int $id): array
    {
        $deps = [];
        if ($type === 'stops') {
            $deps = $this->stopDependencies($id);
        } elseif ($type === 'routes') {
            $deps = $this->routeDependencies($id);
        }
        return [
            'canDelete' => empty($deps),
            'dependencies' => $deps,
            'message' => empty($deps) ? '' : 'Cannot delete: referenced by ' . count($deps) . ' ' . ($deps[0]['type'] ?? 'item') . '(s)'
        ];
    }

    // Force delete with cascade - detach references
    public function cascadeDetach(string $type, int $id): void
    {
        if ($type === 'stops') {
            // Remove stop from all routes' stopIds
            $routes = $this->store->readAll('routes');
            foreach ($routes as $route) {
                $stopIds = $route['stopIds'] ?? [];
                if (in_array($id, $stopIds)) {
                    $newStopIds = array_values(array_filter($stopIds, fn($s) => $s != $id));
                    $this->store->update('routes', $route['id'], ['stopIds' => $newStopIds]);
                }
            }
        } elseif ($type === 'routes') {
            // Unassign vehicles from this route
            $vehicles = $this->store->readAll('vehicles');
            foreach ($vehicles as $v) {
                if (($v['routeId'] ?? null) == $id) {
                    $this->store->update('vehicles', $v['id'], ['routeId' => null]);
                }
            }
        }
    }
}

<?php
// ============================================================
// Sawari - backend/handlers/api.php
// Unified REST API for stops, routes, vehicles, and icons
// ============================================================

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$rootDir = dirname(__DIR__, 2);
$dataDir = $rootDir . '/data';
$iconsDir = $rootDir . '/assets/icons';

if (!is_dir($dataDir)) {
    mkdir($dataDir, 0777, true);
}

$type = $_GET['type'] ?? '';
$allowedTypes = ['stops', 'routes', 'vehicles', 'icons', 'obstructions', 'route-plan'];

if (!in_array($type, $allowedTypes)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid type. Allowed: ' . implode(', ', $allowedTypes)]);
    exit;
}

function readJsonBody()
{
    return json_decode(file_get_contents('php://input'), true);
}

function fetchJsonWithTimeout($url, $timeoutSeconds = 8)
{
    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => $timeoutSeconds,
            'header' => "Accept: application/json\r\nUser-Agent: Sawari/1.0\r\n"
        ]
    ]);

    $raw = @file_get_contents($url, false, $context);
    if ($raw === false) {
        return null;
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : null;
}

function distancePointToSegmentMeters($point, $segA, $segB)
{
    $lat0 = deg2rad(($segA[0] + $segB[0]) / 2.0);
    $metersPerDegLat = 111320.0;
    $metersPerDegLng = 111320.0 * cos($lat0);

    $ax = $segA[1] * $metersPerDegLng;
    $ay = $segA[0] * $metersPerDegLat;
    $bx = $segB[1] * $metersPerDegLng;
    $by = $segB[0] * $metersPerDegLat;
    $px = $point[1] * $metersPerDegLng;
    $py = $point[0] * $metersPerDegLat;

    $dx = $bx - $ax;
    $dy = $by - $ay;
    $lenSq = $dx * $dx + $dy * $dy;

    if ($lenSq <= 0.000001) {
        $ddx = $px - $ax;
        $ddy = $py - $ay;
        return sqrt($ddx * $ddx + $ddy * $ddy);
    }

    $t = (($px - $ax) * $dx + ($py - $ay) * $dy) / $lenSq;
    $t = max(0.0, min(1.0, $t));
    $cx = $ax + $t * $dx;
    $cy = $ay + $t * $dy;
    $ddx = $px - $cx;
    $ddy = $py - $cy;
    return sqrt($ddx * $ddx + $ddy * $ddy);
}

function routeIntersectsObstruction($coords, $obstruction)
{
    if (count($coords) < 2) {
        return false;
    }

    $radius = isset($obstruction['radiusMeters']) ? floatval($obstruction['radiusMeters']) : 40.0;
    $center = [floatval($obstruction['lat']), floatval($obstruction['lng'])];

    for ($i = 0; $i < count($coords) - 1; $i++) {
        $a = $coords[$i];
        $b = $coords[$i + 1];
        $dist = distancePointToSegmentMeters($center, $a, $b);
        if ($dist <= $radius) {
            return true;
        }
    }

    return false;
}

function scoreRouteAgainstObstructions($coords, $obstructions)
{
    $hits = [];
    foreach ($obstructions as $obs) {
        if (!isset($obs['lat']) || !isset($obs['lng'])) {
            continue;
        }
        if (array_key_exists('active', $obs) && !$obs['active']) {
            continue;
        }
        if (routeIntersectsObstruction($coords, $obs)) {
            $hits[] = $obs;
        }
    }
    return $hits;
}

if ($type === 'route-plan') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        exit;
    }

    $input = readJsonBody();
    $waypoints = $input['waypoints'] ?? [];
    $profile = $input['profile'] ?? 'driving';
    $avoidObstructions = array_key_exists('avoidObstructions', $input) ? !!$input['avoidObstructions'] : true;

    if (!is_array($waypoints) || count($waypoints) < 2) {
        http_response_code(400);
        echo json_encode(['error' => 'At least 2 waypoints required']);
        exit;
    }

    $profileMap = [
        'driving' => 'driving',
        'foot' => 'foot',
        'cycling' => 'cycling'
    ];
    $safeProfile = $profileMap[$profile] ?? 'driving';

    $coordParts = [];
    foreach ($waypoints as $wp) {
        if (!is_array($wp) || count($wp) < 2) {
            continue;
        }
        $lat = floatval($wp[0]);
        $lng = floatval($wp[1]);
        $coordParts[] = $lng . ',' . $lat;
    }

    if (count($coordParts) < 2) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid waypoint format']);
        exit;
    }

    $coordsStr = implode(';', $coordParts);
    $osrmServers = [
        'driving' => 'https://routing.openstreetmap.de/routed-car',
        'foot' => 'https://routing.openstreetmap.de/routed-foot',
        'cycling' => 'https://routing.openstreetmap.de/routed-bike'
    ];
    $fallbackServer = 'https://router.project-osrm.org';
    $base = $osrmServers[$safeProfile] ?? $fallbackServer;

    $urls = [
        $base . '/route/v1/' . $safeProfile . '/' . $coordsStr . '?overview=full&geometries=geojson&steps=false&continue_straight=true&alternatives=true',
        $fallbackServer . '/route/v1/' . $safeProfile . '/' . $coordsStr . '?overview=full&geometries=geojson&steps=false&continue_straight=true&alternatives=true'
    ];

    $osrmData = null;
    foreach ($urls as $url) {
        $candidate = fetchJsonWithTimeout($url, 10);
        if (is_array($candidate) && ($candidate['code'] ?? '') === 'Ok' && !empty($candidate['routes'])) {
            $osrmData = $candidate;
            break;
        }
    }

    if (!$osrmData) {
        http_response_code(502);
        echo json_encode(['error' => 'Routing provider unavailable']);
        exit;
    }

    $obstructionFile = $dataDir . '/obstructions.json';
    if (!file_exists($obstructionFile)) {
        file_put_contents($obstructionFile, json_encode([], JSON_PRETTY_PRINT));
    }
    $obstructions = json_decode(file_get_contents($obstructionFile), true) ?: [];

    $rankedRoutes = [];
    foreach ($osrmData['routes'] as $idx => $route) {
        $coords = array_map(function ($c) {
            return [floatval($c[1]), floatval($c[0])];
        }, $route['geometry']['coordinates'] ?? []);

        $hits = scoreRouteAgainstObstructions($coords, $obstructions);
        $rankedRoutes[] = [
            'index' => $idx,
            'coords' => $coords,
            'distance' => floatval($route['distance'] ?? 0),
            'duration' => floatval($route['duration'] ?? 0),
            'hits' => $hits,
            'hitCount' => count($hits)
        ];
    }

    if (empty($rankedRoutes)) {
        http_response_code(502);
        echo json_encode(['error' => 'No routes returned from provider']);
        exit;
    }

    usort($rankedRoutes, function ($a, $b) use ($avoidObstructions) {
        if ($avoidObstructions) {
            if ($a['hitCount'] !== $b['hitCount']) {
                return $a['hitCount'] <=> $b['hitCount'];
            }
        }
        return $a['duration'] <=> $b['duration'];
    });

    $best = $rankedRoutes[0];
    $selectionReason = 'fastest';
    if ($avoidObstructions) {
        $selectionReason = $best['hitCount'] === 0 ? 'clear' : 'least-obstructed';
    }

    echo json_encode([
        'coords' => $best['coords'],
        'distance' => $best['distance'],
        'duration' => $best['duration'],
        'obstructed' => $best['hitCount'] > 0,
        'obstructionHits' => array_map(function ($obs) {
            return [
                'id' => $obs['id'] ?? null,
                'name' => $obs['name'] ?? 'Road issue',
                'lat' => isset($obs['lat']) ? floatval($obs['lat']) : null,
                'lng' => isset($obs['lng']) ? floatval($obs['lng']) : null,
                'radiusMeters' => isset($obs['radiusMeters']) ? floatval($obs['radiusMeters']) : 40
            ];
        }, $best['hits']),
        'selectedBy' => $selectionReason,
        'alternativesChecked' => count($rankedRoutes)
    ]);
    exit;
}

// Icons: special handler
if ($type === 'icons' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $images = [];
    if (is_dir($iconsDir)) {
        $allowed = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif', 'bmp', 'ico', 'tiff'];
        foreach (scandir($iconsDir) as $f) {
            $ext = strtolower(pathinfo($f, PATHINFO_EXTENSION));
            if (in_array($ext, $allowed))
                $images[] = $f;
        }
    }
    $faFile = $dataDir . '/icons.json';
    $fa = file_exists($faFile) ? json_decode(file_get_contents($faFile), true) : ['fontawesome' => []];
    echo json_encode([
        'fontawesome' => $fa['fontawesome'] ?? [],
        'images' => $images
    ]);
    exit;
}

$file = $dataDir . '/' . $type . '.json';
if (!file_exists($file)) {
    file_put_contents($file, json_encode([]));
}

$method = $_SERVER['REQUEST_METHOD'];
$data = json_decode(file_get_contents($file), true) ?: [];

switch ($method) {
    case 'GET':
        echo json_encode($data);
        break;

    case 'POST':
        $input = readJsonBody();
        if (!$input) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid JSON body']);
            exit;
        }
        $maxId = 0;
        foreach ($data as $item) {
            if (isset($item['id']) && $item['id'] > $maxId)
                $maxId = $item['id'];
        }
        $input['id'] = $maxId + 1;
        if ($type === 'vehicles') {
            if (!isset($input['moving']))
                $input['moving'] = false;
            if (!isset($input['bearing']))
                $input['bearing'] = 0;
        }
        $data[] = $input;
        file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT));
        echo json_encode($input);
        break;

    case 'PUT':
        $input = readJsonBody();
        if (!$input || !isset($input['id'])) {
            http_response_code(400);
            echo json_encode(['error' => 'ID required']);
            exit;
        }
        $found = false;
        foreach ($data as &$item) {
            if ($item['id'] == $input['id']) {
                foreach ($input as $k => $v)
                    $item[$k] = $v;
                $found = true;
                file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT));
                echo json_encode($item);
                break;
            }
        }
        if (!$found) {
            http_response_code(404);
            echo json_encode(['error' => 'Item not found']);
        }
        break;

    case 'DELETE':
        $id = $_GET['id'] ?? null;
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'ID required']);
            exit;
        }
        $data = array_values(array_filter($data, fn($item) => $item['id'] != $id));
        file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT));
        echo json_encode(['success' => true]);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}

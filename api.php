<?php
// ============================================================
// Sawari - api.php
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

$type = $_GET['type'] ?? '';
$allowedTypes = ['stops', 'routes', 'vehicles', 'icons'];

if (!in_array($type, $allowedTypes)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid type. Allowed: ' . implode(', ', $allowedTypes)]);
    exit;
}

// Icons: special handler
if ($type === 'icons' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $iconsDir = __DIR__ . '/icons';
    $images = [];
    if (is_dir($iconsDir)) {
        $allowed = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif', 'bmp', 'ico', 'tiff'];
        foreach (scandir($iconsDir) as $f) {
            $ext = strtolower(pathinfo($f, PATHINFO_EXTENSION));
            if (in_array($ext, $allowed))
                $images[] = $f;
        }
    }
    $faFile = __DIR__ . '/icons.json';
    $fa = file_exists($faFile) ? json_decode(file_get_contents($faFile), true) : ['fontawesome' => []];
    echo json_encode([
        'fontawesome' => $fa['fontawesome'] ?? [],
        'images' => $images
    ]);
    exit;
}

$file = __DIR__ . '/' . $type . '.json';
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
        $input = json_decode(file_get_contents('php://input'), true);
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
        $input = json_decode(file_get_contents('php://input'), true);
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

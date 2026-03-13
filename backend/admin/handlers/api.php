<?php
// ============================================================
// Sawari - backend/admin/handlers/api.php
// New Admin API with validation, relation guards, and locking
// ============================================================

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$rootDir = dirname(__DIR__, 3);
$dataDir = $rootDir . '/data';
$iconsDir = $rootDir . '/assets';

require_once __DIR__ . '/../repositories/json/file-store.php';
require_once __DIR__ . '/../services/relation-guard.php';
require_once __DIR__ . '/../validators/stop-validator.php';
require_once __DIR__ . '/../validators/route-validator.php';
require_once __DIR__ . '/../validators/vehicle-validator.php';
require_once __DIR__ . '/../validators/obstruction-validator.php';

$store = new FileStore($dataDir);
$guard = new RelationGuard($store);

function readJsonBody(): ?array
{
    $raw = file_get_contents('php://input');
    return $raw ? json_decode($raw, true) : null;
}

function jsonResponse($data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data);
    exit;
}

function errorResponse(string $message, int $status = 400): void
{
    jsonResponse(['error' => $message], $status);
}

$type = $_GET['type'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];
$allowedTypes = ['stops', 'routes', 'vehicles', 'obstructions', 'icons', 'dependencies', 'upload'];

if (!in_array($type, $allowedTypes)) {
    errorResponse('Invalid type. Allowed: ' . implode(', ', $allowedTypes));
}

// Icons: read-only catalog
if ($type === 'icons') {
    if ($method !== 'GET')
        errorResponse('Method not allowed', 405);

    $images = [];
    if (is_dir($iconsDir)) {
        $allowed = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif'];
        foreach (scandir($iconsDir) as $f) {
            if ($f === '.' || $f === '..' || is_dir($iconsDir . '/' . $f))
                continue;
            $ext = strtolower(pathinfo($f, PATHINFO_EXTENSION));
            if (in_array($ext, $allowed))
                $images[] = $f;
        }
    }
    $faFile = $dataDir . '/icons.json';
    $fa = file_exists($faFile) ? json_decode(file_get_contents($faFile), true) : ['fontawesome' => []];
    jsonResponse([
        'fontawesome' => $fa['fontawesome'] ?? [],
        'images' => $images
    ]);
}

// Upload image
if ($type === 'upload') {
    if ($method !== 'POST')
        errorResponse('Method not allowed', 405);

    if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK)
        errorResponse('No file uploaded or upload error');

    $file = $_FILES['image'];
    $allowed = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif'];
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, $allowed))
        errorResponse('File type not allowed. Allowed: ' . implode(', ', $allowed));

    if ($file['size'] > 10 * 1024 * 1024)
        errorResponse('File too large. Max 10MB.');

    if (!is_dir($iconsDir))
        mkdir($iconsDir, 0755, true);

    $safeName = preg_replace('/[^a-zA-Z0-9_\-.]/', '-', pathinfo($file['name'], PATHINFO_FILENAME));
    $destName = $safeName . '.' . $ext;
    $destPath = $iconsDir . '/' . $destName;

    $counter = 1;
    while (file_exists($destPath)) {
        $destName = $safeName . '-' . $counter . '.' . $ext;
        $destPath = $iconsDir . '/' . $destName;
        $counter++;
    }

    if (!move_uploaded_file($file['tmp_name'], $destPath))
        errorResponse('Failed to save file');

    jsonResponse(['filename' => $destName]);
}

// Dependencies check endpoint
if ($type === 'dependencies') {
    if ($method !== 'GET')
        errorResponse('Method not allowed', 405);
    $entityType = $_GET['entity'] ?? '';
    $entityId = intval($_GET['id'] ?? 0);
    if (!$entityType || !$entityId)
        errorResponse('entity and id parameters required');
    $result = $guard->canDelete($entityType, $entityId);
    jsonResponse($result);
}

// Validators and defaults per type
$validators = [
    'stops' => 'StopValidator',
    'routes' => 'RouteValidator',
    'vehicles' => 'VehicleValidator',
    'obstructions' => 'ObstructionValidator'
];

switch ($method) {
    case 'GET':
        $data = $store->readAll($type);
        // Support single-item fetch
        $id = $_GET['id'] ?? null;
        if ($id !== null) {
            $item = $store->findById($type, intval($id));
            if (!$item)
                errorResponse('Item not found', 404);
            jsonResponse($item);
        }
        jsonResponse($data);
        break;

    case 'POST':
        $input = readJsonBody();
        if (!$input)
            errorResponse('Invalid JSON body');

        $validatorClass = $validators[$type] ?? null;
        if ($validatorClass) {
            $errors = $validatorClass::validate($input, false);
            if (!empty($errors)) {
                jsonResponse(['error' => 'Validation failed', 'details' => $errors], 422);
            }
            $input = $validatorClass::defaults($input);
        }

        // Validate relationships
        if ($type === 'routes' && isset($input['stopIds'])) {
            $invalidStops = $guard->validateStopIds($input['stopIds']);
            if (!empty($invalidStops)) {
                jsonResponse(['error' => 'Invalid stop IDs: ' . implode(', ', $invalidStops)], 422);
            }
        }
        if ($type === 'vehicles' && isset($input['routeId']) && $input['routeId'] !== null) {
            if (!$guard->validateRouteId($input['routeId'])) {
                jsonResponse(['error' => 'Invalid routeId: route does not exist'], 422);
            }
        }

        $created = $store->create($type, $input);
        jsonResponse($created, 201);
        break;

    case 'PUT':
        $input = readJsonBody();
        if (!$input || !isset($input['id']))
            errorResponse('ID required');

        $validatorClass = $validators[$type] ?? null;
        if ($validatorClass) {
            $errors = $validatorClass::validate($input, true);
            if (!empty($errors)) {
                jsonResponse(['error' => 'Validation failed', 'details' => $errors], 422);
            }
        }

        // Validate relationships
        if ($type === 'routes' && isset($input['stopIds'])) {
            $invalidStops = $guard->validateStopIds($input['stopIds']);
            if (!empty($invalidStops)) {
                jsonResponse(['error' => 'Invalid stop IDs: ' . implode(', ', $invalidStops)], 422);
            }
        }
        if ($type === 'vehicles' && isset($input['routeId']) && $input['routeId'] !== null) {
            if (!$guard->validateRouteId($input['routeId'])) {
                jsonResponse(['error' => 'Invalid routeId: route does not exist'], 422);
            }
        }

        $updated = $store->update($type, intval($input['id']), $input);
        if (!$updated)
            errorResponse('Item not found', 404);
        jsonResponse($updated);
        break;

    case 'DELETE':
        $id = intval($_GET['id'] ?? 0);
        if (!$id)
            errorResponse('ID required');

        $force = ($_GET['force'] ?? '') === 'true';
        $check = $guard->canDelete($type, $id);

        if (!$check['canDelete'] && !$force) {
            jsonResponse([
                'error' => $check['message'],
                'dependencies' => $check['dependencies'],
                'hint' => 'Add ?force=true to detach dependencies and delete'
            ], 409);
        }

        if (!$check['canDelete'] && $force) {
            $guard->cascadeDetach($type, $id);
        }

        $deleted = $store->delete($type, $id);
        if (!$deleted)
            errorResponse('Item not found', 404);
        jsonResponse(['success' => true, 'detached' => !$check['canDelete']]);
        break;

    default:
        errorResponse('Method not allowed', 405);
}

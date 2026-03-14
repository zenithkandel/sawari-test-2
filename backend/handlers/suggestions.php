<?php
// ============================================================
// Sawari - Suggestions API
// Handles community suggestions with AI task extraction
// Author: Zenith Kandel — https://zenithkandel.com.np
// License: MIT
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
$dataFile = $rootDir . '/data/suggestions.json';

// Load .env for Groq API key
$envFile = $rootDir . '/.env';
$env = [];
if (file_exists($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (str_starts_with(trim($line), '#'))
            continue;
        if (strpos($line, '=') === false)
            continue;
        [$key, $value] = explode('=', $line, 2);
        $env[trim($key)] = trim($value);
    }
}
$groqApiKey = $env['GROQ_API_KEY'] ?? '';

// --- Helpers ---

function readSuggestions($file)
{
    if (!file_exists($file)) {
        file_put_contents($file, '[]');
        return [];
    }
    $data = json_decode(file_get_contents($file), true);
    return is_array($data) ? $data : [];
}

function writeSuggestions($file, $data)
{
    $fp = fopen($file, 'c+');
    if (!$fp)
        return false;
    flock($fp, LOCK_EX);
    fseek($fp, 0);
    ftruncate($fp, 0);
    fwrite($fp, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    flock($fp, LOCK_UN);
    fclose($fp);
    return true;
}

function jsonResponse($data, $status = 200)
{
    http_response_code($status);
    echo json_encode($data);
    exit;
}

function errorResponse($msg, $status = 400)
{
    jsonResponse(['error' => $msg], $status);
}

/**
 * Use Groq AI to extract an actionable task from a suggestion message.
 * Returns a task object or null if no clear task can be extracted.
 */
function extractTask($message, $category, $apiKey)
{
    if (empty($apiKey))
        return null;

    // Load current data for context
    $rootDir = dirname(__DIR__, 2);
    $stops = json_decode(file_get_contents($rootDir . '/data/stops.json'), true) ?: [];
    $routes = json_decode(file_get_contents($rootDir . '/data/routes.json'), true) ?: [];

    $stopNames = array_map(fn($s) => $s['name'] . ' (id:' . $s['id'] . ')', $stops);
    $routeInfo = array_map(function ($r) {
        $stopNames = isset($r['stops']) ? array_map(fn($s) => $s['name'], $r['stops']) : [];
        return $r['name'] . ' (id:' . $r['id'] . ', stops: [' . implode(', ', $stopNames) . '])';
    }, $routes);

    $systemPrompt = <<<PROMPT
You are a task extraction engine for Sawari, a Kathmandu Valley public transit navigator.

Current data:
STOPS: %STOPS%
ROUTES: %ROUTES%

Given a user suggestion, determine if it contains a specific, actionable task that can be applied to the transit data. Tasks include:
- Adding a stop to a route
- Removing a stop from a route
- Renaming a stop or route
- Adding a new stop at a location
- Changing stop coordinates
- Updating route information

If a clear task is found, respond with ONLY a JSON object (no extra text):
{
  "action": "add_stop_to_route" | "remove_stop_from_route" | "rename_stop" | "rename_route" | "add_stop" | "update_stop" | "update_route",
  "summary": "Short human-readable description of what to do",
  "entity_type": "stop" | "route",
  "entity_id": <number or null if new>,
  "entity_name": "name of the entity",
  "details": { <action-specific key-value pairs> }
}

For "add_stop_to_route": details should have "route_id", "route_name", "stop_id" (or null if new stop), "stop_name"
For "remove_stop_from_route": details should have "route_id", "route_name", "stop_id", "stop_name"
For "rename_stop": details should have "stop_id", "old_name", "new_name"
For "rename_route": details should have "route_id", "old_name", "new_name"
For "add_stop": details should have "stop_name", "lat" (if mentioned), "lng" (if mentioned)
For "update_stop": details should have "stop_id", "field", "value"
For "update_route": details should have "route_id", "field", "value"

If no specific actionable task can be extracted (vague feedback, general comments, feature requests, complaints), respond with exactly: null

Be strict — only extract tasks when the user clearly describes a data correction or update. General suggestions like "add more routes" or "the app is slow" should return null.
PROMPT;

    $systemPrompt = str_replace('%STOPS%', implode(', ', $stopNames), $systemPrompt);
    $systemPrompt = str_replace('%ROUTES%', implode(' | ', $routeInfo), $systemPrompt);

    $ch = curl_init('https://api.groq.com/openai/v1/chat/completions');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $apiKey
        ],
        CURLOPT_POSTFIELDS => json_encode([
            'model' => 'llama-3.3-70b-versatile',
            'messages' => [
                ['role' => 'system', 'content' => $systemPrompt],
                ['role' => 'user', 'content' => "Category: $category\nSuggestion: $message"]
            ],
            'max_tokens' => 300,
            'temperature' => 0
        ])
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$response)
        return null;

    $data = json_decode($response, true);
    $content = trim($data['choices'][0]['message']['content'] ?? '');

    if ($content === 'null' || $content === '')
        return null;

    // Try to parse JSON from the response
    $task = json_decode($content, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        // Try to extract JSON from markdown code blocks
        if (preg_match('/```(?:json)?\s*([\s\S]*?)\s*```/', $content, $m)) {
            $task = json_decode(trim($m[1]), true);
        }
        if (json_last_error() !== JSON_ERROR_NONE)
            return null;
    }

    // Validate required fields
    if (!isset($task['action']) || !isset($task['summary']))
        return null;

    return $task;
}

// --- Route handling ---

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Return all suggestions (for admin panel)
    $suggestions = readSuggestions($dataFile);
    jsonResponse($suggestions);
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input)
        errorResponse('Invalid JSON body');

    $message = trim($input['message'] ?? '');
    $category = trim($input['category'] ?? 'general');
    $name = trim($input['name'] ?? 'Anonymous');

    if (empty($message))
        errorResponse('Message is required');
    if (strlen($message) < 10)
        errorResponse('Message must be at least 10 characters');
    if (strlen($message) > 1000)
        errorResponse('Message must be under 1000 characters');

    $allowedCategories = ['route_correction', 'missing_stop', 'fare_issue', 'new_route', 'general'];
    if (!in_array($category, $allowedCategories)) {
        $category = 'general';
    }

    // Extract task using AI
    $task = extractTask($message, $category, $groqApiKey);

    // Build suggestion entry
    $suggestions = readSuggestions($dataFile);
    $maxId = 0;
    foreach ($suggestions as $s) {
        if (($s['id'] ?? 0) > $maxId)
            $maxId = $s['id'];
    }

    $entry = [
        'id' => $maxId + 1,
        'name' => substr($name, 0, 50),
        'category' => $category,
        'message' => $message,
        'task' => $task,
        'status' => 'pending',
        'created_at' => date('c'),
    ];

    $suggestions[] = $entry;
    writeSuggestions($dataFile, $suggestions);

    jsonResponse($entry, 201);
}

if ($method === 'PUT') {
    // Update suggestion status (for admin: approve, dismiss, complete)
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || !isset($input['id']))
        errorResponse('id is required');

    $id = (int) $input['id'];
    $newStatus = $input['status'] ?? null;
    $allowedStatuses = ['pending', 'approved', 'dismissed', 'completed'];
    if (!in_array($newStatus, $allowedStatuses))
        errorResponse('Invalid status');

    $fp = fopen($dataFile, 'c+');
    if (!$fp)
        errorResponse('Could not open data file', 500);
    flock($fp, LOCK_EX);

    $raw = stream_get_contents($fp);
    $suggestions = json_decode($raw, true) ?: [];

    $found = false;
    foreach ($suggestions as &$s) {
        if ($s['id'] === $id) {
            $s['status'] = $newStatus;
            if ($newStatus === 'completed' || $newStatus === 'approved') {
                $s['resolved_at'] = date('c');
            }
            $found = true;
            break;
        }
    }
    unset($s);

    if (!$found) {
        flock($fp, LOCK_UN);
        fclose($fp);
        errorResponse('Suggestion not found', 404);
    }

    fseek($fp, 0);
    ftruncate($fp, 0);
    fwrite($fp, json_encode($suggestions, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    flock($fp, LOCK_UN);
    fclose($fp);

    jsonResponse(['success' => true, 'id' => $id, 'status' => $newStatus]);
}

if ($method === 'DELETE') {
    $id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
    if (!$id)
        errorResponse('id query parameter is required');

    $fp = fopen($dataFile, 'c+');
    if (!$fp)
        errorResponse('Could not open data file', 500);
    flock($fp, LOCK_EX);

    $raw = stream_get_contents($fp);
    $suggestions = json_decode($raw, true) ?: [];
    $original = count($suggestions);
    $suggestions = array_values(array_filter($suggestions, fn($s) => $s['id'] !== $id));

    if (count($suggestions) === $original) {
        flock($fp, LOCK_UN);
        fclose($fp);
        errorResponse('Suggestion not found', 404);
    }

    fseek($fp, 0);
    ftruncate($fp, 0);
    fwrite($fp, json_encode($suggestions, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    flock($fp, LOCK_UN);
    fclose($fp);

    jsonResponse(['success' => true, 'deleted' => $id]);
}

errorResponse('Method not allowed', 405);

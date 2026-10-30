<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
require_once __DIR__ . '/Controller.php';
function respond(int $status, array $payload): never {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}
try {
    $manager = new PluginSwitchController();
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        // Compatibility scanning only reads plugin definitions and refreshes
        // our private /run cache. Use GET for this non-mutating operation.
        $force = ($_GET['rescan'] ?? '') === '1';
        respond(200, ['plugins' => $manager->all($force)]);
    }
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(405, ['error' => 'Method not allowed']);
    // Unraid's webGUI auto_prepend (local_prepend.php) verifies CSRF tokens
    // BEFORE this script runs, then removes csrf_token from $_POST.
    // Validating it a second time here always fails for legitimate requests.
    // Never expose this endpoint outside Unraid's authenticated WebGUI.
    $action = $_POST['action'] ?? 'toggle';
    if ($action !== 'toggle') respond(400, ['error' => 'Unknown operation']);
    $id = $_POST['id'] ?? null;
    $target = $_POST['enabled'] ?? null;
    if (!is_string($id) || !in_array($target, ['0','1'], true)) {
        respond(400, ['error' => 'Invalid plugin or requested state']);
    }
    respond(200, ['plugin' => $manager->change($id, $target === '1')]);
} catch (Throwable $e) {
    respond(409, ['error' => $e->getMessage()]);
}

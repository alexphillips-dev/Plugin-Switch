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
        respond(200, ['plugins' => $manager->all()]);
    }
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(405, ['error' => 'Method not allowed']);
    // Unraid validates POST csrf_token in its local_prepend.php. Independently
    // validate it here, too, so alternative hosting cannot bypass the guard.
    $session = @parse_ini_file('/var/local/emhttp/var.ini', false, INI_SCANNER_RAW);
    $expected = $session['csrf_token'] ?? null;
    $received = $_POST['csrf_token'] ?? null;
    if (!is_string($expected) || $expected === '' ||
        !is_string($received) || !hash_equals($expected, $received)) {
        respond(403, ['error' => 'Invalid CSRF token']);
    }
    $action = $_POST['action'] ?? 'toggle';
    if ($action === 'rescan') {
        respond(200, ['plugins' => $manager->all(true)]);
    }
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

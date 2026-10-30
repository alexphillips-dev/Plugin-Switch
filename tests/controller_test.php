<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/src/Controller.php';

function expect(bool $condition, string $message): void {
    if (!$condition) {
        throw new RuntimeException('FAIL: ' . $message);
    }
}
$root = sys_get_temp_dir() . '/plugin-switch-test-' . bin2hex(random_bytes(6));
$boot = "$root/boot";
$registered = "$root/installed";
$adapters = "$boot/plugin.switch/adapters";
$parked = "$boot/plugin.switch/disabled";
foreach ([$boot, $registered, $adapters, $parked] as $dir) {
    mkdir($dir, 0700, true);
}
register_shutdown_function(static function () use ($root): void {
    if (!is_dir($root)) return;
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ($iterator as $entry) {
        if ($entry->isDir() && !$entry->isLink()) rmdir($entry->getPathname());
        else unlink($entry->getPathname());
    }
    rmdir($root);
});

$id = 'example.plg';
file_put_contents("$boot/$id", '<?xml version="1.0"?><PLUGIN name="example" author="QA" version="2026.10.29.1"/>');
symlink("$boot/$id", "$registered/$id");
$manager = new PluginSwitchController($boot, $registered, "$root/run", '/does/not/exist');

$plugins = $manager->all();
expect(count($plugins) === 1, 'active plugin should appear');
expect($plugins[0]['enabled'] === true, 'registered plugin must show ON regardless of adapter');
expect($plugins[0]['supported'] === false, 'no adapter should not claim runtime support');
expect($plugins[0]['support'] === 'no-adapter', 'missing adapter classification');
expect($plugins[0]['runtime'] === 'unknown', 'do not infer daemon runtime from registration');

file_put_contents("$adapters/example.sh", "#!/bin/bash\necho enabled\n");
chmod("$adapters/example.sh", 0666);
$plugins = $manager->all();
expect($plugins[0]['support'] === 'invalid-adapter', 'unsafe adapters must be blocked');
expect($plugins[0]['enabled'] === true, 'invalid adapters must not alter display state');
try {
    $manager->change('example.plg', false);
    throw new RuntimeException('Unsafe adapter erroneously allowed');
} catch (RuntimeException $exception) {
    expect(str_contains($exception->getMessage(), 'Adapter must be root-owned'), 'expected explicit adapter validation error');
}
expect(is_file("$boot/$id") && is_link("$registered/$id"), 'rejected change must preserve plugin');

try {
    $manager->change('../example.plg', false);
    throw new RuntimeException('Traversal erroneously allowed');
} catch (RuntimeException $e) {
    expect(str_contains($e->getMessage(), 'Invalid or protected'), 'traversal is rejected');
}
try {
    $manager->change('plugin.switch.plg', false);
    throw new RuntimeException('Self-disable erroneously allowed');
} catch (RuntimeException $e) {
    expect(str_contains($e->getMessage(), 'Invalid or protected'), 'self-disable is rejected');
}
try {
    $manager->change('unRAIDServer.plg', false);
    throw new RuntimeException('Core-disable erroneously allowed');
} catch (RuntimeException $e) {
    expect(str_contains($e->getMessage(), 'Invalid or protected'), 'core-disable is rejected');
}

unlink("$adapters/example.sh");
unlink("$registered/$id");
rename("$boot/$id", "$parked/$id");
$plugins = $manager->all();
expect(count($plugins) === 1, 'parked plugin must remain visible');
expect($plugins[0]['enabled'] === false, 'parked plugin must show OFF');
expect($plugins[0]['support'] === 'no-adapter', 'do not offer unverified re-enable');

echo "Controller support and state tests passed\n";

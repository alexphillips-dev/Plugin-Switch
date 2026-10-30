<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/src/Controller.php';

function check(bool $yes, string $message): void {
    if (!$yes) throw new RuntimeException($message);
}
$root = sys_get_temp_dir() . '/plugin-switch-compat-' . bin2hex(random_bytes(6));
$boot = "$root/boot";
$registered = "$root/registered";
$adapters = "$root/builtin";
$cache = "$root/cache";
$state = "$root/running";
foreach ([$boot, $registered, $adapters, $cache] as $dir) mkdir($dir, 0700, true);
register_shutdown_function(static function () use ($root) {
    if (!is_dir($root)) return;
    $tree = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ($tree as $entry) {
        if ($entry->isDir() && !$entry->isLink()) rmdir($entry->getPathname());
        else unlink($entry->getPathname());
    }
    rmdir($root);
});

$plugin = "$boot/integration-test.plg";
$manifest = <<<'XML'
<?xml version="1.0"?>
<PLUGIN name="integration-test" version="2026.10.29.1">
  <FILE Run="/bin/bash"><INLINE><![CDATA[
    /etc/rc.d/rc.fixture start
    crontab -l
  ]]></INLINE></FILE>
</PLUGIN>
XML;
file_put_contents($plugin, $manifest);
symlink($plugin, "$registered/integration-test.plg");
file_put_contents($state, 'active');
$adapter = "$adapters/integration.sh";
$script = '#!/bin/bash' . "\n" .
    'case "$1" in' . "\n" .
    'status) if test -f ' . escapeshellarg($state) . '; then echo enabled; else echo disabled; fi ;;' . "\n" .
    'start) touch ' . escapeshellarg($state) . ' ;;' . "\n" .
    'stop) rm -f ' . escapeshellarg($state) . ' ;;' . "\n" .
    '*) exit 2 ;;' . "\n" .
    'esac' . "\n";
file_put_contents($adapter, $script);
chmod($adapter, 0700);
$profiles = "$root/profiles.json";
file_put_contents($profiles, json_encode([
    'schema_version' => 1,
    'profiles' => []
]));
$scanner = new PluginSwitchCompatibility($profiles, $adapters, $cache);
$unknown = $scanner->scan('integration-test.plg', $plugin);
check($unknown['classification'] === 'candidate', 'service discovery candidate');
check(in_array('fixture', $unknown['services'], true), 'service name discovered');
check(in_array('scheduler', $unknown['signals'], true), 'cron hazard signal');
check($scanner->verifiedAdapter('integration-test.plg', $plugin) === null, 'no unverified adapter');

$controller = new PluginSwitchController($boot, $registered, "$root/run", '/usr/local/sbin/plugin', $scanner);
$info = $controller->all()[0];
check($info['enabled'] === true, 'installed state true');
check($info['supported'] === false, 'discovery must not authorize live control');
check($info['compatibility']['classification'] === 'candidate', 'controller discovery integration');

// Publish a profile with exact pinned manifest AND adapter fingerprints.
file_put_contents($profiles, json_encode([
    'schema_version' => 1,
    'profiles' => [[
        'id' => 'integration-test.plg',
        'name' => 'Audited Test Adapter',
        'manifest_sha256' => hash_file('sha256', $plugin),
        'adapter' => 'integration.sh',
        'adapter_sha256' => hash_file('sha256', $adapter)
    ]]
]));
$scan = $scanner->scan('integration-test.plg', $plugin, true);
check($scan['profile_status'] === 'verified', 'pinned profile should validate');
check($scanner->verifiedAdapter('integration-test.plg', $plugin) !== null, 'verified adapter discovered');
$info = $controller->all(true)[0];
check($info['supported'] === true, 'verified profile enables live toggle after runtime check');
check($info['compatibility']['classification'] === 'live', 'live classified only after validation');
check($info['compatibility']['control_source'] === 'bundled-profile', 'bundled registry origin');

// No uninstall scripts should run on disable. Both restore paths are tested
// by Controller's separate lifecycle tests.
$result = $controller->change('integration-test.plg', false);
check($result['enabled'] === false, 'plugin parked');
check(!is_file($state), 'service stopped');
check(is_file("$boot/plugin.switch/disabled/integration-test.plg"), 'manifest parked');
$result = $controller->change('integration-test.plg', true);
check($result['enabled'] === true, 'plugin unparked');
check(is_file($state), 'service restarted');
check(is_link("$registered/integration-test.plg"), 'registration restored');

// Changing plugin version invalidates its audited hash, even when the name
// remains the same. It must not be allowed to execute the old verified adapter.
file_put_contents($plugin, str_replace('2026.10.29.1','2026.10.29.2',$manifest));
$scan = $scanner->scan('integration-test.plg', $plugin, true);
check($scan['profile_status'] === 'manifest-mismatch', 'version drift invalidates profile');
check($scanner->verifiedAdapter('integration-test.plg', $plugin) === null, 'no adapter on drift');
check($controller->all(true)[0]['supported'] === false, 'drift locks live control');

// Regression: a previously stopped service must NOT be unexpectedly started
// when a disable attempt is rejected because of conflicting manifests.
file_put_contents($plugin, $manifest);
@unlink($state);
$conflict = "$boot/plugin.switch/disabled/integration-test.plg";
file_put_contents($conflict, $manifest);
try {
    $controller->change('integration-test.plg', false);
    throw new RuntimeException('Conflicted disable unexpectedly succeeded');
} catch (RuntimeException $e) {
    check(str_contains($e->getMessage(), 'parked file conflicts'), 'conflict rejected');
}
check(!is_file($state), 'rollback preserves original stopped runtime');
check(is_file($plugin) && is_link("$registered/integration-test.plg"), 'manifest and link remain installed');
@unlink($conflict);

echo "Capability discovery, hash-pinned profiles, lifecycle and fail-closed drift passed\n";

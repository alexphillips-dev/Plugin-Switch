<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/src/Safety.php';
require_once dirname(__DIR__) . '/src/Release.php';
require_once dirname(__DIR__) . '/src/ProbePool.php';

function assertSafety(bool $yes, string $message): void {
    if (!$yes) throw new RuntimeException($message);
}
$root = sys_get_temp_dir() . '/plugin-switch-safety-' . bin2hex(random_bytes(5));
$boot = "$root/boot";
mkdir("$boot/plugin.switch/disabled", 0700, true);
register_shutdown_function(static function () use ($root): void {
    if (!is_dir($root)) return;
    $items = new RecursiveIteratorIterator(new RecursiveDirectoryIterator(
        $root, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($items as $item) {
        if ($item->isDir() && !$item->isLink()) rmdir($item->getPathname());
        else unlink($item->getPathname());
    }
    rmdir($root);
});
$safety = new PluginSwitchSafety($boot);
file_put_contents("$boot/plugin.switch/safety.json", json_encode([
    'protected'=>['pinned.plg'],
    'depends_on'=>['consumer.plg'=>['provider.plg']]
]));
assertSafety($safety->protectReason('pinned.plg', []) !== null, 'configured protection');
assertSafety($safety->protectReason('provider.plg', ['consumer.plg']) !== null, 'dependent blocks disable');
assertSafety($safety->protectReason('provider.plg', []) === null, 'inactive dependent does not block');
assertSafety($safety->protectReason('plugin.switch.plg', []) !== null, 'cannot disable self');

$safety->begin('provider.plg', 'disable');
$safety->phase('provider.plg','runtime-stopped');
assertSafety($safety->pending('provider.plg')['phase']==='runtime-stopped', 'persist operation phase');
try {
    $safety->begin('provider.plg','disable');
    throw new RuntimeException('Concurrent transaction accepted');
} catch (RuntimeException $e) {
    assertSafety(str_contains($e->getMessage(), 'Unfinished transaction'), 'pending operations locked');
}
$interrupted = "$boot/plugin.switch/disabled/provider.plg";
file_put_contents($interrupted,'<PLUGIN/>');
$r = $safety->recoverInterruptedNextBoot($boot);
assertSafety($r['reboot_required']===true, 'interrupted restore schedules reboot');
assertSafety(is_file("$boot/provider.plg") && !is_file($interrupted), 'no execution, manifest restored');
assertSafety($safety->pending('provider.plg')===null, 'transaction resolved');
assertSafety(count($safety->history())===1, 'recovery recorded');

file_put_contents("$boot/plugin.switch/disabled/another.plg", '<PLUGIN/>');
$restore = $safety->restoreNextBoot($boot);
assertSafety(in_array('another.plg', $restore['restored'], true), 'parked plugin restored');
assertSafety(is_file("$boot/another.plg"), 'boot manifest present');

assertSafety(PluginSwitchRelease::versionOf(
    '<!ENTITY version "2026.10.29.9">') === '2026.10.29.9', 'version extraction');
assertSafety(PluginSwitchRelease::versionOf('<PLUGIN/>')===null, 'invalid version is null');

$adapter = "$root/status.sh";
file_put_contents($adapter, "#!/bin/bash\necho enabled\n");
chmod($adapter,0700);
$probe = PluginSwitchProbePool::check(['test.plg'=>$adapter], 2);
assertSafety(($probe['test.plg']['state'] ?? '') === 'enabled', 'parallel status probe');
echo "Safety, recovery, dependency and update metadata tests passed\n";

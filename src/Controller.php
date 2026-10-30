<?php
declare(strict_types=1);
require_once __DIR__ . '/Compatibility.php';
require_once __DIR__ . '/Safety.php';
require_once __DIR__ . '/ProbePool.php';

/**
 * Plugin Switch runtime controller.
 *
 * A .plg defines an installation, NOT a universally stoppable service.
 * We only change a live plugin when a trusted, plugin-specific adapter exists.
 */
final class PluginSwitchController
{
    private string $boot;
    private string $park;
    private string $installed;
    private string $adapters;
    private string $run;
    private string $pluginCommand;
    private PluginSwitchCompatibility $scanner;
    private PluginSwitchSafety $safety;

    public function __construct(
        string $boot = '/boot/config/plugins',
        string $installed = '/var/log/plugins',
        string $run = '/run/plugin-switch',
        string $pluginCommand = '/usr/local/sbin/plugin',
        ?PluginSwitchCompatibility $scanner = null,
        ?PluginSwitchSafety $safety = null
    ) {
        $this->boot = rtrim($boot, '/');
        $this->park = $this->boot . '/plugin.switch/disabled';
        $this->adapters = $this->boot . '/plugin.switch/adapters';
        $this->installed = rtrim($installed, '/');
        $this->run = rtrim($run, '/');
        $this->pluginCommand = $pluginCommand;
        $this->scanner = $scanner ?? new PluginSwitchCompatibility();
        $this->safety = $safety ?? new PluginSwitchSafety($this->boot);
    }

    private function validId(string $id): bool
    {
        return strlen($id) <= 128
            && preg_match('/^[a-zA-Z0-9][a-zA-Z0-9._-]*\\.plg$/D', $id) === 1
            && $id !== 'plugin.switch.plg'
            && $id !== 'unRAIDServer.plg';
    }

    private function pluginPaths(string $id): array
    {
        if (!$this->validId($id)) {
            throw new RuntimeException('Invalid or protected plugin.');
        }
        return [
            $this->boot . '/' . $id,
            $this->park . '/' . $id,
            $this->installed . '/' . $id,
            $this->run . '/' . $id
        ];
    }

    /**
     * Do not infer compatibility from plugin names, daemon names or manifest
     * contents. A trusted adapter is the only opt-in live-control interface.
     * Report WHY a plugin is unsupported instead of calling it disabled.
     *
     * @return array{0: ?string, 1: string, 2: string}
     */
    private function adapterInfo(string $id, string $manifest = ''): array
    {
        if (PluginSwitchCompatibility::protectedId($id)) {
            return [null, 'protected', 'Core and Plugin Switch components cannot be toggled.'];
        }
        $name = substr($id, 0, -4);
        $file = $this->adapters . '/' . $name . '.sh';
        if (!file_exists($file) && !is_link($file)) {
            $verified = $manifest !== '' ? $this->scanner->verifiedAdapter($id, $manifest) : null;
            if ($verified !== null) {
                return [$verified['path'], 'verified-profile', 'Validated against a hash-pinned bundled live-control profile.'];
            }
            return [null, 'no-adapter', 'No verified live-control profile or trusted local adapter is available.'];
        }
        if (is_link($file) || !is_file($file) || filesize($file) === 0 || filesize($file) > 65536) {
            return [null, 'invalid-adapter', 'Adapter is not a regular file or exceeds the allowed size.'];
        }
        $mode = fileperms($file);
        if ($mode === false || ($mode & 0022) !== 0 || fileowner($file) !== 0) {
            return [null, 'invalid-adapter', 'Adapter must be root-owned and not writable by group or others.'];
        }
        return [$file, 'available', 'Trusted adapter detected; runtime status verified.'];
    }

    private function execute(array $args, int $timeout = 15): array
    {
        $command = array_merge(['/usr/bin/timeout', '--kill-after=2s', $timeout . 's'], $args);
        $proc = @proc_open($command, [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w']
        ], $pipes, null, ['PATH' => '/usr/local/sbin:/usr/sbin:/usr/bin:/sbin:/bin']);
        if (!is_resource($proc)) {
            throw new RuntimeException('Failed to launch runtime controller.');
        }
        fclose($pipes[0]);
        $stdout = stream_get_contents($pipes[1], 8192);
        $stderr = stream_get_contents($pipes[2], 8192);
        fclose($pipes[1]);
        fclose($pipes[2]);
        $code = proc_close($proc);
        return [$code, trim((string)$stdout), trim((string)$stderr)];
    }

    private function state(string $script): string
    {
        [$code, $stdout] = $this->execute(['/bin/bash', $script, 'status'], 8);
        if ($code !== 0 || !in_array($stdout, ['enabled', 'disabled'], true)) {
            throw new RuntimeException('Adapter status must return enabled or disabled (exit 0).');
        }
        return $stdout;
    }

    private function action(string $script, string $verb): void
    {
        [$code, , $stderr] = $this->execute(['/bin/bash', $script, $verb]);
        if ($code !== 0) {
            throw new RuntimeException('Adapter ' . $verb . ' failed (exit ' . $code . '): ' . substr($stderr, 0, 200));
        }
        $wanted = $verb === 'start' ? 'enabled' : 'disabled';
        if ($this->state($script) !== $wanted) {
            throw new RuntimeException('Adapter did not confirm ' . $wanted . ' after ' . $verb . '.');
        }
    }

    private function details(string $id, string $plg, bool $enabled, bool $rescan = false, ?array $probe = null): array
    {
        $name = substr($id, 0, -4);
        $author = '';
        $version = '';
        if (is_file($plg)) {
            // Internal DTD entities are common in Unraid manifests; no network access.
            $old = libxml_use_internal_errors(true);
            $xml = simplexml_load_file($plg, 'SimpleXMLElement', LIBXML_NONET | LIBXML_NOCDATA);
            libxml_clear_errors();
            libxml_use_internal_errors($old);
            if ($xml !== false) {
                $name = (string)($xml['name'] ?? $name);
                $author = (string)($xml['author'] ?? '');
                $version = (string)($xml['version'] ?? '');
            }
        }
        $compat = $this->scanner->scan($id, $plg, $rescan);
        $pending = $this->safety->pending($id);
        $enabledIds = array_map('basename', glob($this->installed . '/*.plg') ?: []);
        $protection = $this->safety->protectReason($id, $enabledIds);
        [$script, $support, $reason] = $this->adapterInfo($id, $plg);
        $runtime = 'unknown';
        if ($script !== null) {
            try {
                if ($probe !== null) {
                    if (!isset($probe['state'])) {
                        throw new RuntimeException($probe['error'] ?? 'Status probe failed.');
                    }
                    $runtime = $probe['state'];
                } else {
                    $runtime = $this->state($script);
                }
            } catch (Throwable $e) {
                // A parked plugin may need its files installed before its
                // adapter can report status. Restore remains possible.
                $support = $enabled ? 'status-error' : 'restore-only';
                $reason = $enabled
                    ? 'Adapter status check failed: ' . $e->getMessage()
                    : 'Plugin is parked. Re-enable restores its files before checking runtime status.';
            }
        }
        // A discovered service is only a candidate. Never grant live controls
        // based on a name or init script existing in the filesystem.
        $supported = $script !== null && (!$enabled || $runtime !== 'unknown');
        if ($support === 'protected') $supported = false;
        if ($pending || $protection) {
            $supported = false;
            $support = $pending ? 'interrupted' : 'protected';
            $reason = $pending
                ? 'Interrupted operation detected. Use Recovery to prepare a safe next-boot restoration.'
                : $protection;
            $compat['classification'] = $pending ? 'needs-recovery' : 'protected';
        }
        if ($supported) {
            $compat['classification'] = 'live';
            $compat['reason'] = $support === 'verified-profile'
                ? 'Bundled profile and runtime status verified.'
                : 'Explicitly trusted local adapter and runtime status verified.';
            $compat['control_source'] = $support === 'verified-profile' ? 'bundled-profile' : 'local-adapter';
        } else {
            $compat['control_source'] = 'none';
        }
        if ($support === 'no-adapter') $reason = $compat['reason'];
        $compat['reason'] = $reason;
        return [
            'id' => $id,
            'name' => $name,
            'author' => $author,
            'version' => $version,
            'enabled' => $enabled,
            'runtime' => $runtime,
            'support' => $support,
            'compatibility' => $compat,
            'supported' => $supported,
            'reason' => $reason,
            'pending' => $pending,
        ];
    }

    public function all(bool $rescan = false): array
    {
        $items = [];
        $sources = [];
        foreach (glob($this->installed . '/*.plg') ?: [] as $link) {
            if (!is_link($link)) continue;
            $id = basename($link);
            if (!$this->validId($id) && !PluginSwitchCompatibility::protectedId($id)) continue;
            $file = $this->boot . '/' . $id;
            if (!is_file($file) || is_link($file) || realpath($link) !== realpath($file)) continue;
            $sources[$id] = ['path'=>$file, 'enabled'=>true];
        }
        foreach (glob($this->park . '/*.plg') ?: [] as $file) {
            $id = basename($file);
            if (!$this->validId($id) || is_link($file) || isset($sources[$id])) continue;
            $sources[$id] = ['path'=>$file, 'enabled'=>false];
        }
        // Static discovery runs in the web request; only verified status
        // adapters execute in bounded parallel jobs (4 simultaneous max).
        $scripts = [];
        foreach ($sources as $id => $source) {
            [$script] = $this->adapterInfo($id, $source['path']);
            if ($script !== null) $scripts[$id] = $script;
        }
        $probes = PluginSwitchProbePool::check($scripts);
        foreach ($sources as $id => $source) {
            $items[$id] = $this->details($id, $source['path'], $source['enabled'],
                $rescan, $probes[$id] ?? null);
        }
        ksort($items, SORT_NATURAL | SORT_FLAG_CASE);
        return array_values($items);
    }

    public function change(string $id, bool $enable): array
    {
        [$active, $disabled, $link, $marker] = $this->pluginPaths($id);
        if (!is_dir($this->run) && !mkdir($this->run, 0700, true) && !is_dir($this->run)) {
            throw new RuntimeException('Cannot create runtime lock directory.');
        }
        $lock = fopen($this->run . '/controller.lock', 'c');
        if ($lock === false || !flock($lock, LOCK_EX)) {
            throw new RuntimeException('Could not lock plugin operations.');
        }
        try {
            $enabledIds = array_map('basename', glob($this->installed . '/*.plg') ?: []);
            if (!$enable && ($reason = $this->safety->protectReason($id, $enabledIds))) {
                throw new RuntimeException($reason);
            }
            if ($this->safety->pending($id)) {
                throw new RuntimeException('Interrupted transaction; use Recovery before retrying.');
            }
            [$script, , $adapterReason] = $this->adapterInfo($id, $enable ? $disabled : $active);
            if ($script === null) {
                throw new RuntimeException($adapterReason);
            }
            // Snapshot the actual runtime state before attempting a change,
            // so failure handling does not accidentally start an already
            // stopped service.
            $originalRuntime = $enable ? null : $this->state($script);
            $this->safety->begin($id, $enable ? 'enable' : 'disable');
            try {
            if ($enable) {
                if (!is_file($disabled) || is_link($disabled) || file_exists($active)) {
                    throw new RuntimeException('Plugin is not safely parked, or an active file conflicts.');
                }
                if (is_link($link) || file_exists($link)) {
                    throw new RuntimeException('An installed plugin entry conflicts with the parked plugin.');
                }
                if (is_file($marker)) {
                    // Stopped during this boot: restore without reinstalling.
                    if (!rename($disabled, $active)) {
                        throw new RuntimeException('Could not restore plugin manifest.');
                    }
                    $this->safety->phase($id, 'manifest-restored');
                    if (!symlink($active, $link)) {
                        rename($active, $disabled);
                        throw new RuntimeException('Could not restore installed plugin registration.');
                    }
                    try {
                        if ($this->state($script) !== 'enabled') {
                            $this->action($script, 'start');
                        }
                    } catch (Throwable $e) {
                        @unlink($link);
                        @rename($active, $disabled);
                        throw $e;
                    }
                    @unlink($marker);
                    $this->safety->phase($id, 'runtime-restored');
                } else {
                    // A reboot has removed the plugin's installed files.
                    // Use the official install lifecycle, then verify the adapter.
                    [$code, , $stderr] = $this->execute([$this->pluginCommand, 'install', $disabled], 120);
                    if ($code !== 0 || !is_file($active) || !is_link($link)) {
                        throw new RuntimeException('Unraid could not reinstall the parked plugin. ' . substr($stderr, 0, 200));
                    }
                    $this->safety->phase($id, 'reinstalled');
                    if ($this->state($script) !== 'enabled') {
                        $this->action($script, 'start');
                    }
                    if (!unlink($disabled)) {
                        throw new RuntimeException('Plugin started, but its parked manifest could not be removed.');
                    }
                }
            } else {
                if (!is_file($active) || is_link($active) || is_file($disabled)) {
                    throw new RuntimeException('Plugin is not safely installed, or a parked file conflicts.');
                }
                if (!is_link($link) || realpath($link) !== realpath($active)) {
                    throw new RuntimeException('Plugin registration is inconsistent; refusing to disable.');
                }
                if (!is_dir($this->park) && !mkdir($this->park, 0700, true) && !is_dir($this->park)) {
                    throw new RuntimeException('Cannot create disabled-plugin directory.');
                }
                if ($originalRuntime !== 'disabled') {
                    $this->action($script, 'stop');
                }
                $this->safety->phase($id, 'runtime-stopped');
                if (!rename($active, $disabled)) {
                    // Do not report success if persistence failed.
                    $this->action($script, 'start');
                    throw new RuntimeException('Could not park the plugin manifest.');
                }
                $this->safety->phase($id, 'manifest-parked');
                if (!unlink($link)) {
                    @rename($disabled, $active);
                    $this->action($script, 'start');
                    throw new RuntimeException('Could not unregister the stopped plugin.');
                }
                if (@file_put_contents($marker, 'stopped this boot', LOCK_EX) === false) {
                    throw new RuntimeException('Cannot save same-boot restore marker.');
                }
                $this->safety->phase($id, 'parked');
            }
            $this->safety->end($id, 'success');
            error_log('[plugin.switch] ' . ($enable ? 'enabled ' : 'disabled ') . $id);
            $file = $enable ? $active : $disabled;
            return $this->details($id, $file, $enable);
            } catch (Throwable $operationError) {
                // Best-effort synchronous rollback. Never silently claim
                // success if the plugin or runtime cannot be restored.
                try {
                    if (!$enable && is_file($disabled) && !is_file($active)) {
                        if (!@rename($disabled, $active)) throw new RuntimeException('Manifest rollback failed.');
                    }
                    if (!$enable && is_file($active) && !is_link($link)) {
                        if (!@symlink($active, $link)) throw new RuntimeException('Registration rollback failed.');
                    }
                    if (!$enable && $originalRuntime === 'enabled' && $this->state($script) !== 'enabled') {
                        $this->action($script, 'start');
                    }
                    if (!$enable && $originalRuntime === 'disabled' && $this->state($script) !== 'disabled') {
                        $this->action($script, 'stop');
                    }
                    // Enabling a plugin after reboot may partially install it.
                    // Leave this transaction pending for explicit recovery.
                    if ($enable && !is_file($disabled)) {
                        throw new RuntimeException('Enable interrupted; intervention required.');
                    }
                    if ($enable && !is_file($active) && !is_link($link)) {
                        // A failed start may have partially started services.
                        // Verify stopped before claiming the original parked state.
                        if ($this->state($script) === 'disabled') {
                            $this->safety->end($id, 'failed-no-change');
                        }
                    } elseif (!$enable && is_file($active) && is_link($link)) {
                        $this->safety->end($id, 'rolled-back');
                    }
                } catch (Throwable $rollbackError) {
                    error_log('[plugin.switch] rollback failure ' . $id . ': ' . $rollbackError->getMessage());
                    throw new RuntimeException($operationError->getMessage() .
                        ' Rollback incomplete; use Recovery before retrying.');
                }
                throw $operationError;
            }
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    /**
     * No service restarts are attempted in emergency recovery. Restored plugin
     * definitions take effect at the NEXT boot only.
     */
    public function recoverNextBoot(): array
    {
        if (!is_dir($this->run)) @mkdir($this->run, 0700, true);
        $lock = @fopen($this->run . '/controller.lock', 'c');
        if ($lock === false || !flock($lock, LOCK_EX)) {
            throw new RuntimeException('Could not acquire recovery lock.');
        }
        try {
            $interrupted = $this->safety->recoverInterruptedNextBoot($this->boot);
            $parked = $this->safety->restoreNextBoot($this->boot);
            return ['interrupted'=>$interrupted, 'parked'=>$parked,
                'reboot_required'=>($interrupted['reboot_required'] || $parked['reboot_required'])];
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    public function diagnostics(): array
    {
        return [
            'pending'=>$this->safety->allPending(),
            'history'=>array_slice($this->safety->history(), -20),
            'protection_config'=>$this->boot . '/plugin.switch/safety.json',
        ];
    }
}

<?php
declare(strict_types=1);

/**
 * Persistent, fail-closed safety configuration and recovery journal.
 * No root-service or plugin commands are executed by this class.
 */
final class PluginSwitchSafety
{
    private string $root;
    private string $journalDir;
    private string $history;

    public function __construct(string $boot = '/boot/config/plugins')
    {
        $this->root = rtrim($boot, '/') . '/plugin.switch';
        $this->journalDir = $this->root . '/transactions';
        $this->history = $this->root . '/history.json';
    }

    public static function validId(string $id): bool
    {
        return strlen($id) <= 128 &&
            preg_match('/^[a-zA-Z0-9][a-zA-Z0-9._-]*\\.plg$/D', $id) === 1;
    }

    private function config(): array
    {
        $path = $this->root . '/safety.json';
        if (!is_file($path) || is_link($path) || (@filesize($path) ?: 0) > 65536) return [];
        $data = json_decode((string)@file_get_contents($path), true);
        return is_array($data) ? $data : [];
    }

    public function protectReason(string $id, array $enabled): ?string
    {
        if (!self::validId($id)) return 'Invalid plugin identifier.';
        if (in_array(strtolower($id), ['plugin.switch.plg','unraidserver.plg'], true)) {
            return 'Protected system or Plugin Switch component.';
        }
        $config = $this->config();
        foreach (($config['protected'] ?? []) as $protected) {
            if ($protected === $id) return 'Plugin protected by administrator policy.';
        }
        foreach (($config['depends_on'] ?? []) as $dependent => $required) {
            if (!in_array($dependent, $enabled, true) || !is_array($required)) continue;
            if (in_array($id, $required, true)) {
                return 'Required by enabled plugin ' . $dependent . '.';
            }
        }
        return null;
    }

    private function directory(): void
    {
        if (!is_dir($this->journalDir) && !@mkdir($this->journalDir, 0700, true)) {
            throw new RuntimeException('Cannot create transaction journal.');
        }
    }

    private function writeJson(string $path, array $value): void
    {
        $this->directory();
        if (is_link($path)) throw new RuntimeException('Journal symlink refused.');
        $temp = @tempnam($this->journalDir, '.ps-');
        if ($temp === false) throw new RuntimeException('Cannot create journal temporary file.');
        @chmod($temp, 0600);
        try {
            $json = json_encode($value, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
            if ($json === false || @file_put_contents($temp, $json, LOCK_EX) === false ||
                !@rename($temp, $path)) throw new RuntimeException('Cannot persist transaction.');
        } finally {
            @unlink($temp);
        }
    }

    private function journalFile(string $id): string
    {
        if (!self::validId($id)) throw new RuntimeException('Invalid plugin identifier.');
        return $this->journalDir . '/' . $id . '.json';
    }

    public function pending(string $id): ?array
    {
        $file = $this->journalFile($id);
        if (!is_file($file) || is_link($file)) return null;
        $data = json_decode((string)@file_get_contents($file), true);
        return is_array($data) ? $data : ['phase'=>'corrupt','id'=>$id];
    }

    public function allPending(): array
    {
        $results = [];
        foreach (glob($this->journalDir . '/*.plg.json') ?: [] as $file) {
            $id = substr(basename($file), 0, -5);
            if (!self::validId($id)) continue;
            $data = $this->pending($id);
            if ($data) $results[$id] = $data;
        }
        return $results;
    }

    public function begin(string $id, string $operation): void
    {
        if ($this->pending($id)) throw new RuntimeException('Unfinished transaction. Use recovery diagnostics.');
        if (!in_array($operation, ['enable','disable'], true)) throw new RuntimeException('Invalid operation.');
        $this->writeJson($this->journalFile($id), [
            'id'=>$id, 'operation'=>$operation, 'phase'=>'starting', 'time'=>gmdate('c')
        ]);
    }

    public function phase(string $id, string $phase): void
    {
        $entry = $this->pending($id);
        if (!$entry) throw new RuntimeException('Transaction not found.');
        $entry['phase'] = $phase;
        $this->writeJson($this->journalFile($id), $entry);
    }

    public function end(string $id, string $outcome): void
    {
        $entry = $this->pending($id);
        if (!$entry) return;
        $entry['outcome'] = $outcome;
        $entry['completed_at'] = gmdate('c');
        $records = $this->history();
        $records[] = $entry;
        $records = array_slice($records, -100);
        $this->writeJson($this->history, $records);
        @unlink($this->journalFile($id));
    }

    public function history(): array
    {
        if (!is_file($this->history) || is_link($this->history) || (@filesize($this->history) ?: 0) > 65536) return [];
        $data = json_decode((string)@file_get_contents($this->history), true);
        return is_array($data) ? $data : [];
    }

    public function recoverInterruptedNextBoot(string $boot): array
    {
        $boot = rtrim($boot, '/');
        $park = $boot . '/plugin.switch/disabled';
        $result = ['recovered'=>[], 'manual'=>[], 'reboot_required'=>false];
        foreach ($this->allPending() as $id => $entry) {
            $target = $boot . '/' . $id;
            $disabled = $park . '/' . $id;
            if (is_link($target) || is_link($disabled) ||
                (is_file($target) && is_file($disabled))) {
                $result['manual'][$id] = 'Conflicting or unsafe manifests; manual review required.';
                continue;
            }
            if (is_file($disabled)) {
                if (!@rename($disabled, $target)) {
                    $result['manual'][$id] = 'Cannot restore manifest.';
                    continue;
                }
                $result['reboot_required'] = true;
            }
            if (!is_file($target)) {
                $result['manual'][$id] = 'No valid manifest available.';
                continue;
            }
            $this->end($id, 'recovered-next-boot');
            $result['recovered'][] = $id;
        }
        return $result;
    }

    /**
     * Emergency recovery is boot-only: moving a parked manifest back into the
     * startup scan is safer than automatically executing unknown installers.
     * Never overwrite existing manifests or process active transactions.
     */
    public function restoreNextBoot(string $boot): array
    {
        $boot = rtrim($boot, '/');
        $park = $boot . '/plugin.switch/disabled';
        $result = ['restored'=>[], 'skipped'=>[], 'reboot_required'=>false];
        foreach (glob($park . '/*.plg') ?: [] as $file) {
            $id = basename($file);
            if (!self::validId($id) || is_link($file) ||
                in_array(strtolower($id), ['plugin.switch.plg','unraidserver.plg'], true)) {
                continue;
            }
            $target = $boot . '/' . $id;
            if ($this->pending($id) || file_exists($target) || is_link($target)) {
                $result['skipped'][$id] = 'Pending operation or manifest conflict.';
                continue;
            }
            if (@rename($file, $target)) {
                $result['restored'][] = $id;
                $result['reboot_required'] = true;
            } else {
                $result['skipped'][$id] = 'Could not restore manifest.';
            }
        }
        return $result;
    }
}

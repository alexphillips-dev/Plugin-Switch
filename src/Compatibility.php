<?php
declare(strict_types=1);

/**
 * Read-only compatibility inventory for Unraid 7 plugins.
 *
 * Discovery is evidence, NOT authorization to execute inferred commands.
 * Only an exact manifest fingerprint plus a bundled, hash-pinned adapter can
 * elevate a verified profile to live-capable. Local administrator adapters
 * are an independent explicit trust path managed by Controller.php.
 */
final class PluginSwitchCompatibility
{
    private string $catalog;
    private string $adapterDir;
    private string $cacheDir;
    private int $ttl;

    public function __construct(
        string $catalog = __DIR__ . '/profiles.json',
        string $adapterDir = __DIR__ . '/builtin-adapters',
        string $cacheDir = '/run/plugin-switch/discovery',
        int $ttl = 300
    ) {
        $this->catalog = $catalog;
        $this->adapterDir = rtrim($adapterDir, '/');
        $this->cacheDir = rtrim($cacheDir, '/');
        $this->ttl = max(0, $ttl);
    }

    public static function protectedId(string $id): bool
    {
        return in_array(strtolower($id), ['plugin.switch.plg', 'unraidserver.plg'], true);
    }

    private function catalog(): array
    {
        if (!is_file($this->catalog) || is_link($this->catalog)) return [];
        $data = @file_get_contents($this->catalog);
        if (!is_string($data) || strlen($data) > 131072) return [];
        $parsed = json_decode($data, true);
        if (!is_array($parsed) || ($parsed['schema_version'] ?? null) !== 1) return [];
        return is_array($parsed['profiles'] ?? null) ? $parsed['profiles'] : [];
    }

    private function allProfilesFor(string $id): array
    {
        return array_values(array_filter($this->catalog(), static function ($profile) use ($id): bool {
            return is_array($profile) && ($profile['id'] ?? '') === $id;
        }));
    }

    /**
     * Profiles cannot declare arbitrary commands. They only identify an
     * adapter file already packaged in Plugin Switch, pinned by checksum.
     */
    public function verifiedAdapter(string $id, string $manifest): ?array
    {
        if (self::protectedId($id) || !is_file($manifest) || is_link($manifest)) return null;
        $hash = @hash_file('sha256', $manifest);
        if (!is_string($hash)) return null;
        foreach ($this->allProfilesFor($id) as $profile) {
            if (!is_string($profile['manifest_sha256'] ?? null) ||
                !hash_equals(strtolower($profile['manifest_sha256']), $hash)) continue;
            $name = $profile['adapter'] ?? null;
            $sha = $profile['adapter_sha256'] ?? null;
            if (!is_string($name) || preg_match('/^[a-z0-9][a-z0-9._-]*\\.sh$/D', $name) !== 1 ||
                !is_string($sha) || preg_match('/^[0-9a-f]{64}$/D', $sha) !== 1) continue;
            $path = $this->adapterDir . '/' . $name;
            if (!is_file($path) || is_link($path) || @filesize($path) > 65536 ||
                @fileowner($path) !== 0 || ((@fileperms($path) ?: 0) & 0022) !== 0) continue;
            $actual = @hash_file('sha256', $path);
            if (!is_string($actual) || !hash_equals($sha, $actual)) continue;
            return ['path' => $path, 'profile' => (string)($profile['name'] ?? $id)];
        }
        return null;
    }

    private static function uniqueLimited(array $values, int $max): array
    {
        return array_slice(array_values(array_unique($values)), 0, $max);
    }

    /** @return array<string,mixed> */
    public function scan(string $id, string $manifest, bool $force = false): array
    {
        $result = [
            'classification' => self::protectedId($id) ? 'protected' : 'unverified',
            'reason' => 'No audited, reversible live-control method has been verified; no live-control action is available.',
            'services' => [],
            'signals' => [],
            'profile' => null,
            'profile_status' => 'none',
            'scanned_at' => gmdate('c'),
        ];
        if (self::protectedId($id)) {
            $result['reason'] = 'Core or Plugin Switch components cannot be disabled.';
            return $result;
        }
        if (!preg_match('/^[a-zA-Z0-9][a-zA-Z0-9._-]*\\.plg$/D', $id) ||
            !is_file($manifest) || is_link($manifest)) return $result;
        $size = @filesize($manifest);
        if ($size === false || $size <= 0 || $size > 2097152) {
            $result['reason'] = 'Manifest is missing, empty or larger than the safe scanning limit.';
            return $result;
        }
        $content = @file_get_contents($manifest);
        if (!is_string($content)) return $result;
        $fingerprint = hash('sha256', $content);
        $registryHash = is_file($this->catalog) ? (@hash_file('sha256', $this->catalog) ?: '') : '';
        $cacheKey = hash('sha256', $id . ':' . $fingerprint . ':' . $registryHash);
        $cacheFile = $this->cacheDir . '/' . $id . '.json';
        if (!$force && $this->ttl > 0 && is_file($cacheFile) && !is_link($cacheFile) &&
            @filesize($cacheFile) < 32768 && time() - (int)@filemtime($cacheFile) < $this->ttl) {
            $cache = json_decode((string)@file_get_contents($cacheFile), true);
            if (is_array($cache) && ($cache['key'] ?? null) === $cacheKey &&
                is_array($cache['result'] ?? null)) return $cache['result'];
        }

        $result['manifest_sha256'] = $fingerprint;
        $old = libxml_use_internal_errors(true);
        // LIBXML_NONET and no LIBXML_NOENT: do not fetch external entities or
        // expand arbitrary entity content while inspecting third-party plugins.
        $xml = @simplexml_load_string($content, 'SimpleXMLElement', LIBXML_NONET | LIBXML_NOCDATA);
        libxml_clear_errors();
        libxml_use_internal_errors($old);
        if ($xml === false || $xml->getName() !== 'PLUGIN') {
            $result['reason'] = 'Manifest XML could not be safely parsed.';
            return $result;
        }

        $text = '';
        $methods = [];
        $files = 0;
        foreach ($xml->FILE as $file) {
            if (++$files > 300) break;
            $attrs = $file->attributes();
            $name = (string)($attrs['Name'] ?? '');
            $method = (string)($attrs['Method'] ?? 'install');
            $methods[] = $method;
            $text .= "\n" . substr($name, 0, 1024) . "\n" .
                substr((string)($attrs['Run'] ?? ''), 0, 1024) . "\n" .
                substr((string)($file->INLINE ?? ''), 0, 32768);
            if (strlen($text) > 262144) break;
        }
        // The evidence is a bounded list of literal references. No service
        // command is ever executed by the discovery engine.
        preg_match_all('#/(?:etc/rc\\.d/rc\\.|etc/init\\.d/)([a-zA-Z0-9._-]{2,64})#', $text, $matches);
        $result['services'] = self::uniqueLimited($matches[1] ?? [], 12);
        $patterns = [
            'kernel-module' => '/\\b(?:modprobe|insmod|rmmod|depmod)\\b/i',
            'network-stack' => '/\\b(?:iptables|nft|ip\\s+(?:route|rule)|wg-quick|ipsec)\\b/i',
            'storage-stack' => '/\\b(?:zpool|zfs\\s+|mdadm|mount|umount)\\b/i',
            'global-boot-hooks' => '#(?:/etc/rc\\.d/rc\\.local|/boot/config/go|/etc/udev/)#i',
            'scheduler' => '/(?:\\bcrontab\\b|\\bcron\\b|update_cron)/i',
            'gui-files' => '#/usr/local/emhttp/plugins/#i',
            'destructive-remove' => '/\\b(?:rm\\s+-rf|wipefs|mkfs\\.)\\b/i',
        ];
        foreach ($patterns as $label => $regex) {
            if (preg_match($regex, $text) === 1) $result['signals'][] = $label;
        }
        if (in_array('remove', $methods, true) ||
            count(array_filter($methods, static fn($m) => str_contains($m, 'remove'))) > 0) {
            $result['signals'][] = 'uninstall-hook';
        }
        $profiles = $this->allProfilesFor($id);
        if ($profiles) {
            $result['profile_status'] = 'manifest-mismatch';
            $result['signals'][] = 'profile-version-drift';
        }
        $verified = $this->verifiedAdapter($id, $manifest);
        if ($verified) {
            $result['classification'] = 'candidate';
            $result['profile_status'] = 'verified';
            $result['profile'] = $verified['profile'];
            $result['reason'] = 'Manifest and bundled adapter match a reviewed profile; runtime status must also pass.';
        } elseif ($result['services'] !== []) {
            $result['classification'] = 'candidate';
            $result['reason'] = 'Potential service controls discovered; reversibility and dependencies are not verified.';
        } elseif ($profiles) {
            $result['classification'] = 'candidate';
            $result['reason'] = 'Previously reviewed manifest has changed; profile must be revalidated before live control.';
        }
        $result['signals'] = self::uniqueLimited($result['signals'], 12);
        if (is_dir($this->cacheDir) || @mkdir($this->cacheDir, 0700, true)) {
            if (!is_link($cacheFile)) {
                $payload = json_encode(['key' => $cacheKey, 'result' => $result], JSON_INVALID_UTF8_SUBSTITUTE);
                if ($payload !== false) {
                    $tmp = @tempnam($this->cacheDir, '.scan-');
                    if ($tmp !== false) {
                        @chmod($tmp, 0600);
                        if (@file_put_contents($tmp, $payload, LOCK_EX) !== false) @rename($tmp, $cacheFile);
                        @unlink($tmp);
                    }
                }
            }
        }
        return $result;
    }
}

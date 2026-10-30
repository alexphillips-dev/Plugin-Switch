<?php
declare(strict_types=1);

/** Branch-pinned, opt-in update diagnostics; no automatic network requests. */
final class PluginSwitchRelease
{
    private string $manifest;
    private string $cache;

    public function __construct(
        string $manifest = '/boot/config/plugins/plugin.switch.plg',
        string $cache = '/run/plugin-switch/update.json'
    ) {
        $this->manifest = $manifest;
        $this->cache = $cache;
    }

    public static function versionOf(string $xml): ?string
    {
        if (preg_match('/<!ENTITY\\s+version\\s+"([0-9]{4}\\.[0-9]{1,2}\\.[0-9]{1,2}\\.[0-9]+)"\\s*>/', $xml, $m)) return $m[1];
        if (preg_match('/<PLUGIN\\b[^>]*\\bversion="([0-9]{4}\\.[0-9]{1,2}\\.[0-9]{1,2}\\.[0-9]+)"/', $xml, $m)) return $m[1];
        return null;
    }

    /**
     * Match the native Unraid third-party plugin manager exactly.
     * PHP version_compare() is NOT used there; strcmp() is.
     */
    public static function isNewer(?string $published, ?string $installed): bool
    {
        return $published !== null && $installed !== null &&
            strcmp($published, $installed) > 0;
    }

    public function local(): array
    {
        if (!is_file($this->manifest) || is_link($this->manifest)) {
            return ['installed_version'=>null, 'branch'=>null, 'update_url'=>null,
                'error'=>'Installed Plugin Switch manifest not found.'];
        }
        $source = (string)@file_get_contents($this->manifest, false, null, 0, 8192);
        $url = null;
        if (preg_match('/<!ENTITY\\s+pluginURL\\s+"([^"]+)"\\s*>/', $source, $m)) $url = $m[1];
        $allowed = '#^https://raw\\.githubusercontent\\.com/alexphillips-dev/Plugin-Switch/(dev|main)/plugin\\.switch\\.plg$#D';
        if (!is_string($url) || !preg_match($allowed, $url, $match)) {
            return ['installed_version'=>self::versionOf($source), 'branch'=>null,
                'update_url'=>$url, 'error'=>'Update URL is not a supported dev/main endpoint.'];
        }
        return ['installed_version'=>self::versionOf($source), 'branch'=>$match[1],
            'update_url'=>$url, 'error'=>null];
    }

    public function check(bool $force = false): array
    {
        $local = $this->local();
        if ($local['error']) return $local;
        if (!$force && is_file($this->cache) && !is_link($this->cache) &&
            (int)@filemtime($this->cache) > time() - 600) {
            $data = json_decode((string)@file_get_contents($this->cache), true);
            if (is_array($data) && ($data['update_url'] ?? null) === $local['update_url']) return $data;
        }
        $result = $local + ['latest_version'=>null, 'available'=>false, 'checked_at'=>gmdate('c')];
        if (!function_exists('curl_init')) {
            $result['error'] = 'PHP curl extension is unavailable.';
            return $result;
        }
        $ch = curl_init($local['update_url']);
        if ($ch === false) {
            $result['error'] = 'Could not start update check.';
            return $result;
        }
        $payload = '';
        curl_setopt_array($ch, [
            CURLOPT_FOLLOWLOCATION=>false,
            CURLOPT_CONNECTTIMEOUT=>3,
            CURLOPT_TIMEOUT=>8,
            CURLOPT_USERAGENT=>'Plugin-Switch-update-check/1',
            CURLOPT_WRITEFUNCTION=>static function ($curl, string $chunk) use (&$payload): int {
                if (strlen($payload) + strlen($chunk) > 262144) return 0;
                $payload .= $chunk;
                return strlen($chunk);
            }
        ]);
        $ok = curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        if ($ok !== true || $status !== 200) {
            $result['error'] = 'Update check failed (HTTP ' . $status . '): ' . substr($error, 0, 100);
            return $result;
        }
        $result['latest_version'] = self::versionOf($payload);
        if ($result['latest_version'] === null) {
            $result['error'] = 'Release manifest has no recognized version.';
            return $result;
        }
        // Keep diagnostics consistent with Unraid's native third-party strcmp() check.
        $result['available'] = self::isNewer($result['latest_version'], $result['installed_version']);
        $result['error'] = null;
        $dir = dirname($this->cache);
        if (is_dir($dir) || @mkdir($dir, 0700, true)) {
            if (!is_link($this->cache)) {
                $temp = @tempnam($dir, '.update-');
                if ($temp !== false) {
                    @chmod($temp, 0600);
                    @file_put_contents($temp, json_encode($result), LOCK_EX);
                    @rename($temp, $this->cache);
                    @unlink($temp);
                }
            }
        }
        return $result;
    }
}

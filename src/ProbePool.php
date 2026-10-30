<?php
declare(strict_types=1);

/** Bounded parallel, read-only status probes; one slow adapter cannot stall all rows. */
final class PluginSwitchProbePool
{
    public static function check(array $scripts, int $limit = 4): array
    {
        $limit = max(1, min(6, $limit));
        $queue = array_keys($scripts);
        $active = [];
        $results = [];
        while ($queue || $active) {
            while (count($active) < $limit && $queue) {
                $id = array_shift($queue);
                $script = $scripts[$id];
                // All scripts were already validated by adapterInfo() before
                // reaching this pool. We NEVER execute scanner-discovered paths.
                $proc = @proc_open(
                    ['/usr/bin/timeout','--kill-after=1s','5s','/bin/bash',$script,'status'],
                    [0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],
                    $pipes,
                    null,
                    ['PATH'=>'/usr/local/sbin:/usr/sbin:/usr/bin:/sbin:/bin']
                );
                if (!is_resource($proc)) {
                    $results[$id] = ['error'=>'Could not start status probe.'];
                    continue;
                }
                fclose($pipes[0]);
                stream_set_blocking($pipes[1], false);
                stream_set_blocking($pipes[2], false);
                $active[$id] = ['proc'=>$proc,'pipes'=>$pipes,'output'=>'','error'=>''];
            }
            foreach ($active as $id => &$task) {
                $task['output'] .= (string)@stream_get_contents($task['pipes'][1], max(1, 512-strlen($task['output'])));
                $task['error'] .= (string)@stream_get_contents($task['pipes'][2], max(1, 256-strlen($task['error'])));
                $state = proc_get_status($task['proc']);
                if ($state['running']) continue;
                $task['output'] .= (string)@stream_get_contents($task['pipes'][1], max(1, 512-strlen($task['output'])));
                fclose($task['pipes'][1]);
                fclose($task['pipes'][2]);
                proc_close($task['proc']);
                $value = trim($task['output']);
                if ($state['exitcode'] === 0 && in_array($value, ['enabled','disabled'], true)) {
                    $results[$id] = ['state'=>$value];
                } else {
                    $results[$id] = ['error'=>'Status probe returned an invalid result or timed out.'];
                }
                unset($active[$id]);
            }
            unset($task);
            if ($active) usleep(20000);
        }
        return $results;
    }
}

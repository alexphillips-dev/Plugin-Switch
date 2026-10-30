#!/bin/bash
# Copy to /boot/config/plugins/plugin.switch/adapters/EXACT-PLUGIN-BASENAME.sh
# Example: for sample.plg use sample.sh.
# Must be root-owned, not writable by group/others; do not use for actual
# plugins without adapting the service name and checking side effects.
set -euo pipefail
SERVICE='example-service'
case "${1:-}" in
  status)
    if /etc/rc.d/rc.example-service status >/dev/null 2>&1; then
      printf 'enabled\n'
    else
      printf 'disabled\n'
    fi
    ;;
  stop) /etc/rc.d/rc.example-service stop ;;
  start) /etc/rc.d/rc.example-service start ;;
  *) echo 'Usage: adapter {status|stop|start}' >&2; exit 2 ;;
esac

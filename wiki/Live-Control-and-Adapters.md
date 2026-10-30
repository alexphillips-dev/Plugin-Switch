# Live Control & Adapters

[Home](Home) · [Compatibility Scanning](Compatibility-Scanning) · [Security Model](Security-Model)

**The safety boundary:** Plugin Switch never executes a command merely because it appeared in a third-party `.plg` manifest. Actual start/stop commands come from a **trusted adapter**, verified separately from scanner evidence.

## Adapter contract

A live-control adapter is a shell script supporting exactly three requested actions:

| Command | Required behavior |
|---|---|
| `status` | Exit `0` and print **exactly** `enabled` or `disabled` to stdout |
| `stop` | Safely stop all plugin-specific runtime functionality, then exit successfully |
| `start` | Restore functionality, then exit successfully |

`stop`/`start` are **not** the same as Unraid plugin install/uninstall. The controller checks `status` after a requested action; a return code of `0` from `stop` alone is not sufficient.

The adapter must handle cases such as already stopped/running, stale PID files, cron jobs, auto-restarting services, configuration preservation, shared dependencies, and incomplete operations. No third-party plugin can be assumed to satisfy those requirements without testing.

## Locally trusted adapters

For `example.plg`, an administrator can install an adapter at:

```text
/boot/config/plugins/plugin.switch/adapters/example.sh
```

The adapter must be a regular file, not a symbolic link, **owned by root**, **not writable by group or others**, and no larger than **64 KiB**. Plugin Switch rejects unsafe files. It invokes trusted scripts through `/bin/bash`, so a file does not have to be executable to pass the current file checks.

**This is a privileged extension point.** Granting adapter trust lets its script run as part of a privileged plugin lifecycle. Never download and enable unknown adapters based only on their names, forum posts or a ChatGPT-generated guess.

### Illustrative contract only

```bash
#!/bin/bash
set -euo pipefail

case "${1:-}" in
  status)
    # Replace with a verified, unambiguous test of the FULL plugin runtime.
    # Print only "enabled" or "disabled"; exit nonzero if uncertain.
    echo "disabled"
    ;;
  stop)
    # Intentionally not implemented; do not guess a service name.
    echo "Not audited" >&2
    exit 2
    ;;
  start)
    echo "Not audited" >&2
    exit 2
    ;;
  *) exit 2 ;;
esac
```

**Do not install this example** as an operational adapter. It deliberately does not support start/stop. Follow the checked-in [example adapter](https://github.com/alexphillips-dev/Plugin-Switch/blob/dev/examples/example-adapter.sh) as a structural reference only; it also requires plugin-specific auditing.

## Bundled verified profiles

Bundled profiles are listed in [`src/profiles.json`](https://github.com/alexphillips-dev/Plugin-Switch/blob/dev/src/profiles.json). Each record identifies the exact plugin filename, a SHA-256 of its `.plg`, a packaged adapter filename, and a SHA-256 of that adapter. Only an exact match authorizes the packaged control path (and the runtime status must still pass).

```json
{
  "schema_version": 1,
  "profiles": [
    {
      "id": "example.plg",
      "name": "Audited Example Plugin",
      "manifest_sha256": "<64 lowercase hex digits>",
      "adapter": "example.sh",
      "adapter_sha256": "<64 lowercase hex digits>"
    }
  ]
}
```

The example above describes the **schema**, not an approved profile; the placeholder hashes are intentionally invalid. Currently the shipped `profiles` list is empty.

## How to propose a real profile

1. Select a **specific version** of a plugin and obtain its original manifest and full repository/source.
2. Audit install/update/remove hooks, service lifecycle, UI integration, scheduled jobs, kernel/network/storage effects, file writes and dependencies.
3. Develop reversible, deterministic start/stop/status behavior; reject ambiguity rather than guessing.
4. Test on an isolated Unraid 7 environment. Include already-stopped, repeated toggles, failure injection, reboot and recovery cases.
5. Generate review-only fingerprints with the repository utility:

   ```bash
   python3 tools/profile_review.py ./example.plg --adapter ./example.sh
   ```

6. Add the reviewed script to `src/builtin-adapters/` and the exact hashes to `src/profiles.json`, with reproducible tests and a written explanation of side effects.
7. Verify an updated manifest **fails closed** until re-reviewed. Do not broaden an exact SHA check merely to make more versions work.

See [Contributing](Contributing) and the [profile review instructions](https://github.com/alexphillips-dev/Plugin-Switch/blob/dev/profiles/README.md).

## When not to add a live adapter

Do not assume live unloading is appropriate for a plugin that patches Unraid internals, installs kernel drivers, changes disk handling, manipulates network routing or firewalls, or controls shared system services. It may be safer to leave the control locked and use the plugin's own documented lifecycle.

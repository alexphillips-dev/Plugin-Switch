# Release History

[Home](Home) · [Updates & Release Channels](Updates-and-Release-Channels)

This page summarizes development milestones through **`2026.10.29.10`**. For exact changes and commits, inspect the [`dev` history](https://github.com/alexphillips-dev/Plugin-Switch/commits/dev) and the current [manifest](https://github.com/alexphillips-dev/Plugin-Switch/blob/dev/plugin.switch.plg). This is **not** a promise that every milestone was tested on production Unraid systems.

| Version | Major change |
|---|---|
| `2026.10.29.1` | Corrected installed-state switch display, support diagnostics and date-based versioning |
| `2026.10.29.2` | Branch-pinned update URL; Plugin Switch display metadata and description |
| `2026.10.29.3` | SHA-256 payloads to support reliable Unraid inline-file replacement during updates |
| `2026.10.29.4` | Read-only compatibility discovery, reviewed-profile schema and exportable evidence |
| `2026.10.29.5` | Corrected scan CSRF handling; reduced clutter in the Enabled column |
| `2026.10.29.6` | Isolated switch styling and a centered, scrollable compatibility modal |
| `2026.10.29.7` | Initial cell-centering adjustment |
| `2026.10.29.8` | Working left-aligned switch/lock group for Unraid's table layout |
| `2026.10.29.9` | Transaction journals, protection/dependency policy, concurrent probes, update diagnostics and Recovery UI |
| `2026.10.29.10` | Fixed rollback to preserve a plugin's original stopped/running state |

Documentation changes to the Wiki do not automatically create a new `.plg` release. The installed plugin version only changes when the manifest is rebuilt and published using the prescribed `YYYY.MM.DD.patch` scheme.

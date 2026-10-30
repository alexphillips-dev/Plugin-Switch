# Plugin Switch (development preview)

Adds an **Enabled** column to Unraid's existing **Plugins** tab. Designed for true **live** start/stop of plugins that expose a trustworthy runtime control adapter, rather than misleading everyone with a generic ON/OFF switch.

> **Development build — do not deploy to a production Unraid host without lab validation.**
> Unraid plugins are not isolated processes; many cannot be stopped without a reboot. **An installed plugin shows ON even when its live toggle is locked.** The toggle represents installation/load-at-boot state, NOT a guarantee that every service is currently running.

## Features

- One-column native Plugins tab integration, resilient to asynchronous table re-renders
- Real-time start/stop/status confirmation via trusted per-plugin adapters
- Persistent disabled plugin manifests stored outside Unraid's boot scan
- Disabled plugins remain visible after reboot with a way to enable them again
- Protected core/manager plugins, path validation, CSRF enforcement, exclusive operation locks
- Explicit compatibility diagnostics in each row (hover the info symbol for the reason)
- No generic `plugin remove` as an off switch; removing can erase settings
- No claims of support for kernel drivers, globally patched components, or unknown teardown behavior

## Install on a lab Unraid server

Use the direct `.plg` URL under **Plugins > Install Plugin**, after validating the manifest and source:

`https://raw.githubusercontent.com/alexphillips-dev/Plugin-Switch/dev/plugin.switch.plg`

Build the manifest with `python3 tools/build.py` if editing `src/` locally.

## How Plugin Switch determines support

**All installed plugins show ON by default**, because they are registered with Unraid and scheduled to load at boot. That does not imply they can be safely paused. The support label under each toggle is a separate assessment:

| Label | Meaning | Toggle |
| --- | --- | --- |
| Live ready | Trusted root-owned adapter found, status probe returned `enabled` | Available |
| Service stopped | Trusted adapter returned `disabled`, but Unraid manifest is still installed | Available |
| No live control | No matching adapter installed | Locked ON for installed plugins |
| Adapter blocked | Adapter missing file guarantees, wrong owner, unsafe permissions or size | Locked |
| Adapter error | Adapter exists but its `status` action failed | Locked |
| Restore available | Plugin parked after a previous disable; its adapter can't report status until the plugin is installed again | Available |
| Disabled | Plugin is parked and its adapter reports stopped | Available |

**There is no universal Unraid API for safely stopping and restarting any plugin.** We deliberately do **not** infer compatibility from a process name, existence of a `.plg`, or available uninstall routine. A plugin is *supported* only when a developer/operator has inspected its lifecycle and supplied a trusted, tested runtime adapter. As shipped, **no third-party adapters are bundled**, so installed plugins are normally ON and locked until supported adapters are added.

To identify a plugin's exact manifest filename, inspect `/boot/config/plugins/*.plg`. For a plugin `example.plg`, the adapter is `/boot/config/plugins/plugin.switch/adapters/example.sh`. Its `status` action must print precisely `enabled` or `disabled`, exit 0, and its start/stop actions must be truly reversible. If the adapter is invalid, the tooltip explains the reason. Do not assume the sample adapter controls a real plugin without reviewing that plugin's code.

## Versioning policy

Every published change uses Unraid's `YYYY.MM.DD.patch` version format, starting with `2026.10.29.1`. On the same date increment the final patch number (e.g. `2026.10.29.2`), and on a new date use `.1`. Update the `VERSION` constant in `tools/build.py` and regenerate `plugin.switch.plg` with `python3 tools/build.py`. Automated tests reject malformed dates and the old `-dev` format.

## Adapter contract

For an installed `example.plg`, install a **trusted root-owned, non-world/group-writable** executable adapter at:

`/boot/config/plugins/plugin.switch/adapters/example.sh`

Use the example in `examples/example-adapter.sh` only as a template. This code does not ship with any adapters enabled.

Commands: `status` prints exactly `enabled` or `disabled` and exits 0, `stop` stops everything affected by that plugin safely, and `start` restores everything. Verify that services do not auto-restart, and that it is safe to re-enable them. The adapter controls runtime; the controller handles persistence. Only create adapters for plugins whose cleanup and restore behavior you have inspected.

## Lifecycle model

Disable: verify a trusted adapter, stop the plugin, verify stopped, move its `.plg` to `/boot/config/plugins/plugin.switch/disabled/`, unregister the installed symlink, and leave a marker in `/run/plugin-switch/` for same-boot re-enable. Plugin settings directories remain untouched.

Re-enable (same boot): restore the `.plg` and symlink, start and verify. Re-enable (after reboot): invoke Unraid's official `plugin install` lifecycle from the parked manifest, verify the adapter, and remove the parked copy.

**Limitations**: a failed install or failed adapter action can require manual intervention; some plugin installers are not idempotent, plugins may share resources, and plugin dependencies are not automatically discoverable. Do not write an adapter for a plugin without reviewing its source. Plugin Switch itself and core OS plugins are protected from toggle operations.

## Development

```bash
python3 tools/build.py --check
php -l src/Controller.php
php -l src/api.php
node --check src/switch.js
python3 -m unittest discover -s tests -v
php tests/controller_test.php
```

## Reference

Unraid WebGUI source: [Plugins.page](https://github.com/unraid/webgui/blob/master/emhttp/plugins/dynamix.plugin.manager/Plugins.page) and [ShowPlugins.php](https://github.com/unraid/webgui/blob/master/emhttp/plugins/dynamix.plugin.manager/include/ShowPlugins.php).

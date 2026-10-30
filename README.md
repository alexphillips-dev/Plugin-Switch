# Plugin Switch (development preview)

Adds an **Enabled** column to Unraid's existing **Plugins** tab. Designed for true **live** start/stop of plugins that expose a trustworthy runtime control adapter, rather than misleading everyone with a generic ON/OFF switch.

> **Development build — do not deploy to a production Unraid host without lab validation.**
> Unraid plugins are not isolated processes; many cannot be stopped without a reboot. Unsupported plugins remain visible with a disabled control.

## Features

- One-column native Plugins tab integration, resilient to asynchronous table re-renders
- Real-time start/stop/status confirmation via trusted per-plugin adapters
- Persistent disabled plugin manifests stored outside Unraid's boot scan
- Disabled plugins remain visible after reboot with a way to enable them again
- Protected core/manager plugins, path validation, CSRF enforcement, exclusive operation locks
- No generic `plugin remove` as an off switch; removing can erase settings
- No claims of support for kernel drivers, globally patched components, or unknown teardown behavior

## Install on a lab Unraid server

Use the direct `.plg` URL under **Plugins > Install Plugin**, after validating the manifest and source:

`https://raw.githubusercontent.com/alexphillips-dev/Plugin-Switch/dev/plugin.switch.plg`

Build the manifest with `python3 tools/build.py` if editing `src/` locally.

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
```

## Reference

Unraid WebGUI source: [Plugins.page](https://github.com/unraid/webgui/blob/master/emhttp/plugins/dynamix.plugin.manager/Plugins.page) and [ShowPlugins.php](https://github.com/unraid/webgui/blob/master/emhttp/plugins/dynamix.plugin.manager/include/ShowPlugins.php).

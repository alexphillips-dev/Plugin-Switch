# Plugin Switch

**Plugin Switch** is an Unraid 7.x development-preview plugin by **[alexphillips-dev](https://github.com/alexphillips-dev)**. It extends Unraid's existing **Plugins** tab with an Enabled switch, compatibility information, and tools for scanning, update diagnostics, and recovery.

> **Development preview.** Test on a non-production Unraid server and keep a backup of your boot flash. Unraid plugins are not isolated containers; arbitrary plugins cannot be safely paused or resumed without an explicitly validated lifecycle.

## What it does

- Shows an **Enabled** switch beside installed plugins. ON means the plugin is registered for boot loading; it does **not** guarantee its runtime services are running.
- Discovers possible service controls and risk signals through **read-only** manifest scanning. Findings are evidence to review, not permission to execute them.
- Supports live enable/disable only through **trusted, tested adapters** and version-matched compatibility profiles; unsupported switches remain locked with explanations.
- Records operations, offers conservative next-boot recovery, protects configured plugins/dependencies, and exports a local compatibility report.
- Keeps development and future stable release update URLs pinned to their respective GitHub branches.

**Current limitation:** No third-party plugin has yet been certified in the bundled registry. Most switches will therefore be locked until reviewed adapters are available. Recovery is a fallback, not a guarantee that every plugin change can be undone live.

## Install (development channel)

In Unraid, open **Plugins → Install Plugin** and paste:

```text
https://raw.githubusercontent.com/alexphillips-dev/Plugin-Switch/dev/plugin.switch.plg
```

The `main` branch is **not** a published stable release. To check for available updates, use Unraid's native Plugins update controls; Plugin Switch also provides a read-only **Check updates** diagnostic.

## Documentation

- **[GitHub Wiki](https://github.com/alexphillips-dev/Plugin-Switch/wiki):** user guide, compatibility, adapters, architecture, recovery and troubleshooting.
- **[Changelog](CHANGELOG.md):** complete development release history and changes.
- **[Safety policy reference](docs/SAFETY.md):** administrator protection rules and recovery behavior.
- **[Verified profile guide](profiles/README.md):** reviewed adapters and contribution requirements.
- **[Report a problem](https://github.com/alexphillips-dev/Plugin-Switch/issues):** include Unraid version, installed plugin version, and redacted logs.

## Development

The `dev` branch is the current development source. Release manifests are built with `python3 tools/build.py --branch dev` and validated by GitHub Actions. See the [Wiki's contributing guide](https://github.com/alexphillips-dev/Plugin-Switch/wiki/Contributing) for full workflows.

**License:** [MIT](LICENSE).

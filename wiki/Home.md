# Plugin Switch

**A native Unraid Plugins-tab extension for inspecting plugin compatibility and controlling eligible plugins without uninstalling them.**

> **Development preview — current documented build: `2026.10.29.11` (`dev` branch).** Plugin Switch has not been validated across the full Unraid plugin ecosystem. Use a test server, keep a flash backup, and read [Safety & Recovery](Safety-and-Recovery) before testing live controls.

Plugin Switch adds an **Enabled** column to **Unraid → Plugins**, a compact lock/info button for compatibility details, and tools to scan compatibility, export a local report, inspect update channels, and prepare recovery.

## The distinction that matters

An **ON** switch means Unraid has the plugin registered for installation at startup. **It does not prove the plugin's services are currently running or that Plugin Switch can stop them.** A greyed-out/locked switch means no trusted, verified live-control method is available. The lock opens a details modal explaining what was detected and why the switch is locked.

At the time of this documentation, **the bundled third-party compatibility profile registry is empty**. Plugin Switch can identify potential service controls, but **does not automatically certify them**. Live controls require a carefully reviewed, exact-match bundled profile or a trusted local adapter.

## Start here

| I want to… | Read |
|---|---|
| Install or update the development build | [Getting Started](Getting-Started) |
| Understand each button and status | [User Interface](User-Interface) |
| Know what actually happens when I toggle a plugin | [How It Works](How-It-Works) |
| Understand scanner results and their limitations | [Compatibility Scanning](Compatibility-Scanning) |
| Learn what makes a plugin eligible for live control | [Live Control & Adapters](Live-Control-and-Adapters) |
| Protect plugins and plan recovery | [Safety & Recovery](Safety-and-Recovery) |
| Set administrator policies | [Configuration Reference](Configuration-Reference) |
| Diagnose an error | [Troubleshooting](Troubleshooting) |
| Inspect update branches and versioning | [Updates & Release Channels](Updates-and-Release-Channels) |
| Review implementation, security or contribute | [Architecture](Architecture), [Security Model](Security-Model), [Contributing](Contributing) |

## What is — and is not — included

**Implemented:** native Plugins-tab column; read-only manifest scanning; candidate service and risk signals; SHA-256-pinned compatibility profiles; trusted local adapters; concurrent status checks; persistent disabled manifests; operation journals; guarded recovery for a future reboot; administrator-defined protection/dependency policies; local JSON export; dev/main update-channel diagnostics.

**Not a general-purpose unload engine:** Unraid plugins are not containers. There is no universal, guaranteed reversible way to remove arbitrary plugin hooks, kernel modules, cron tasks, or patches at runtime. Plugin Switch will *not* infer a safe stop command from a service name alone. It does not automatically test third-party stop/start operations, auto-install arbitrary adapters, discover all dependencies, or guarantee zero-downtime deactivation.

## Links

- [Source and development branch](https://github.com/alexphillips-dev/Plugin-Switch/tree/dev)
- [Current development installer (`.plg`)](https://raw.githubusercontent.com/alexphillips-dev/Plugin-Switch/dev/plugin.switch.plg)
- [Full release changelog](https://github.com/alexphillips-dev/Plugin-Switch/blob/dev/CHANGELOG.md)
- [Issues and bug reports](https://github.com/alexphillips-dev/Plugin-Switch/issues)
- [Build and regression tests](https://github.com/alexphillips-dev/Plugin-Switch/actions)

**Author:** [alexphillips-dev](https://github.com/alexphillips-dev) · **License:** MIT · **Platform targeted by the manifest:** Unraid 7.0 or newer.

# How It Works

[Home](Home) · [Compatibility Scanning](Compatibility-Scanning) · [Safety & Recovery](Safety-and-Recovery)

## Unraid plugin lifecycle vs runtime lifecycle

Unraid plugins are installed from `.plg` XML manifests, and Unraid tracks successfully installed plugin definitions using symlinks under `/var/log/plugins/`. The boot flash normally stores the definitions in `/boot/config/plugins/*.plg`. On boot, Unraid processes those manifests to install their components again into the running OS.

A `.plg` may create a service, WebGUI pages, packages, cron entries, kernel components, or global hooks. **There is no universal Unraid “pause this plugin” API.** Merely moving a `.plg` stops future boot loading, but it does not undo currently running services or modifications.

Plugin Switch therefore separates:

1. **Registration state:** the plugin definition is installed vs parked.
2. **Runtime status:** whether a verified adapter reports `enabled` or `disabled`.
3. **Control eligibility:** whether a trusted reversible control method has passed checks.
4. **Discovery evidence:** indicators collected from static manifest inspection; not authorization to execute commands.

## Files and paths

| Location | Role |
|---|---|
| `/boot/config/plugins/*.plg` | Manifest definitions Unraid loads at startup |
| `/var/log/plugins/*.plg` | Unraid's installed-plugin tracking symlinks |
| `/boot/config/plugins/plugin.switch/disabled/*.plg` | Parked definitions; excluded from Unraid's top-level boot scan |
| `/boot/config/plugins/plugin.switch/adapters/*.sh` | Administrator-provided local live-control scripts |
| `/boot/config/plugins/plugin.switch/safety.json` | Optional administrator protection and dependency rules |
| `/boot/config/plugins/plugin.switch/transactions/*.json` | Persistent in-progress operation journals |
| `/boot/config/plugins/plugin.switch/history.json` | Bounded completed-operation history |
| `/run/plugin-switch/` | Volatile lock files, same-boot markers and scan/update caches |
| `/usr/local/emhttp/plugins/plugin.switch/` | Plugin Switch runtime code delivered by the installer |

Paths under `/boot` survive reboot. Files under `/run` do not. If a plugin is parked across a reboot, its same-boot restore marker is lost and re-enablement must use Unraid's install lifecycle.

## Disable: verified live control only

After user confirmation, the controller acquires an exclusive lock and checks protection/dependency policy. It then verifies that a trusted adapter exists, records a transaction, reads the original runtime state, and (if required) invokes the adapter's `stop` action. After a successful status verification, it parks the `.plg`, unregisters the tracking symlink, and writes the same-boot marker. The completed operation is recorded in history.

**The plugin is not uninstalled.** Its configuration directory is left in place. However, the adapter author must ensure that stopping the runtime actually disables all relevant side effects (including timers, cron entries and auto-restarts).

## Enable in the same boot

When the same-boot marker exists, the controller restores the manifest and Unraid registration symlink, calls the adapter's `start` action if needed, verifies status, and clears the marker. This avoids a full reinstall when the runtime files are still present.

## Enable after a reboot

The runtime marker is volatile, so enabling a parked plugin after a reboot is a different path. The controller attempts Unraid's official `plugin install` lifecycle using the parked definition, then validates the runtime adapter. **Reinstallation may execute the third-party plugin's install scripts** and is not guaranteed to be idempotent. Failures can leave an interrupted transaction requiring manual inspection.

## When something fails

Each operation records phases such as runtime stopped, manifest parked, reinstalled or restored. The controller attempts a **best-effort** rollback. Failed or uncertain states are not presented as completed operations. An interrupted journal blocks further toggles until recovery.

Read [Safety & Recovery](Safety-and-Recovery) before testing stop/start adapters. Emergency recovery only returns parked definitions to the **next boot** scan; it is not an in-place runtime restart.

## What the scanner does not do

It does not automatically execute `remove` hooks, call arbitrary discovered services, probe every process on the host, or attempt plugin cleanup by guessing. It cannot determine all inter-plugin dependencies from static XML alone.

For the component layout, see [Architecture](Architecture).

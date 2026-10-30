# Plugin Switch (development preview — 2026.10.29.9)

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

Build the manifest with `python3 tools/build.py --branch dev` if editing `src/` locally.

### Branch-aware installation and updates

Each release branch contains its own generated `plugin.switch.plg` whose `pluginURL` is pinned to that branch. Installing the **dev** manifest stays on **dev** for Unraid's built-in update checks. Promoting to **main** requires generating `python3 tools/build.py --branch main` on the main release branch; then stable installations stay on **main**. **Do not use the main URL before a release has been published to main.**

- Development: `https://raw.githubusercontent.com/alexphillips-dev/Plugin-Switch/dev/plugin.switch.plg`
- Stable (once published): `https://raw.githubusercontent.com/alexphillips-dev/Plugin-Switch/main/plugin.switch.plg`

The internal plugin ID **must remain `plugin.switch`** so existing installations and config paths aren't broken. The native Plugins page reads the visible title/description from the bundled `/usr/local/emhttp/plugins/plugin.switch/README.md`; this file begins with **Plugin Switch**. The manifest author is **alexphillips-dev**, and the bundled description includes the current update channel.

`tools/build.py --check --branch dev` (or `main`) verifies that the pinned manifest matches its intended branch.

### If the dev install URL does not work

The development manifest is a **raw XML .plg file**, not a graphical installer. In Unraid, open **Plugins → Install Plugin**, paste the URL exactly, and select **Install**. Do not paste a GitHub `/blob/` or `/tree/` page.

```text
https://raw.githubusercontent.com/alexphillips-dev/Plugin-Switch/dev/plugin.switch.plg
```

If it still fails, run these diagnostic commands from the **Unraid terminal**:

```bash
curl -fL --connect-timeout 10 --max-time 30 \
  -o /tmp/plugin.switch.plg \
  https://raw.githubusercontent.com/alexphillips-dev/Plugin-Switch/dev/plugin.switch.plg
head -n 8 /tmp/plugin.switch.plg
plugin install /tmp/plugin.switch.plg
```

The first command must download XML beginning with `<?xml`. The installer output should include a concrete error if it fails. You can also check `/var/log/syslog` for `plugin-manager` messages. If the download fails, check Unraid DNS, HTTPS access, and filtering of `raw.githubusercontent.com`. Do not disable DNS/security filtering broadly to work around a plugin install.

**Upgrade fix in 2026.10.29.3:** All embedded files now carry SHA-256 hashes. Unraid's installer otherwise skips files that already exist, leaving older PHP and JavaScript in place even when the plugin version advances. The manifest is still branch-pinned to `dev`.

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

## Automatic compatibility discovery (2026.10.29.4)

The Plugins page now shows read-only scan results plus a **Scan compatibility** button and **Export report** button. The scanner runs without stopping plugins, executing their install/uninstall hooks, or inspecting unrelated process command lines.

- **Live:** a trusted local administrator adapter or a reviewed *bundled profile* with exact manifest and adapter SHA-256 hashes has passed a runtime status check. Live toggle unlocked.
- **Review required:** possible service start/stop references detected, or a previously-reviewed manifest changed. Toggle remains locked.
- **Next boot:** no confirmed reversible live controls found. Toggle locked; this classification is informational, not an implemented scheduling action.
- **Protected:** core OS/Plugin Switch cannot be toggled.
- **Scanned:** read-only analysis uses manifest evidence and 5-minute RAM-disk cache, refreshed when content or the profile registry changes. Manually rescan any time.

Evidence includes candidate service scripts, potential scheduler/kernel/network/storage/global hook interactions, the exact manifest fingerprint, and matching profile status. Scanner findings are hints, not proof a plugin can be live-disabled.

### Phases delivered

1. **Discovery:** read-only bounded manifest XML inspection, service references, hazard signals, persisted /run cache, manual rescan, expandable per-plugin report.
2. **Verified control engine:** local adapters remain supported; bundled reviewed profiles can automatically provide live control only if both a specific plugin manifest and adapter file match pinned SHA-256 hashes. A lifecycle integration test uses a disposable synthetic plugin. **No unaudited third-party plugin has been enabled by default.**
3. **Expandability:** `src/profiles.json` is the audited catalog; `src/builtin-adapters/*.sh` packages reviewed adapters; `profiles/README.md` documents review and submission procedures. The UI exports on-device evidence to support future plugin reviews. No telemetry or automatic remote fetching.

**Important:** The installed plugin ecosystem is not standardized. Discovering a `start/stop` script does NOT mean all scheduled tasks, WebGUI hooks, packages or kernel modifications are reversible. We do not ship fabricated compatibility profiles. Profiles for popular plugins require source review and a real Unraid test cycle before being approved.

## 2026.10.29.5 — Scan CSRF and compact column

- **Scan compatibility** is a read-only `GET /plugins/plugin.switch/api.php?rescan=1` request. It does not require a CSRF token because it performs no server-side user configuration changes (only refreshes bounded /run discovery cache).
- Live enable/disable remains **POST only**, protected by the existing Unraid WebGUI authentication and native CSRF middleware. Unraid checks and removes `csrf_token` before dispatch; plugins must not validate the removed field again.
- **Enabled** column now shows just the switch and a single icon. There are no extra text lines or nested "Why?" expansion in table rows. Clicking the icon opens a compact compatibility details panel that can be closed by clicking outside, Escape, or the close button.
- A lock icon indicates live control isn't validated; the switch stays ON if the plugin is installed, but cannot be clicked until a verified adapter becomes available. The information panel explains why.
- Rebuild the dev manifest with `python3 tools/build.py --branch dev`; all files are SHA-256-pinned for reliable upgrades.

Use a hard browser refresh after upgrading if the older table appears cached. Production/real-Unraid testing still required.

## 2026.10.29.6 — Responsive modal and native-theme isolation

The Enabled cell is now a compact **switch plus 15px lock/info icon**, rendered within a Shadow DOM boundary to keep Unraid's global checkbox and button styles from adding unwanted checkmarks, boxes, padding, or layout rules. The switch uses an accessible `role="switch"` button with `aria-checked` rather than a styled HTML checkbox; its ON state still represents installed state, and unsupported controls stay locked.

Clicking the lock/info icon opens a centered, theme-independent modal with a readable plugin title, state badges, clear compatibility explanation, comfortably spaced label/value rows, and a **dedicated scrollable body**. The modal limits its height to the viewport, supports narrow screens with stacked fields, and closes using Escape, the Close button, or clicking outside. This corrects the previous tiny floating panel with compressed vertical lettering and inaccessible scrolling.

UI compatibility details are escaped before insertion; the modal has dialog semantics and keyboard focus handling. Tests verify Shadow DOM isolation, modal structure, responsiveness, and the absence of native checkbox markup.

## 2026.10.29.7 — Center the Enabled cell controls

The toggle and adjacent lock/info icon are positioned together at the **true center of each Enabled table cell** instead of relying on the native table column's asymmetric padding and inherited alignment. This changes only the Enabled column layout; the accessible switch behavior, compatibility scanner, and modal remain unchanged. Added regression coverage for cell positioning and horizontal/vertical centering.

## 2026.10.29.8 — Explicit left alignment

The Enabled cell now places the **switch + lock/info icon 12px from the left side of the cell**, rather than centering it using a percentage-based absolute position. The isolated group is a fixed 68px wide, uses `justify-content:flex-start`, and remains vertically centered. This avoids inherited Unraid table padding and gives a visible leftward adjustment. The compatibility modal and control semantics are unchanged.

## 2026.10.29.9 — Reliability and safety improvements

- Persistent, atomic transaction journals for live toggles with best-effort synchronous rollback. Pending/incomplete operations lock further toggles until inspected.
- **Recovery** action prepares disabled and interrupted manifests to load after a future reboot. It deliberately never runs unknown plugin installers or restarts services immediately.
- Administrator-managed `safety.json` supports protected plugins and explicit known `depends_on` relationships. See `docs/SAFETY.md`. Dependencies are not guessed from process names.
- Verified adapter runtime status probes run concurrently (maximum four, each independently timed out); discovery remains read-only with fingerprint caching.
- User-facing compatibility label **Unverified** replaces the misleading Next boot count. Discovery of a service alone never unlocks live control.
- **Check updates** reports installed version, published version, pinned dev/main branch, and last check result, with a remote URL allowlist and bounded timeout. Does not run on page load.
- **Scan compatibility** and **Export report** are grouped on the far right of the toolbar, with CSS `!important` inline overrides for Unraid themes.
- `tools/profile_review.py` prepares candidate hashes for reviewed adapters but never adds unvalidated profiles automatically.
- CI tests expanded to cover recovery, interruption, dependencies, status probes, version parsing, packaging and toolbar placement.

**Important:** The real third-party compatibility registry remains empty until plugins are individually audited and exercised on a disposable Unraid installation. This prevents unsafe claims about arbitrary live plug-in control.

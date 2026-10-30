# Changelog

All user-visible changes to Plugin Switch are recorded here, newest first. This is the canonical release history; the [README](README.md) is a short project overview and the [Wiki](https://github.com/alexphillips-dev/Plugin-Switch/wiki) explains the current behavior rather than duplicating release notes.

Releases use `YYYY.MM.DD.PP` and **zero-pad** the patch from the start of each release date, as FolderView Plus does. The package manifest pins the update channel and a versioned, checksummed archive. Some older development builds that used unpadded patches may require a one-time manual refresh; consult the [Update Guide](https://github.com/alexphillips-dev/Plugin-Switch/wiki/Updates-and-Release-Channels).

## [2026.10.29.11] - 2026-10-29
### Fixed
- Removed the temporary .90 release from the active development update channel and resumed the sequential patch format.
- Switched release delivery to a versioned, SHA-256/MD5-verified .txz package and branch-pinned .plg manifest, following FolderView Plus.
- Added a user-initiated, cache-busted force-refresh helper for installations whose prior manifest or legacy patch ordering prevents Unraid's native update detection.
- Kept the Plugin Switch diagnostic update check aligned with FolderView Plus: numeric version comparison, network response details, and a separate indicator for Unraid's native update visibility.
### Development
- Added reproducible package generation and a package integrity/update-channel test suite.
- Added per-release notes in docs/releases and retained CHANGELOG.md as the canonical cumulative history.

## [2026.10.29.10] - 2026-10-29
### Fixed
- Preserve the original running/stopped state during rollback of a failed disable; do not start a plugin that was already stopped.
- Avoid clearing recovery state after an incomplete enable until the parked plugin is verified stopped.
### Tests
- Added a failed-disable regression covering an already-stopped plugin and a conflicting parked manifest.

## [2026.10.29.9] - 2026-10-29
### Added
- Persistent per-plugin operation journal and best-effort rollback.
- Recovery dialog and guarded next-boot restoration for parked/interrupted plugin manifests. Recovery does not execute plugin installers or restart runtime services immediately.
- Administrator-configured `safety.json` protected-plugin and explicit `depends_on` rules; protection is not inferred from scanner hints.
- Bounded parallel runtime-status probes (up to four concurrent checks) and timeout handling.
- Development update-channel diagnostics (installed/published versions, `dev`/`main` and last check), via allowlisted URLs.
- Profile review helper and expanded integration tests for dependency, recovery, version and status functionality.
### Changed
- Grouped Scan compatibility and Export report controls at the right edge of the toolbar.
- Renamed misleading "Next boot" compatibility classification to "Unverified" for plugins with no validated live-control method.

## [2026.10.29.8] - 2026-10-29
### Fixed
- Positioned the toggle/lock group with a 12px left inset to counter Unraid's table-cell padding and alignment, retaining the successful UI layout.

## [2026.10.29.7] - 2026-10-29
### Changed
- Tried percentage-based cell centering and added positioning assertions. Superseded by the left-inset approach in `.8`.

## [2026.10.29.6] - 2026-10-29
### Fixed
- Replaced theme-affected checkbox/buttons with Shadow DOM-isolated custom toggle and lock/info controls.
- Replaced the narrow details popover with a centered, scrollable, accessible modal, including viewport-height limits, mobile layout, keyboard close, and focus handling.
### Tests
- Added UI regression checks for modal scrolling, theme isolation and removal of native checkbox markup.

## [2026.10.29.5] - 2026-10-29
### Fixed
- Read-only compatibility scans use GET; state-changing requests continue to rely on Unraid's native CSRF middleware.
- Removed incorrect second CSRF verification after Unraid had already consumed the token.
- Reduced Enabled-column clutter and introduced separate compatibility details.
### Tests
- Added request and layout regression tests.

## [2026.10.29.4] - 2026-10-29
### Added
- Read-only manifest scanner for service candidates and risk signals (scheduler, kernel, networking, storage, WebGUI and uninstall hooks).
- Manifest-fingerprint discovery cache, manual rescan, compatibility summary, detail reports and local JSON export.
- Hash-pinned compatibility profile registry, explicit local adapter trust path, and a disposable start/stop integration fixture.
### Safety
- Candidate discovery does **not** unlock live controls. No unaudited third-party profiles are bundled.

## [2026.10.29.3] - 2026-10-29
### Fixed
- Added SHA-256 checksums to inline .plg payloads so Unraid replaces changed PHP/JS/README files instead of silently leaving old files in place.
- Added checksum validation to automated packaging tests.
### Documentation
- Added terminal-based installer diagnostics, with the expected `plugin.switch.plg` basename.

## [2026.10.29.2] - 2026-10-29
### Added
- Branch-pinned `pluginURL` generated for `dev` or `main` releases.
- Unraid display metadata: visible Plugin Switch title, GitHub author `alexphillips-dev`, description README and support link.
### Tests
- Added branch URL and metadata checks.

## [2026.10.29.1] - 2026-10-29
### Fixed
- Installed plugin toggles show ON regardless of whether a runtime adapter exists; installation and live-control support are separate states.
- Added diagnostics for missing, unsafe or malfunctioning adapters.
- Improved client-side asset cache refresh.
### Tests
- Enforced date-based `YYYY.MM.DD.patch` syntax.

## [2026.10.29-dev1] - historical development preview
### Added
- Initial Plugins-tab Enabled column, native WebGUI integration, PHP controller and opt-in adapter contract.
- Manifest parking for next boot, same-boot re-enable, basic operation safety checks and branch `dev` packaging.
- No universal live unload operation or third-party adapters were provided.

# User Interface

[Home](Home) · [Getting Started](Getting-Started) · [Compatibility Scanning](Compatibility-Scanning)

Plugin Switch integrates into Unraid's existing **Plugins → Installed Plugins** table. It does not replace Unraid's updater or uninstall controls.

## Enabled column

Each managed row shows a compact switch and a lock/info icon.

| Display | Meaning | User action |
|---|---|---|
| **ON** | Plugin definition is registered as installed and normally participates in boot startup | Not proof its runtime service is active |
| **OFF** | Plugin definition has been parked outside Unraid's boot-time `.plg` scan | Re-enable requires an available trusted adapter/control path |
| **Locked switch** | Runtime control is unverified, protected, invalid, or otherwise unavailable | Click the adjacent lock for details; do not assume the plugin is broken |
| **Unlocked switch** | Controller has an eligible adapter/profile and verified runtime status | Click to request a live operation; confirmation is required |
| **Info/lock icon** | Opens a compatibility details modal | Read detected evidence and restrictions |

The controls are intentionally positioned toward the left inside the Enabled cell so they work with Unraid's native table styling. The details modal uses separate styling, a scrollable body, and Escape/close/outside-click dismissal.

## Compatibility details modal

The modal describes the current registration state, compatibility classification, reason, service candidates, signals (e.g. scheduler, kernel or storage references), profile result, control source, and scan timestamp.

**Interpretation:** A detected service is only evidence that the plugin *might* have runtime controls. It does not mean those controls are safe. Risk signals are text-pattern matches in a plugin manifest, **not** proof that the detected action is currently executing.

## Toolbar

The controls are grouped on the far right; the compatibility summary remains separate on the left.

| Control | What it actually does |
|---|---|
| **Scan compatibility** | Re-runs read-only manifest discovery and refreshes the on-device `/run` scan cache |
| **Export report** | Downloads a local JSON report; Plugin Switch does not upload it |
| **Check updates** | On demand, checks the selected `dev` or `main` manifest for a published version; informational only |
| **Recovery** | Shows pending operations and recent outcomes; offers next-boot manifest restoration with explicit confirmation |

The initial Plugins-page load also reads compatibility state. Updating the page or performing a scan may refresh the cached results; it does **not** run a stop/start operation.

## Classification vocabulary

- **Live control available:** Verified control path and acceptable runtime status. The switch may be unlocked.
- **Needs review / candidate:** Scanner found potential controls or a previously verified manifest changed. The switch is locked.
- **Unverified / no verified live control:** No approved live control is known. Locked.
- **Protected:** Core or explicitly protected component. Locked.
- **Recovery required:** An interrupted operation has a pending journal. Further toggles are blocked until safely resolved.

Some terms in the modal come from the scanner and others from runtime verification. If they differ, **the actual unlock decision is authoritative**: a candidate never gets a live toggle just by being detected.

See [Live Control & Adapters](Live-Control-and-Adapters) for what is required before a toggle becomes usable.

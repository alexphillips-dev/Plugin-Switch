# Frequently Asked Questions

[Home](Home) · [Getting Started](Getting-Started) · [Troubleshooting](Troubleshooting)

### Why are all my switches ON but locked?

ON represents installation/boot registration. Locked means no verified runtime-control method is available. The packaged third-party profile list is currently empty. This is expected rather than a failed compatibility scan.

### Can Plugin Switch disable any Unraid plugin without rebooting?

**No.** Unraid plugins are not isolated services. Some modify kernel drivers, the WebGUI, cron, networking, storage or global system hooks. A safe live toggle requires an audited, reversible adapter or profile. Discovery alone cannot certify one.

### Why isn't “plugin remove” used to disable something temporarily?

Uninstall hooks may delete configuration or modify shared resources. They are not a safe generic stop method. Plugin Switch keeps plugin settings and uses verified start/stop adapters where supported.

### Will a disabled plugin remain disabled after reboot?

Its `.plg` definition is parked outside Unraid's top-level startup scan, so it will not be automatically installed by that scan. This does **not** guarantee every side effect left by the plugin has disappeared from the runtime; the adapter must handle that.

### Can I re-enable it without rebooting?

For an eligible adapter: the controller can restore it during the same boot. After a reboot, the operation may need Unraid's plugin installer and can execute third-party install scripts. There is no blanket guarantee across all plugin types.

### Does Plugin Switch uninstall, overwrite or clear a plugin's settings?

Normal disable keeps the plugin's configuration directory. It does not call `plugin remove` as a generic pause. But a third-party adapter or future reinstallation may have side effects; review its implementation. Always keep a backup.

### What does “Needs review” mean?

Static manifest inspection found possible controls or profile drift. It means **not yet verified**, not “safe enough to try.” The toggle stays locked until approval and runtime checks succeed.

### What does “Unverified” mean?

No audited reversible runtime control is available for that plugin. It is **not** equivalent to “Disable on next boot” and does not offer an automatic next-boot action in the ordinary toggle.

### Does “Scan compatibility” modify running services?

No. It reads bounded manifest content and refreshes a volatile scan cache. It does not run discovered install, uninstall or service commands. Verified `status` adapters are executed separately when reporting actual eligible controls.

### Does “Export report” send data somewhere?

It downloads a JSON snapshot locally through your browser. No telemetry upload is part of this feature. Review it for potentially sensitive inventory details before sharing.

### What is the Recovery button for?

For interrupted or parked plugin manifests. **Restore next boot** returns the `.plg` definitions to Unraid's future boot scan. It does not restart services or reboot the server right now. Read [Safety & Recovery](Safety-and-Recovery).

### Why is there a `dev` install link but no stable release?

The `dev` branch contains the documented development build. `main` is intended for future stable builds, but a stable `.plg` should not be assumed to exist until it is published. See [Updates & Release Channels](Updates-and-Release-Channels).

### Why doesn't Unraid recognize the newest version immediately?

Unraid performs its own network and version checks, which may fail or cache results. Inspect the installed manifest and use **Check updates** for branch/version diagnostics. See [Troubleshooting](Troubleshooting).

### Is Plugin Switch safe for a production server?

It is a development preview. The scanner is read-only, but privileged live-control and manifest operations can be disruptive. Test in a lab first, use only verified adapters, keep flash backups, and never assume that a passing unit test certifies a production plugin.

### How can I help support more plugins?

Submit a reproducible adapter review with exact plugin version, source audit, dependencies, stop/start/status implementation, rollback testing and a pinned digest. See [Contributing](Contributing).

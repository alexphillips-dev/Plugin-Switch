# Getting Started

[Home](Home) · Next: [User Interface](User-Interface)

## Before installing

Plugin Switch is a **development-preview Unraid 7.x plugin**. The `.plg` manifest specifies a minimum Unraid version of **7.0.0**; this is a package constraint, **not** a claim of device-level testing on every Unraid 7 release. Use a lab server where possible.

Recommended precautions:

1. Make a current, restorable backup of your Unraid flash configuration. Know how to boot without a problematic plugin.
2. Ensure you can reach the Unraid console or SSH if the WebGUI is unavailable.
3. Read [Safety & Recovery](Safety-and-Recovery), especially the distinction between a plugin's manifest and its running components.
4. Avoid testing new adapters on plugins that manage storage, network access, security controls, or hardware drivers.

## Install the dev build

In Unraid, navigate to **Plugins → Install Plugin** and paste **the raw `.plg` URL**, not a GitHub `/blob/` page:

```text
https://raw.githubusercontent.com/alexphillips-dev/Plugin-Switch/dev/plugin.switch.plg
```

Alternatively, use the Unraid terminal:

```bash
curl -fL --connect-timeout 10 --max-time 30 \
  -o /tmp/plugin.switch.plg \
  https://raw.githubusercontent.com/alexphillips-dev/Plugin-Switch/dev/plugin.switch.plg

head -n 8 /tmp/plugin.switch.plg
plugin install /tmp/plugin.switch.plg
```

The downloaded file should begin with `<?xml` and contain a `PLUGIN` manifest referencing a versioned, checksummed `.txz` package. The installer downloads and installs that archive. Observe the installer output for errors; do not treat a downloaded file as proof of successful installation.

## Verify the installation

1. Return to **Plugins → Installed Plugins** and confirm **Plugin Switch** appears. The internal plugin ID remains `plugin.switch`.
2. Confirm the new **Enabled** column. Most existing plugins may show **ON with a lock**, which is expected.
3. Use **Scan compatibility** to inspect the installed plugin manifests. Scanning is read-only with respect to plugin services; see [Compatibility Scanning](Compatibility-Scanning).
4. Click a **lock/info** icon to inspect the compatibility explanation.
5. Optionally use **Export report** to download a JSON snapshot for review or bug reporting. Examine it for system-specific information before sharing.

## What to expect on first use

The built-in verified-profile registry currently contains **zero approved third-party profiles**. This means common plugins are **not automatically live-toggleable** just because they have an init script. Locked toggles are a safety feature, not a failed installation.

The **Enabled** switch shows Unraid registration/boot intent. It is not an all-purpose service health indicator. See [User Interface](User-Interface) and [How It Works](How-It-Works).

## Updating

For an installation sourced from `dev`, the manifest's `pluginURL` points back to `dev`. Use Unraid's **Check For Updates** or Plugin Switch's **Check updates** diagnostics. The latter reports information but does not install releases.

If Unraid does not detect an update, inspect [Updates & Release Channels](Updates-and-Release-Channels), then use **Check updates → Copy refresh commands**. This copies a cache-busted manifest download plus `plugin install /tmp/plugin.switch.plg forced` for a deliberate one-time refresh. Check that the downloaded manifest points to the intended branch before running it; do not delete persistent plugin settings to force a refresh.

## Uninstall carefully

**Restore any parked plugins before uninstalling Plugin Switch.** The current uninstall hook removes Plugin Switch's runtime WebGUI files but deliberately keeps `/boot/config/plugins/plugin.switch/` and its persisted recovery data. That includes parked plugin manifests. Uninstalling Plugin Switch does **not** automatically reactivate them.

Before removing Plugin Switch, use its **Recovery → Restore next boot** workflow, inspect which manifests were restored, and plan a reboot. If the plugin is already gone, see [manual recovery](Safety-and-Recovery#manual-recovery-when-the-webgui-is-unavailable). Do not remove the `plugin.switch` config directory while it contains disabled manifests you still need.

## Getting help

Include the installed Plugin Switch version, Unraid version, relevant error text, whether the problem happens during scan or toggle, and relevant logs. See [Troubleshooting](Troubleshooting) and open an [issue](https://github.com/alexphillips-dev/Plugin-Switch/issues).

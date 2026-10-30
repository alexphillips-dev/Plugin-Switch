# Troubleshooting

[Home](Home) · [Getting Started](Getting-Started) · [Safety & Recovery](Safety-and-Recovery)

**First principle:** Do not repeatedly toggle a plugin when the controller reports a failed operation or pending recovery. Preserve logs and review the current state before further changes.

## Installation URL does not work

Use the **raw `.plg` URL**, not a GitHub page URL:

```text
https://raw.githubusercontent.com/alexphillips-dev/Plugin-Switch/dev/plugin.switch.plg
```

Diagnose download separately from installation:

```bash
curl -fL --connect-timeout 10 --max-time 30 \
  -o /tmp/plugin.switch.plg \
  https://raw.githubusercontent.com/alexphillips-dev/Plugin-Switch/dev/plugin.switch.plg
head -n 12 /tmp/plugin.switch.plg
plugin install /tmp/plugin.switch.plg
```

If `curl` fails, inspect DNS, outbound HTTPS, and filtering for `raw.githubusercontent.com` on your Unraid system. If the installer fails, retain the exact installer output and inspect the system log; do not delete installed config directories indiscriminately.

## All toggles are ON but locked

This is currently expected for most third-party plugins. **ON = installed/registered**, while **locked = no verified live-control adapter**. The built-in third-party profile list currently has no approved entries. Click the lock to inspect scan evidence. A service candidate does not automatically unlock the toggle.

## Scan compatibility fails or shows stale results

- Confirm you're running a recent dev build; a prior release had a duplicate CSRF validation problem.
- Reload the Plugins page, then try **Scan compatibility** again.
- Inspect the error message and relevant `webGUI`/PHP log entries.
- A scan reads manifests and refreshes the `/run` cache; it should not stop a service.
- Large or malformed manifests may be reported as unverified rather than scanned fully.
- If the error persists, download **Export report** if it is still accessible and attach sanitized evidence to an issue.

## Update not detected

Use **Check updates** to compare installed and published versions, including their native-Unraid visibility and response diagnostics. Plugin Switch follows FolderView Plus's numeric version check; Unraid's third-party plugin manager uses string ordering. See [Updates & Release Channels](Updates-and-Release-Channels). Verify `pluginURL` points to `dev`. If the native update is hidden by legacy patch formatting or an abandoned development build, use the copyable forced-refresh helper to install the reviewed, cache-busted manifest. Confirm that both the `.plg` and its versioned `.txz` archive are available on the same branch.

## Plugin reports “Adapter error”

A trusted adapter was found, but `status` did not return **exactly** `enabled` or `disabled` with exit code 0, or it failed/timed out. The switch remains locked. Check script ownership, permissions, its output, and the real service state. Never make the check always say “enabled” merely to unlock the button.

## “Needs review” or “Profile version drift”

The scanner found possible service controls or the plugin manifest differs from a previously reviewed hash. Review the new manifest and adapter behavior before updating the bundled profile. Modifying a hash to silence the warning is not a safe fix.

## “Recovery required”

A prior operation left a journal entry. Open **Recovery** and review the pending phase and any skipped paths. The next-boot restore action does not restart services now. Read [Safety & Recovery](Safety-and-Recovery) before touching transaction files manually.

## Plugin is parked but still running

A stopped adapter should prevent all relevant runtime functionality; a plugin can also have cron tasks, WebGUI hooks or shared processes. If those are still active, the adapter may not provide complete live control. Disable further toggling and inspect the plugin's lifecycle instead of assuming the manifest move removed everything.

## Useful local checks

```bash
# Installed/plugin-boot definition
ls -l /boot/config/plugins/plugin.switch.plg
ls -l /var/log/plugins/plugin.switch.plg

# Parked manifests and transaction history
ls -la /boot/config/plugins/plugin.switch/disabled/
ls -la /boot/config/plugins/plugin.switch/transactions/

# General Unraid diagnostics (review before sharing)
# Tools → Diagnostics in the Unraid WebGUI
```

The plugin's **Export report** contains plugin inventory and compatibility evidence. System diagnostics may contain hostnames, network addresses, mount paths, tokens or other sensitive material. Redact before sharing publicly.

## Reporting a useful issue

Include Unraid version, Plugin Switch version and branch, steps to reproduce, expected vs actual behavior, relevant error text, whether the plugin was installed/parked, and sanitized compatibility evidence. If the issue involves a live adapter, include the exact plugin manifest revision and adapter source with secrets removed.

[Open an issue](https://github.com/alexphillips-dev/Plugin-Switch/issues).

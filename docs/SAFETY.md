# Plugin Switch safety and compatibility policies

Optional administrator configuration lives at:
`/boot/config/plugins/plugin.switch/safety.json`

Example:

```json
{
  "protected": ["unassigned.devices.plg"],
  "depends_on": {
    "consumer.plg": ["provider.plg"]
  }
}
```

`protected` names are exact `.plg` basenames. An enabled dependent blocks
the provider from being disabled. Plugin Switch never assumes dependencies
based solely on matching process names. Keep the configuration root-owned
and review it before applying changes.

The critical Unraid OS and Plugin Switch identifiers are always protected.
The dependency map is an **explicit administrator policy**, not inferred truth.

## Recovery

A per-plugin transaction journal is written to the flash device under
`/boot/config/plugins/plugin.switch/transactions/` during start/stop. The
journal records durable phases. If an operation fails, the controller tries
to return the runtime and manifest to the original state. When rollback
cannot be verified, the journal remains to block additional toggles.

From the Plugins tab open **Recovery**. The emergency Restore action
reinstates parked `.plg` files to the next boot scan, including interrupted
operations when unambiguous. **It does not start services, execute install
scripts, or reboot the server.** Review the result and then reboot manually.

Log history is capped at the last 100 outcomes. Operations on flash are
kept to explicit user-triggered state changes, not periodic scans.

## Status and update diagnostics

The compatibility scan uses bounded XML inspection with content fingerprints
and a short /run cache. Verified runtime adapters are probed concurrently
with a maximum of four processes and individual timeouts.

The **Check updates** button reports the installed version, pinned branch,
latest published version, and last check result using a narrow allowlist of
the project's own dev/main manifest URLs. No remote update checks run
automatically when opening the Plugins page.

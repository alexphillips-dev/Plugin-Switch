# Configuration Reference

[Home](Home) · [Safety & Recovery](Safety-and-Recovery) · [Architecture](Architecture)

Plugin Switch intentionally has few settings. Most behavior is driven by installed manifests and the availability of audited runtime-control adapters.

## Administrator safety policy

**Path:** `/boot/config/plugins/plugin.switch/safety.json`

This JSON file is optional. It is read by the controller when deciding whether a disable action should be allowed. Create it using a text editor or command line with trusted administrative access. It is **not** an auto-generated map of dependencies.

```json
{
  "protected": [
    "important-plugin.plg"
  ],
  "depends_on": {
    "consumer.plg": ["provider.plg"]
  }
}
```

| Key | Format | Effect |
|---|---|---|
| `protected` | Array of exact `.plg` basenames | Prevents those plugins from being disabled |
| `depends_on` | Object mapping a dependent plugin to arrays of required plugin basenames | Prevents disabling a provider while an identified dependent is installed/enabled |

`consumer.plg → provider.plg` means the consumer **requires** the provider. If the consumer is active, disabling the provider is blocked. Only include dependencies you have investigated and can justify. Incorrect rules may either block legitimate operations or fail to protect real dependencies.

The system protects its own `plugin.switch.plg` and Unraid core `unRAIDServer.plg` identifier regardless of this file. User-provided JSON does not replace these protections.

### Recommendations

- Keep `safety.json` root-owned and limit write access; it influences privileged operations.
- Back it up with your flash configuration.
- Use **exact manifest filenames** (`.plg`), not displayed plugin titles or arbitrary service names.
- Do not make a broad wildcard-like protection rule; the implementation currently uses exact string matches.
- Treat changes as immediately relevant to subsequent state checks; there is no separate Apply button.

## Paths and storage

| Path | Storage | Purpose |
|---|---|---|
| `/boot/config/plugins/plugin.switch/adapters/` | Flash (persistent) | Local trusted `.sh` adapters |
| `/boot/config/plugins/plugin.switch/disabled/` | Flash (persistent) | Parked `.plg` definitions |
| `/boot/config/plugins/plugin.switch/transactions/` | Flash (persistent) | Per-plugin interrupted operation journals |
| `/boot/config/plugins/plugin.switch/history.json` | Flash (persistent) | Recent completed operation history (up to 100 entries) |
| `/boot/config/plugins/plugin.switch/safety.json` | Flash (persistent) | Optional protection/dependency policy |
| `/run/plugin-switch/discovery/` | RAM / volatile | Bounded scan cache |
| `/run/plugin-switch/update.json` | RAM / volatile | On-demand update-check result |
| `/run/plugin-switch/*.plg` | RAM / volatile | Same-boot restore markers |
| `/usr/local/emhttp/plugins/plugin.switch/` | Runtime system | Plugin Switch WebGUI, API and bundled registry |

Do not manually modify the transaction journal or installed-plugin symlinks during a normal operation. A manual recovery should be guided by [Safety & Recovery](Safety-and-Recovery).

## Local adapter naming

For `sample.plg`, the adapter is expected at:

```text
/boot/config/plugins/plugin.switch/adapters/sample.sh
```

It must be root-owned, a regular file, no larger than 64 KiB and not group/world writable. See [Live Control & Adapters](Live-Control-and-Adapters) for behavior and trust boundaries.

## Scanner parameters

Current implementation uses the following hard-coded defaults (these are **not** configurable UI settings):

| Setting | Current value |
|---|---|
| Manifest scan upper bound | 2 MiB per `.plg` |
| `FILE` elements considered | Up to 300 |
| Static discovery cache lifetime | 300 seconds |
| Candidate service references | Up to 12 |
| Concurrent runtime probes | Four by default (pool clamps to 1–6) |
| Individual pooled status command | Five-second timeout (with an additional kill grace) |
| On-demand update check | Three-second connect; eight-second overall timeout |
| Update result cache | 10 minutes |

If new options are added in a later version, this page should be updated with their actual configuration mechanism.

## No remote telemetry

The scanner reads local plugin definitions. **Export report** saves JSON to your browser; the tool does not send it to GitHub. **Check updates** performs a separate, user-requested HTTPS read to the branch-pinned GitHub raw manifest URL.

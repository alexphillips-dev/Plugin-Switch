# Compatibility Scanning

[Home](Home) · [User Interface](User-Interface) · [Live Control & Adapters](Live-Control-and-Adapters)

The compatibility scanner answers **“what might this plugin do?”** It does **not** answer **“can I safely stop this entire plugin?”** without a separate verified runtime-control method.

## Data sources

Plugin Switch inspects local `.plg` files that correspond to installed or parked plugins. It parses the XML with network access disabled (`LIBXML_NONET`) and examines a bounded sample of `FILE` entries, filenames, `Run` attributes and inline scripts. It does **not** execute the scripts it examines.

The current implementation limits an inspected manifest to **2 MiB**, considers at most **300** `FILE` elements, and caps collected script/file text before scanning. It extracts no more than **12** service references and limits the risk-signal list. These bounds protect the WebGUI from unbounded text processing; they also mean some relevant behavior can be missed.

### Signals the scanner recognizes

| Signal | What text it looks for | Why it matters |
|---|---|---|
| **Service candidate** | References resembling `/etc/rc.d/rc.NAME` or `/etc/init.d/NAME` | May expose a supported start/stop interface |
| **Scheduler** | `cron`, `crontab`, `update_cron` | Stopping a daemon may not stop scheduled jobs |
| **Kernel module** | `modprobe`, `insmod`, `rmmod`, `depmod` | Module state can affect unrelated devices/services |
| **Network stack** | Routing, firewall, tunnel or IPsec commands | Disabling incorrectly could disconnect the server |
| **Storage stack** | Mount, ZFS, pool or RAID-related commands | High impact and often not safely reversible live |
| **Global boot hooks** | Boot startup or udev integration | May persist outside the plugin's main process |
| **WebGUI files** | Unraid WebGUI plugin paths | WebUI state may survive stopping a daemon |
| **Destructive remove** | Commands such as `rm -rf`, formatting operations | An uninstall hook is not a safe generic stop command |
| **Uninstall hook** | `FILE Method="remove"` | Removing a plugin can have side effects or delete config |
| **Profile drift** | Manifest no longer matches a reviewed profile | Previously approved controls must be re-reviewed |

These are **pattern matches in source text**, not execution traces or a formal dependency graph. A benign install script can contain some of these terms, and a dangerous script may contain none. Treat findings as review cues.

## Classifications

| Classification | Meaning | Can toggle live? |
|---|---|---|
| `unverified` | No audited, reversible runtime control verified | No |
| `candidate` | Potential service controls or changed reviewed manifest detected | **No** |
| `live` | A trusted adapter plus runtime status checks passed | Only if no other protection/recovery restriction applies |
| `protected` | Core component or protected by policy | No |
| `needs-recovery` | An interrupted journal exists | No, until resolved |

Importantly, **candidate is not a percentage score or certification**. The scanner cannot prove an adapter is safe on its own.

## How an adapter becomes verified

Two routes are supported:

- **Bundled reviewed profile:** exact `.plg` filename and SHA-256 hash match a record in `profiles.json`, a bundled adapter file matches its SHA-256 digest, and runtime `status` responds as expected.
- **Local administrator adapter:** a root-owned, non-symlink shell script with safe permissions is present at the expected adapter path and passes runtime status checks. This is an administrator trust decision, not a code audit performed by Plugin Switch.

An exact profile match must fail closed when the manifest changes. The bundled registry currently has **no third-party verified entries**, so discovery alone will normally leave switches locked.

## Scanning and cache behavior

The scanner caches results under `/run/plugin-switch/discovery/` for approximately **five minutes**. Cache entries are keyed from the manifest content hash and compatibility-registry hash, so changed content invalidates an old result. Use **Scan compatibility** to request a forced refresh.

Verified adapter status probes are run separately in a bounded concurrent pool (**four simultaneously by default**, individual `timeout`-bounded calls). A slow or failing adapter should not force all remaining probes to wait sequentially. A failed status check does not grant live control.

## Export report

**Export report** downloads the current browser-side compatibility results as JSON. It includes plugin names, versions, installed state, eligibility and detection details. It does not automatically upload the report. Review for potentially sensitive system information before posting it publicly. See [Troubleshooting](Troubleshooting) for recommended issue details.

## Limitations and future profiles

A profile must be audited against a specific plugin revision, including service stop/start, scheduler cleanup, dependencies, repeated cycles, reboot recovery and failed operations. To contribute one, see [Live Control & Adapters](Live-Control-and-Adapters) and [Contributing](Contributing).

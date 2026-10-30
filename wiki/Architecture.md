# Architecture & API

[Home](Home) · [How It Works](How-It-Works) · [Security Model](Security-Model)

This is an implementation-oriented guide for the current **`dev` build `2026.10.29.11`**. It documents the code as shipped; it is not a stable external API commitment.

## Components

```text
plugin.switch.plg              Branch-pinned installer, archive URL and integrity digests
archive/plugin.switch-VERSION.txz  Versioned, checksum-verified runtime package
└─ /usr/local/emhttp/plugins/plugin.switch/
   ├─ PluginSwitch_Loader.page   Loads the UI on Unraid navigation pages
   ├─ switch.js                  Plugins-table integration, Shadow DOM, modal and controls
   ├─ api.php                    Same-origin JSON entry point
   ├─ Controller.php             Install/park state transitions and adapter lifecycle
   ├─ Compatibility.php          Read-only manifest discovery and profile validation
   ├─ ProbePool.php              Bounded concurrent verified-adapter status probes
   ├─ Safety.php                 Protection, journals, history and recovery
   ├─ Release.php                Branch-pinned on-demand update diagnostics
   ├─ profiles.json              Verified profile registry (currently empty)
   └─ builtin-adapters/          Approved packaged adapters (none shipped yet)
```

The project also includes `tools/build.py` to generate the self-contained `.plg`, `tools/profile_review.py` to generate *review-only* hashes, and regression tests under `tests/`.

## Frontend lifecycle

`PluginSwitch_Loader.page` loads `switch.js`; the script watches Unraid's asynchronously generated `#plugin_table` and adds an **Enabled** column without editing Unraid's installed files. The controls use Shadow DOM so native Unraid form styles do not distort switches/icons, and the details modal uses a separate scrollable Shadow DOM view.

Rows are matched using Unraid's existing installed-plugin controls and their `.plg` filenames. Parked plugins, which the stock installed-plugin renderer no longer lists, are added back from Plugin Switch's registry. The UI requests JSON from `api.php`, refreshes when necessary, and uses confirmation before an enabled state change.

## Backend API (internal, authenticated WebGUI only)

These routes are **not for remote unauthenticated use**. They depend on Unraid WebGUI authentication, routing and POST CSRF enforcement.

| Method | Path/query | Function |
|---|---|---|
| `GET` | `/plugins/plugin.switch/api.php` | Installed/parked plugin status and compatibility data |
| `GET` | `?rescan=1` | Force a compatibility refresh (local `/run` cache only) |
| `GET` | `?diagnostics=1` | Pending journals, recent operation history, policy-file location |
| `GET` | `?updates=1` | On-demand branch-pinned release-version check |
| `POST` | `action=toggle&id=NAME.plg&enabled=0|1` | Request trusted live stop/start + manifest lifecycle |
| `POST` | `action=recover&confirmation=RESTORE` | Prepare manifest recovery for the next reboot |

POST calls must include Unraid's valid CSRF token. The middleware validates and consumes it before the PHP endpoint receives the operation fields. The API intentionally rejects unknown operations and malformed toggle identifiers.

**Example inventory response (illustrative fields, not real inventory):**

```json
{
  "plugins": [
    {
      "id": "example.plg",
      "name": "Example",
      "enabled": true,
      "runtime": "unknown",
      "supported": false,
      "support": "no-adapter",
      "compatibility": {
        "classification": "unverified",
        "services": [],
        "signals": [],
        "profile_status": "none"
      }
    }
  ]
}
```

The real response may include additional fields. Do not make external automation depend on an undocumented response shape.

## Discovery and trust decision

`Compatibility.php` fingerprints the manifest and scans bounded XML text for candidate services and risk signals. It can identify matching bundled profiles, but a **live** classification is granted by the controller only after a trusted adapter's runtime status verifies. `ProbePool.php` executes only these already-vetted adapters, with bounded concurrency and per-process timeout. Scanner-discovered paths are never executed automatically.

## State transition and recovery

`Controller.php` serializes mutations with a lock under `/run/plugin-switch/`. `Safety.php` records transaction phases on the boot flash and enforces built-in or administrator policies. Rollback aims to preserve the original runtime state. If the controller cannot verify rollback, the pending transaction remains visible and blocks further toggles. Emergency recovery moves unambiguous parked manifests into the **future startup scan**, without installing or starting services immediately.

## Packaging and release checks

`tools/build.py --branch dev` builds deterministic `.txz` content from PHP/JS/README sources and a branch-pinned `.plg` with MD5/SHA-256 package checksums. The version uses `YYYY.MM.DD.PP` and URLs pin to the intended branch. GitHub Actions validate and publish versioned artifacts after packaging and simulated safety tests. Passing CI does **not** constitute real-Unraid lifecycle certification.

See [Contributing](Contributing) for development and review requirements.

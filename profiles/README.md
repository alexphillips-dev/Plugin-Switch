# Verified compatibility profiles

The production catalog lives at `src/profiles.json`. It intentionally starts empty: no third-party Unraid plugin has yet passed a device-level stop/start/restore audit, and we will not falsely label one as safe.

Each verified profile requires:
- `id`: exact installed manifest filename, e.g. `example.plg`
- `name`: human-readable profile name
- `manifest_sha256`: exact audited .plg manifest content hash
- `adapter`: basename of a **bundled** .sh adapter stored in `src/builtin-adapters/`
- `adapter_sha256`: exact audited adapter hash

The scanner will never execute adapter code. The controller runs `status` only after the adapter has been authenticated, then permits `stop`/`start` through the same controller used for administrator-supplied local adapters.

## Review procedure

1. Review the complete source and install/update/remove routines of a *specific version* of a candidate plugin.
2. Determine all services, cron tasks, launch points, shared dependencies and recovery effects.
3. Write a reversible `status|start|stop` adapter, with timeout and deterministic verification.
4. Validate start→stop→start on a disposable Unraid 7 test VM, then test repeated cycles and reboot recovery.
5. Pin exact manifest and adapter SHA-256 digests in `src/profiles.json`. Do not whitelist by plugin name alone.
6. Add reproducible fixtures and integration tests. Never claim live support from a mere static discovery hit.
7. Re-evaluate changed hashes before publishing another supported version; changed manifests must fail closed.

## Candidate discovery

The scanner extracts service references and hazard signals as *review hints*. Its `candidate` classification NEVER enables an unsafe toggle. Local evidence and fingerprints are presented in the Plugins tab and exportable as JSON; Plugin Switch does not upload that report or transmit telemetry.

## Compatibility schema example (NOT an enabled production profile)

```json
{
  "id": "example.plg",
  "name": "Audited Example Service",
  "manifest_sha256": "64 lowercase hex characters",
  "adapter": "example.sh",
  "adapter_sha256": "64 lowercase hex characters"
}
```

Run `python3 tools/profile_review.py /path/to/plugin.plg --adapter /path/to/reviewed.sh` to emit a **review-only** fingerprint report. Publishing an adapter still requires independent source review, rollback testing, and matching checksums.

# Contributing & Development

[Home](Home) · [Architecture](Architecture) · [Live Control & Adapters](Live-Control-and-Adapters)

Contributions are welcome, particularly **reproducible bug reports, test fixtures, security reviews and thoroughly audited compatibility profiles**. The project is MIT-licensed; review the repository [LICENSE](https://github.com/alexphillips-dev/Plugin-Switch/blob/dev/LICENSE).

## Development branch and versioning

The active work is on [`dev`](https://github.com/alexphillips-dev/Plugin-Switch/tree/dev). A stable `main` release has not yet been published. Release versions follow **`YYYY.MM.DD.PP`** (patches are zero-padded from `.01` onward). A runtime change requires a new versioned `.txz` archive, checksum, branch-specific `.plg`, and concise notes in `docs/releases/`; `CHANGELOG.md` is the authoritative cumulative history.

## Local development and checks

```bash
git clone https://github.com/alexphillips-dev/Plugin-Switch.git
cd Plugin-Switch
git switch dev

python3 tools/build.py --branch dev
python3 tools/build.py --check --branch dev
php -l src/Controller.php
php -l src/Compatibility.php
php -l src/Safety.php
php -l src/ProbePool.php
php -l src/Release.php
php -l src/api.php
node --check src/switch.js
python3 -m unittest discover -s tests -v
```

Some PHP integration tests require root/Unraid-like filesystem semantics (for example, ownership checks). The CI workflow runs the suite in a suitable Linux runner. Unit tests do not replace device-level lifecycle verification.

## How to contribute a verified profile

A profile is **not** accepted merely because a file references `/etc/rc.d/rc.some-service` or a service has a stop command. A strong submission includes:

1. Exact plugin name, `.plg` filename, version and source URL.
2. SHA-256 of the full manifest and the proposed adapter.
3. Source review of install/update/remove hooks and what files or services they change.
4. Dependencies (other plugins, drivers, storage/network/security services) and how they are protected.
5. Reversible `status`, `stop`, and `start` implementations with explicit verification.
6. Repeatable start/stop/start tests, an already-stopped case, error injection, same-boot restoration and post-reboot reinstallation/recovery tests.
7. Known risks, failure modes, rollback procedure, and testing Unraid version(s).

The helper:

```bash
python3 tools/profile_review.py ./plugin.plg --adapter ./adapter.sh
```

prints a **review-only** JSON fingerprint. It does not whitelist or auto-approve the plugin. A maintainer must review and pin it in `src/profiles.json`, and store the vetted script in `src/builtin-adapters/`. Any changed manifest hash requires renewed review.

## Bug reporting

Open an [issue](https://github.com/alexphillips-dev/Plugin-Switch/issues) with version/branch, Unraid version, screenshots (if UI-related), exact reproduction, expected/actual results, relevant logs, and a sanitized exported compatibility report. **Never publish secrets, license keys, session cookies or unredacted diagnostics.**

## Release checklist

- Confirm all code changes are inspected together with their cross-component effects (PHP backend, JS UI, builder, profiles and tests).
- Bump `VERSION` in `tools/build.py` using the required date-based scheme.
- Rebuild and validate `plugin.switch.plg` with the correct branch URL.
- Verify the generated `.txz` archive, `.sha256` digest, and branch-pinned `.plg` agree. The Build development package workflow publishes both artifacts only after tests pass.
- Run lint, tests and simulated recovery scenarios.
- Confirm compatibility classifications remain fail-closed for unknown plugins.
- Inspect workflow results and verify the published raw `.plg` contains the intended version and update URL.
- Test installation and representative interactions on an Unraid lab host before recommending the release for wider use.
- Update this Wiki when behavior, controls, safety guarantees or config format change.

## Wiki maintenance

The source Markdown files are retained under the repository's `wiki/` directory. The Wiki publishing workflow attempts to synchronize those pages to GitHub's separate `.wiki.git` repository. **GitHub Wiki must have its first page initialized** for that remote to exist. Wiki publication success is reported by GitHub Actions; a green software test alone does not verify Wiki publication.

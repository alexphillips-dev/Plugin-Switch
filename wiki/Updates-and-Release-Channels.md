# Updates & Release Channels

[Home](Home) · [Getting Started](Getting-Started) · [Troubleshooting](Troubleshooting)

Plugin Switch follows **FolderView Plus's release model**: a branch-pinned Unraid `.plg` installer references a **versioned, checksummed `.txz` package**. Source and release artifacts are kept together on `dev`; a future stable release would use `main`.

## Development version format

Releases use `YYYY.MM.DD.PP`, for example:

- `2026.10.29.11` — the eleventh development update on October 29.
- `2026.10.29.12` — the next update on the same day.
- `2026.10.30.01` — the first update on October 30.

The patch is zero-padded to at least two digits. To calculate the next version:

```bash
python3 tools/build.py --next-version 2026-10-30
```

Do not publish a `.plg` without its matching immutable versioned archive. Each release preserves its archive and SHA-256 digest, plus concise notes in `docs/releases/`. `CHANGELOG.md` is the canonical cumulative release history.

## Update channel

| Channel | Manifest | Status |
|---|---|---|
| `dev` | `https://raw.githubusercontent.com/alexphillips-dev/Plugin-Switch/dev/plugin.switch.plg` | Active development |
| `main` | `https://raw.githubusercontent.com/alexphillips-dev/Plugin-Switch/main/plugin.switch.plg` | Not yet released as stable |

The installed `.plg` contains `pluginURL` pinned to the branch it was built for. The manifest points to `archive/plugin.switch-<version>.txz` on the same branch with MD5/SHA-256 digests. Unraid downloads and verifies the package, installs it with `upgradepkg --install-new`, and keeps `/boot/config/plugins/plugin.switch/` settings separate from the deployed WebGUI files.

## Two different update checks

**Unraid → Plugins → Check for Updates** uses Unraid's plugin manager. Current Unraid source compares third-party plugin versions lexicographically using PHP `strcmp()`. Historically, some Plugin Switch patch numbers were not consistently padded, so `.10` did not always appear newer than `.9` in that check.

**Plugin Switch → Check updates** uses `version_compare()` numerically, like FolderView Plus's own update diagnostic. It fetches the manifest from the installed channel with a cache-busting query (`?_=` plus current timestamp), no-cache headers, bounded timeouts and no redirects. It reports published version, network response, and whether Unraid's native comparison will show the update. It **does not install** an update.

Old installed manifests cannot be repaired simply by writing a new version. In particular, a legacy unpadded installation or an abandoned development build may require a one-time manual force refresh.

## Force-refresh helper (for stale or mismatched installs)

Use **Check updates → Copy refresh commands**, or run the equivalent commands in the Unraid terminal as an administrator:

```bash
wget -O /tmp/plugin.switch.plg \
  "https://raw.githubusercontent.com/alexphillips-dev/Plugin-Switch/dev/plugin.switch.plg?_=$(date +%s)"

plugin install /tmp/plugin.switch.plg forced

head -n 8 /boot/config/plugins/plugin.switch.plg
```

The `forced` option bypasses Unraid's usual older/same-version check. Use it only after reviewing the correct branch and version; it can overwrite runtime files. Back up the boot flash first. After installation, confirm the version and `pluginURL`, refresh the browser (Ctrl+F5), and reopen Plugins. **Never delete the disabled manifest directory or recovery journal** merely to force an update.

## Release build (maintainers)

```bash
python3 tools/build.py --branch dev
python3 tools/build.py --branch dev --check
python3 -m unittest discover -s tests -v
```

The build produces deterministic `.txz` bytes from `src/`, a matching `.sha256` text file, and the branch-pinned `.plg`. The GitHub Actions **Build development package** workflow publishes the dev artifacts only after packaging and runtime tests pass. The workflow does not publish to `main`.

See the [canonical changelog](https://github.com/alexphillips-dev/Plugin-Switch/blob/dev/CHANGELOG.md) and [Contributing](Contributing).

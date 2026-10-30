# Updates & Release Channels

[Home](Home) · [Getting Started](Getting-Started) · [Troubleshooting](Troubleshooting)

Plugin Switch follows the requested Unraid-style version scheme:

```text
YYYY.MM.DD.patch
```

For example, `2026.10.29.90` is a compatibility-bridge patch on October 29, 2026. The source build utility validates this pattern, verifies Unraid-compatible ordering against historical releases, and generates a self-contained `.plg` with per-file SHA-256 checksums. On future dates, use **zero-padded numeric fields**, for example `2026.10.30.01`, `2026.10.30.02`, and so forth.

## Important: how Unraid compares plugin versions

Unraid's current third-party plugin update code uses PHP `strcmp($latest, $installed)`, which compares **characters**, not numeric patch components. This is why `2026.10.29.10` did not show as newer than `2026.10.29.9` for some installations.

| Installed | Available | Unraid's comparison |
|---|---|---|
| `2026.10.29.9` | `2026.10.29.10` | **Not newer** (legacy ordering problem) |
| `2026.10.29.9` | `2026.10.29.90` | **Newer** |
| `2026.10.29.10` | `2026.10.29.90` | **Newer** |
| `2026.10.29.90` | `2026.10.30.01` | **Newer** |

The bridge patch `.90` intentionally follows `.9` lexicographically while remaining in `YYYY.MM.DD.patch` format. This resolves update discovery for both `.9` and `.10` installations. Future versions on a new date will start with `.01` and use consistent zero padding for reliable string sorting. Avoid mixing padded and unpadded patch formats on the same date.

The builder rejects a proposed release if it is not lexicographically newer than every earlier release documented in [CHANGELOG.md](https://github.com/alexphillips-dev/Plugin-Switch/blob/dev/CHANGELOG.md).

## `dev` vs `main`

Plugin Switch supports **branch-pinned installation and update checks**. The manifest used for installation includes a `pluginURL` that points to the same branch.

| Channel | Manifest URL | Current availability |
|---|---|---|
| **Development (`dev`)** | `https://raw.githubusercontent.com/alexphillips-dev/Plugin-Switch/dev/plugin.switch.plg` | Available; active development build |
| **Stable (`main`)** | `https://raw.githubusercontent.com/alexphillips-dev/Plugin-Switch/main/plugin.switch.plg` | **Do not assume a stable `.plg` has been published yet** |

The existence of a Git branch does not guarantee that it contains a release. Do not use the `main` URL until a production manifest is explicitly published there.

## Unraid update checks

Unraid's native plugin manager reads the installed `.plg` metadata, downloads the manifest named by `pluginURL`, compares the version and exposes an update if appropriate. Unraid may cache downloaded manifests or show a transient “cannot check” state when network checks fail. Local installed metadata can also differ from what you believe was deployed.

**Check For Updates** belongs to Unraid and initiates its own update mechanism. The Plugin Switch **Check updates** button is an **information-only diagnostic**. It reads the installed version/channel and retrieves the published version from the allowlisted `dev` or `main` raw GitHub manifest. It does not install anything.

The current update diagnostic uses strict URL allowlisting, does not follow redirects, has bounded timeouts, and caches a successful result in `/run` for about ten minutes. It does not poll the remote endpoint continuously.

## Diagnose a missing update

From the Unraid terminal, inspect the local version and URL:

```bash
head -n 12 /boot/config/plugins/plugin.switch.plg
```

Compare with what the development branch publishes:

```bash
curl -fL --connect-timeout 10 --max-time 30 \
  -o /tmp/plugin.switch.plg \
  https://raw.githubusercontent.com/alexphillips-dev/Plugin-Switch/dev/plugin.switch.plg
head -n 12 /tmp/plugin.switch.plg
```

If the versions differ and Unraid isn't offering an update, check the **lexicographic comparison** above, then use Unraid's **Check For Updates** and inspect any failure logs. If your local manifest has an outdated or non-`dev` `pluginURL`, the native updater will keep checking the wrong branch. You may reinstall from the exact `dev` URL through Unraid's normal plugin installer after backing up your boot flash. Do not manually replace live PHP/JavaScript runtime files while an install/update operation is active.

## Building a release (maintainers)

The branch is passed to the generator, not guessed from the user's web browser:

```bash
python3 tools/build.py --branch dev
python3 tools/build.py --check --branch dev
python3 -m unittest discover -s tests -v
```

A future stable release is built on `main` with `--branch main`. The `.plg` includes an exact `pluginURL` and SHA-256 digests for its bundled payload, allowing Unraid to replace outdated inline files during updates.

See [Contributing](Contributing) for the release checklist and the [canonical CHANGELOG.md](https://github.com/alexphillips-dev/Plugin-Switch/blob/dev/CHANGELOG.md) for release changes.

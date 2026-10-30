#!/usr/bin/env python3
"""Generate a self-contained, branch-pinned Unraid .plg."""
from pathlib import Path
from datetime import date
import argparse
import hashlib
import os
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
VERSION = "2026.10.29.90"
CHANNELS = ("dev", "main")
SOURCE_FILES = {
    "src/Compatibility.php": "Compatibility.php",
    "src/profiles.json": "profiles.json",
    "src/Safety.php": "Safety.php",
    "src/ProbePool.php": "ProbePool.php",
    "src/Release.php": "Release.php",
    "src/Controller.php": "Controller.php",
    "src/api.php": "api.php",
    "src/switch.js": "switch.js",
    "src/PluginSwitch_Loader.page": "PluginSwitch_Loader.page",
    "src/README.md": "README.md",
}


def validate_version(version: str) -> None:
    if not re.fullmatch(r"[0-9]{4}\.[0-9]{1,2}\.[0-9]{1,2}\.[0-9]+", version):
        raise ValueError("Version must follow YYYY.MM.DD.patch")
    year, month, day, patch = map(int, version.split("."))
    date(year, month, day)
    if patch < 1:
        raise ValueError("Patch numbers begin at 1")


def validate_unraid_release_order(version: str) -> None:
    """Unraid checks third-party .plg versions with strcmp, not version_compare.

    A release must sort ABOVE *all* older published versions as plain strings,
    including legacy non-padded patches such as .9 versus .10.
    """
    changelog = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
    previous = re.findall(r"^## \[([0-9]{4}\.[0-9]{1,2}\.[0-9]{1,2}\.[0-9]+)\]", changelog, re.M)
    if not previous or previous[0] != version:
        raise ValueError("CHANGELOG.md must start with the current release")
    for older in previous[1:]:
        if version <= older:
            raise ValueError(
                f"Unraid string ordering: {version} is NOT newer than {older}. "
                "Choose a lexicographically newer YYYY.MM.DD.patch."
            )


def validate_branch(branch: str) -> None:
    if branch not in CHANNELS:
        raise ValueError(f"Unsupported release branch: {branch!r}. Choose dev or main.")


def build(branch: str = "dev") -> str:
    """Build a manifest whose update URL and description pin its branch."""
    validate_version(VERSION)
    validate_unraid_release_order(VERSION)
    validate_branch(branch)
    begin = f'''<?xml version="1.0" standalone="yes"?>
<!DOCTYPE PLUGIN [
<!ENTITY name "plugin.switch">
<!ENTITY author "alexphillips-dev">
<!ENTITY version "{VERSION}">
<!ENTITY pluginURL "https://raw.githubusercontent.com/alexphillips-dev/Plugin-Switch/{branch}/plugin.switch.plg">
]>
<PLUGIN name="&name;" author="&author;" version="&version;" pluginURL="&pluginURL;" icon="fa-toggle-on" min="7.0.0" support="https://github.com/alexphillips-dev/Plugin-Switch/issues">
<CHANGES>{VERSION} - Fix Unraid lexicographic update ordering; move full release notes into CHANGELOG.md.</CHANGES>
'''
    parts = [begin]
    for path, name in SOURCE_FILES.items():
        content = (ROOT / path).read_text(encoding="utf-8")
        if path == "src/README.md":
            content = content.replace("__PLUGIN_SWITCH_BRANCH__", branch)
        # Unraid skips an existing FILE when no digest is provided. Without a
        # SHA256 entry, upgrading only updates the manifest and leaves old
        # PHP/JS/README files on disk. Match Unraid's trim(INLINE).PHP_EOL.
        payload = content.strip() + "\n"
        digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()
        content = content.replace("]]>", "]]]]><![CDATA[>")
        parts.append(
            f'<FILE Name="/usr/local/emhttp/plugins/&name;/{name}">'
            f'<INLINE><![CDATA[{content}]]></INLINE>'
            f'<SHA256>{digest}</SHA256></FILE>\n'
        )
    for adapter in sorted((ROOT / "src/builtin-adapters").glob("*.sh")):
        # Reviewed adapters may be added in a future version, but are never
        # loaded from an untrusted remote URL at runtime.
        content = adapter.read_text(encoding="utf-8")
        payload = content.strip() + "\n"
        digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()
        safe = content.replace("]]>", "]]]]><![CDATA[>")
        parts.append(
            f'<FILE Name="/usr/local/emhttp/plugins/&name;/builtin-adapters/{adapter.name}">'
            f'<INLINE><![CDATA[{safe}]]></INLINE>'
            f'<SHA256>{digest}</SHA256></FILE>\n'
        )
    parts.append('''<FILE Run="/bin/bash"><INLINE><![CDATA[
set -eu
mkdir -p /boot/config/plugins/plugin.switch/adapters
mkdir -p /boot/config/plugins/plugin.switch/disabled
mkdir -p /usr/local/emhttp/plugins/plugin.switch
chmod 0700 /boot/config/plugins/plugin.switch/adapters /boot/config/plugins/plugin.switch/disabled
]]></INLINE></FILE>
<FILE Run="/bin/bash" Method="remove"><INLINE><![CDATA[
# Do not delete persisted adapters or disabled plugin definitions.
rm -rf /usr/local/emhttp/plugins/plugin.switch
]]></INLINE></FILE>
</PLUGIN>
''')
    return ''.join(parts)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--branch", choices=CHANNELS, default=os.environ.get("PLUGIN_SWITCH_BRANCH", "dev"),
                        help="GitHub branch to pin for future updates (default: dev)")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    target = ROOT / "plugin.switch.plg"
    value = build(args.branch)
    if args.check:
        if not target.exists() or target.read_text(encoding="utf-8") != value:
            print(f"plugin.switch.plg does not match {args.branch} build", file=sys.stderr)
            sys.exit(1)
        print(f"Manifest current for {args.branch} ({VERSION})")
    else:
        target.write_text(value, encoding="utf-8")
        print(f"Wrote {target} for {args.branch} ({VERSION})")

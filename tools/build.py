#!/usr/bin/env python3
"""Create a branch-pinned Unraid .plg and a reproducible versioned .txz.

Following FolderView Plus: manifest has a versioned archive URL and SHA-256
verification, with a dev/main update channel. The archive contains the code,
not another copy of the release changelog.
"""
from pathlib import Path
from datetime import date
from io import BytesIO
import argparse
import hashlib
import re
import sys
import tarfile

ROOT = Path(__file__).resolve().parents[1]
VERSION = "2026.10.29.11"
CHANNELS = ("dev", "main")
PACKAGE_NAME = "plugin.switch"
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
    if not re.fullmatch(r"[0-9]{4}\.[0-9]{2}\.[0-9]{2}\.[0-9]{2,}", version):
        raise ValueError("Use YYYY.MM.DD.PP with zero-padded month/day/patch")
    y, m, d, patch = map(int, version.split("."))
    date(y, m, d)
    if patch < 1:
        raise ValueError("Patch numbers begin at 01")


def validate_branch(branch: str) -> None:
    if branch not in CHANNELS:
        raise ValueError("Only dev and main are valid release channels")


def release_history() -> list[str]:
    notes = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
    return re.findall(r"^## \[([0-9]{4}\.[0-9]{2}\.[0-9]{2}\.[0-9]+)\]", notes, re.M)


def validate_release_history() -> None:
    history = release_history()
    if not history or history[0] != VERSION:
        raise ValueError("The changelog must begin with the current release")
    if any(VERSION == previous for previous in history[1:]):
        raise ValueError("Duplicate release version in changelog")
    newest = [int(x) for x in VERSION.split(".")]
    for older in history[1:]:
        if newest <= [int(x) for x in older.split(".")]:
            raise ValueError(f"Release version {VERSION} must be numerically newer than {older}")


def next_version(current: str, target_date: str) -> str:
    """FolderView-style, normalized YYYY.MM.DD.PP release increment."""
    validate_version(current)
    date.fromisoformat(target_date)
    target = target_date.replace("-", ".")
    base = current.rsplit(".", 1)[0]
    if target < base:
        raise ValueError("Release date cannot precede the current version date")
    patch = int(current.rsplit(".", 1)[1]) + 1 if target == base else 1
    return f"{target}.{patch:02d}"


def archive_filename() -> str:
    return f"{PACKAGE_NAME}-{VERSION}.txz"


def archive_path() -> Path:
    return ROOT / "archive" / archive_filename()


def archive_source(branch: str) -> dict[str, bytes]:
    validate_branch(branch)
    result = {}
    for name, destination in SOURCE_FILES.items():
        content = (ROOT / name).read_text(encoding="utf-8")
        if name == "src/README.md":
            content = content.replace("__PLUGIN_SWITCH_BRANCH__", branch)
        result[f"usr/local/emhttp/plugins/{PACKAGE_NAME}/{destination}"] = content.encode("utf-8")
    for script in sorted((ROOT / "src/builtin-adapters").glob("*.sh")):
        if not re.fullmatch(r"[a-z0-9][a-z0-9._-]*\.sh", script.name):
            raise ValueError(f"Invalid adapter filename: {script.name}")
        result[f"usr/local/emhttp/plugins/{PACKAGE_NAME}/builtin-adapters/{script.name}"] = script.read_bytes()
    return result


def build_archive(branch: str = "dev") -> bytes:
    validate_version(VERSION)
    validate_release_history()
    content = archive_source(branch)
    memory = BytesIO()
    # Normalize all entry metadata so CI can reproduce and compare exact bytes.
    with tarfile.open(fileobj=memory, mode="w:xz", format=tarfile.GNU_FORMAT, preset=6) as tar:
        for name in sorted(content):
            payload = content[name]
            entry = tarfile.TarInfo(name)
            entry.size = len(payload)
            entry.mode = 0o644
            entry.uid = entry.gid = 0
            entry.uname = entry.gname = "root"
            entry.mtime = 0
            tar.addfile(entry, BytesIO(payload))
    return memory.getvalue()


def build(branch: str = "dev", archive: bytes | None = None) -> str:
    validate_version(VERSION)
    validate_branch(branch)
    if archive is None:
        archive = build_archive(branch)
    digest = hashlib.sha256(archive).hexdigest()
    md5 = hashlib.md5(archive).hexdigest()  # Compatibility only; SHA-256 provides integrity
    url = f"https://raw.githubusercontent.com/alexphillips-dev/Plugin-Switch/{branch}"
    change_file = ROOT / "docs" / "releases" / f"{VERSION}.md"
    if not change_file.is_file():
        raise ValueError(f"Missing concise release notes: {change_file}")
    changes = change_file.read_text(encoding="utf-8").strip()
    if not changes or "]]>" in changes or "<" in changes:
        raise ValueError("Release notes must be nonempty, short and safe for XML")
    return f'''<?xml version="1.0" standalone="yes"?>
<!DOCTYPE PLUGIN [
<!ENTITY name "{PACKAGE_NAME}">
<!ENTITY author "alexphillips-dev">
<!ENTITY version "{VERSION}">
<!ENTITY pluginURL "{url}/plugin.switch.plg">
<!ENTITY md5 "{md5}">
<!ENTITY sha256 "{digest}">
]>
<PLUGIN name="&name;" author="&author;" version="&version;" pluginURL="&pluginURL;" icon="fa-toggle-on" min="7.0.0" support="https://github.com/alexphillips-dev/Plugin-Switch/issues">
<CHANGES>
### {VERSION}
{changes}
</CHANGES>
<FILE Name="/boot/config/plugins/&name;/&name;-&version;.txz" Run="upgradepkg --install-new">
<URL>{url}/archive/&name;-&version;.txz</URL>
<MD5>&md5;</MD5>
<SHA256>&sha256;</SHA256>
</FILE>
<FILE Run="/bin/bash"><INLINE><![CDATA[
set -eu
mkdir -p /boot/config/plugins/plugin.switch/adapters /boot/config/plugins/plugin.switch/disabled
chmod 0700 /boot/config/plugins/plugin.switch/adapters /boot/config/plugins/plugin.switch/disabled
]]></INLINE></FILE>
<FILE Run="/bin/bash" Method="remove"><INLINE><![CDATA[
rm -rf /usr/local/emhttp/plugins/plugin.switch
]]></INLINE></FILE>
</PLUGIN>
'''


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--branch", choices=CHANNELS, default="dev")
    parser.add_argument("--check", action="store_true", help="Verify package and manifest match current sources")
    parser.add_argument("--next-version", metavar="YYYY-MM-DD", help="Print the next padded version for this date")
    args = parser.parse_args()
    if args.next_version:
        print(next_version(VERSION, args.next_version))
        return
    archive = build_archive(args.branch)
    manifest = build(args.branch, archive)
    target = archive_path()
    sha_target = target.with_name(target.name + ".sha256")
    sha_content = hashlib.sha256(archive).hexdigest() + "  " + target.name + "\n"
    manifest_file = ROOT / "plugin.switch.plg"
    if args.check:
        if not target.is_file() or target.read_bytes() != archive:
            raise SystemExit("Missing/stale versioned package: " + str(target))
        if not sha_target.is_file() or sha_target.read_text() != sha_content:
            raise SystemExit("Missing/stale archive checksum")
        if not manifest_file.is_file() or manifest_file.read_text() != manifest:
            raise SystemExit("Missing/stale branch-pinned manifest")
        print(f"Package and manifest verified: {VERSION} ({args.branch})")
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        # Keep previously released immutable packages available for existing installations.
        if target.exists() and target.read_bytes() != archive:
            raise SystemExit("Archive exists with different bytes. Bump version before rebuilding.")
        target.write_bytes(archive)
        sha_target.write_text(sha_content)
        manifest_file.write_text(manifest)
        print(f"Built {target} and {manifest_file} for {args.branch} ({VERSION})")


if __name__ == "__main__":
    main()

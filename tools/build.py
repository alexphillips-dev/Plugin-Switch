#!/usr/bin/env python3
"""Generate a self-contained Unraid .plg from checked-in sources."""
from pathlib import Path
from datetime import date
import re
import argparse
import sys

ROOT = Path(__file__).resolve().parents[1]
VERSION = "2026.10.29.1"

def validate_version(version: str) -> None:
    if not re.fullmatch(r"[0-9]{4}\\.[0-9]{1,2}\\.[0-9]{1,2}\\.[0-9]+", version):
        raise ValueError("Version must follow YYYY.MM.DD.patch")
    year, month, day, patch = map(int, version.split("."))
    date(year, month, day)
    if patch < 1:
        raise ValueError("Patch numbers begin at 1")

SOURCE_FILES = {
    "src/Controller.php": "Controller.php",
    "src/api.php": "api.php",
    "src/switch.js": "switch.js",
    "src/PluginSwitch_Loader.page": "PluginSwitch_Loader.page",
}
def build():
    validate_version(VERSION)
    begin = f'''<?xml version="1.0" standalone="yes"?>
<!DOCTYPE PLUGIN [
<!ENTITY name "plugin.switch">
<!ENTITY author "Alex Phillips">
<!ENTITY version "{VERSION}">
<!ENTITY pluginURL "https://raw.githubusercontent.com/alexphillips-dev/Plugin-Switch/dev/plugin.switch.plg">
]>
<PLUGIN name="&name;" author="&author;" version="&version;" pluginURL="&pluginURL;" icon="fa-toggle-on" min="7.0.0">
<CHANGES>{VERSION} - Correct installed-state display, add adapter support diagnostics, and enforce Unraid version numbering.</CHANGES>
'''
    parts = [begin]
    for path, name in SOURCE_FILES.items():
        content = (ROOT / path).read_text()
        # CDATA cannot contain a raw ]]> sequence.
        content = content.replace("]]>", "]]]]><![CDATA[>")
        parts.append(f'<FILE Name="/usr/local/emhttp/plugins/&name;/{name}"><INLINE><![CDATA[{content}]]></INLINE></FILE>\n')
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
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    target = ROOT / "plugin.switch.plg"
    value = build()
    if args.check:
        if not target.exists() or target.read_text() != value:
            print("plugin.switch.plg is out of date", file=sys.stderr)
            sys.exit(1)
        print("Manifest current")
    else:
        target.write_text(value)
        print(f"Wrote {target}")

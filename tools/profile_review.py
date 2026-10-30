#!/usr/bin/env python3
"""Produce review-only metadata; NEVER auto-approve a plugin's live controls."""
import argparse
import hashlib
import json
from pathlib import Path

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path, help="Exact .plg file to review")
    parser.add_argument("--adapter", type=Path, help="Optional locally audited adapter")
    args = parser.parse_args()
    manifest = args.manifest.resolve(strict=True)
    if manifest.suffix != ".plg" or manifest.stat().st_size > 2 * 1024 * 1024:
        parser.error("Only .plg files up to 2 MiB can be reviewed")
    result = {
        "status": "REVIEW_REQUIRED",
        "id": manifest.name,
        "manifest_sha256": hashlib.sha256(manifest.read_bytes()).hexdigest(),
        "name": "REPLACE_WITH_AUDITED_NAME",
        "risk_note": "Inspect full uninstall, install, service, scheduling and dependency lifecycle.",
    }
    if args.adapter:
        adapter = args.adapter.resolve(strict=True)
        if adapter.suffix != ".sh" or adapter.stat().st_size > 65536:
            parser.error("Adapter must be a shell script of at most 64 KiB")
        result["adapter"] = adapter.name
        result["adapter_sha256"] = hashlib.sha256(adapter.read_bytes()).hexdigest()
    print(json.dumps(result, indent=2))
    print("\nNot approved: verify on an isolated Unraid host before adding to src/profiles.json.")

if __name__ == "__main__":
    main()

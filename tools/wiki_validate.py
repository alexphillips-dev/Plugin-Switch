#!/usr/bin/env python3
"""Validate the GitHub Wiki source set before publishing."""
from pathlib import Path
import re
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else 'wiki')
pages = {p.stem: p for p in root.glob('*.md')}
required = {'Home', '_Sidebar', '_Footer', 'Getting-Started', 'How-It-Works',
            'Compatibility-Scanning', 'Live-Control-and-Adapters',
            'Safety-and-Recovery', 'Troubleshooting', 'Security-Model',
            'Updates-and-Release-Channels'}
errors = [f'Missing page: {name}' for name in sorted(required - pages.keys())]
for name, page in sorted(pages.items()):
    body = page.read_text(encoding='utf-8')
    if not body.strip(): errors.append(f'Empty page: {page.name}')
    if not name.startswith('_') and not body.startswith('# '):
        errors.append(f'No primary heading: {page.name}')
    if body.count(chr(96) * 3) % 2:
        errors.append(f'Unbalanced fenced block: {page.name}')
    for link in re.findall(r'\[[^\]]+\]\(([^)]+)\)', body):
        if link.startswith(('https:', 'http:', 'mailto:', '#')): continue
        if link.split('#', 1)[0] not in pages:
            errors.append(f'Broken link in {page.name}: {link}')
home = pages.get('Home')
if home:
    body = home.read_text(encoding='utf-8')
    builder = root.parent / 'tools' / 'build.py'
    current = re.search(r'^VERSION = "([^"]+)"', builder.read_text(encoding='utf-8'), re.M) if builder.is_file() else None
    if not current:
        errors.append('Could not determine current build version from tools/build.py')
    for term in ('empty', 'Safety & Recovery', *([current.group(1)] if current else [])):
        if term not in body: errors.append(f'Home missing warning: {term}')
if errors:
    print('\n'.join(errors), file=sys.stderr)
    sys.exit(1)
print(f'Wiki validation passed: {len(pages)} pages')

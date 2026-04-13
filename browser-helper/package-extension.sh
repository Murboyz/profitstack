#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
EXT_DIR="$ROOT/hcp-chrome-extension"
DIST_DIR="$ROOT/dist"
ZIP_PATH="$DIST_DIR/profitstack-hcp-helper.zip"

mkdir -p "$DIST_DIR"
rm -f "$ZIP_PATH"

python3 - "$EXT_DIR" "$ZIP_PATH" <<'PY'
import pathlib
import sys
import zipfile

ext_dir = pathlib.Path(sys.argv[1]).resolve()
zip_path = pathlib.Path(sys.argv[2]).resolve()

with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
    for path in sorted(ext_dir.rglob('*')):
        if path.is_dir():
            continue
        if path.name in {'.DS_Store', 'generate_icons.py'} or '__MACOSX' in path.parts:
            continue
        zf.write(path, path.relative_to(ext_dir))

print(f'Created: {zip_path}')
PY

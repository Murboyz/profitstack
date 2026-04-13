#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
EXT_DIR="$ROOT/hcp-chrome-extension"
DIST_DIR="$ROOT/dist"
ZIP_PATH="$DIST_DIR/profitstack-hcp-helper.zip"

mkdir -p "$DIST_DIR"
rm -f "$ZIP_PATH"

cd "$EXT_DIR"
zip -r "$ZIP_PATH" . -x '*.DS_Store' -x '__MACOSX/*'

echo "Created: $ZIP_PATH"

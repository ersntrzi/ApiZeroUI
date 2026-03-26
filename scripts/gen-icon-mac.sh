#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PNG="$ROOT_DIR/assets/icon.png"
OUT_ICNS="$ROOT_DIR/assets/icon.icns"
ICONSET_DIR="$ROOT_DIR/assets/icon.iconset"

if [[ ! -f "$PNG" ]]; then
  echo "gen-icon-mac: icon.png bulunamadı: $PNG" >&2
  exit 1
fi

rm -rf "$ICONSET_DIR"
mkdir -p "$ICONSET_DIR"

# macOS built-ins: sips + iconutil
for size in 16 32 64 128 256 512; do
  sips -z "$size" "$size" "$PNG" --out "$ICONSET_DIR/icon_${size}x${size}.png" >/dev/null
  sips -z "$((size*2))" "$((size*2))" "$PNG" --out "$ICONSET_DIR/icon_${size}x${size}@2x.png" >/dev/null
done

iconutil -c icns "$ICONSET_DIR" -o "$OUT_ICNS"
rm -rf "$ICONSET_DIR"

echo "gen-icon-mac: ok -> $OUT_ICNS"


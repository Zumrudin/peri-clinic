#!/usr/bin/env bash
# Builds self-hosted, Cyrillic+Latin subsets of the site fonts (variable woff2).
# Requires: python3 with fonttools + brotli (pip install fonttools brotli).
set -euo pipefail
cd "$(dirname "$0")/../.."

SRC_DIR=/tmp/fonts
OUT_DIR=public/fonts
BASE=https://github.com/google/fonts/raw/main/ofl
mkdir -p "$SRC_DIR" "$OUT_DIR"

declare -A FILES=(
  ["cormorant-garamond"]="cormorantgaramond/CormorantGaramond%5Bwght%5D.ttf"
  ["cormorant-garamond-italic"]="cormorantgaramond/CormorantGaramond-Italic%5Bwght%5D.ttf"
  ["golos-text"]="golostext/GolosText%5Bwght%5D.ttf"
)

# Latin-1, general punctuation, currency (incl. ₽), arrows used in UI, stars, ✦, Cyrillic + extensions, №
UNICODES="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+20BD,U+2122,U+2190-2193,U+2197,U+2212,U+2215,U+2605-2606,U+2726,U+FEFF,U+FFFD,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116"

for name in "${!FILES[@]}"; do
  src="$SRC_DIR/$name.ttf"
  [ -s "$src" ] || curl -sL -o "$src" "$BASE/${FILES[$name]}"
  python3 -m fontTools.subset "$src" \
    --output-file="$OUT_DIR/$name.woff2" \
    --flavor=woff2 \
    --unicodes="$UNICODES" \
    --layout-features='*' \
    --no-hinting \
    --desubroutinize
  printf '%-28s %6s KB\n' "$name.woff2" "$(( $(stat -c %s "$OUT_DIR/$name.woff2") / 1024 ))"
done

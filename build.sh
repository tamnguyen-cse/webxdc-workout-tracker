#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
out="workout-tracker.xdc"
if [[ -e "$out" ]]; then trash "$out"; fi
zip -9 -r -X "$out" index.html script.js style.css manifest.toml icon.png LICENSE css js data/seed.js \
  -x '*.DS_Store'
unzip -l "$out" | tail -3

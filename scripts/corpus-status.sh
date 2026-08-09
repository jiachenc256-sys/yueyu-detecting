#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CORPUS_DIR="${HOME}/Desktop/linguilistic project/baidu-yueju"

echo "Drop folder: $CORPUS_DIR"
if [[ -d "$CORPUS_DIR" ]]; then
  videos=$(find "$CORPUS_DIR/videos" -type f 2>/dev/null | wc -l | tr -d ' ')
  audio=$(find "$CORPUS_DIR/audio-or-tracks" -type f 2>/dev/null | wc -l | tr -d ' ')
  echo "videos: $videos files"
  echo "audio-or-tracks: $audio files"
else
  echo "Not created yet - run: make corpus-setup"
fi

INV="$ROOT/data/corpus/inventory.json"
if [[ -f "$INV" ]]; then
  python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); print("inventory:", d["totalFiles"], "media files")' "$INV"
else
  echo "inventory: none yet - run make corpus-inventory after download"
fi

#!/usr/bin/env bash
# Pack gold clips + training scripts for Google Colab upload.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

MANIFEST="data/corpus/asr/gold-clips.jsonl"
CLIPS="data/corpus/asr/clips"
OUT="data/corpus/asr/yueyu-asr-colab.zip"

if [[ ! -f "$MANIFEST" ]]; then
  echo "Missing $MANIFEST — run: npm run asr:export-gold" >&2
  exit 1
fi
if [[ ! -d "$CLIPS" ]] || [[ -z "$(ls -A "$CLIPS" 2>/dev/null)" ]]; then
  echo "Missing clips — run: make asr-slice" >&2
  exit 1
fi

rm -f "$OUT"
# shellcheck disable=SC2046
zip -r "$OUT" \
  "$MANIFEST" \
  data/corpus/asr/gold-summary.json \
  scripts/asr/train_whisper_lora.py \
  scripts/asr/eval_cer.py \
  scripts/asr/slice_clips.py \
  scripts/asr/requirements.txt \
  scripts/asr/COLAB.md \
  $(find "$CLIPS" -name '*.wav' | head -n 5000)

echo "Wrote $OUT ($(du -h "$OUT" | awk '{print $1}'))"
echo "Upload this zip to Google Drive / Colab, unzip, then follow scripts/asr/COLAB.md"

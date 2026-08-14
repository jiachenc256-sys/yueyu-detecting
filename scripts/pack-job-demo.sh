#!/usr/bin/env bash
# Build a lean offline zip for academic job applications.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/YueyuDetecting_JobDemo.zip}"
STAGE="$ROOT/.tmp-job-demo"
rm -rf "$STAGE"
mkdir -p "$STAGE"

rsync -a \
  --exclude '.git' \
  --exclude '.cursor' \
  --exclude 'node_modules' \
  --exclude '_incoming_audio' \
  --exclude '.tmp-speak' \
  --exclude '.tmp-job-demo' \
  --exclude '.tmp-fangyan' \
  --exclude '*.zip' \
  --exclude 'assets/audio/longmen-kezhai.m4a' \
  --exclude 'assets/learn/ziyin-audio' \
  --exclude 'assets/tanci' \
  --exclude 'YueyuDetecting_*' \
  --exclude 'yueyu-detecting-ziyin-learn.zip' \
  --exclude 'DEVELOPMENT_STAGES.md' \
  --exclude 'EVIDENCE_CHECKLIST.md' \
  --exclude 'FILE_PURPOSES.md' \
  --exclude 'SLIDEROOM_DESCRIPTION.md' \
  "$ROOT/" "$STAGE/YueyuDetecting_JobDemo/"

# Tiny Shengzhou sample set so Dictionary/Learn still demo offline.
mkdir -p "$STAGE/YueyuDetecting_JobDemo/assets/learn/ziyin-audio/shengzhou"
for han in 多 大 人 天 上 下 来 去 好 听; do
  src="$ROOT/assets/learn/ziyin-audio/shengzhou/${han}.m4a"
  if [[ -f "$src" ]]; then
    cp "$src" "$STAGE/YueyuDetecting_JobDemo/assets/learn/ziyin-audio/shengzhou/"
  fi
done
printf '%s\n' \
  '# Offline pack: only a few Shengzhou clips are included to keep size small.' \
  '# Full set is on the live site under assets/learn/ziyin-audio/shengzhou/.' \
  > "$STAGE/YueyuDetecting_JobDemo/assets/learn/ziyin-audio/README.md"

printf '%s\n' \
  'Yueyu Detecting — job demo pack' \
  '' \
  '1. Read METHOD.md (research + engineering summary).' \
  '2. From this folder: python3 -m http.server 8080' \
  '3. Open http://127.0.0.1:8080/ — try Speak → Try sample; FAQ; Dictionary.' \
  '4. Preferred for reviewers: https://yueyudetecting.com' \
  '' \
  'Excluded to keep this zip small:' \
  '- full 新龙门 m4a (~49MB)' \
  '- full Shengzhou per-character audio library (only 10 sample clips offline)' \
  '- tanci page images (use live site for Tanci readers)' \
  '- _incoming_audio and git history' \
  > "$STAGE/YueyuDetecting_JobDemo/00_READ_ME.txt"

rm -f "$OUT"
(cd "$STAGE" && zip -qr "$OUT" YueyuDetecting_JobDemo)
rm -rf "$STAGE"
ls -lh "$OUT"

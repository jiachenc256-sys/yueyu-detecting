#!/usr/bin/env bash
# Create local drop folders for Baidu / private Yueju packs.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Default: repo-local, git-ignored. Override for your own download location:
#   CORPUS_DROP_DIR="/path/to/baidu-yueju" ./scripts/corpus-setup.sh
DROP="${CORPUS_DROP_DIR:-$ROOT/data/corpus/incoming/baidu-yueju}"

mkdir -p \
  "$DROP/videos" \
  "$DROP/audio-or-tracks" \
  "$DROP/_inventory"

README="$DROP/README.txt"
if [[ ! -f "$README" ]]; then
  cat > "$README" <<'EOF'
Yueju corpus drop folder (LOCAL ONLY — do not upload whole packs to GitHub)

1) Download from 百度网盘 APP / desktop client into:
   - videos/          ← 越剧视频 pack
   - audio-or-tracks/ ← 越剧-1451首 pack

2) In the project, run:
   make corpus-inventory

3) Pick a starter set (5–10 pieces) and create manifests under:
   data/corpus/manifests/

Keep share links / extract codes private.
EOF
fi

# Local-only source note (never commit)
LOCAL_NOTE="$(cd "$(dirname "$0")/.." && pwd)/data/corpus/SOURCES.local.md"
if [[ ! -f "$LOCAL_NOTE" ]]; then
  cat > "$LOCAL_NOTE" <<'EOF'
# Local corpus sources (DO NOT COMMIT)

Private researcher notes for Baidu packs. This file is gitignored.

## Pack A — 越剧视频
- pan.baidu.com share (order note): keep extract code offline
- Drop into the videos/ subfolder of the corpus drop folder.

## Pack B — 越剧-1451首
- pan.baidu.com share (order note): keep extract code offline
- Drop into the audio-or-tracks/ subfolder of the corpus drop folder.

## Rights
Acquired for private academic / school research.
Do not redistribute the full packs publicly.
EOF
fi

echo "Ready:"
echo "  $DROP"
echo "  $LOCAL_NOTE"
echo ""
echo "Next: download Baidu packs into videos/ and audio-or-tracks/"
echo "Then: make corpus-inventory"

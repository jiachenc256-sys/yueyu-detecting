#!/usr/bin/env bash
# Yueju Archive — daily project routine
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_DIR="$HOME/Desktop/linguilistic project"
PORT="${PORT:-8080}"

usage() {
  cat <<'EOF'
Yueju Archive routine

Usage: ./scripts/routine.sh <command>

Commands:
  dev           Start local server (port 8080)
  transcript    Rebuild base JSON from Desktop SRT (npm)
  data          Seed MT + merge + validate
  sync-audio    Copy m4a from Desktop into assets/audio/
  status        Git branch + remote status
  setup-remote  Add GitHub remote (needs REPO_URL env var; NEW repo only)
  push          Push current branch to origin
  sync-check    Verify source materials still exist on Desktop

Examples:
  ./scripts/routine.sh dev
  ./scripts/routine.sh data
  REPO_URL=https://github.com/you/yueju-linguistic-archive.git ./scripts/routine.sh setup-remote
  ./scripts/routine.sh push
EOF
}

cmd_dev() {
  cd "$ROOT"
  echo "→ http://localhost:$PORT"
  python3 -m http.server "$PORT"
}

cmd_transcript() {
  cd "$ROOT"
  export PATH="$HOME/.local/node/bin:$PATH"
  npm run build:transcript
}

cmd_data() {
  cd "$ROOT"
  export PATH="$HOME/.local/node/bin:$PATH"
  npm run rebuild:data
}

cmd_sync_audio() {
  cd "$ROOT"
  mkdir -p assets/audio
  cp "$SOURCE_DIR/新龙门客寨.m4a" assets/audio/longmen-kezhai.m4a
  echo "Copied audio → assets/audio/longmen-kezhai.m4a"
}

cmd_status() {
  cd "$ROOT"
  echo "Branch: $(git branch --show-current)"
  git status -sb
  echo ""
  if git remote get-url origin >/dev/null 2>&1; then
    echo "Remote: $(git remote get-url origin)"
  else
    echo "Remote: (none — run setup-remote first)"
  fi
}

cmd_setup_remote() {
  cd "$ROOT"
  if [[ -z "${REPO_URL:-}" ]]; then
    echo "Set REPO_URL first, e.g.:"
    echo "  REPO_URL=https://github.com/you/yueju-archive.git ./scripts/routine.sh setup-remote"
    exit 1
  fi
  if git remote get-url origin >/dev/null 2>&1; then
    git remote set-url origin "$REPO_URL"
  else
    git remote add origin "$REPO_URL"
  fi
  echo "Remote set to $REPO_URL"
}

cmd_push() {
  cd "$ROOT"
  if ! git remote get-url origin >/dev/null 2>&1; then
    echo "No remote configured. Run setup-remote first."
    exit 1
  fi
  git push -u origin HEAD
}

cmd_sync_check() {
  echo "Checking source materials at:"
  echo "  $SOURCE_DIR"
  echo ""
  for f in "新龙门客寨.srt" "新龙门客寨.txt" "新龙门客寨.m4a" "local linguistic project 计划docx.docx"; do
    if [[ -e "$SOURCE_DIR/$f" ]]; then
      echo "  ✓ $f"
    else
      echo "  ✗ $f (missing)"
    fi
  done
}

main() {
  case "${1:-help}" in
    dev)           cmd_dev ;;
    transcript)    cmd_transcript ;;
    data)          cmd_data ;;
    sync-audio)    cmd_sync_audio ;;
    status)        cmd_status ;;
    setup-remote)  cmd_setup_remote ;;
    push)          cmd_push ;;
    sync-check)    cmd_sync_check ;;
    help|-h|--help) usage ;;
    *) echo "Unknown command: $1"; usage; exit 1 ;;
  esac
}

main "$@"

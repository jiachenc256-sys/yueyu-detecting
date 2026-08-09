#!/usr/bin/env bash
# Create and push to a NEW GitHub repository only.
# Refuses to touch any pre-existing personal archive remote.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NEW_REPO_NAME="${NEW_REPO_NAME:-yueju-linguistic-archive}"
VISIBILITY="${VISIBILITY:-private}"

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) is required."
  echo "Install: https://cli.github.com/"
  echo "Then: gh auth login"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Not logged in. Run: gh auth login"
  exit 1
fi

OWNER="$(gh api user --jq .login)"
TARGET="https://github.com/${OWNER}/${NEW_REPO_NAME}.git"

echo "Will publish ONLY to NEW repo:"
echo "  $TARGET"
echo "Visibility: $VISIBILITY"
echo ""
echo "This script will never push to any other repository."
echo ""

# Hard refuse if origin already points elsewhere
if git remote get-url origin >/dev/null 2>&1; then
  current="$(git remote get-url origin)"
  case "$current" in
    *"${NEW_REPO_NAME}"*)
      echo "Origin already points at the new archive repo."
      ;;
    *)
      echo "REFUSING: origin is already set to:"
      echo "  $current"
      echo "Remove or rename that remote first so your old archive stays untouched."
      exit 1
      ;;
  esac
fi

if gh repo view "${OWNER}/${NEW_REPO_NAME}" >/dev/null 2>&1; then
  echo "Repo already exists: ${OWNER}/${NEW_REPO_NAME}"
else
  echo "Creating ${OWNER}/${NEW_REPO_NAME} ..."
  gh repo create "${NEW_REPO_NAME}" \
    --"${VISIBILITY}" \
    --description "Academic Yueju–Shaoxing linguistic archive (new project)" \
    --source=. \
    --remote=origin \
    --push
  echo "Created and pushed."
  exit 0
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  git remote add origin "$TARGET"
fi

git push -u origin HEAD
echo "Pushed current branch to ${TARGET}"
echo "Old archives were not modified."

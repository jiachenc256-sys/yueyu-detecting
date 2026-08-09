.PHONY: help serve open status push setup-remote publish-new branch transcript sync-audio data check corpus-setup corpus-inventory corpus-status

PORT ?= 8080
SOURCE_DIR := $(HOME)/Desktop/linguilistic project
CORPUS_DIR := $(SOURCE_DIR)/baidu-yueju
export PATH := $(HOME)/.local/node/bin:$(PATH)

help:
	@echo "Yueju Linguistic Archive — project routine"
	@echo ""
	@echo "  make serve          Start local dev server on port $(PORT)"
	@echo "  make open           Open archive in default browser"
	@echo "  make data           Seed MT + merge layers + validate"
	@echo "  make check          build + test + validate"
	@echo "  make transcript     Rebuild base JSON from Desktop SRT (npm)"
	@echo "  make sync-audio     Copy m4a from Desktop into assets/audio/"
	@echo "  make corpus-setup   Create Desktop drop folders for Baidu packs"
	@echo "  make corpus-inventory  Scan downloads -> data/corpus/inventory.json"
	@echo "  make corpus-status  Show corpus readiness"
	@echo "  make status         Show git branch and working tree"
	@echo "  make setup-remote URL=<new-repo-url>   Add origin (NEW repo only)"
	@echo "  make publish-new    Create+push NEW GitHub repo yueju-linguistic-archive"
	@echo "  make push           Push current branch to origin"
	@echo "  make branch NAME=cursor/my-feature   Create and switch branch"

serve:
	@echo "Serving at http://localhost:$(PORT)"
	@python3 -m http.server $(PORT)

open:
	@open "http://localhost:$(PORT)"

data:
	@npm run rebuild:data

check:
	@npm run check

transcript:
	@npm run build:transcript

sync-audio:
	@mkdir -p assets/audio
	@cp "$(SOURCE_DIR)/新龙门客寨.m4a" assets/audio/longmen-kezhai.m4a
	@echo "Copied audio -> assets/audio/longmen-kezhai.m4a"

corpus-setup:
	@chmod +x scripts/corpus-setup.sh
	@./scripts/corpus-setup.sh

corpus-inventory:
	@npm run corpus:inventory

corpus-status:
	@./scripts/corpus-status.sh

status:
	@git status -sb
	@git remote -v 2>/dev/null || true

setup-remote:
	@test -n "$(URL)" || (echo "Usage: make setup-remote URL=https://github.com/you/yueju-linguistic-archive.git" && exit 1)
	@echo "$(URL)" | grep -qi 'yueju-linguistic-archive\|yueju-archive' || (echo "Refusing unknown remote name. Use a NEW archive repo URL." && exit 1)
	@git remote get-url origin >/dev/null 2>&1 && git remote set-url origin "$(URL)" || git remote add origin "$(URL)"
	@echo "Remote set to $(URL)"
	@echo "Reminder: do not point origin at any pre-existing personal archive you want left untouched."

push:
	@git remote get-url origin >/dev/null 2>&1 || (echo "No remote. Run: make publish-new   OR   make setup-remote URL=<NEW-repo-url>" && exit 1)
	@git push -u origin HEAD

publish-new:
	@./scripts/publish-new-repo.sh

branch:
	@test -n "$(NAME)" || (echo "Usage: make branch NAME=cursor/my-feature" && exit 1)
	@git checkout -b "$(NAME)"

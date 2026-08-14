.PHONY: help serve open status push setup-remote publish-new branch transcript sync-audio data check corpus-setup corpus-inventory corpus-status asr-export asr-status asr-slice asr-pack-colab

PORT ?= 8080
SOURCE_DIR := $(HOME)/Desktop/linguilistic project
CORPUS_DIR := $(SOURCE_DIR)/baidu-yueju
export PATH := $(HOME)/.local/node/bin:$(PATH)

help:
	@echo "Yueyu Detecting (越语侦听) — project routine"
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
	@echo "  make asr-export     Export ASR gold-clip candidates from transcripts"
	@echo "  make asr-status     Show gold-summary.json minutes / goldOk counts"
	@echo "  make asr-slice      Slice goldOk cues to 16k mono wavs"
	@echo "  make asr-pack-colab Zip clips + scripts for Colab upload"
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
	@cp "$(CORPUS_DIR)/越剧-1451首/越剧、梁祝 - 十八相送钱惠丽单仰萍.mp3" assets/audio/liangzhu-shibaxiangsong.mp3
	@cp "$(CORPUS_DIR)/越剧-1451首/1061-越剧 - 天上掉下个林妹妹.mp3" assets/audio/hongloumeng-tianxia.mp3
	@cp "$(CORPUS_DIR)/越剧-1451首/1132-越剧 - 拷红.mp3" assets/audio/xixiangji-kaohong.mp3
	@cp "$(CORPUS_DIR)/越剧-1451首/越剧 - 祥林嫂 - 袁雪芬 听他一番心酸话.mp3" assets/audio/xianglin-sao-xinsuanhua.mp3
	@cp "$(CORPUS_DIR)/越剧-1451首/1090-越剧 - 五女拜寿 - 花树同园不同根.mp3" assets/audio/wunv-baishou-huashu.mp3
	@cp "$(CORPUS_DIR)/越剧-1451首/越剧名段-575首/02.追鱼.观灯.赵志刚.何赛飞.07年春晚.mp3" assets/audio/zhuiyu-guandeng.mp3
	@cp "$(CORPUS_DIR)/越剧-1451首/1165-越剧 - 碧玉簪 - 新房之中冷清清 樊婷婷.mp3" assets/audio/biyu-zan-xinfang.mp3
	@cp "$(CORPUS_DIR)/越剧-1451首/越剧名段-575首/5.何文秀·算命[无字幕].mp3" assets/audio/he-wenxiu-suanming.mp3
	@echo "Synced starter clip audio into assets/audio/"

corpus-setup:
	@chmod +x scripts/corpus-setup.sh
	@./scripts/corpus-setup.sh

corpus-inventory:
	@npm run corpus:inventory

corpus-status:
	@./scripts/corpus-status.sh

asr-export:
	@npm run asr:export-gold

asr-status:
	@test -f data/corpus/asr/gold-summary.json && cat data/corpus/asr/gold-summary.json || (echo "Run make asr-export first"; exit 1)

asr-slice:
	@./.venv-asr/bin/python scripts/asr/slice_clips.py \
		--manifest data/corpus/asr/gold-clips.jsonl \
		--out-dir data/corpus/asr/clips \
		--only-gold-ok || \
	python3 scripts/asr/slice_clips.py \
		--manifest data/corpus/asr/gold-clips.jsonl \
		--out-dir data/corpus/asr/clips \
		--only-gold-ok

asr-pack-colab:
	@chmod +x scripts/asr/pack-colab.sh
	@./scripts/asr/pack-colab.sh

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

# Yueyu Detecting · 越语侦听

**Sole author:** Alice Chen (Chen Jiachen / Jiachen Chen)  
**Live site:** https://yueyudetecting.com  
**Code:** https://github.com/jiachenc256-sys/yueyu-detecting  

A public **linguistic toolkit and archive** for Yueyu (Shaoxing / Shengzhou-area Wu speech), Yue-opera dialogue, and Qing tanci woodblock reading — with timed multilingual transcripts, learning tools, a draft dictionary, and a reproducible low-resource ASR adaptation experiment.

This is **not** a personal résumé page. It is framed as a public academic / educational resource: hear Yueyu, read aligned dialogue, try recognition baselines, and follow a transparent research path toward better Yueyu ASR.

---

## Authorship

Alice Chen is the **only author and only contributor**. Concept, collection workflow, information architecture, copy, TypeScript app code, data schemas, Learn content, ASR gold-clip pipeline, fine-tune experiment, evaluation, and deployment are independent work.

Ordinary dependencies (not co-authors): TypeScript, Node.js/npm, browser speech APIs, on-device Whisper for demos, Hugging Face for hosting adapter weights, GitHub Pages, Ajv, opencc-js, etc. Media rights remain with their holders.

---

## Project arc (≈ 1–2 years)

1. **Collection year** — gather Yue-opera / radio / tanci materials; select clips; keep raw packs local; inventory rights and metadata.  
2. **Public site + research iteration** — ship the static archive and learning tools; expand Learn / dictionary / FAQ; run a pilot Yueyu ASR adaptation with CER reporting.

Software commits document the site-building and research-tooling phases. Application text lives in `SLIDEROOM_DESCRIPTION.md` and `DEVELOPMENT_STAGES.md`.

---

## What the site does

| Area | What you can do |
| :--- | :--- |
| **Home** | Positioning as a public Yueyu / Wu speech toolkit; clear entry to Speak, Archive, Learn, Dictionary |
| **Speak（听说）** | Mic or upload audio → recognition → 简体 / 繁體 / English; try-sample clips; mobile result tabs |
| **Archive（对话档案）** | Timed Yue-opera / dialogue pieces with plot intros, filters, title search, speaker labels where available |
| **Tanci（弹词）** | Upload woodblock page images for OCR; full flip readers for curated PDFs on the live site |
| **Learn（学习）** | Pinyin guide; leveled 字音 (Shangyu / Zhuji / Shengzhou); Shengzhou speaker audio; Level 5 flashcards with local progress |
| **Dictionary（词典）** | Searchable draft phrases + character lookup tied to the ziyin bank (content grows as paper sources arrive) |
| **FAQ** | Practical Q&A (how recognition works, citing, contributing, inaccurate ASR, etc.) |
| **Speakers（口语）** | On-site catalog for local read-alouds (no external station jumps); clips added as consent allows |
| **Story / Pathways** | Corpus workflow narrative and learner pathways |
| **About** | Pipeline, preliminary linguistic observations, contribute notes, developer / privacy / copyright — including **pilot ASR CER** |

**Languages in the UI:** 简体 · 繁體 · English.

---

## Research track: Yueyu ASR adaptation

Site Speak still uses a **generic on-device Whisper baseline** for privacy-friendly demos. Separately, a pilot adaptation was completed:

| Item | Result |
| :--- | :--- |
| Gold clips | ~124 cues / ~18.4 minutes from corrected archive alignments |
| Hold-out test | 27 clips (whole-piece split: 祥林嫂, 何文秀) |
| Baseline CER | `whisper-tiny` ≈ **42.9%** |
| Adapted CER | `whisper-small` + LoRA ≈ **18.7%** (Δ ≈ −24 pp) |
| Public adapter | https://huggingface.co/ArikaisAllie/yueyu-whisper-small-lora-v1 |

**Honest limits:** small gold set; baseline and adapted model sizes are not matched; not production Yueyu ASR. Next steps: size-matched ablation, more gold data, then wire an adapted model into Speak when hosting is ready.

Full write-up: [`docs/YUEYU_ASR.md`](docs/YUEYU_ASR.md) · numbers: [`data/corpus/asr/runs/cer-v1.json`](data/corpus/asr/runs/cer-v1.json) · model card: [`docs/HF_MODEL_CARD.md`](docs/HF_MODEL_CARD.md)

---

## Tech stack

- **Frontend:** static `index.html` + TypeScript (ES modules) → `scripts/dist/src/`  
- **Styles:** tokenized CSS (`styles/`), including Speak / Tanci / Learn / Dictionary / a11y  
- **Data:** JSON transcripts with layered 简 / 繁 / EN cues; Ajv schema validation; opencc-js for 繁體 seeding  
- **Hosting:** GitHub Pages (`yueyudetecting.com`)  
- **ASR demo:** browser speech API (mic) + on-device Whisper (upload)  
- **ASR research scripts:** Python under `scripts/asr/` (slice, LoRA train, CER eval, Colab notes)  
- **OCR:** configured service URL in `config.json` (no secrets in the public frontend)

---

## Local setup

```bash
npm install
npm run build
npm test
npm run validate
# or: make check

python3 -m http.server 8080
# open http://localhost:8080
```

Useful commands:

```bash
make help
npm run rebuild:data          # MT seed + merge + validate
npm run asr:export-gold       # export archive cues → gold-clips.jsonl
make asr-slice                # cut 16 kHz wavs (needs ffmpeg / imageio-ffmpeg)
make asr-status               # gold-summary.json
```

Node **≥ 20** required.

---

## Repository layout

```text
index.html                 Site shell & panels
src/                       TypeScript sources (app, speak, tanci, ziyin, dictionary, faq, i18n, …)
scripts/dist/src/          Compiled JS served on Pages
scripts/asr/               Yueyu ASR train / eval / Colab helpers
scripts/export-asr-gold.py Export gold-clip candidates from transcripts
styles/                    CSS
data/transcripts/          Timed multilingual pieces
data/translations/         EN / 繁 sidecars
data/learn/                Ziyin character bank
data/dictionary/           Draft phrase dictionary
data/corpus/               Corpus manifests, intros, ASR gold metadata
data/faq.json              FAQ content
assets/                    Audio / tanci / speak samples (selected public clips)
pieces/                    Per-piece HTML viewers
schemas/                   JSON Schema
docs/                      Data model, ASR, dictionary, recording, academic notes
tests/                     Unit tests
```

File-by-file map (if present): [`FILE_PURPOSES.md`](./FILE_PURPOSES.md).

---

## Documentation index

| Doc | Topic |
| :--- | :--- |
| [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) | Transcript / cue layers and statuses |
| [`docs/YUEYU_ASR.md`](docs/YUEYU_ASR.md) | ASR gold → fine-tune → CER → HF |
| [`docs/DICTIONARY.md`](docs/DICTIONARY.md) | Dictionary design notes |
| [`docs/CORPUS_INTAKE.md`](docs/CORPUS_INTAKE.md) | Private pack intake (Baidu / local) |
| [`docs/SPEAKER_RECORDING.md`](docs/SPEAKER_RECORDING.md) | Shengzhou speaker recording checklist |
| [`docs/ACADEMIC_NOTES.md`](docs/ACADEMIC_NOTES.md) | Academic framing notes |
| [`docs/HF_MODEL_CARD.md`](docs/HF_MODEL_CARD.md) | Mirror of the Hugging Face model card |
| [`CITATION.cff`](CITATION.cff) | Citation metadata |

---

## Privacy & rights (short)

- Mic / uploads stay in the browser path described on the About page; do not upload material you cannot process.  
- Large private media packs stay **off** public git; only curated clips and texts ship.  
- Website code, UI, curated transcripts, plot intros, and editorial arrangement are Alice Chen’s project work unless noted.  
- Third-party engines (speech, Whisper, fonts, translation APIs) keep their own terms.  
- Details: live **About → Privacy / Copyright**.

---

## License / citation

See [`CITATION.cff`](CITATION.cff). Prefer citing the live site and this repository for academic use. Media rights remain with their holders.

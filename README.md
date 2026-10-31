# Yueyu Detecting · 越语侦听

**Sole author:** Alice Chen (Chen Jiachen / Jiachen Chen)  
**Live site:** https://yueyudetecting.com  
**Code:** https://github.com/jiachenc256-sys/yueyu-detecting  

A public **linguistic toolkit and archive** for Yueyu (Shaoxing / Shengzhou-area Wu speech), Yue-opera dialogue, and Qing tanci woodblock reading — with timed multilingual transcripts, learning tools, a draft dictionary, and a reproducible low-resource ASR adaptation study that runs **fully on-device in the browser**.


---

## Authorship

Alice Chen is the **only author and only contributor**. Concept, collection workflow, information architecture, copy, TypeScript app code, data schemas, Learn content, ASR gold-clip pipeline, fine-tune / checkpoint-blending experiments, evaluation, ONNX export, and deployment are independent work.

Ordinary dependencies (not co-authors): TypeScript, Node.js/npm, ONNX Runtime Web (WASM), the open Whisper model and PEFT/LoRA + Optimum tooling, Hugging Face for hosting adapter weights, GitHub Pages, Ajv, opencc-js, ffmpeg, jiwer, etc. Media rights remain with their holders.

---

## Project arc (≈ 1–2 years)

1. **Collection year** — gather Yue-opera / radio / tanci materials; select clips; keep raw packs local; inventory rights and metadata.  
2. **Public site + research iteration** — ship the static archive and learning tools; expand Learn / dictionary / FAQ; build a gold corpus and run a size-matched, whole-play-held-out Whisper adaptation study (v1–v13 + checkpoint blends), then deploy the chosen blend on-device.

---

## What the site does

| Area | What you can do |
| :--- | :--- |
| **Home** | Positioning as a public Yueyu / Wu speech toolkit; clear entry to Speak, Archive, Learn, Dictionary |
| **Speak（听说）** | Mic or upload audio → on-device recognition → 简体 / 繁體 / English; try-sample clips; archive lyric retrieval and voice features alongside transcription |
| **Archive（对话档案）** | Timed Yue-opera / dialogue pieces with plot intros, filters, title search, speaker labels where available |
| **Tanci（弹词）** | Upload woodblock page images for OCR; full flip readers for curated PDFs on the live site |
| **Learn（学习）** | Pinyin guide; leveled 字音 (Shangyu / Zhuji / Shengzhou); Shengzhou speaker audio; Level 5 flashcards with local progress |
| **Dictionary（词典）** | Searchable draft phrases + character lookup tied to the ziyin bank (content grows as paper sources arrive) |
| **FAQ** | Practical Q&A (how recognition works, citing, contributing, inaccurate ASR, etc.) |
| **Speakers（口语）** | On-site catalog for local read-alouds (no external station jumps); clips added as consent allows |
| **Story / Pathways** | Corpus workflow narrative and learner pathways |
| **About** | Pipeline, preliminary linguistic observations, contribute notes, developer / privacy / copyright — including the ASR study numbers |

**Languages in the UI:** 简体 · 繁體 · English.

---

## Research track: Yueyu ASR adaptation

Speak runs a **Yueyu-adapted Whisper-small entirely in the visitor's browser**. The deployed weights are an INT8 ONNX export of a merged **checkpoint blend**, not a single LoRA:

- **Deployed checkpoint:** `whisper-small-merged-blend-v10-a0.5`
- **Blend recipe:** `0.5·(0.35·v2 + 0.65·v8b) + 0.5·v10`
- **Payload:** one INT8 encoder + a decoder split into two shards the browser joins before load — about **247 MB**, downloaded and cached once (~15–30 s on first recognition; later runs are offline-capable)
- **Runtime:** ONNX Runtime Web / WASM, no ASR server; mic via `MediaRecorder`, uploads read locally — audio does not leave the device
- **Location:** `assets/asr/yueyu-whisper-small-onnx/` (supersedes the earlier LoRA-v2-only export)

### Corpus and split

The gold corpus is sliced from corrected timed transcripts to 16 kHz mono and scored on text normalized to simplified Chinese with punctuation/whitespace stripped. The test split is by **whole play**, not random cues, so a play can never appear in both train and test.

| Item | Value |
| :--- | :--- |
| Sliced clips | **7,836** |
| Gold-OK clips (enter evaluation) | **7,809** |
| Gold duration | **≈ 668 min** gold-OK (≈ 672 min total; train ≈ 605 min, test ≈ 67 min) |
| Test pieces (whole-play holdout) | `jingchai-ji` 荆钗记 (early ~5 min) + `baitu-ji` 白兔记 (full unseen play) |
| Removed from hard gold | `he-wenxiu-suanming` (lyrics/audio mismatch) and `xianglin-sao-xinsuanhua` (grid fake timestamps) |
| Label QA | 31 worst-scoring test cues re-listened by hand — all gold confirmed |

### Results

**Pilot (n = 27, 2026-08-15 protocol), size-matched, raw unclipped CER.** Raw CER can exceed 1.0 because insertion-heavy loops add characters, so mean/median/worst and a runaway count are all reported. The two generic rows were produced through the **Hugging Face pipeline with greedy decoding and all failure safeguards off**, not the reference openai-whisper backend; a fixed-model control below (§Results, "Decoding-only control") re-runs plain openai-whisper on the same 27 cues.

| Model | mean | median | worst | runaways (≥400 ch) | length within ±20% | exact match |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| Whisper-tiny | 7.31 | 1.43 | 63.43 | 2 | 13/27 | 0 |
| plain Whisper-small (HF pipeline, safeguards off) | 10.70 | 1.71 | 63.43 | 2 | 10/27 | 0 |
| **LoRA-adapted (v2)** | **1.10** | **1.00** | **2.14** | **0** | **25/27** | **0** |

**Clean whole-play study (2026-08-23), mean raw CER, same size-matched baselines.**

| Held-out set | n | tiny | plain small | **deployed blend-v10** | lab adapter v13 (not deployed) |
| :--- | ---: | ---: | ---: | ---: | ---: |
| 荆钗记 Jingchai (seen play) | 39 | 2.16 | 1.51 | **0.85** | 0.81 |
| 白兔记 Baitu (unseen whole play) | 80 | 3.55 | 3.35 | **1.18** | 1.04 |

**Decoding-only control (fixed model, n = 27, reference openai-whisper backend, CPU fp32).** The pilot generic row was produced through the Hugging Face pipeline, so a fixed-model control decodes the **same unadapted Whisper-small checkpoint** twice on the identical cues, changing only the decoder — `greedy_loop` (`temperature=0`, no fallback, `condition_on_previous_text=False`, compression check off) vs `default_hygiene` (temperature fallback tuple, `compression_ratio_threshold=2.4`, `condition_on_previous_text=True`). Same cues, same references as `cer-v2b.json`; the 27-cue evaluation snapshot is kept locally and not published under the current corpus-rights set (the current `gold-clips.jsonl` marks these 27 `goldOk:false` after the 2026-08-23 protocol).

| Same whisper-small, only decoding changes | mean CER | median | worst CER | runaways (≥200 ch) | length ±20% | exact |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| greedy_loop (all safeguards off) | 3.39 | 1.13 | 31.86 | 1 | 9/27 | 0 |
| default_hygiene | **1.91** | 1.25 | 6.57 | **0** | 9/27 | 0 |
| _adapted LoRA v2 (different backend, for reference)_ | _1.10_ | _1.00_ | _2.14_ | _0_ | _25/27_ | _0_ |

**Honest reading.** Backend and decoding, not weights, explain most of the pilot headline: plain openai-whisper greedy already scores 3.39 (not 10.70), and turning on stock safeguards drops it to 1.91 and removes the only ≥200-char runaway (a 223-character subtitle-watermark repeat → a 7-character, CER 1.0 line). Median is essentially flat (1.13→1.25) and length conformance does not move (9/27), so hygiene removes the catastrophic tail but does not teach opera line length or content. The adapted model's edge over hygienic generic (1.10 vs 1.91, 25/27 vs 9/27 length-conformant) is real but **cross-backend**; the rigorous weight-level evidence is the within-pipeline clean whole-play study above (Baitu 3.35 → 1.04), where generic and adapted share the same evaluator. Script: `scripts/asr/eval_decode_control.py`; run log `data/corpus/asr/runs/cer-decode-control.json`.

### How to read the numbers honestly

- The adapter's main, defensible win is **behavioral**: it eliminates runaway repetition and restores sung-line length/register. On the 27-cue pilot, 25/27 outputs land within ±20% of reference length versus 10/27 for plain small.
- It is **not yet transcribing content correctly**: exact match is 0%, and on 21/27 pilot cues the adapted output shared no character with the reference. (The earlier pilot's "max CER = 1.0" note was wrong; the true worst value is **2.14**.)
- On 2026-08-23 the author made an explicit **ceiling decision**: keep the robust, cross-play-tested **blend-v10 in production** and leave the slightly higher-scoring v13 as a laboratory adapter, rather than dropping hard clips to chase a vanity CER of ~0.5.
- Domain is archive Yue-opera; spoken / broadcast Shengzhou Wu gold is a separate, not-yet-covered domain.

**Public adapter:** https://huggingface.co/ArikaisAllie/yueyu-whisper-small-lora-v1 (the deployed blend is merged locally from the v2/v8b/v10 adapters).

Full write-up: [`docs/TECHNICAL_REPORT.md`](docs/TECHNICAL_REPORT.md) · full v1–v13 study log [`docs/YUEYU_ASR.md`](docs/YUEYU_ASR.md) · ceiling decision [`docs/ASR_CEILING_DECISION_20260823.md`](docs/ASR_CEILING_DECISION_20260823.md) · pilot numbers [`data/corpus/asr/runs/cer-v2b.json`](data/corpus/asr/runs/cer-v2b.json) · clean study `data/corpus/asr/runs/cer-protocol-20260823-*.json` · model card [`docs/HF_MODEL_CARD.md`](docs/HF_MODEL_CARD.md).

---

## User validation (August 2026)

Beyond the CER study, the public-facing design was validated in **13 face-to-face, task-based sessions** with three audiences: **4 students** (ages 15–25), **5 older users** (ages 50–70, both Yueyu speakers and non-speakers), and **4 professionals** (two teachers, one archivist, one digital-humanities researcher). Each participant completed guided tasks across Archive, Dictionary / Learn, Hear, Speak, and the Tanci OCR, with 1–5 ratings plus open feedback; older users' forms were filled in by the author during the interview.

What the feedback changed:

- **Persistent text-size / contrast control** — two older users asked for the font-size enlargement to remain visible on every page; it is now the global "Aa Access" panel (saved on the device).
- **Context before content** — older users and a professional reviewer asked for a short introduction before each opera / tanci piece; Archive pieces and Tanci books now carry plot / background intros.
- **OCR export** — the archivist asked for an export of recognition results, which informed the OCR result/export workflow.
- **Pinyin on-ramp** — two students asked for an introduction to Yueyu pinyin, addressed by the Learn pinyin guide.
- **Professional take-up** — all four professionals said they would consider using the platform for teaching or research and were willing to contribute corrections, recordings, or contacts.

The full task sheets, session dates, and per-participant responses are kept in the author's process notebook (not published in this repository, as it contains participant records).

The 13 sessions ran on the working build before public release; the public repository and GitHub Pages deployment went live on 2026-08-09.
---

## Tech stack

- **Frontend:** static `index.html` + TypeScript (ES modules) → `scripts/dist/src/`  
- **Styles:** tokenized CSS (`styles/`), including Speak / Tanci / Learn / Dictionary / a11y  
- **Data:** JSON transcripts with layered 简 / 繁 / EN cues; Ajv schema validation; opencc-js for 繁體 seeding  
- **Hosting:** GitHub Pages (`yueyudetecting.com`)  
- **On-device ASR:** mic (`MediaRecorder`) and upload both run the adapted **INT8 ONNX Whisper-small blend** locally via ONNX Runtime Web / WASM; audio is not sent to a server  
- **ASR research scripts:** Python under `scripts/asr/` (slice, LoRA train, merge/blend, CER eval, decoding control, ONNX export, Colab notes)  
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
scripts/asr/               Slice, LoRA train, merge/blend, CER eval, decoding control, ONNX export / Colab
scripts/export-asr-gold.py Export gold-clip candidates from transcripts
styles/                    CSS
data/transcripts/          Timed multilingual pieces
data/translations/         EN / 繁 sidecars
data/learn/                Ziyin character bank
data/dictionary/           Draft phrase dictionary
data/corpus/               Corpus manifests, gold metadata, ASR run JSON
data/faq.json              FAQ content
assets/asr/                Deployed INT8 ONNX weights (+ v2 backup)
assets/speak/              Lyric index, fingerprint, sample clips
pieces/                    Per-piece HTML viewers
schemas/                   JSON Schema
docs/                      Data model, ASR, dictionary, recording, academic notes
tests/                     Unit tests
```


---

## Documentation index

| Doc | Topic |
| :--- | :--- |
| [`docs/TECHNICAL_REPORT.md`](docs/TECHNICAL_REPORT.md) | Consolidated ASR study: corpus, pilot, decoding control, clean whole-play study, deployment |
| [`docs/YUEYU_ASR.md`](docs/YUEYU_ASR.md) | v1–v13 experiment log, blend recipe, ONNX switch |
| [`docs/ASR_CEILING_DECISION_20260823.md`](docs/ASR_CEILING_DECISION_20260823.md) | The "acknowledge the ceiling, don't chase 0.5" decision |
| [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) | Transcript / cue layers and statuses |
| [`docs/DICTIONARY.md`](docs/DICTIONARY.md) | Dictionary design notes |
| [`docs/CORPUS_INTAKE.md`](docs/CORPUS_INTAKE.md) | Private pack intake (Baidu / local) |
| [`docs/SPEAKER_RECORDING.md`](docs/SPEAKER_RECORDING.md) | Shengzhou speaker recording checklist |
| [`docs/SPEAK_GOLD_COVERAGE_20260824.md`](docs/SPEAK_GOLD_COVERAGE_20260824.md) | Which archive pieces have committed timed transcripts |
| [`docs/ACADEMIC_NOTES.md`](docs/ACADEMIC_NOTES.md) | Academic framing notes |
| [`docs/HF_MODEL_CARD.md`](docs/HF_MODEL_CARD.md) | Mirror of the Hugging Face model card |
| [`CITATION.cff`](CITATION.cff) | Citation metadata |

---

## Privacy & rights (short)

- **Audio stays on-device:** mic input and uploaded audio are recognized locally in WASM and are never transmitted. Outbound requests are limited to (i) the one-time, cacheable download of public weights and site assets, (ii) the tanci OCR service, which receives only the page image you choose to submit, and (iii) the translation API, which receives only text — the recognized transcript, or the tanci page text — when you ask for Traditional Chinese or English. Fonts and static assets come from public CDNs.
- Do not upload material you do not have the right to process. Large private media packs stay **off** public git; only curated clips and texts ship.  
- Website code, UI, curated transcripts, plot intros, and editorial arrangement are Alice Chen's project work unless noted.  
- Third-party engines and assets (Whisper, ONNX Runtime, fonts, the Talcne OCR backend and the Baidu OCR engine it calls, the MyMemory translation API) keep their own terms.
- Details: live **About → Privacy / Copyright**.

---

## Use of AI tools

Generative-AI tools were used only as assistants for **repetitive, mechanical work**
— for example, reformatting and organizing collected materials, bulk data cleanup,
boilerplate scaffolding, and English wording polish. They were not used to design the
project, make research or curation decisions, generate the gold labels, choose the
methodology, or interpret the results.

Every dataset, transcript correction, dictionary entry, experiment, and number in this
repository was produced, checked, and is owned by the author. All model outputs and
AI-suggested edits were treated as untrusted drafts and verified against the source
materials before being kept. The open models and libraries listed above (Whisper,
PEFT/LoRA, ONNX Runtime, etc.) are third-party tools, not AI co-authors.

---

## License / citation

See [`CITATION.cff`](CITATION.cff). Prefer citing the live site and this repository for academic use. Media rights remain with their holders.

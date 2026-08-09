# Academic notes

## Project scope

This website combines:

1. **Speak → Recognize → Translate (Phase A)** — microphone input, baseline speech recognition, then 简体中文 / 繁體中文 / English after a short delay  
2. **Dialogue archive** — collected Yueju materials (beginning with *新龙门客寨*) used for study and later ASR improvement  

The speech target for research/training is:

- **散白** — closer to everyday Shengzhou/Shaoxing speech  
- **韵白** — hybrid stage diction (中州韵 + Wu tonal habits)  
- **唱词** — sung lines with musical timing  

Generic Mandarin ASR and generic machine translation both fail unevenly on these layers. The archive therefore separates:

1. **Source text** (`zh`) with ASR provenance and correction status  
2. **Curated English glosses** for academic reading  
3. **Labeled MT** only where curated English is missing  

## Translation policy

- Curated English aims for **stage meaning** (intelligible gloss), not free literary adaptation.  
- Machine translation is **not authoritative** and must remain labeled in the UI.  
- Researchers citing dialogue should prefer `zh` + `en.status === "curated"`.  
- MT lines may be used for discovery/search only.

## Relationship to everyday 绍兴话

Yue opera is rooted in 嵊州话 (Taihu Wu, Lin-Shao group), but stage 韵白 is a hybrid. Do not equate archive lines with everyday Shaoxing conversation without further annotation.

Useful references for later expansion:

- 吴语学堂 / wugniu Shengzhou materials  
- 《嵊县志·方言编》  
- 钱乃荣《吴语声调实验录》  

## Provenance & ethics

- Original media and SRT remain on the researcher’s Desktop source folder.  
- This repository is a **new academic web archive**. It does not modify any pre-existing GitHub archive.  
- Large audio/video binaries are kept local (`make sync-audio`); the git repository stores structured text data and code.  
- Larger privately acquired packs (e.g. Baidu Yueju collections) use the intake workflow in [`CORPUS_INTAKE.md`](CORPUS_INTAKE.md); raw packs stay local.  
- When releasing datasets publicly, separate licensing for media rights vs. aligned JSON annotations.

## School submission package

For coursework review, the auditable core is:

| Artifact | Why it matters |
|----------|----------------|
| `schemas/piece.schema.json` | Formal data contract |
| `docs/DATA_MODEL.md` | Field semantics |
| `src/` TypeScript modules | Typed merge/viewer logic |
| `tests/` | Precedence and parsing correctness |
| `CITATION.cff` | How to cite this archive |

Run:

```bash
npm install
npm test
npm run validate
npm run build
make serve
```

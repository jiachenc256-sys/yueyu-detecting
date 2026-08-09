# Merging Talcne (弹词) into Yueyu Detecting

## Sister project found

| | |
|---|---|
| **Repo** | [jiachenc256-sys/Talcne](https://github.com/jiachenc256-sys/Talcne) |
| **Name** | 弹词文字识别助手 · MVP |
| **Stack** | Vue 3 + Vite frontend · FastAPI + Baidu OCR backend |
| **Job** | Upload a clear tanci woodblock / print page → OCR → image↔text proofreading |

This site (`yueyu-detecting`) is a timed audio dialogue archive. Talcne is a **text-layer intake** tool for 弹词刻本. Keep both repos; do not force-push or delete Talcne.

## What this site already scaffolds

- Archive filters: **全部 / 越剧 / 弹词 / 广播**
- A **弹词** card that link-outs to Talcne
- A **广播** placeholder for everyday Wu / radio speech
- Piece `category` in the schema (`yueju` \| `tanci` \| `broadcast` \| `other`)
- Story copy that names 吴语, elders, tanci text layers, and radio

## Recommended next merge steps (do not rush)

1. **Keep Talcne as the OCR workbench** until export is stable (save/export JSON of corrected lines).
2. **Define a thin bridge format** from Talcne export → Yueyu piece JSON:
   - either a text-only piece (`audio` optional later), or
   - a `layers.zh` seed with provisional timings once audio exists.
3. **Import one short tanci sample** as `category: "tanci"` under `data/transcripts/`, with speakers if dialogic.
4. **Optional**: iframe or deep-link a deployed Talcne URL from the Archive card instead of only GitHub.
5. **Later**: shared lexicon / “addable words” from OCR corrections feeding Speak recognition.

## Non-goals for the first merge

- Do not copy Baidu API keys or `.env` into this repo.
- Do not vendor the whole Vue/FastAPI app into this static site.
- Do not commit large audio; keep `assets/audio/` gitignored as today.

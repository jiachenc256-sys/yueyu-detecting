# Merging Talcne (弹词) into Yueyu Detecting

## Sister project found

| | |
|---|---|
| **Repo** | [jiachenc256-sys/Talcne](https://github.com/jiachenc256-sys/Talcne) |
| **Name** | 弹词文字识别助手 · MVP |
| **Stack** | Vue 3 + Vite frontend · FastAPI + Baidu OCR backend |
| **Job** | Upload a clear tanci woodblock / print page → OCR → image↔text proofreading |

This site (`yueyu-detecting`) is a timed audio dialogue archive. Talcne is a **text-layer intake** tool for 弹词刻本. Keep both repos; do not force-push or delete Talcne.

## Purpose of the bridge

Talcne produces **corrected text**. Yueyu presents **readable archive pieces** (and timed audio when available). The JSON export is the thin pipe between them so 弹词 is not only an external GitHub card.

## What this site already scaffolds

- Archive filters: **全部 / 越剧 / 弹词 / 广播**
- A **弹词** card that link-outs to Talcne
- A **广播** placeholder for everyday Wu / radio speech
- Piece `category` in the schema (`yueju` \| `tanci` \| `broadcast` \| `other`)
- Story copy that names 吴语, elders, tanci text layers, and radio

## Talcne → Yueyu export format

In Talcne, after proofreading, click **导出 JSON（越语侦听）**. Shape (`schemaVersion: "1.0.0"`):

```json
{
  "schemaVersion": "1.0.0",
  "source": "talcne",
  "target": "yueyu-detecting",
  "exportedAt": "2026-08-10T00:00:00.000Z",
  "script": "zh-Hans",
  "fileNames": ["page1.jpg"],
  "fullText": "…",
  "lines": ["第一句", "第二句"],
  "pages": [{ "page": 1, "text": "…", "lines": ["…"], "blocks": [] }],
  "note": "…"
}
```

Canonical field for import: **`lines`** (non-empty trimmed rows from the editable box).

## Import (this repo)

```bash
node scripts/import-talcne-export.mjs path/to/talcne-yueyu-export.json \
  --id pearl-tower-sample \
  --title "珍珠塔 · 文字层样例" \
  --title-en "Pearl Tower · text-layer sample"
```

Writes `data/transcripts/<id>.json` with `category: "tanci"`, provisional 4s cue timings, and a placeholder `audio` path (add real audio later). Then add an Archive card in `index.html` under `data-archive-category="tanci"`.

Sample fixture: [`data/fixtures/talcne-yueyu-export.sample.json`](../data/fixtures/talcne-yueyu-export.sample.json).

## Recommended next merge steps

1. ~~Stable JSON export from Talcne~~ (button: 导出 JSON（越语侦听）)
2. Run one real OCR → export → `import-talcne-export.mjs` → Archive card
3. Optional: deep-link a deployed Talcne URL from the Archive card
4. Later: shared lexicon from OCR corrections → Speak recognition
5. Later: attach matching audio + real timings

## Non-goals for the first merge

- Do not copy Baidu API keys or `.env` into this repo.
- Do not vendor the whole Vue/FastAPI app into this static site.
- Do not commit large audio; keep `assets/audio/` gitignored as today.

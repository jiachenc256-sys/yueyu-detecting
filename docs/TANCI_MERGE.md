# Merging Talcne (弹词) into Yueyu Detecting

## Sister project

| | |
|---|---|
| **Repo** | [jiachenc256-sys/Talcne](https://github.com/jiachenc256-sys/Talcne) |
| **Job** | Upload tanci woodblock / print page → Baidu OCR → proofread |

This site keeps a **timed listening archive** plus an **in-site Tanci panel** for image OCR. Talcne remains the dedicated OCR workbench / backend. Do not delete Talcne; do not copy Baidu keys into this repo.

## In-site panel (what “combined” means in the UI)

Nav **弹词** (`#tanci`) on this site:

- Image upload only (no microphone — speech stays in Speak)
- Calls Talcne’s `POST /api/ocr` with `FormData` field `file`
- Editable result + **简体 / 繁體 / English** (MyMemory, same pattern as Speak)
- **导出 JSON（档案桥）**
- API base (hidden): `config.json` → `talcneApiBase` (Render URL), else `localStorage.yueyu.talcneApiBase` / `window.__YUEYU_TALCNE_API__`, else `http://127.0.0.1:8000`

```bash
# Terminal 1 — Talcne backend
cd /path/to/Talcne/backend
uvicorn main:app --reload
# health: http://127.0.0.1:8000/api/health
```

Then open Yueyu → **弹词** → choose image → recognize → read translations.

Production OCR backend: `https://talcne.onrender.com` (set in [`config.json`](../config.json)). Ensure Render `CORS_ORIGINS` includes `https://yueyudetecting.com`. Free tier may sleep after ~15 minutes idle.

## Export → archive piece

Export JSON shape (`schemaVersion: "1.0.0"`, `source: "talcne"`) is documented in Talcne’s `docs/YUEYU_EXPORT.md`. Import here:

```bash
node scripts/import-talcne-export.mjs path/to/talcne-yueyu-export.json \
  --id pearl-tower-sample \
  --title "珍珠塔 · 文字层样例" \
  --title-en "Pearl Tower · text-layer sample"
```

Sample fixture: [`data/fixtures/talcne-yueyu-export.sample.json`](../data/fixtures/talcne-yueyu-export.sample.json).

## Non-goals

- Do not vendor the Vue/FastAPI app into this static Pages site.
- Do not put Baidu API keys in this repository.
- Do not commit large audio packs (`assets/audio/` stays gitignored).

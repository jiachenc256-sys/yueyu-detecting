# 越剧档案 · Yueju Archive

A web archive for Yue opera (越剧) linguistic materials — performances, aligned transcripts, and the Yueju–Shaoxing ASR research plan.

## Current phase

**Planning UI** — structure and project docs. No media playback yet.

## Contents

| Tab | Purpose |
|-----|---------|
| **Archive** | Performance index (starting with 新龙门客寨) |
| **Plan** | Full project plan from the linguistic research doc |
| **Dataset** | Yueju-SX open-source package structure |

## Run locally

Open `index.html` in a browser, or serve statically:

```bash
python3 -m http.server 8080
# → http://localhost:8080
```

## Source materials

Original files live at `~/Desktop/linguilistic project/`:

- `新龙门客寨.MOV` / `.m4a` — video & audio
- `新龙门客寨.srt` / `.txt` — timed transcript
- `local linguistic project 计划docx.docx` — research plan

## Next steps

1. Copy/link media into `assets/` with a manifest
2. Clean ASR errors in opening transcript lines
3. Add synced transcript viewer with audio scrubbing
4. Expand archive grid as new pieces are added

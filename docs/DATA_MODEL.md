# Data model

This archive stores timed dialogue as **layered cues**. Chinese (`zh`) is the source layer. English (`en`) and future languages attach as optional layers with explicit status codes.

## Piece file

Path: `data/transcripts/<piece-id>.json`

| Field | Meaning |
|-------|---------|
| `id` | Stable kebab-case identifier |
| `title` / `titleEn` | Chinese and English titles |
| `audio` | Relative path to local audio |
| `sourceSrt` | Provenance filename from the Desktop source bundle |
| `category` | Optional archive taxonomy: `yueju` / `tanci` / `broadcast` / `other` |
| `schemaVersion` | Currently `1.0.0` |
| `cueCount` | Number of cues |
| `correctedCount` | Cues whose `zh.status` is `corrected` or `reviewed` |
| `coverage` | Counts for translation readiness |
| `cues` | Timed dialogue units |

Validated by [`schemas/piece.schema.json`](../schemas/piece.schema.json).

## Cue

| Field | Meaning |
|-------|---------|
| `id` | 1-based index from the source SRT |
| `start` / `end` | Seconds |
| `speaker` | Optional who-is-speaking label (e.g. 梁山伯 / 祝英台 / 旁白) |
| `speakerEn` | Optional English speaker label for EN display |
| `rawAsr` | Original ASR string (research transparency) |
| `layers.zh` | Source 汉字戏词 |
| `layers.en` | Optional English gloss/translation |

`speaker` / `speakerEn` are optional so legacy cues without speakers remain valid.

## Status codes

### `layers.zh.status`

| Value | Use |
|-------|-----|
| `raw` | ASR text unchanged |
| `corrected` | Deterministic or manual cleanup applied |
| `reviewed` | Checked by a human for linguistic accuracy |

### `layers.en.status`

| Value | Authority | UI treatment |
|-------|-----------|--------------|
| `curated` | Academic source of truth | Shown without warning |
| `draft` | Unfinished human work | Shown with “draft” badge |
| `mt` | Machine translation | Shown with “MT — not authoritative” badge |

**Precedence when merging layers:** `curated` > `draft` > `mt`.

## Translation sidecar files

| Path | Role |
|------|------|
| `data/translations/<id>.en.json` | Curated (and draft) English entries keyed by cue `id` |
| `data/translations/<id>.en.mt.json` | Precomputed MT fallback for untranslated cues |

Sidecar entry shape:

```json
{
  "id": 10,
  "text": "This broken door needs fixing again.",
  "status": "curated",
  "source": "archive-editor-2026-08"
}
```

## Build pipeline

1. `npm run build:transcript` — SRT → base Chinese cues  
2. `npm run merge` — merge curated + MT sidecars → validated piece JSON  
3. `npm run validate` — schema check  
4. Viewer reads only the merged piece JSON  

No live translation API keys are required for reproducibility.

# 越剧档案 · Yueju Linguistic Archive

An **academic web archive** for Yue opera (越剧) linguistic materials — timed transcripts, layered Chinese/English dialogue, and the Yueju–Shaoxing ASR research plan.

This repository is a **new archive project**. It does **not** modify any pre-existing GitHub archive. Desktop source media remain untouched.

## What you can do

- Browse the performance archive (starting with **新龙门客寨**)
- Play audio with an active-line transcript
- Switch display language: **中文 / EN / 中·EN**
- Search across Chinese and English layers
- See translation authority badges:
  - **Curated** — academic source of truth
  - **MT — not authoritative** — offline machine/heuristic gloss for gaps

## Academic stack

| Piece | Role |
|-------|------|
| [`schemas/piece.schema.json`](schemas/piece.schema.json) | Formal JSON Schema |
| [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) | Field semantics & merge policy |
| [`docs/ACADEMIC_NOTES.md`](docs/ACADEMIC_NOTES.md) | Scope, ethics, citation notes |
| [`src/`](src/) | Typed TypeScript modules |
| [`tests/`](tests/) | Merge precedence & parsing tests |
| [`CITATION.cff`](CITATION.cff) | How to cite this archive |

Languages in v1: `zh` (source 汉字戏词) + `en` (curated and/or MT).

## Setup

Requires Node.js 20+.

```bash
export PATH="$HOME/.local/node/bin:$PATH"   # if using the local Node install
npm install
npm run rebuild:data    # seed MT + merge layers + validate
npm run build           # compile TypeScript viewer/app
npm test
make sync-audio         # copy m4a from Desktop (gitignored)
make serve              # http://localhost:8080
```

Full rebuild from Desktop SRT:

```bash
npm run prepare:data
```

## Data pipeline

```text
Desktop SRT → build:transcript → *.base.json
curated en.json + en.mt.json → merge → transcripts/*.json (schema v1.0.0)
viewer reads only the merged piece JSON
```

Translation policy (school-safe):

1. Curated English in `data/translations/<id>.en.json` wins
2. Offline MT in `data/translations/<id>.en.mt.json` fills gaps only
3. UI always labels MT as non-authoritative
4. No live API keys required for reproducibility

## Routine

```bash
make help
make serve
make open
make transcript          # python legacy helper still available
make sync-audio
make status

# NEW GitHub repo only — never point this at an old archive
# Requires: gh auth login   (one time)
make publish-new
# or manually:
# make setup-remote URL=https://github.com/YOU/yueju-linguistic-archive.git
# make push
```

`make publish-new` / `scripts/publish-new-repo.sh` will **only** create/push `yueju-linguistic-archive` and will refuse if `origin` already points at a different repo.

## Source materials (local, untouched)

`~/Desktop/linguilistic project/`:

- `新龙门客寨.MOV` / `.m4a`
- `新龙门客寨.srt` / `.txt`
- research plan documents

## School check

```bash
npm run check
```

Expected: TypeScript build succeeds, tests pass, piece JSON validates against the schema.

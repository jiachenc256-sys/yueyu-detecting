# Dictionary data notes

## Characters
Sourced from `data/learn/ziyin.json` (levels 1–4). Shengzhou playback uses:

`assets/learn/ziyin-audio/shengzhou/<han>.m4a`

## Phrases
File: `data/dictionary/phrases.json`

| Field | Meaning |
|-------|---------|
| `id` | Stable id (`p001`…) |
| `zh` | Display phrase (draft Mandarin/Yueyu practice text) |
| `en` | English gloss |
| `scene` | `greet` / `buy` / `ask` / `family` / `weather` / `theatre` / `daily` |
| `chars` | Optional related characters |
| `note` | Optional usage note |

To extend: append items, keep ids unique, then refresh the Dictionary panel (no rebuild required beyond static deploy).

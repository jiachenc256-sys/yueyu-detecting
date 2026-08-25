# Dictionary data notes

## Characters
Primary: `data/dictionary/shengzhou-chars.json` (from `shengzhou-1000/shengzhou-1000.csv`).

| Field | Meaning |
|-------|---------|
| `id` | Book id `0001`… |
| `han` / `hanDisplay` | Character (display may include sense e.g. `磨(动)`) |
| `rhyme` | 音韵地位 |
| `oldMale` / `youngMale` | 老男音 / 青男音 |

Shangyu / Zhuji / Mandarin pinyin are merged from `data/learn/ziyin.json` when the same `han` exists. Shengzhou playback still uses `assets/learn/ziyin-audio/shengzhou/<han>.m4a` + `shengzhou-audio-hans.json`.

## Phrases
Primary: `data/dictionary/shengzhou-phrases.json` (from `shengzhou-phrases/shengzhou-phrases.csv`).

| Field | Meaning |
|-------|---------|
| `id` | `sz` + book id |
| `zh` | 词条 |
| `reading` | 方言注音 (han + IPA) |
| `scene` | Book category key (`plant`, `action`, …) |
| `category` / `part` | Chinese labels |
| `chars` | Hans extracted from 词条 for cross-links |

Category chips: `data/dictionary/shengzhou-phrase-scenes.json`.

Legacy learner draft file `phrases.json` is retained for reference but **not** loaded by the Dictionary panel.

## Rebuild from CSV
```bash
python3 scripts/build-shengzhou-dictionary.py
```

# METHOD — Yueyu Detecting

## Problem
Wu / Yueyu speech (Shaoxing–Shengzhou area) and Yue-opera stage dialect are hard to hear, align, and teach with Mandarin-centric tools. Archive material exists, but public demos rarely connect **ASR → readable multilingual text → linguistic comparison**.

## Pipeline
1. **Collect / curate** — Yue-opera starter clips, tanci image pages, Shengzhou character recordings; spoken Speakers track planned.
2. **Transcribe / align** — timed cues with Simplified / Traditional / English layers; human correction where ASR fails (especially 韵白).
3. **Validate** — native-speaker / enthusiast listening goals (Story stages).
4. **Feed back** — Speak demo (browser Whisper + translation), Learn charts, Dictionary (chars + phrases).

## Linguistics angle
- Three-place character contrasts (Shangyu / Zhuji / Shengzhou) with Mandarin pinyin as gloss anchor only.
- Shengzhou audio as first reproducible gold path.
- Preliminary observations: same character, different finals/tones across counties; sanbai vs yunbai difficulty for generic ASR.

## CS angle
- Static site (HTML/CSS/TS) deployable to GitHub Pages.
- On-device Whisper for uploads/samples; Web Speech API for mic.
- Multilingual UI i18n; Archive filters + search; Dictionary search over `ziyin.json` + `phrases.json`.

## Limits
- Baseline ASR is not Yueyu-specialized.
- Phrase list is a draft for native correction.
- Speakers read-alouds are not yet published as playable clips.
- Full private corpora stay local; public site ships curated clips.

## Next steps
- Native review of dictionary phrases; expand scenes.
- First consented speaker read-alouds on-site.
- Contribution intake for photos / proofreading.
- Optional evaluation set from gold transcripts → Speak error analysis.

# Speaker recording checklist — Learn tools (字音)

**Goal:** Let learners hear a real speaker for each character (or line), not browser TTS.  
**Owner:** Alice Chen (Chen Jiachen)  
**Pilot scope:** start with **Shengzhou** only, **Level 1** (~30–50 characters).

This is a **listening demo** (“Hear a speaker”). It is separate from Speak → Recognize (learner’s own mic).

---

## 1. Who to recruit

Prefer people who:

- Speak **Shengzhou / Shaoxing-area** Wu comfortably, **or** know Yue opera 韵白 / 念白
- Can record in a quiet room for 20–40 minutes
- Will sign a short consent (name or “anonymous local speaker”, year, place)

Avoid promising money unless you already have a budget; offer clear credit on the site if they agree.

---

## 2. Consent (keep a copy)

Ask each speaker to confirm in writing (email / WeChat is fine):

- [ ] I agree that short clips of my voice may be used on Yueyu Detecting for education.
- [ ] Display name on site: ________ (or “Local speaker”)
- [ ] Place / variety: ________ (e.g. Shengzhou)
- [ ] Date: ________

---

## 3. Recording setup

| Item | Recommendation |
| :--- | :--- |
| Device | Phone voice-memo or computer mic is OK for pilot |
| Room | Quiet; phone ~20 cm from mouth |
| Format | Export **m4a** or **mp3**, mono, ~44.1 kHz |
| Length | **1–2 seconds** per character (say the word once, clearly) |
| Pace | One character → pause → next; do not rush |

Script prompt (Chinese):  
「请用嵊州话读这个字，只读一遍，稍慢、清楚。」

English:  
“Please say this character once in Shengzhou speech, slowly and clearly.”

---

## 4. File naming (required)

Put files here:

```text
assets/learn/ziyin-audio/shengzhou/<汉字>.m4a
```

Examples:

```text
assets/learn/ziyin-audio/shengzhou/多.m4a
assets/learn/ziyin-audio/shengzhou/大.m4a
assets/learn/ziyin-audio/shengzhou/人.m4a
```

Optional later:

```text
assets/learn/ziyin-audio/shangyu/<汉字>.m4a
assets/learn/ziyin-audio/zhuji/<汉字>.m4a
```

Or set an explicit path in `data/learn/ziyin.json`:

```json
{
  "han": "多",
  "pinyin": "duō",
  "shangyu": "tɷ35",
  "zhuji": "tɤu544",
  "shengzhou": "to534",
  "level": 1,
  "audio": {
    "shengzhou": "assets/learn/ziyin-audio/shengzhou/多.m4a",
    "speaker": "Local speaker · Shengzhou · 2025"
  }
}
```

---

## 5. Pilot word list (Level 1 starter)

Record these first (same order as the Level 1 cards when possible):

多 大 锣 左 歌 个 河 可 火 我  
破 婆 磨 过 果 货 坐 锁 箩 驼  
人 好 头 口 手 走 来 去 上 下

(Adjust to whatever is actually in Level 1 if the bank shifts.)

---

## 6. After recording

1. Normalize loudness roughly (optional: export at similar volume).  
2. Drop files into `assets/learn/ziyin-audio/shengzhou/`.  
3. Optionally add `"audio": { "shengzhou": "…", "speaker": "…" }` on those items in `ziyin.json`.  
4. Hard-refresh Learn tools → **Pronunciation** → click **Hear Shengzhou**.  
5. Credit speakers on About (if they want named credit).

---

## 7. What not to do (yet)

- Do not record all ~900 characters before the pilot works in the UI.  
- Do not replace curated IPA with audio-only.  
- Do not put huge raw session files in git; only short per-character clips.  
- Do not mix this with the Speak mic demo in the same button.

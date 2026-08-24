# Speak 两路径增强计划

日期：2026-08-23  
作者：Alice Chen（sole author）  
目标：在字级 CER 见顶后，把「能用」做强——先档案、后腔调。

## 路径回顾

1. **① 档案检索** — 这段 radio/音频是否已在本站语料  
2. **② 腔调·语调** — 未命中时，用能量/起伏/音色粗估情绪（悲急怒柔亢叹）

## 分期

### P0 · 本轮落地（高性价比）

| 项 | 说明 |
|----|------|
| 选剧目 | 识别前可选「不限 / 某出戏」，缩小档案检索 |
| 置信度条 | 档案对齐分、情绪分可视化 |
| 打开档案 | 命中后一键跳到 `pieces/{id}.html#cue-N` |

### P1 · 下一轮

| 项 | 说明 | 状态 |
|----|------|------|
| 播放进度锚定 | 整段戏跟读时，只搜当前时间前后句 | ✅ 2026-08-23 |
| 场景白话卡 | 每出戏预写短大意（「江边送十朋赴考」），少套话 | ✅ 2026-08-23 |
| 音频指纹查重 | 真正按声纹/指纹判「是否在库」，不依赖识别错字 | ✅ 轻量版 2026-08-23 |

资产：`assets/speak/scene-cards.json`、`assets/speak/audio-fingerprints.json`（lyric-index v2 含 start/end）

### P2 · 匹配与雷达（2026-08-23）

| 项 | 说明 | 状态 |
|----|------|------|
| 更好文本匹配 | 汉字 bigram + 拼音 bigram 混合打分 | ✅ `pinyin-map.json` |
| 白话大意增强 | 命中后更少套话；场景卡优先 | ✅ `analyzeGist` |
| 按场次/戏雷达 | 分戏主题轴标签（`piece-radar.json`） | ✅ |
| 情绪粗估加强 | flux / voicedRatio + 分戏先验 | ✅ 浏览器音频特征 |

资产：`assets/speak/pinyin-map.json`、`assets/speak/piece-radar.json`

### P3 · 本地白话一句（2026-08-23）

| 项 | 说明 | 状态 |
|----|------|------|
| 模板白话 | 戏名 + 场景卡 + 档案句 → 一句白话 + EN（本地规则，无外呼） | ✅ `composeVernacular` |
| 场景卡补密 | 梁祝 / 祥林嫂分时间窗 | ✅ |

## 明确不做（近期）

- 不靠继续猛训硬冲 CER 0.5 作为主线  
- 不把情绪路径伪装成「听清了唱词」  
- 不把摘要或情绪判断外包给第三方在线接口

## 2026-08-24 · Speak 十一项补强（不含 portfolio packet）

| # | 项 | 状态 |
|---|----|------|
| 1 | Open-archive：22 出补 `pieces/*.html` + `PIECE_PAGES` | ✅ |
| 2 | Scene cards 扩至 27 戏 | ✅ |
| 3 | Piece radar 扩至 27 戏 | ✅ |
| 4 | Fingerprints 扩至 712（含梁祝/牡丹亭等）；`scripts/asr/build_audio_fingerprints.py` | ✅ |
| 5 | Demo path 文案 + 示例自动选戏 | ✅ |
| 6 | Limits 文案（启发式 / blend-v10 / 非 0.5） | ✅ |
| 7 | Weak-match：无高置信命中 + 参考候选 | ✅ |
| 8 | Gold coverage 笔记 + 待提交 transcripts | ✅ 见 `docs/SPEAK_GOLD_COVERAGE_20260824.md` |
| 9 | 保持 v10 上线（决策笔记） | ✅ |
| 10 | `.gitignore`：`.cursor/`、`_incoming_audio/`、zip/bak | ✅ |
| 11 | Mobile Speak：触控、全宽筛选、sticky status | ✅ |

## 2026-08-24 · 语言学 / 场景对齐（申请前约 2 个月）

| # | 项 | 状态 |
|---|----|------|
| L1 | 语言学卡片覆盖全部 35 出 lyric-index | ✅ `piece-linguistics.json` |
| L2 | 命中后结构化语言学 note（genre / register / roles / listen） | ✅ |
| L3 | Scene cards + piece radar 对齐至 35 出（补 8 出缺口） | ✅ `?v=20260824rich2` |
| L4 | 说话人：碧玉簪 / 西厢拷红 / 何文秀算命 → cue-speakers **114** | ✅ `build_cue_speakers.py` |
| L5 | 短选段场景加密 + 龙门客栈 7 窗再校 | ✅ |
| L6 | 指纹补薄戏（+143 → **855**；珍珠塔暂无本地 wav） | ✅ |
| L7 | 保持 **blend-v10** 上线；不冲 CER 0.5 | ✅ 仍有效 |

### 申请前剩余富化（按性价比，不含 portfolio packet）

| 周次（约） | 焦点 | 产物感觉 |
|-----------|------|----------|
| ✅ W1–2 | 说话人扩到 7 出 / 114 cues | 命中后能点名「谁在唱」 |
| ✅ W3–4 | 短选段 scene 更密 + 龙门客栈分段再校 + 指纹补薄 | 白话/查重更贴 |
| 接下来 | 真机 QA：弱命中 / 指纹 / Try sample / EN 文案 | 演示不翻车 |
| 再后 | 首页 / About 诚实叙事 + 证据链（gold coverage） | 申请材料可截图 |
| 之后 | Portfolio 录音包（单独排期） | 不挡产品主线 |

**ASR：** 现场 Speak 继续 **blend-v10**；dual metrics / ceiling 决策不变（见 `docs/ASR_CEILING_DECISION_20260823.md`）。

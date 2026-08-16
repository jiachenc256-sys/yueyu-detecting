# 越语 ASR：从档案到可上线模型

**作者：** Alice Chen（Chen Jiachen）独立完成。

目标：把「听说」接到**在越语/越剧语料上微调过的模型**（设备端）。  
不做用户反馈邮箱；主线是金标语料 → 微调 → CER → 上线。

## 现状（仓库里已有）

| 资产 | 说明 |
|------|------|
| `data/transcripts/*.json` | 带时间轴的校对台词（`zh.status` = corrected/reviewed） |
| `assets/audio/*.mp3` 等 | 与档案页同步的短选段 |
| 粗估 | 约 **2173 句 / ~210 分钟** 金标（`goldOk=true`；含龙门 + 四部新戏字幕） |
| Speak 权重 | `assets/asr/yueyu-whisper-small-onnx/`（**blend-v10 a0.5** → INT8 ONNX；decoder 分片；旧 v2 备份在 `…-v2-backup/`） |

## 试点 CER

### v2 同尺寸消融（推荐引用 / 线上权重，2026-08）

同一测试集 n=27（祥林嫂 + 何文秀整部留出）；原始 CER 均值（可 >1，因插入／循环）：

| 模型 | meanCer (raw) | exact match |
|------|---------------|-------------|
| `openai/whisper-tiny` | 7.3 | 0% |
| `whisper-small`（无 LoRA） | 10.7 | 0% |
| `whisper-small` + LoRA v2（加长训练） | **1.1** | 0% |
| 合并后 checkpoint（`whisper-small-merged-v2`） | **1.1** | 0% |
| Δ（LoRA − plain small） | **−9.6** | — |

数字：[`data/corpus/asr/runs/cer-v2b.json`](../data/corpus/asr/runs/cer-v2b.json)、[`cer-merged-v2.json`](../data/corpus/asr/runs/cer-merged-v2.json)。

### v3 扩金标实验（2026-08-15；未换线上权重）

龙门客寨字幕校对后，候选金标约 **103 min**（训练约 98 min，测试仍 4.7 min）。同测试集 n=27：

| 适配器 | 训练数据 | meanCer (raw) | Δ vs plain small |
|--------|----------|---------------|------------------|
| LoRA v2（线上） | ~14 min 多戏混合 | **1.1** | **−9.6** |
| LoRA v3 | 全量龙门主导 ~98 min | 4.2 | −6.5 |
| LoRA v3b | 非龙门全留 + 龙门抽 ~30 min | 1.36 | −9.3 |
| LoRA v3c | v2 热启动 + 均衡集续训 | 2.31 | −8.4 |

**结论：** 把龙门全量灌进训练会伤留出 CER；均衡抽样接近 v2，但尚未超过。线上 Speak 继续用 v2，直到有更好 holdout。数字：`cer-v3.json` / `cer-v3b.json` / `cer-v3c.json`。

### v4 四部新戏入库（2026-08-15 夜）

新增字幕对齐金标：钗头凤 / 陈三两 / 白兔记 / 梁祝·下（本地 `assets/audio/*.m4a`，gitignore）。全库金标约 **210 min**（`goldOk`）。

| 适配器 | 训练策略 | 旧留出 meanCer (n=27) | 新戏抽样 CER (n=40) |
|--------|----------|----------------------|---------------------|
| LoRA v2（线上） | ~14 min 多戏 | **1.10** | 1.15 |
| LoRA v4 | v2 热启动 + 新戏全量 + 龙门封顶 | 1.26 | **1.08** |
| LoRA v4b | 每部大戏封顶 ~18 min | 2.39 | — |

**结论：** 新戏域上 v4 略好，但官方留出（祥林嫂+何文秀）仍是 v2 更好 → **今晚不换线上 ONNX**。数字：`cer-v4.json` / `cer-v4-domain-sample.json`。

### v5 正确留出协议（2026-08-16）

方法：测试 = 祥林嫂 + 何文秀 + **整部白兔记不进训练**；训练 = 其余戏，龙门/陈三两各封顶 ~18 min；**从零**训 LoRA（不热启动 v2）。

| 系统 | 旧留出 n=27 | 白兔记抽样 ~10 min (n=77) |
|------|-------------|---------------------------|
| plain `whisper-small` | 10.7 | 7.5 |
| LoRA v2（线上） | **1.10** | 2.08 |
| LoRA v5（新协议） | 1.52 | **0.99** |

**解读：** v5 在「没见过的全剧」上大幅好于 v2（2.08→0.99），但旧窄留出退步（1.10→1.52）。线上暂仍 v2；若产品更在意生戏泛化，可改挂 v5。数字：[`cer-v5.json`](../data/corpus/asr/runs/cer-v5.json)。

### v6 双指标冲刺（2026-08-16）

新增训练候选：狸猫换太子、荆钗记（入库；训练时与龙门/陈三两一并封顶）。验收目标：旧留出 ≤1.2 且白兔抽样 ≤1.1。

| 系统 | 旧留出 | 白兔抽样 | 双过？ |
|------|--------|----------|--------|
| v2 | **1.10** | 2.08 | 否 |
| v5 | 1.52 | **0.99** | 否 |
| v6（含新两部封顶、从零） | 1.34 | 1.55 | 否 |
| v6b（v5 热启动+短选段加重复习） | 1.42 | 1.22 | 否 |

**结论：** 新全剧扩面后仍未双达标；再堆长全剧容易两头不讨好。下一步优先 **与旧留出同域的短选段**（祥林嫂/何文秀风格、经典短唱），而不是再加 2 小时全剧。数字：`cer-v6.json` / `cer-v6b.json`。

### v7 短场扩面（2026-08-16）

入库：步步惊心五场短折 + 梁祝十八相送完整版（陈丽君/李云霄）。验收仍：旧 ≤1.2 且白兔 ≤1.1。

| 系统 | 旧留出 | 白兔抽样 | 双过？ |
|------|--------|----------|--------|
| v2 | **1.10** | 2.08 | 否 |
| v5 | 1.52 | 0.99 | 否 |
| v7（v5 热启动+短场） | 1.43 | **0.96** | 否（生戏过、旧戏未过） |
| v7b（v2 热启动+仅短场） | 4.30 | 1.33 | 否（步步惊心域偏移伤旧留出） |

**结论：** 短场有助于生戏，但步步惊心与祥林嫂/何文秀域差仍大，**旧留出未回到 ≤1.2**。线上仍 v2。更需要：袁雪芬系/经典悲剧短选段等同域材料。数字：`cer-v7.json` / `cer-v7b.json`。

### v8 经典短段扩面（2026-08-16）

入库：葬花吟 + 五女拜寿 1–4。全库约 **505 min** `goldOk`。训练：`gold-clips-balanced-v8.jsonl`（葬花吟 3×；五女/全剧封顶 12 min；步步惊心各封顶 8 min；v5 热启动）。

| 系统 | 旧留出 | 白兔抽样 | 双过？ |
|------|--------|----------|--------|
| v2 | **1.10** | 1.79 | 否 |
| v5 | 1.52 | 0.99 | 否 |
| v7 | 1.43 | 1.39 | 否 |
| v8 | 1.41 | **0.98** | 否（生戏略好、旧戏仍未回 ≤1.2） |

**结论：** 葬花吟有助于生戏（白兔最佳），但旧留出仅从 v7 的 1.43 → 1.41，**仍未双达标**。线上继续 v2。数字：[`cer-v8.json`](../data/corpus/asr/runs/cer-v8.json)。

### v2⊕v8 权重插值（2026-08-16）

公式：`W = (1−α)·W_v2 + α·W_v8`（先各自 merge LoRA 再线性混合）。同双指标集：

| α（v8 比重） | 旧留出 | 白兔 | 双过？ |
|-------------|--------|------|--------|
| 0（纯 v2） | **1.10** | 1.79 | 否 |
| 0.35 | 1.22 | 1.22 | 否（最接近两端） |
| 0.50 | 1.34 | **1.01** | 否（生戏过、旧戏未过） |
| 1（纯 v8） | 1.41 | **0.98** | 否 |

**结论：** 线性混合能在两端之间折中，但**没有 α 同时 ≤1.2 且 ≤1.1**。下一步更靠谱的是 **v2 热启动 + v8 语料续训（v8b）**，而不是再扫混合比。数字：[`cer-v2v8-blend.json`](../data/corpus/asr/runs/cer-v2v8-blend.json)。

### v8b：v2 热启动 + v8 语料（2026-08-16）

同一均衡清单 `gold-clips-balanced-v8.jsonl`，从 **LoRA v2** 续训 600 steps。

| 系统 | 旧留出（≤1.2） | 白兔（≤1.1） | 双过？ |
|------|----------------|--------------|--------|
| v2 | **1.10** ✓ | 1.79 | 否 |
| v8 | 1.41 | **0.98** ✓ | 否 |
| v8b | **1.19** ✓ | 1.39 | 否 |

**结论：** v2 热启动成功把旧留出拉回 ≤1.2，但生戏从 v8 的 0.98 退到 1.39，**仍未双达标**。线上继续 v2。数字：[`cer-v8b.json`](../data/corpus/asr/runs/cer-v8b.json)。

### 保留两边：v2⊕v8b 权重混合（2026-08-16）

把「旧戏强」的 v2 与「续训后仍偏旧、又带一点新语料」的 v8b 做全量权重插值。细扫后：

| 配方 | 旧留出 | 白兔 | 双过？ |
|------|--------|------|--------|
| **0.35·v2 + 0.65·v8b** | **1.17** ✓ | **1.00** ✓ | **是** |

检查点：`data/corpus/asr/runs/whisper-small-merged-v2-v8b-w0.65`（已 merge 的完整 Whisper-small，非 LoRA）。  
数字：[`cer-keep-both-fine.json`](../data/corpus/asr/runs/cer-keep-both-fine.json)。上线前需再导出 INT8 ONNX 并做一次复核。

错误分析（同检查点）：[`worst-clips-v2v8b-blend.md`](../data/corpus/asr/runs/worst-clips-v2v8b-blend.md) — 主因是**听错成别的句子**（非循环解码）；94 句里 exact match = 0，CER≥1 有 74 句。

### v9 清洗续训尝试（2026-08-16）

在双过混合权重上挂 LoRA，用过滤后的经典重清单（删 194 条密度/时轴可疑句；葬花等 4×；低 LR 400 steps）。

| 系统 | 旧留出 | 白兔 | 双过？ |
|------|--------|------|--------|
| blend v2⊕v8b | **1.17** | 1.00 | **是** |
| v9（续训后） | 1.22 | **0.97** | 否 |

**结论：** 自动清洗+续训能略降生戏 CER，但一碰就会把旧留出顶出 1.2；与 blend 再混合也无法双过。当前仍以 **blend** 为最佳可用检查点。再提绝对准确率需要**更多同域精标短段**（祥林嫂/何文秀风格），不是再自动堆训。数字：[`cer-v9.json`](../data/corpus/asr/runs/cer-v9.json)。

### v10 牡丹亭 + para 折子（2026-08-16）

入库：`mudanting-huanhunji`（训练封顶 10 min）、`para-2`、`para-3`。跳过 `para-1`（与 para-3 大量重叠）；**`para-7.mov` 无音轨**，无法入库。

| 系统 | 旧留出 | 白兔 | 双过？ |
|------|--------|------|--------|
| blend v2⊕v8b | **1.17** | 1.00 | **是** |
| v10 纯续训 | 2.41 | 0.99 | 否（旧戏崩） |
| **0.5·blend + 0.5·v10** | 1.17 | **0.99** | **是**（生戏略好） |

新检查点：`data/corpus/asr/runs/whisper-small-merged-blend-v10-a0.5`。数字：[`cer-v10.json`](../data/corpus/asr/runs/cer-v10.json)。

### v11 红楼梦 1–5（2026-08-16）

入库：`hongloumeng-1..5`（各封顶 10 min、4× 加重）；跳过 `hongloumeng-6`（与 5 约 88% 重叠）。在 blend-v10 上续训。

| 系统 | 旧留出 | 白兔 | 双过？ |
|------|--------|------|--------|
| blend-v10 a0.5 | **1.17** | **0.99** | **是** |
| v11 | 1.27 | 0.99 | 否 |

**结论：** 红楼分段入库后生戏几乎不动，旧留出略退；与 v11 再混合也无法双过。继续以 **blend-v10 a0.5** 为最佳检查点。数字：[`cer-v11.json`](../data/corpus/asr/runs/cer-v11.json)。

**公开 LoRA（HF）：** [`ArikaisAllie/yueyu-whisper-small-lora-v1`](https://huggingface.co/ArikaisAllie/yueyu-whisper-small-lora-v1)

**产品：** 「听说」麦克风与上传均走本站适配 ONNX。口语/电台金标是后续域扩展，不在当前适配域内。

**诚实边界：** exact match 仍约 0%。主声明引用同尺寸 `deltaCerAdaptedMinusSmall`。

### v1 早期对照（2026-08-14，Colab；体量不对等，仅作历史）

| 模型 | 测试集 n | 平均 CER |
|------|----------|----------|
| `openai/whisper-tiny`（基线） | 27 | **42.9** |
| `whisper-small` + LoRA（适配） | 27 | **18.7** |
| Δ（adapted − baseline） | | **−24.2** |

原始数字：[`data/corpus/asr/runs/cer-v1.json`](../data/corpus/asr/runs/cer-v1.json)。

## 四步流程

```text
1. 导出候选句  →  2. 你人工确认  →  3. 切片 + 微调  →  4. CER 后换网站模型
   npm run asr:export-gold      改 register / goldOk     Colab/本地 GPU      HF + speak.ts
```

### 1. 导出候选

```bash
npm run asr:export-gold
# 或
make asr-export
```

写出：

- `data/corpus/asr/gold-clips.jsonl` — 每行一条训练候选
- `data/corpus/asr/gold-summary.json` — 分钟数 / 训练测试划分统计

默认：**整部作品**留作测试（避免同一出戏泄漏），其余进训练。

### 2. 你每天要做的（不可替代）

打开 `gold-clips.jsonl`，对每条（或每天抽 10–20 条）：

1. 听对应时间段音频（档案页点时间戳，或切片后听 wav）
2. 确认 `text` 是否真是「你愿意当正确答案」的字
3. 填 `register`：`sanbai` | `yunbai` | `changci` | `spoken` | `other`
4. 设 `goldOk`: `true`（通过）或 `false`（丢掉）
5. 需要改字就改 `text`，并设 `zhStatus` 为 `reviewed`

**四周目标：** 先把现有 ~19 分钟全部 `goldOk=true`；同时继续往档案加选段，冲 **30–60 分钟**。

### 3. 切片 + 微调

```bash
make asr-slice          # 切出 data/corpus/asr/clips/*.wav
make asr-pack-colab     # 生成 data/corpus/asr/yueyu-asr-colab.zip
```

然后打开 [`scripts/asr/COLAB.md`](../scripts/asr/COLAB.md) 上 Colab。

### 4. 评测（必须有数字再宣传）

同尺寸消融（tiny / plain small / small+LoRA）已跑通，见 `cer-v2b.json`。扩金标后请重跑：

```bash
make asr-eval-v2
# 或：
./.venv-asr/bin/python scripts/asr/eval_cer.py \
  --manifest data/corpus/asr/gold-clips.jsonl \
  --clips-dir data/corpus/asr/clips \
  --tiny openai/whisper-tiny \
  --small openai/whisper-small \
  --adapted data/corpus/asr/runs/whisper-small-lora-v1 \
  --out data/corpus/asr/runs/cer-v2.json
```

把 `cer-v2.json` 写进技术报告 / About——**没有跑通评测就不要写「准确率提升」**。重点引用 `deltaCerAdaptedMinusSmall`（同尺寸下的适配增益）。

### 5. 上线（已完成试点）

1. 合并 / 选用双过检查点（当前：**blend-v10 a0.5**）  
2. Optimum 导出 ONNX + INT8 量化 → `assets/asr/yueyu-whisper-small-onnx/`（decoder 分片）  
3. [`src/speak.ts`](../src/speak.ts) 麦克风（MediaRecorder）与上传均加载该本地模型  

**2026-08-16 已换：** Speak 本地权重由 LoRA v2 改为 `whisper-small-merged-blend-v10-a0.5`（双过：旧≈1.17 / 白兔≈0.99）。旧 v2 ONNX 备份：`assets/asr/yueyu-whisper-small-onnx-v2-backup/`。

可选：用 `scripts/asr/upload-onnx-hf.sh` 再镜像到 Hugging Face。口语/电台金标另开域，不假设被越剧 LoRA 覆盖。

静态 GitHub Pages **不能训练**；可以 **加载仓库内托管的权重**。

## 字段说明（jsonl）

| 字段 | 含义 |
|------|------|
| `id` | `pieceId-cueId` |
| `pieceId` / `audio` / `start` / `end` | 从哪切 |
| `text` | 金标汉字 |
| `split` | `train` \| `test` |
| `register` | 你填的语域 |
| `goldOk` | 你确认后为 `true` |
| `rights` | 默认 `archive-starter`；私人长音频勿进公开仓库 |

## 诚实边界（文书可用）

- 试点阶段语料仍以**越剧选段**为主，不等于全覆盖「日常嵊州口语」。
- 唱段/伴奏多的句子会难；优先把 **散白** 做稳再扩韵白。
- 第一次微调可能 CER 只小幅下降——**方法与可复现实验**本身就是学术证据。

## 相关文件

- 导出：[`scripts/export-asr-gold.py`](../scripts/export-asr-gold.py)
- 训练：[`scripts/asr/`](../scripts/asr/)
- 旧版剧目清单（百度包）：[`docs/CORPUS_INTAKE.md`](CORPUS_INTAKE.md)

# 越语 ASR：从档案到可上线模型

**作者：** Alice Chen（Chen Jiachen）独立完成。

目标：把「听说」从通用 `Xenova/whisper-tiny` 换成**在越语/越剧语料上微调过的模型**。  
不做用户反馈邮箱；主线是金标语料 → 微调 → CER → 上线。

## 现状（仓库里已有）

| 资产 | 说明 |
|------|------|
| `data/transcripts/*.json` | 带时间轴的校对台词（`zh.status` = corrected/reviewed） |
| `assets/audio/*.mp3` 等 | 与档案页同步的短选段 |
| 粗估 | 约 **124 句 / ~18.4 分钟** 试点金标（已导出并完成首次微调） |

## 试点 CER（2026-08-14，Colab T4）

| 模型 | 测试集 n | 平均 CER |
|------|----------|----------|
| `openai/whisper-tiny`（基线） | 27 | **42.9%** |
| `whisper-small` + LoRA（适配） | 27 | **18.7%** |
| Δ（adapted − baseline） | | **−24.2 pp**（负数更好） |

测试集按整剧留出：`祥林嫂`、`何文秀`。原始数字：[`data/corpus/asr/runs/cer-v1.json`](../data/corpus/asr/runs/cer-v1.json)。

**公开权重：** [`ArikaisAllie/yueyu-whisper-small-lora-v1`](https://huggingface.co/ArikaisAllie/yueyu-whisper-small-lora-v1)

**诚实边界：** 基线是 tiny、适配是 small+LoRA，体量不完全对等；应用文书时可写「完成了可复现的低资源适应实验」，并计划补跑同尺寸 `whisper-small` 无 LoRA 对照。

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

```bash
python3 scripts/asr/eval_cer.py \
  --manifest data/corpus/asr/gold-clips.jsonl \
  --clips-dir data/corpus/asr/clips \
  --baseline openai/whisper-tiny \
  --adapted data/corpus/asr/runs/whisper-small-lora-v1 \
  --out data/corpus/asr/runs/cer-v1.json
```

把 `cer-v1.json` 里的数字写进 About「技术流程」——**没有跑通评测就不要写「准确率提升」**。

### 5. 上线（有模型之后）

1. 推到 Hugging Face（你的账号）
2. 导出/转换到 `@xenova/transformers` 可用格式，或用小型推理 API
3. 改 `src/speak.ts` 里的模型 ID（当前是 `Xenova/whisper-tiny`）

静态 GitHub Pages **不能训练**；可以 **加载你托管好的权重**。

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

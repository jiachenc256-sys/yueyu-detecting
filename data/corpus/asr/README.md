# 越语 ASR 金标语料与实验记录

**作者：** Alice Chen（Chen Jiachen）

本目录保存越语 / 越剧端侧 Whisper 适配研究的金标语料清单与逐版 CER 结果。
完整方法与结论见 [`docs/TECHNICAL_REPORT.md`](../../../docs/TECHNICAL_REPORT.md)，
逐日开发日志见 [`docs/YUEYU_ASR.md`](../../../docs/YUEYU_ASR.md)。

## 当前权威状态（2026-08-23 协议）

| 项目 | 值 |
|------|------|
| 切片总数 | **7,836** |
| 进入评估（goldOk） | **7,809**（27 条 pending） |
| gold 时长 | ≈ **667.6 min**（训练 ≈ 605.1 / 测试 ≈ 67.3） |
| 测试切分 | 整剧留出：`jingchai-ji` 荆钗记前段 + `baitu-ji` 白兔记全剧（384 句） |
| 上线权重 | `whisper-small-merged-blend-v10-a0.5`（INT8 ONNX，部署于 `assets/asr/`） |
| 汇总 / 逐版结果 | `gold-summary.json`；`runs/` 下各版 CER JSON |

机器 / 启发式产物与人工精标分层存放，非权威结果均带状态标记。

## 目录内容

- `gold-clips.jsonl`：金标候选及每条的 `goldOk` 状态
- `gold-summary.json`：规模、时长、整剧切分汇总
- `runs/`：v1–v13、解码对照（`cer-decode-control.json`）、2026-08-23 整剧研究（`cer-protocol-20260823-*.json`）等
- 早期 27-cue 评估快照按语料版权保留在本地、未公开；当前 `gold-clips.jsonl` 已将这 27 条标为 `goldOk:false`

## 复现

```bash
npm run asr:export-gold      # 导出金标候选
make asr-slice               # 切 16kHz wav（需 ffmpeg；原始大包/wav 不入库）
make asr-pack-colab          # 打包 Colab 训练用材料
```

训练步骤说明：[`scripts/asr/COLAB.md`](../../../scripts/asr/COLAB.md)。

> 历史说明：v1 试点（124 句 / 18.4 min，即 HF 上的 `lora-v1` 适配器）仅为早期记录，
> 体量不对等；当前评估与线上模型以上表及 `runs/cer-protocol-20260823-*.json` 为准。

公开适配器：https://huggingface.co/ArikaisAllie/yueyu-whisper-small-lora-v1

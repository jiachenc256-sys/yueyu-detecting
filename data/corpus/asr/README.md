# 越语 ASR 金标

**作者：** Alice Chen（Chen Jiachen）

## 当前状态

| 步骤 | 状态 |
|------|------|
| 金标 | 124 句 / 18.4 分钟 |
| 切片 | 124 wav（本地） |
| 微调 | Colab：whisper-small + LoRA v1 |
| CER | tiny 42.9% → adapted 18.7%（n=27）见 `runs/cer-v1.json` |
| HF | https://huggingface.co/ArikaisAllie/yueyu-whisper-small-lora-v1 |

网站「听说」仍用通用基线；上线适配模型是下一步。

## 你现在要做的（Colab）

1. 在 Finder 打开：`data/corpus/asr/yueyu-asr-colab.zip`
2. 按 [`scripts/asr/COLAB.md`](../../../scripts/asr/COLAB.md) 上传到 Colab、开 GPU、训练
3. 下载 `cer-v1.json` 发回聊天

重新切片 / 打包：

```bash
make asr-slice
make asr-pack-colab
```

## 文档

[`docs/YUEYU_ASR.md`](../../docs/YUEYU_ASR.md)

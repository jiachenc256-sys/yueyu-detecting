---
language:
- zh
tags:
- whisper
- asr
- peft
- lora
- yueju
- wu
- low-resource
license: other
base_model: openai/whisper-small
library_name: peft
pipeline_tag: automatic-speech-recognition
---

# Yueyu Detecting — Whisper-small LoRA (pilot v1)

**Sole author:** Alice Chen (Chen Jiachen / Jiachen Chen)

LoRA adapter for **Yueyu / Yue opera (越语·越剧)** speech recognition, fine-tuned from [`openai/whisper-small`](https://huggingface.co/openai/whisper-small).

Part of the public project **[Yueyu Detecting (越语侦听)](https://yueyudetecting.com)**, built and maintained solely by Alice Chen.

## Pilot evaluation

Held-out test set: **27 clips**, whole-piece split (`祥林嫂`, `何文秀`).

### Size-matched claim (preferred)

| Model | Mean raw CER |
| --- | ---: |
| `openai/whisper-tiny` | 7.3 |
| `openai/whisper-small` (no LoRA) | 10.7 |
| longer local LoRA v2 on `whisper-small` | **1.1** |
| Δ (LoRA − plain small) | **−9.6** |

JSON: repo `data/corpus/asr/runs/cer-v2b.json`. Exact match still **0%** on this holdout.

### This HF adapter (v1) — early / size-mismatched note

| Model | Mean CER |
| --- | ---: |
| `openai/whisper-tiny` (site baseline) | 42.9 |
| this adapter on `whisper-small` | **18.7** |

On the later size-matched decode, the same v1 adapter scores raw mean CER **5.55** (`cer-v2.json`).

**Caveats:** small gold set (~18.4 min total); Speak on the live site still uses a generic baseline; not production Yueyu ASR. See repo `docs/TECHNICAL_REPORT.md`.

## Load

```python
from transformers import WhisperForConditionalGeneration, WhisperProcessor
from peft import PeftModel

base = "openai/whisper-small"
adapter = "ArikaisAllie/yueyu-whisper-small-lora-v1"

processor = WhisperProcessor.from_pretrained(base, language="chinese", task="transcribe")
model = WhisperForConditionalGeneration.from_pretrained(base)
model = PeftModel.from_pretrained(model, adapter)
```

## Training

- Author: Alice Chen (Chen Jiachen)
- Method: LoRA (`r=16`, `alpha=32`, targets `q_proj`/`v_proj`)
- Steps: 200 (Colab T4)
- Data: archive-aligned gold clips from Yueyu Detecting transcripts

## Rights

**Author:** Alice Chen (Chen Jiachen). Training clips derive from archive starter materials for academic/demo use. Do not claim commercial rights to source performances. Adapter weights released for research and educational reuse with attribution to Alice Chen / Yueyu Detecting.

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

## Pilot evaluation (2026-08-14)

Held-out test set: **27 clips** (~4.7 min), whole-piece split (`祥林嫂`, `何文秀`).

| Model | Mean CER |
| --- | --- |
| `openai/whisper-tiny` (site baseline) | 42.9% |
| this adapter on `whisper-small` | **18.7%** |

**Caveats:** small gold set (~18.4 min total); baseline size ≠ adapted size; not production Yueyu ASR. See repo `docs/YUEYU_ASR.md`.

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

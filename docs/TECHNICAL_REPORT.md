# Technical Report · Yueyu Detecting ASR Pilot

**Sole author:** Alice Chen (Chen Jiachen / Jiachen Chen)  
**Project:** [Yueyu Detecting (越语侦听)](https://yueyudetecting.com)  
**Date:** 2026-08-14 (pilot v1)  
**Adapter:** [ArikaisAllie/yueyu-whisper-small-lora-v1](https://huggingface.co/ArikaisAllie/yueyu-whisper-small-lora-v1)

---

## 中文摘要

**研究问题：** 在标注数据稀缺的条件下，能否用少量高质量音文对齐语料，微调开源自动语音识别（ASR）模型，提升对吴语越语／越剧相关语音的识别准确率？

**方法：** 从本站已校对的时间轴档案导出金标切片 → 按整剧留出测试集 → 在 `whisper-small` 上以 LoRA 微调 → 与站点基线 `whisper-tiny` 在独立测试集上比较字错误率（CER）。

**结果：** 测试集 27 句上，基线平均 CER ≈ 42.9%，适配后 ≈ 18.7%（绝对降幅约 24 个百分点）。

**局限：** 金标约 18.4 分钟；基线与适配模型体量不完全对等；网站「听说」页仍加载通用基线 Whisper。本报告记录可复现试点，而非生产级越语 ASR。

---

## English abstract

**Question.** Can a small, high-quality aligned speech–text set improve open ASR on low-resource Yueyu / Yue-opera-related speech via parameter-efficient fine-tuning?

**Method.** Export gold clips from corrected timed archive transcripts; hold out whole pieces for test; fine-tune `whisper-small` with LoRA; evaluate character error rate (CER) against the site baseline `whisper-tiny`.

**Result.** On 27 held-out clips, mean CER fell from ≈ 42.9% (tiny) to ≈ 18.7% (small + LoRA), about −24 absolute points.

**Limits.** Gold set ≈ 18.4 minutes; baseline and adapted sizes are not matched; Speak still runs generic on-device Whisper. This is a reproducible pilot, not production Yueyu ASR.

---

## 1. Goal

Yueyu (Shaoxing / Shengzhou-area Wu) and Yue-opera stage speech are **low-resource** for mainstream ASR: scarce public aligned data, register variation (散白 / 韵白 / 唱词), and domain shift from Mandarin-centric training.

This pilot asks whether **archive-quality timed transcripts** already curated for Yueyu Detecting can support a first **adaptation** of an open ASR model, with transparent evaluation.

---

## 2. Method

### 2.1 Data pipeline

1. Timed cues in `data/transcripts/*.json` with `layers.zh.status` ∈ {`corrected`, `reviewed`}.  
2. Export candidates via `scripts/export-asr-gold.py` → `data/corpus/asr/gold-clips.jsonl`.  
3. Slice to 16 kHz mono wavs (`scripts/asr/slice_clips.py`).  
4. Fine-tune with LoRA (`scripts/asr/train_whisper_lora.py`).  
5. Evaluate CER (`scripts/asr/eval_cer.py`).

### 2.2 Why Whisper + LoRA?

- **Whisper** is a strong open multilingual ASR baseline already used on-site for upload demos (`whisper-tiny` in-browser).  
- **LoRA** adapts a larger checkpoint (`whisper-small`) with few trainable parameters, suitable for a laptop/Colab T4 pilot and a small gold set.

### 2.3 Training setup (pilot v1)

| Item | Value |
| --- | --- |
| Base model | `openai/whisper-small` |
| Adaptation | LoRA r=16, α=32, targets `q_proj` / `v_proj` |
| Steps | 200 (Colab T4) |
| Split | Whole-piece holdout (avoid line leakage within a play) |

Test pieces: `xianglin-sao-xinsuanhua`, `he-wenxiu-suanming`.

---

## 3. Data summary

| Split | Approx. duration | Notes |
| --- | --- | --- |
| All gold | ~18.4 min (124 cues) | From corrected archive alignments |
| Train | ~13.7 min | Remaining pieces |
| Test | ~4.7 min (27 cues) | Held-out plays |

Register labels (`sanbai` / `yunbai` / `changci`) are provisional heuristics for analysis; the pilot does **not** claim multi-hour native-speaker re-listening of every cue.

---

## 4. Results

### 4.1 Pilot v1 (Colab; tiny vs LoRA — size-mismatched)

| System | Mean raw CER (n=27) |
| --- | --- |
| Baseline `openai/whisper-tiny` | **42.9** |
| Adapted `whisper-small` + LoRA | **18.7** |
| Δ (adapted − baseline) | **−24.2** (lower is better) |

Raw JSON: [`data/corpus/asr/runs/cer-v1.json`](../data/corpus/asr/runs/cer-v1.json).

```text
CER raw mean (lower better; can exceed 1.0 with insertions)
tiny  |############################| 42.9
LoRA  |############                | 18.7
```

### 4.2 Pilot v2 (local; size-matched ablation)

Same test set; decode `max_new_tokens=444`. Columns: tiny / plain `whisper-small` / `small`+LoRA.

| System | meanCer (raw) | meanCerCapped | exactMatchRate |
| --- | ---: | ---: | ---: |
| `whisper-tiny` | 7.31 | 1.88 | 0% |
| `whisper-small` (no LoRA) | 10.70 | 2.10 | 0% |
| `whisper-small` + LoRA | **5.55** | **1.35** | 0% |
| Δ LoRA − plain small | **−5.15** | −0.76 | — |

Raw JSON: [`data/corpus/asr/runs/cer-v2.json`](../data/corpus/asr/runs/cer-v2.json).

**How to read this:** raw CER averages jiwer scores that can exceed 1.0 when the model loops/repeats. LoRA clearly reduces that failure mode versus a **size-matched** plain `small` baseline (`deltaCerAdaptedMinusSmall`). Exact-match rate is still 0% on this 27-clip holdout — the pilot is a reproducible adaptation loop, not production Yueyu ASR.

---

## 5. Limits and interpretation

1. **Size mismatch (v1):** comparing `tiny` to `small`+LoRA confounds adaptation with capacity. Prefer **v2** `deltaCerAdaptedMinusSmall` for the adaptation claim.  
2. **Metric honesty:** raw CER drop ≠ fluent transcripts yet; exact match is still ~0 on n=27. Growing gold is required before claiming usable recognition.  
3. **Small N / short gold:** 27 test clips / ~18.4 min total; results can shift as gold grows.  
4. **Domain:** archive starters are mostly Yue-opera excerpts, not a full everyday Yueyu conversational benchmark.  
5. **Product gap:** Speak on the live site still uses the generic baseline until an adapted model is wired in.

What the pilot **does** show: a closed loop from curated archive → trainable clips → measured CER → public adapter weights, authored by Alice Chen.

---

## 6. Future work

- Longer LoRA runs (`--max-steps` 400–800, `--no-text-normalizer`) and re-eval with `make asr-eval-v2`.  
- Grow gold toward 30–60 minutes, then 2h+, with clearer 散白 / 韵白 tagging.  
- Integrate the Hugging Face adapter into Speak when hosting allows.  
- Treat the held-out slice as a seed for a reusable Yueyu evaluation set.

Operational notes: [`docs/YUEYU_ASR.md`](YUEYU_ASR.md); Colab steps: [`scripts/asr/COLAB.md`](../scripts/asr/COLAB.md).

---

## Citation

See [`CITATION.cff`](../CITATION.cff). Prefer citing the live site and this repository. Adapter: `ArikaisAllie/yueyu-whisper-small-lora-v1`.

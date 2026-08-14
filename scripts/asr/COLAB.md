# Colab：第一次越语 Whisper 微调（照做即可）

本地已准备好压缩包：`data/corpus/asr/yueyu-asr-colab.zip`（含 124 条 wav + 脚本）。

## A. 上传到 Colab（5 分钟）

1. 打开 [Google Colab](https://colab.research.google.com/) → **新建笔记本**
2. 菜单 **Runtime → Change runtime type → GPU（T4）→ Save**
3. 左侧文件夹图标 → 上传 `yueyu-asr-colab.zip`  
   （或先放到 Google Drive 再挂载）
4. 在第一个单元格运行：

```python
!unzip -q yueyu-asr-colab.zip -d yueyu_asr
%cd yueyu_asr
!ls
!wc -l data/corpus/asr/gold-clips.jsonl
!ls data/corpus/asr/clips | wc -l
```

若 zip 解压后路径层级多一层，用 `!find . -name gold-clips.jsonl` 找到后 `cd` 到含 `data/` 与 `scripts/` 的目录。

## B. 安装依赖

```python
!pip install -q -r scripts/asr/requirements.txt
# If peft complains about torchao version, also run:
!pip install -q -U "torchao>=0.16.0" "peft>=0.11.0"
```

## C. 若训练报 `tokenizer=` 错误：先打补丁（普通 Python 格，不要用 `!`）

```python
from pathlib import Path

%cd /content/yueyu_asr

p = Path("scripts/asr/train_whisper_lora.py")
t = p.read_text()
old = """    trainer = Seq2SeqTrainer(
        args=training_args,
        model=model,
        train_dataset=train_ds,
        eval_dataset=eval_ds,
        data_collator=collator,
        tokenizer=processor.feature_extractor,
    )"""
new = """    trainer_kwargs = dict(
        args=training_args,
        model=model,
        train_dataset=train_ds,
        eval_dataset=eval_ds,
        data_collator=collator,
    )
    try:
        trainer = Seq2SeqTrainer(
            **trainer_kwargs, processing_class=processor.feature_extractor
        )
    except TypeError:
        trainer = Seq2SeqTrainer(
            **trainer_kwargs, tokenizer=processor.feature_extractor
        )"""
if old not in t:
    raise SystemExit("patch target not found")
p.write_text(t.replace(old, new))
print("patched OK")
```

## D. 训练（约十几～几十分钟，视 GPU）

```python
!python scripts/asr/train_whisper_lora.py \
  --manifest data/corpus/asr/gold-clips.jsonl \
  --clips-dir data/corpus/asr/clips \
  --model openai/whisper-small \
  --output-dir data/corpus/asr/runs/whisper-small-lora-v1 \
  --max-steps 200
```

## E. 评测 CER（推荐：同尺寸消融 v2）

一次跑三列：**tiny / plain small / small+LoRA**（这才是公平对比）：

```python
!python scripts/asr/eval_cer.py \
  --manifest data/corpus/asr/gold-clips.jsonl \
  --clips-dir data/corpus/asr/clips \
  --tiny openai/whisper-tiny \
  --small openai/whisper-small \
  --adapted data/corpus/asr/runs/whisper-small-lora-v1 \
  --adapted-base openai/whisper-small \
  --out data/corpus/asr/runs/cer-v2.json

!python - <<'PY'
import json
r=json.load(open("data/corpus/asr/runs/cer-v2.json"))
for k in ("tiny","small","adapted"):
    b=r[k]
    print(f"{k:8} meanCer={b['meanCer']*100:.1f}%  capped={b['meanCerCapped']*100:.1f}%  ({b['model']})")
print("delta small−tiny:", round(r.get("deltaCerSmallMinusTiny",0)*100,1), "pp")
print("delta LoRA−small:", round(r.get("deltaCerAdaptedMinusSmall",0)*100,1), "pp")
PY
```

重点看 **`deltaCerAdaptedMinusSmall`**：负数 = LoRA 在同尺寸下真的更好。

若已有旧的 tiny-vs-LoRA 结果，仍可用 legacy：

```python
!python scripts/asr/eval_cer.py \
  --manifest data/corpus/asr/gold-clips.jsonl \
  --clips-dir data/corpus/asr/clips \
  --baseline openai/whisper-tiny \
  --adapted data/corpus/asr/runs/whisper-small-lora-v1 \
  --out data/corpus/asr/runs/cer-v1.json
```

## F. 下载结果

在 Colab 文件树里下载：

- `data/corpus/asr/runs/whisper-small-lora-v1/`（模型）
- `data/corpus/asr/runs/cer-v2.json`（三列 CER；优先）

把 `cer-v2.json` 发回聊天，我可以写进技术报告 / About。

## 预期（要诚实）

- ~18 分钟语料：能**跑通流程**；plain `small` 可能已接近 LoRA，LoRA 增益可能只有几个百分点——正常。
- 这已经是申请材料里很有力的「我做过可复现实验」证据。
- 继续降 CER：优先加金标（30–60 分钟），再谈更大模型。

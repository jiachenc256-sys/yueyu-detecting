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

## E. 评测 CER（基线 tiny vs 微调）

```python
!python scripts/asr/eval_cer.py \
  --manifest data/corpus/asr/gold-clips.jsonl \
  --clips-dir data/corpus/asr/clips \
  --baseline openai/whisper-tiny \
  --adapted data/corpus/asr/runs/whisper-small-lora-v1 \
  --out data/corpus/asr/runs/cer-v1.json

!cat data/corpus/asr/runs/cer-v1.json | head -c 2000
```

## F. 下载结果

在 Colab 文件树里下载：

- `data/corpus/asr/runs/whisper-small-lora-v1/`（模型）
- `data/corpus/asr/runs/cer-v1.json`（数字）

把 `cer-v1.json` 发回聊天，我可以帮你写进 About，并规划如何接到网站「听说」页。

## 预期（要诚实）

- ~18 分钟语料：能**跑通流程**；CER 可能只小幅下降，甚至差不多——正常。
- 这已经是申请材料里很有力的「我做过可复现实验」证据。
- 以后加更多金标，模型才会更像「越语专用」。

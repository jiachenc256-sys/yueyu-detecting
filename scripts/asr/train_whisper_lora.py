#!/usr/bin/env python3
"""Fine-tune Whisper with LoRA on Yueyu gold clips (pilot script).

Example:

  python3 scripts/asr/train_whisper_lora.py \\
    --manifest data/corpus/asr/gold-clips.jsonl \\
    --clips-dir data/corpus/asr/clips \\
    --model openai/whisper-small \\
    --output-dir data/corpus/asr/runs/whisper-small-lora-v1

Notes:
  - Needs GPU for practical runtime (Colab T4 OK for small).
  - Requires goldOk=true rows and matching wavs from slice_clips.py.
  - This is a research pilot, not a production trainer.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path

import torch
from datasets import Dataset
from peft import LoraConfig, get_peft_model
from transformers import (
    Seq2SeqTrainer,
    Seq2SeqTrainingArguments,
    WhisperForConditionalGeneration,
    WhisperProcessor,
)
from transformers.models.whisper.english_normalizer import BasicTextNormalizer


@dataclass
class ClipRow:
    path: str
    text: str
    split: str


def load_rows(manifest: Path, clips_dir: Path, only_gold_ok: bool) -> list[ClipRow]:
    rows: list[ClipRow] = []
    for line in manifest.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        obj = json.loads(line)
        if only_gold_ok and obj.get("goldOk") is not True:
            continue
        if obj.get("goldOk") is False:
            continue
        wav = clips_dir / f"{obj['id']}.wav"
        if not wav.exists():
            continue
        text = (obj.get("text") or "").strip()
        if not text:
            continue
        rows.append(ClipRow(path=str(wav), text=text, split=obj.get("split") or "train"))
    return rows


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", type=Path, required=True)
    ap.add_argument("--clips-dir", type=Path, required=True)
    ap.add_argument("--model", default="openai/whisper-small")
    ap.add_argument("--output-dir", type=Path, required=True)
    ap.add_argument(
        "--allow-pending",
        action="store_true",
        help="Include goldOk=null (not recommended)",
    )
    ap.add_argument("--max-steps", type=int, default=200)
    ap.add_argument("--batch-size", type=int, default=4)
    ap.add_argument("--lr", type=float, default=1e-4)
    args = ap.parse_args()

    all_rows = load_rows(
        args.manifest, args.clips_dir, only_gold_ok=not args.allow_pending
    )
    train_rows = [r for r in all_rows if r.split == "train"]
    eval_rows = [r for r in all_rows if r.split == "test"]

    if len(train_rows) < 8:
        print(
            f"Need more gold clips to train (train={len(train_rows)}). "
            "Mark goldOk=true and run slice_clips.py first.",
            file=sys.stderr,
        )
        return 1

    if not eval_rows:
        print("Warning: no test split clips found; using 10% of train as eval.")
        cut = max(1, len(train_rows) // 10)
        eval_rows = train_rows[:cut]
        train_rows = train_rows[cut:]

    print(f"train={len(train_rows)} eval={len(eval_rows)} base={args.model}")

    processor = WhisperProcessor.from_pretrained(args.model, language="chinese", task="transcribe")
    model = WhisperForConditionalGeneration.from_pretrained(args.model)
    model.config.forced_decoder_ids = None
    model.config.suppress_tokens = []

    lora = LoraConfig(
        r=16,
        lora_alpha=32,
        target_modules=["q_proj", "v_proj"],
        lora_dropout=0.05,
        bias="none",
    )
    model = get_peft_model(model, lora)
    model.print_trainable_parameters()

    normalizer = BasicTextNormalizer()

    def to_dataset(rows: list[ClipRow]) -> Dataset:
        return Dataset.from_list([{"audio": r.path, "text": r.text} for r in rows])

    train_ds = to_dataset(train_rows)
    eval_ds = to_dataset(eval_rows)

    def prepare(batch):
        import soundfile as sf

        audio_path = batch["audio"]
        speech, sr = sf.read(audio_path)
        if sr != 16000:
            raise ValueError(f"Expected 16k wav, got {sr} for {audio_path}")
        feats = processor.feature_extractor(speech, sampling_rate=16000).input_features[0]
        labels = processor.tokenizer(normalizer(batch["text"])).input_ids
        return {"input_features": feats, "labels": labels}

    train_ds = train_ds.map(prepare, remove_columns=train_ds.column_names)
    eval_ds = eval_ds.map(prepare, remove_columns=eval_ds.column_names)

    class DataCollatorSpeechSeq2SeqWithPadding:
        def __init__(self, processor):
            self.processor = processor

        def __call__(self, features):
            input_features = [{"input_features": f["input_features"]} for f in features]
            label_features = [{"input_ids": f["labels"]} for f in features]
            batch = self.processor.feature_extractor.pad(input_features, return_tensors="pt")
            labels_batch = self.processor.tokenizer.pad(label_features, return_tensors="pt")
            labels = labels_batch["input_ids"].masked_fill(
                labels_batch.attention_mask.ne(1), -100
            )
            if (labels[:, 0] == self.processor.tokenizer.bos_token_id).all().cpu().item():
                labels = labels[:, 1:]
            batch["labels"] = labels
            return batch

    collator = DataCollatorSpeechSeq2SeqWithPadding(processor)
    args.output_dir.mkdir(parents=True, exist_ok=True)

    training_args = Seq2SeqTrainingArguments(
        output_dir=str(args.output_dir),
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        learning_rate=args.lr,
        max_steps=args.max_steps,
        fp16=torch.cuda.is_available(),
        eval_strategy="steps",
        eval_steps=50,
        save_steps=50,
        logging_steps=10,
        predict_with_generate=True,
        generation_max_length=128,
        report_to=[],
        remove_unused_columns=False,
    )

    trainer_kwargs = dict(
        args=training_args,
        model=model,
        train_dataset=train_ds,
        eval_dataset=eval_ds,
        data_collator=collator,
    )
    # transformers v5 removed tokenizer=; use processing_class instead.
    try:
        trainer = Seq2SeqTrainer(
            **trainer_kwargs, processing_class=processor.feature_extractor
        )
    except TypeError:
        trainer = Seq2SeqTrainer(
            **trainer_kwargs, tokenizer=processor.feature_extractor
        )
    trainer.train()
    trainer.save_model(str(args.output_dir))
    processor.save_pretrained(str(args.output_dir))
    print(f"Saved adapter/model → {args.output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

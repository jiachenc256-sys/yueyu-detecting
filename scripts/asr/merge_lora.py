#!/usr/bin/env python3
"""Merge a Whisper LoRA adapter into a full checkpoint for export / Speak.

Example:

  .venv-asr/bin/python scripts/asr/merge_lora.py \\
    --adapter data/corpus/asr/runs/whisper-small-lora-v2 \\
    --base openai/whisper-small \\
    --out data/corpus/asr/runs/whisper-small-merged-v2
"""

from __future__ import annotations

import argparse
from pathlib import Path

from peft import PeftModel
from transformers import WhisperForConditionalGeneration, WhisperProcessor


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--adapter", type=Path, required=True)
    ap.add_argument("--base", default="openai/whisper-small")
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()

    if not (args.adapter / "adapter_config.json").exists():
        raise SystemExit(f"Not a PEFT adapter dir: {args.adapter}")

    args.out.mkdir(parents=True, exist_ok=True)
    print(f"Loading base {args.base} …")
    processor = WhisperProcessor.from_pretrained(
        args.base, language="chinese", task="transcribe"
    )
    base = WhisperForConditionalGeneration.from_pretrained(args.base)
    print(f"Loading adapter {args.adapter} …")
    model = PeftModel.from_pretrained(base, str(args.adapter))
    print("Merging …")
    model = model.merge_and_unload()
    model.eval()
    print(f"Saving → {args.out}")
    model.save_pretrained(str(args.out))
    processor.save_pretrained(str(args.out))
    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Compare baseline vs adapted Whisper CER on gold test clips.

  python3 scripts/asr/eval_cer.py \\
    --manifest data/corpus/asr/gold-clips.jsonl \\
    --clips-dir data/corpus/asr/clips \\
    --baseline openai/whisper-tiny \\
    --out data/corpus/asr/runs/cer-v1.json
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import jiwer
import soundfile as sf
import torch
from transformers import pipeline


def load_test_items(manifest: Path, clips_dir: Path, only_gold_ok: bool) -> list[dict]:
    items = []
    for line in manifest.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        obj = json.loads(line)
        if obj.get("split") != "test":
            continue
        if only_gold_ok and obj.get("goldOk") is not True:
            continue
        wav = clips_dir / f"{obj['id']}.wav"
        if not wav.exists():
            continue
        items.append({"id": obj["id"], "path": str(wav), "ref": obj["text"].strip()})
    return items


def cer(ref: str, hyp: str) -> float:
    if not ref:
        return 0.0
    return float(jiwer.cer(ref, hyp))


def eval_model(model_id: str, items: list[dict], device: int | str) -> dict:
    # Load once
    asr = pipeline(
        "automatic-speech-recognition",
        model=model_id,
        device=device,
        chunk_length_s=30,
    )
    rows = []
    scores = []
    for it in items:
        speech, sr = sf.read(it["path"])
        out = asr(
            {"array": speech, "sampling_rate": sr},
            generate_kwargs={"language": "chinese", "task": "transcribe"},
        )
        hyp = (out.get("text") if isinstance(out, dict) else str(out)).strip()
        score = cer(it["ref"], hyp)
        scores.append(score)
        rows.append({"id": it["id"], "ref": it["ref"], "hyp": hyp, "cer": score})
    mean = sum(scores) / len(scores) if scores else None
    return {"model": model_id, "n": len(rows), "meanCer": mean, "items": rows}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", type=Path, required=True)
    ap.add_argument("--clips-dir", type=Path, required=True)
    ap.add_argument("--baseline", default="openai/whisper-tiny")
    ap.add_argument("--adapted", default=None, help="Optional fine-tuned model/adapter path")
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--only-gold-ok", action="store_true", default=True)
    ap.add_argument("--allow-pending", action="store_true")
    args = ap.parse_args()

    only_gold = not args.allow_pending
    items = load_test_items(args.manifest, args.clips_dir, only_gold_ok=only_gold)
    if not items:
        raise SystemExit("No test clips found. Mark goldOk on test split and slice first.")

    device = 0 if torch.cuda.is_available() else -1
    report = {
        "nTest": len(items),
        "baseline": eval_model(args.baseline, items, device),
    }
    if args.adapted:
        report["adapted"] = eval_model(args.adapted, items, device)
        b = report["baseline"]["meanCer"]
        a = report["adapted"]["meanCer"]
        if b is not None and a is not None:
            report["deltaCer"] = a - b
            report["note"] = "Negative deltaCer means adapted is better (lower error)."

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: report[k] for k in report if k not in ("baseline", "adapted")}, ensure_ascii=False, indent=2))
    print(f"Wrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

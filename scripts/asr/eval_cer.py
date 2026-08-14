#!/usr/bin/env python3
"""Compare Whisper systems on gold test clips (CER).

Size-matched ablation (recommended v2):

  python3 scripts/asr/eval_cer.py \\
    --manifest data/corpus/asr/gold-clips.jsonl \\
    --clips-dir data/corpus/asr/clips \\
    --tiny openai/whisper-tiny \\
    --small openai/whisper-small \\
    --adapted data/corpus/asr/runs/whisper-small-lora-v1 \\
    --adapted-base openai/whisper-small \\
    --out data/corpus/asr/runs/cer-v2.json

Legacy (v1-compatible):

  python3 scripts/asr/eval_cer.py \\
    --manifest data/corpus/asr/gold-clips.jsonl \\
    --clips-dir data/corpus/asr/clips \\
    --baseline openai/whisper-tiny \\
    --adapted data/corpus/asr/runs/whisper-small-lora-v1 \\
    --out data/corpus/asr/runs/cer-v1.json
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import jiwer
import soundfile as sf
import torch
from transformers import (
    WhisperForConditionalGeneration,
    WhisperProcessor,
    pipeline,
)


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


def cap_hypothesis(ref: str, hyp: str, ratio: float = 2.5, pad: int = 8) -> str:
    """Truncate runaway repetition hallucinations for a secondary metric."""
    limit = max(int(len(ref) * ratio) + pad, len(ref) + pad)
    if len(hyp) <= limit:
        return hyp
    return hyp[:limit]


def pick_device() -> int | str:
    if torch.cuda.is_available():
        return 0
    if getattr(torch.backends, "mps", None) is not None and torch.backends.mps.is_available():
        return "mps"
    return -1


def is_peft_dir(path: Path) -> bool:
    return path.is_dir() and (path / "adapter_config.json").exists()


def build_asr(model_id: str, device: int | str, adapted_base: str | None = None):
    """Build an ASR pipeline. Supports HF ids, full checkpoints, or PEFT adapter dirs."""
    path = Path(model_id)
    if is_peft_dir(path):
        base_id = adapted_base or "openai/whisper-small"
        processor = WhisperProcessor.from_pretrained(
            base_id, language="chinese", task="transcribe"
        )
        base = WhisperForConditionalGeneration.from_pretrained(base_id)
        try:
            from peft import PeftModel
        except ImportError as exc:  # pragma: no cover
            raise SystemExit("peft is required to load LoRA adapters") from exc
        model = PeftModel.from_pretrained(base, str(path))
        model = model.merge_and_unload()
        model.eval()
        return pipeline(
            "automatic-speech-recognition",
            model=model,
            tokenizer=processor.tokenizer,
            feature_extractor=processor.feature_extractor,
            device=device,
            chunk_length_s=30,
        )

    return pipeline(
        "automatic-speech-recognition",
        model=model_id,
        device=device,
        chunk_length_s=30,
    )


def eval_model(
    model_id: str,
    items: list[dict],
    device: int | str,
    *,
    adapted_base: str | None = None,
    cap_ratio: float = 2.5,
    max_new_tokens: int = 128,
) -> dict:
    asr = build_asr(model_id, device, adapted_base=adapted_base)
    rows = []
    scores: list[float] = []
    capped_scores: list[float] = []
    gen_kwargs = {
        "language": "chinese",
        "task": "transcribe",
        "max_new_tokens": max_new_tokens,
    }
    for it in items:
        speech, sr = sf.read(it["path"])
        out = asr(
            {"array": speech, "sampling_rate": sr},
            generate_kwargs=gen_kwargs,
        )
        hyp = (out.get("text") if isinstance(out, dict) else str(out)).strip()
        hyp_capped = cap_hypothesis(it["ref"], hyp, ratio=cap_ratio)
        score = cer(it["ref"], hyp)
        score_c = cer(it["ref"], hyp_capped)
        scores.append(score)
        capped_scores.append(score_c)
        rows.append(
            {
                "id": it["id"],
                "ref": it["ref"],
                "hyp": hyp,
                "cer": score,
                "cerCapped": score_c,
                "hypTruncated": hyp_capped != hyp,
            }
        )
    mean = sum(scores) / len(scores) if scores else None
    mean_c = sum(capped_scores) / len(capped_scores) if capped_scores else None
    clipped = [min(s, 1.0) for s in scores]
    mean_clipped = sum(clipped) / len(clipped) if clipped else None
    exact = sum(1 for r in rows if r["hyp"] == r["ref"])
    return {
        "model": model_id,
        "n": len(rows),
        "meanCer": mean,
        "meanCerCapped": mean_c,
        "meanCerClipped": mean_clipped,
        "exactMatchRate": (exact / len(rows)) if rows else None,
        "capNote": (
            "meanCer is raw jiwer CER (can exceed 1.0 with insertions). "
            "meanCerCapped truncates long hyps; meanCerClipped = mean(min(cer,1)). "
            "Primary academic claim for adaptation should cite size-matched deltas on the same metric."
        ),
        "items": rows,
    }


def summarize(report: dict) -> dict:
    out: dict = {"nTest": report.get("nTest")}
    for key in ("tiny", "small", "adapted", "baseline"):
        block = report.get(key)
        if isinstance(block, dict) and "meanCer" in block:
            out[key] = {
                "model": block.get("model"),
                "meanCer": block.get("meanCer"),
                "meanCerCapped": block.get("meanCerCapped"),
                "meanCerClipped": block.get("meanCerClipped"),
                "exactMatchRate": block.get("exactMatchRate"),
            }
    for key in ("deltaCerSmallMinusTiny", "deltaCerAdaptedMinusSmall", "deltaCer"):
        if key in report:
            out[key] = report[key]
    if "note" in report:
        out["note"] = report["note"]
    return out


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Evaluate CER for tiny / small / small+LoRA (size-matched ablation)."
    )
    ap.add_argument("--manifest", type=Path, required=True)
    ap.add_argument("--clips-dir", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)

    # v2 named systems
    ap.add_argument("--tiny", default=None, help="e.g. openai/whisper-tiny")
    ap.add_argument("--small", default=None, help="Size-matched baseline, e.g. openai/whisper-small")
    ap.add_argument(
        "--adapted",
        default=None,
        help="LoRA adapter dir or merged model path / HF id",
    )
    ap.add_argument(
        "--adapted-base",
        default="openai/whisper-small",
        help="Base model when --adapted is a PEFT adapter directory",
    )

    # legacy aliases
    ap.add_argument(
        "--baseline",
        default=None,
        help="Legacy alias: if set without --tiny/--small, used as the single baseline",
    )

    ap.add_argument("--only-gold-ok", action="store_true", default=True)
    ap.add_argument("--allow-pending", action="store_true")
    ap.add_argument("--cap-ratio", type=float, default=2.5)
    ap.add_argument(
        "--max-new-tokens",
        type=int,
        default=128,
        help="Decode cap to limit repetition loops on short clips (default 128).",
    )
    args = ap.parse_args()

    only_gold = not args.allow_pending
    items = load_test_items(args.manifest, args.clips_dir, only_gold_ok=only_gold)
    if not items:
        raise SystemExit("No test clips found. Mark goldOk on test split and slice first.")

    device = pick_device()
    print(f"device={device} nTest={len(items)}")

    tiny_id = args.tiny
    small_id = args.small
    adapted_id = args.adapted
    baseline_id = args.baseline

    # Legacy path: --baseline [+ --adapted]
    if baseline_id and not tiny_id and not small_id:
        tiny_id = baseline_id

    if not any([tiny_id, small_id, adapted_id]):
        raise SystemExit("Provide at least one of --tiny/--small/--adapted (or legacy --baseline).")

    report: dict = {
        "schema": "cer-v2",
        "nTest": len(items),
        "device": str(device),
        "split": "whole-piece holdout test",
    }

    report["decode"] = {"max_new_tokens": args.max_new_tokens, "cap_ratio": args.cap_ratio}

    if tiny_id:
        print(f"Evaluating tiny/baseline: {tiny_id}")
        report["tiny"] = eval_model(
            tiny_id,
            items,
            device,
            cap_ratio=args.cap_ratio,
            max_new_tokens=args.max_new_tokens,
        )
        # keep legacy key when using --baseline alone or with adapted
        if baseline_id and not args.small:
            report["baseline"] = report["tiny"]

    if small_id:
        print(f"Evaluating size-matched small: {small_id}")
        report["small"] = eval_model(
            small_id,
            items,
            device,
            cap_ratio=args.cap_ratio,
            max_new_tokens=args.max_new_tokens,
        )

    if adapted_id:
        print(f"Evaluating adapted: {adapted_id}")
        report["adapted"] = eval_model(
            adapted_id,
            items,
            device,
            adapted_base=args.adapted_base,
            cap_ratio=args.cap_ratio,
            max_new_tokens=args.max_new_tokens,
        )

    # Deltas (lower CER is better → negative = improvement)
    def mean(key: str) -> float | None:
        block = report.get(key)
        if isinstance(block, dict):
            return block.get("meanCer")
        return None

    t, s, a = mean("tiny"), mean("small"), mean("adapted")
    notes = []
    if t is not None and s is not None:
        report["deltaCerSmallMinusTiny"] = s - t
        notes.append("deltaCerSmallMinusTiny: capacity effect (small − tiny).")
    if s is not None and a is not None:
        report["deltaCerAdaptedMinusSmall"] = a - s
        notes.append(
            "deltaCerAdaptedMinusSmall: adaptation effect (LoRA − plain small); "
            "this is the size-matched claim."
        )
    if t is not None and a is not None and s is None:
        report["deltaCer"] = a - t
        notes.append("deltaCer: adapted − tiny (legacy; confounds size + adaptation).")
    if notes:
        report["note"] = " ".join(notes) + " Negative deltas mean lower error."

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summarize(report), ensure_ascii=False, indent=2))
    print(f"Wrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

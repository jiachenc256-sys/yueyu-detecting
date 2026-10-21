#!/usr/bin/env python3
"""Decoding-hygiene control for the Yueyu ASR adaptation claim.

Question this answers
---------------------
The pilot's 10.7 -> 1.1 raw-CER drop was measured with a Hugging Face
pipeline that only set `language=chinese, task=transcribe, max_new_tokens`
(i.e. greedy decoding with NO repetition safeguards). Two clips ran away
into 444-character loops and dominated the mean.

This script holds the MODEL fixed (openai/whisper-small, same model used as
the size-matched baseline) and changes ONLY the decoding settings, using the
reference `openai-whisper` implementation so every Whisper safeguard is
available. It runs two arms on the exact same clips:

  * greedy_loop   : single greedy pass, safeguards OFF
                    (temperature=0, no fallback, no compression cut)
  * default_hygiene: normal Whisper decoding (temperature fallback
                     0.0..1.0 + compression_ratio_threshold=2.4 +
                     condition_on_previous_text)

If the two looping clips disappear under `default_hygiene` and the raw mean
collapses, then most of the 10.7 -> 1.1 delta is a decoding artifact, and the
adaptation claim must rest on the cleaned size-matched / unseen-play numbers
(jingchai n=39, baitu n=80), not on the raw pilot mean.

Both arms also report a punctuation/traditional-normalized CER (secondary),
because refs have almost no punctuation while hypotheses often do.

Install / run
-------------
    pip install -U openai-whisper jiwer soundfile    # ffmpeg must be on PATH
    python eval_decode_control.py \
        --manifest data/corpus/asr/gold-clips.jsonl \
        --clips-dir  data/corpus/asr/clips \
        --model small \
        --out data/corpus/asr/runs/cer-decode-control.json

First run downloads openai/whisper-small (~460 MB, same weights either way).
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import jiwer
import soundfile as sf

try:
    import whisper  # reference openai-whisper
    from whisper.tokenizer import get_tokenizer
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "openai-whisper is required: pip install -U openai-whisper (and have ffmpeg on PATH)."
    ) from exc

try:
    from opencc import OpenCC

    _T2S = OpenCC("t2s")
    HAVE_OPENCC = True
except Exception:  # pragma: no cover
    _T2S = None
    HAVE_OPENCC = False

# CJK + ASCII alnum only -> drops punctuation and whitespace from both sides.
_KEEP = re.compile(r"[0-9a-zA-Z\u4e00-\u9fff]")


def load_items(manifest: Path, clips_dir: Path) -> list[dict]:
    items = []
    for line in manifest.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        o = json.loads(line)
        if o.get("split") != "test" or o.get("goldOk") is not True:
            continue
        wav = clips_dir / f"{o['id']}.wav"
        if not wav.exists():
            continue
        items.append({"id": o["id"], "path": str(wav), "ref": o["text"].strip()})
    if not items:
        raise SystemExit("No test+goldOk clips with matching wavs found.")
    return items


def normalize(s: str) -> str:
    """CER-normalization: traditional->simplified (if available), strip punct/space."""
    if HAVE_OPENCC:
        s = _T2S.convert(s)
    return "".join(_KEEP.findall(s))


def metrics(rows: list[dict]) -> dict:
    raw = [r["cerRaw"] for r in rows]
    nor = [r["cerNorm"] for r in rows]
    n = len(rows)
    srt = sorted(raw)
    med = srt[n // 2] if n % 2 else (srt[n // 2 - 1] + srt[n // 2]) / 2

    def within_pm20(r, pad=3):
        lo = max(0, r["refLen"] * 0.8 - pad)
        hi = r["refLen"] * 1.2 + pad
        return lo <= r["hypLen"] <= hi

    return {
        "n": n,
        "meanCerRaw": sum(raw) / n,
        "medianCerRaw": med,
        "maxCerRaw": max(raw),
        "meanCerNormalized": sum(nor) / n,
        "exactMatch": sum(1 for r in rows if r["hyp"].strip() == r["ref"]),
        "runawayLoops_ge200chars": sum(1 for r in rows if r["hypLen"] >= 200),
        "lengthConform_pm20pct": sum(1 for r in rows if within_pm20(r)),
        "meanHypLen": sum(r["hypLen"] for r in rows) / n,
    }


def run_arm(model, items: list[dict], *, name: str, transcribe_kwargs: dict) -> dict:
    rows = []
    for it in items:
        audio, sr = sf.read(it["path"])
        result = model.transcribe(it["path"], **transcribe_kwargs)
        hyp = (result.get("text") or "").strip()
        ref = it["ref"]
        rows.append(
            {
                "id": it["id"],
                "ref": ref,
                "hyp": hyp,
                "refLen": len(ref),
                "hypLen": len(hyp),
                "cerRaw": float(jiwer.cer(ref, hyp)) if ref else 0.0,
                "cerNorm": (
                    float(jiwer.cer(normalize(ref), normalize(hyp)))
                    if normalize(ref)
                    else 0.0
                ),
            }
        )
    out = {"arm": name, "decode": transcribe_kwargs}
    out.update(metrics(rows))
    out["items"] = rows
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", type=Path, required=True)
    ap.add_argument("--clips-dir", type=Path, required=True)
    ap.add_argument("--model", default="small", help="whisper model size/path; keep 'small' for the size-matched control")
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--language", default="zh")
    args = ap.parse_args()

    items = load_items(args.manifest, args.clips_dir)
    print(f"n={len(items)} model={args.model} opencc_normalization={HAVE_OPENCC}")
    model = whisper.load_model(args.model)

    common = {"language": args.language, "task": "transcribe", "verbose": False}

    # Arm A: reproduce the pilot's greedy, safeguard-free single pass.
    greedy_kwargs = dict(
        common,
        temperature=0.0,                 # single greedy pass, no fallback
        condition_on_previous_text=False,
        compression_ratio_threshold=None,  # never cut for repetition
        logprob_threshold=None,
        no_speech_threshold=None,
        beam_size=None,
    )
    # Arm B: stock Whisper decoding (all safeguards at defaults).
    hygiene_kwargs = dict(
        common,
        temperature=(0.0, 0.2, 0.4, 0.6, 0.8, 1.0),
        condition_on_previous_text=True,
        compression_ratio_threshold=2.4,
    )

    arm_g = run_arm(model, items, name="greedy_loop", transcribe_kwargs=greedy_kwargs)
    arm_h = run_arm(model, items, name="default_hygiene", transcribe_kwargs=hygiene_kwargs)

    report = {
        "schema": "decode-control-v1",
        "model": f"openai/whisper-{args.model}" if not Path(args.model).exists() else args.model,
        "n": len(items),
        "normalization": "raw jiwer CER + secondary CER after t2s/punct-strip",
        "note": "Same model, only decoding differs. Compare raw mean / runaway loops to the pilot 10.7.",
        "arms": {"greedy_loop": arm_g, "default_hygiene": arm_h},
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    for a in (arm_g, arm_h):
        print(
            f"\n[{a['arm']}] meanRaw={a['meanCerRaw']:.3f} median={a['medianCerRaw']:.3f} "
            f"max={a['maxCerRaw']:.2f} loops(>=200ch)={a['runawayLoops_ge200chars']} "
            f"lenConform={a['lengthConform_pm20pct']}/{a['n']} exact={a['exactMatch']} "
            f"meanNormCER={a['meanCerNormalized']:.3f}"
        )
    print(f"\nWrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

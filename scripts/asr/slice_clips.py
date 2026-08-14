#!/usr/bin/env python3
"""Slice archive audio into per-cue wavs for ASR training.

Uses ffmpeg from PATH, or imageio-ffmpeg's bundled binary if available.

  python3 scripts/asr/slice_clips.py \\
    --manifest data/corpus/asr/gold-clips.jsonl \\
    --out-dir data/corpus/asr/clips \\
    --only-gold-ok
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path


def resolve_ffmpeg() -> str:
    found = shutil.which("ffmpeg")
    if found:
        return found
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception as e:  # noqa: BLE001
        raise SystemExit(
            "ffmpeg not found. Install ffmpeg, or: pip install imageio-ffmpeg"
        ) from e


def load_rows(path: Path) -> list[dict]:
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        rows.append(json.loads(line))
    return rows


def slice_one(ffmpeg: str, src: Path, start: float, end: float, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    dur = max(0.05, end - start)
    cmd = [
        ffmpeg,
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        f"{start:.3f}",
        "-i",
        str(src),
        "-t",
        f"{dur:.3f}",
        "-ac",
        "1",
        "-ar",
        "16000",
        str(dest),
    ]
    subprocess.run(cmd, check=True)


def main() -> int:
    ap = argparse.ArgumentParser(description="Slice ASR gold clips with ffmpeg")
    ap.add_argument("--manifest", type=Path, required=True)
    ap.add_argument("--out-dir", type=Path, required=True)
    ap.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parents[2],
        help="Repo root (for resolving relative audio paths)",
    )
    ap.add_argument(
        "--only-gold-ok",
        action="store_true",
        help="Only slice rows with goldOk=true (recommended before train)",
    )
    ap.add_argument(
        "--include-pending",
        action="store_true",
        help="Also slice goldOk=null (pilot / listen-check)",
    )
    args = ap.parse_args()
    ffmpeg = resolve_ffmpeg()

    rows = load_rows(args.manifest)
    written = 0
    skipped = 0

    for row in rows:
        ok = row.get("goldOk")
        if args.only_gold_ok and ok is not True:
            skipped += 1
            continue
        if not args.only_gold_ok and not args.include_pending and ok is False:
            skipped += 1
            continue

        audio_rel = row.get("audio")
        if not audio_rel:
            skipped += 1
            continue
        src = args.root / audio_rel
        if not src.exists():
            print(f"missing audio: {src}", file=sys.stderr)
            skipped += 1
            continue

        dest = args.out_dir / f"{row['id']}.wav"
        try:
            slice_one(ffmpeg, src, float(row["start"]), float(row["end"]), dest)
            written += 1
        except subprocess.CalledProcessError as e:
            print(f"ffmpeg failed for {row.get('id')}: {e}", file=sys.stderr)
            skipped += 1

    print(f"sliced={written} skipped={skipped} → {args.out_dir}")
    print(f"ffmpeg={ffmpeg}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

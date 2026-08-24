#!/usr/bin/env python3
"""Build assets/speak/audio-fingerprints.json from local ASR cue WAVs.

Clips stay gitignored under data/corpus/asr/clips/{pieceId}-{cueId}.wav.
Only the compact JSON vectors are committed.

Recipe matches src/speak-fingerprint.ts: 24 bins × (RMS energy + ZCR), L2-normalized → 48-dim.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import struct
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CLIPS = ROOT / "data" / "corpus" / "asr" / "clips"
OUT = ROOT / "assets" / "speak" / "audio-fingerprints.json"
TRANSCRIPTS = ROOT / "data" / "transcripts"

DEFAULT_PIECES = [
    ("jingchai-ji", 120),
    ("baitu-ji", 120),
    ("xianglin-sao-xinsuanhua", 40),
    ("liangzhu-shibaxiangsong", 40),
    ("liangzhu-shibaxiangsong-full", 80),
    ("liangzhu-xia", 60),
    ("mudanting-huanhunji", 80),
    ("chen-sanliang", 60),
    ("hongloumeng-1", 60),
    ("zanghua-yin", 60),
    ("chai-tou-feng", 40),
    # 2026-08-24 rich pack (short demos + longmen sample)
    ("biyu-zan-xinfang", 20),
    ("he-wenxiu-suanming", 20),
    ("xixiangji-kaohong", 20),
    ("hongloumeng-tianxia", 20),
    ("wunv-baishou-huashu", 20),
    ("zhuiyu-guandeng", 20),
    ("longmen-kezhai", 80),
]


def read_wav_mono(path: Path) -> list[float]:
    with wave.open(str(path), "rb") as w:
        nch = w.getnchannels()
        sw = w.getsampwidth()
        n = w.getnframes()
        raw = w.readframes(n)
    if sw == 2:
        fmt = f"<{n * nch}h"
        samples = struct.unpack(fmt, raw)
        scale = 32768.0
    elif sw == 1:
        fmt = f"<{n * nch}B"
        samples = struct.unpack(fmt, raw)
        scale = 128.0
        samples = [s - 128 for s in samples]
    else:
        raise ValueError(f"unsupported sample width {sw} in {path}")
    if nch == 1:
        return [s / scale for s in samples]
    out = []
    for i in range(0, len(samples), nch):
        out.append(sum(samples[i : i + nch]) / (nch * scale))
    return out


def fingerprint(samples: list[float], bins: int = 24) -> list[float]:
    n = max(1, len(samples))
    vec: list[float] = []
    for b in range(bins):
        start = (b * n) // bins
        end = ((b + 1) * n) // bins
        length = max(1, end - start)
        energy = 0.0
        zc = 0
        prev = samples[start] if start < n else 0.0
        for i in range(start, end):
            x = samples[i]
            energy += x * x
            if (prev >= 0) != (x >= 0):
                zc += 1
            prev = x
        vec.append(math.sqrt(energy / length))
        vec.append(zc / length)
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [round(v / norm, 5) for v in vec]


def cue_times(piece_id: str) -> dict[int, tuple[float | None, float | None]]:
    path = TRANSCRIPTS / f"{piece_id}.json"
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    out: dict[int, tuple[float | None, float | None]] = {}
    for c in data.get("cues") or []:
        try:
            cid = int(c["id"])
        except (KeyError, TypeError, ValueError):
            continue
        out[cid] = (c.get("start"), c.get("end"))
    return out


def list_clips(piece_id: str) -> list[tuple[int, Path]]:
    pat = re.compile(rf"^{re.escape(piece_id)}-(\d+)\.wav$")
    found: list[tuple[int, Path]] = []
    if not CLIPS.exists():
        return found
    for p in CLIPS.iterdir():
        m = pat.match(p.name)
        if m:
            found.append((int(m.group(1)), p))
    found.sort(key=lambda x: x[0])
    return found


def sample_evenly(items: list, cap: int) -> list:
    if len(items) <= cap:
        return items
    if cap <= 1:
        return items[:1]
    out = []
    for i in range(cap):
        idx = round(i * (len(items) - 1) / (cap - 1))
        out.append(items[idx])
    # de-dupe while preserving order
    seen = set()
    uniq = []
    for x in out:
        if x[0] in seen:
            continue
        seen.add(x[0])
        uniq.append(x)
    return uniq


def build(piece_caps: list[tuple[str, int]]) -> dict:
    items = []
    for piece_id, cap in piece_caps:
        clips = list_clips(piece_id)
        if not clips:
            print(f"skip {piece_id}: no clips")
            continue
        times = cue_times(piece_id)
        chosen = sample_evenly(clips, cap)
        for cue_id, path in chosen:
            try:
                samples = read_wav_mono(path)
            except Exception as e:
                print(f"  fail {path.name}: {e}")
                continue
            # match browser: first ~8s only
            # assume 16kHz common; if unknown, take first 8*16000 samples
            take = min(len(samples), 8 * 16000)
            v = fingerprint(samples[:take])
            start, end = times.get(cue_id, (None, None))
            items.append(
                {
                    "id": f"{piece_id}-{cue_id}",
                    "pieceId": piece_id,
                    "cueId": cue_id,
                    "start": start,
                    "end": end,
                    "v": v,
                }
            )
        print(f"{piece_id}: {len(chosen)}/{len(clips)} clips → fingerprints")
    return {
        "schema": "yueyu-audio-fp/v1",
        "dim": 48,
        "n": len(items),
        "items": items,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=OUT)
    args = ap.parse_args()
    data = build(DEFAULT_PIECES)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {args.out} n={data['n']}")


if __name__ == "__main__":
    main()

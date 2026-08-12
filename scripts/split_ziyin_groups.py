#!/usr/bin/env python3
"""Split group recordings into per-character m4a clips.

Source of truth for group order: 录音字 PDF (same lists as Level 1–4 sheets).
Recording protocol: each character × 3 takes; ~1s between takes; ~3s between chars.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
INCOMING = ROOT / "_incoming_audio" / "单字语音 全"
PDF_PATH = ROOT / "_incoming_audio" / "录音字_20260811231045.pdf"
OUT_DIR = ROOT / "assets" / "learn" / "ziyin-audio" / "shengzhou"
BATCH_DIR = ROOT / "assets" / "learn" / "ziyin-audio" / "batches"
WORK = ROOT / "_incoming_audio" / "_split_work"
PDF_GROUPS_JSON = ROOT / "_incoming_audio" / "pdf_groups.json"
CN_NUM = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10}


def only_han(s: str) -> str:
    return "".join(ch for ch in s if "\u4e00" <= ch <= "\u9fff")


def load_pdf_groups() -> dict[tuple[int, int], list[str]]:
    """Parse 录音字 PDF into {(level, group): [chars...]}."""
    import fitz

    if not PDF_PATH.exists():
        raise SystemExit(f"missing PDF: {PDF_PATH}")
    text = "\n".join(page.get_text("text") for page in fitz.open(PDF_PATH))
    groups: dict[tuple[int, int], list[str]] = {}
    cur_lv: int | None = None
    pending_g: int | None = None
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        m = re.match(r"第\s*([1-4])\s*阶", line)
        if m:
            cur_lv = int(m.group(1))
            pending_g = None
            continue
        m = re.match(r"^(\d+)\.\s*(.*)$", line)
        if m and cur_lv is not None:
            g = int(m.group(1))
            rest = only_han(m.group(2))
            if rest:
                groups[(cur_lv, g)] = list(rest)
                pending_g = None
            else:
                pending_g = g
            continue
        if pending_g is not None and cur_lv is not None:
            chars = only_han(line)
            if chars:
                groups[(cur_lv, pending_g)] = list(chars)
                pending_g = None
    PDF_GROUPS_JSON.write_text(
        json.dumps({f"L{lv}_G{g:02d}": chars for (lv, g), chars in sorted(groups.items())}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return groups


def parse_group_num(name: str) -> tuple[int, int] | None:
    stem = Path(name).stem
    stem = re.sub(r"\(\d+\)$", "", stem)
    m = re.search(r"(一|二|三|四)阶(.+)$", stem)
    if not m:
        return None
    lv = {"一": 1, "二": 2, "三": 3, "四": 4}[m.group(1)]
    rest = m.group(2).replace("组", "")
    if rest.isdigit():
        return lv, int(rest)
    if rest == "十":
        return lv, 10
    if rest.startswith("十") and len(rest) == 2:
        return lv, 10 + CN_NUM.get(rest[1], 0)
    if rest in CN_NUM:
        return lv, CN_NUM[rest]
    return None


def afconvert_to_wav(src: Path, dst: Path, sr: int = 48000) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        ["afconvert", "-f", "WAVE", "-d", f"LEI16@{sr}", "-c", "1", str(src), str(dst)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def afconvert_to_m4a(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        ["afconvert", "-f", "m4af", "-d", "aac", str(src), str(dst)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def load_wav(path: Path) -> tuple[int, np.ndarray]:
    with wave.open(str(path), "rb") as w:
        sr = w.getframerate()
        audio = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
    return sr, audio


def write_wav(path: Path, sr: int, audio: np.ndarray) -> None:
    audio = np.clip(audio, -1.0, 1.0)
    pcm = (audio * 32767.0).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())


def speech_segments(
    audio: np.ndarray,
    sr: int,
    frame_ms: float = 20.0,
    min_speech: float = 0.07,
    merge_gap: float = 0.40,
) -> list[tuple[float, float]]:
    frame = max(1, int(frame_ms / 1000 * sr))
    nframes = len(audio) // frame
    if nframes < 2:
        return []
    rms = np.sqrt(np.mean(audio[: nframes * frame].reshape(nframes, frame) ** 2, axis=1))
    thr = max(0.007, float(np.percentile(rms, 25)) * 2.8)
    speech = rms > thr
    raw: list[list[float]] = []
    i = 0
    while i < len(speech):
        if speech[i]:
            j = i
            while j < len(speech) and speech[j]:
                j += 1
            t0, t1 = i * frame / sr, j * frame / sr
            if t1 - t0 >= min_speech:
                raw.append([t0, t1])
            i = j
        else:
            i += 1
    if not raw:
        return []
    merged = [raw[0]]
    for a, b in raw[1:]:
        if a - merged[-1][1] <= merge_gap:
            merged[-1][1] = b
        else:
            merged.append([a, b])
    return [(a, b) for a, b in merged]


def adjust_segment_count(segs: list[tuple[float, float]], target: int) -> list[tuple[float, float]]:
    """Merge closest pairs or keep as-is to approach target count (usually 3*n_chars)."""
    segs = list(segs)
    while len(segs) > target:
        # merge the pair with smallest gap
        best_i = 0
        best_gap = 1e9
        for i in range(len(segs) - 1):
            gap = segs[i + 1][0] - segs[i][1]
            if gap < best_gap:
                best_gap = gap
                best_i = i
        a0, _ = segs[best_i]
        _, b1 = segs[best_i + 1]
        segs = segs[:best_i] + [(a0, b1)] + segs[best_i + 2 :]
    return segs


def partition_triple(segs: list[tuple[float, float]], n_chars: int) -> list[list[tuple[float, float]]]:
    """Force groups of 3 takes when possible; else largest-gap partition."""
    if n_chars <= 0:
        return []
    if not segs:
        return [[] for _ in range(n_chars)]

    target = n_chars * 3
    # Triple-take path: segment count near 3N
    if len(segs) >= n_chars * 2:
        segs2 = adjust_segment_count(segs, target) if len(segs) > target else segs
        if len(segs2) >= target:
            segs2 = segs2[:target]
            return [segs2[i * 3 : (i + 1) * 3] for i in range(n_chars)]
        # pad by splitting longest segments if still short
        while len(segs2) < target:
            # duplicate midpoint of longest as fake split (rare)
            lengths = [b - a for a, b in segs2]
            i = int(np.argmax(lengths))
            a, b = segs2[i]
            mid = (a + b) / 2
            segs2 = segs2[:i] + [(a, mid), (mid, b)] + segs2[i + 1 :]
        return [segs2[i * 3 : (i + 1) * 3] for i in range(n_chars)]

    # Sparse / single-take-looking: largest gaps
    if len(segs) <= n_chars:
        out: list[list[tuple[float, float]]] = [[s] for s in segs]
        while len(out) < n_chars:
            out.append([])
        return out

    gaps = [(segs[i][0] - segs[i - 1][1], i) for i in range(1, len(segs))]
    cut_idxs = sorted(i for _, i in sorted(gaps, reverse=True)[: n_chars - 1])
    groups: list[list[tuple[float, float]]] = []
    start = 0
    for cut in cut_idxs + [len(segs)]:
        groups.append(segs[start:cut])
        start = cut
    return groups


def time_windows(duration: float, n_chars: int) -> list[tuple[float, float]]:
    if n_chars <= 0 or duration <= 0:
        return []
    step = duration / n_chars
    return [(i * step, (i + 1) * step) for i in range(n_chars)]


def pick_take(audio: np.ndarray, sr: int, takes: list[tuple[float, float]]) -> tuple[float, float]:
    """Prefer middle of 3 takes; else loudest; pad slightly."""
    if not takes:
        return 0.0, 0.0

    def energy(seg: tuple[float, float]) -> float:
        a, b = int(seg[0] * sr), int(seg[1] * sr)
        chunk = audio[a:b]
        return float(np.mean(chunk * chunk)) if len(chunk) else 0.0

    if len(takes) >= 3:
        t0, t1 = takes[1]
    elif len(takes) == 2:
        t0, t1 = max(takes, key=energy)
    else:
        t0, t1 = takes[0]
    pad = 0.15
    t0 = max(0.0, t0 - pad)
    t1 = min(len(audio) / sr, t1 + pad)
    return t0, t1


def split_file(src: Path, chars: list[str], out_dir: Path) -> dict:
    work = WORK / src.stem
    if work.exists():
        shutil.rmtree(work)
    work.mkdir(parents=True)
    wav = work / "full.wav"
    afconvert_to_wav(src, wav)
    sr, audio = load_wav(wav)
    duration = len(audio) / sr
    segs = speech_segments(audio, sr)
    n = len(chars)
    groups = partition_triple(segs, n)

    windows = time_windows(duration, n)
    for idx in range(n):
        if idx < len(groups) and groups[idx]:
            continue
        w0, w1 = windows[idx]
        overlap = [s for s in segs if s[1] > w0 and s[0] < w1]
        groups[idx] = overlap if overlap else [(w0 + 0.2, max(w0 + 0.35, w1 - 0.2))]

    written = []
    issues = []
    mode = "triple" if len(segs) >= n * 2 else "sparse"
    for idx, han in enumerate(chars):
        takes = groups[idx] if idx < len(groups) else []
        if not takes:
            issues.append(f"{han}: no speech")
            continue
        if mode == "triple" and len(takes) != 3:
            issues.append(f"{han}: {len(takes)} takes")
        t0, t1 = pick_take(audio, sr, takes)
        if t1 <= t0:
            issues.append(f"{han}: empty clip")
            continue
        clip = audio[int(t0 * sr) : int(t1 * sr)]
        peak = float(np.max(np.abs(clip))) if len(clip) else 0.0
        if peak > 1e-4:
            clip = clip * min(0.95 / peak, 3.0)
        wav_clip = work / f"{han}.wav"
        m4a_clip = out_dir / f"{han}.m4a"
        write_wav(wav_clip, sr, clip)
        afconvert_to_m4a(wav_clip, m4a_clip)
        written.append(han)

    return {
        "file": src.name,
        "expected": n,
        "speech_segs": len(segs),
        "written": len(written),
        "issues": issues,
        "mode": mode,
        "chars": "".join(chars),
    }


def main() -> None:
    pdf_groups = load_pdf_groups()
    print(f"PDF groups loaded: {len(pdf_groups)}")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    BATCH_DIR.mkdir(parents=True, exist_ok=True)
    WORK.mkdir(parents=True, exist_ok=True)

    # clear previous clips so stale chars don't linger
    for old in OUT_DIR.glob("*.m4a"):
        old.unlink()

    reports = []
    files = sorted(INCOMING.rglob("*.m4a"))
    for src in files:
        parsed = parse_group_num(src.name)
        if not parsed:
            print("SKIP unparsed", src.name)
            continue
        lv, g = parsed
        chars = pdf_groups.get((lv, g))
        if not chars:
            print("SKIP no PDF group", src.name, parsed)
            continue
        shutil.copy2(src, BATCH_DIR / f"L{lv}_G{g:02d}.m4a")
        print(f"SPLIT {src.name} -> L{lv}G{g} ({len(chars)} chars) {''.join(chars[:6])}…")
        rep = split_file(src, chars, OUT_DIR)
        reports.append(rep)
        print(f"  mode={rep['mode']} segs={rep['speech_segs']} written={rep['written']} issues={len(rep['issues'])}")

    report_path = ROOT / "_incoming_audio" / "split_report.json"
    report_path.write_text(json.dumps(reports, ensure_ascii=False, indent=2), encoding="utf-8")
    total_written = sum(r["written"] for r in reports)
    total_expected = sum(r["expected"] for r in reports)
    print("---")
    print(f"done: {total_written}/{total_expected} clips -> {OUT_DIR}")
    print(f"report: {report_path}")
    print(f"pdf groups: {PDF_GROUPS_JSON}")


if __name__ == "__main__":
    main()

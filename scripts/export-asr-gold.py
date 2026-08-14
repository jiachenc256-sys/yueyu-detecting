#!/usr/bin/env python3
"""Export timed, corrected archive cues as ASR gold-clip candidates (JSONL).

Usage: python3 scripts/export-asr-gold.py
       npm run asr:export-gold
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TRANSCRIPTS_DIR = ROOT / "data" / "transcripts"
OUT_DIR = ROOT / "data" / "corpus" / "asr"
OUT_JSONL = OUT_DIR / "gold-clips.jsonl"
OUT_SUMMARY = OUT_DIR / "gold-summary.json"

DEFAULT_TEST_PIECES = {
    "xianglin-sao-xinsuanhua",
    "he-wenxiu-suanming",
}
MAX_DUR_SEC = 30.0
MIN_DUR_SEC = 0.4


def is_usable_text(text: str) -> bool:
    t = text.strip()
    if not t:
        return False
    if t.startswith("["):
        return False
    if re.fullmatch(r"（.*）", t) or re.fullmatch(r"\(.*\)", t):
        return False
    return True


def load_existing() -> dict[str, dict]:
    out: dict[str, dict] = {}
    if not OUT_JSONL.exists():
        return out
    for line in OUT_JSONL.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        if row.get("id"):
            out[row["id"]] = row
    return out


def list_pieces() -> list[dict]:
    pieces = []
    for path in sorted(TRANSCRIPTS_DIR.glob("*.json")):
        if path.name.endswith(".base.json"):
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        if data.get("id") and data.get("audio") and isinstance(data.get("cues"), list):
            pieces.append(data)
    return pieces


def round1(n: float) -> float:
    return round(n * 10) / 10


def export_clips() -> tuple[list[dict], dict]:
    prev = load_existing()
    clips: list[dict] = []

    for piece in list_pieces():
        audio_rel = piece["audio"]
        if not (ROOT / audio_rel).exists():
            continue
        split = "test" if piece["id"] in DEFAULT_TEST_PIECES else "train"

        for cue in piece["cues"]:
            zh = (cue.get("layers") or {}).get("zh") or {}
            text = (zh.get("text") or "").strip()
            zh_status = zh.get("status") or ""
            if zh_status not in ("corrected", "reviewed"):
                continue
            if not is_usable_text(text):
                continue
            start = float(cue["start"])
            end = float(cue["end"])
            duration = end - start
            if not (MIN_DUR_SEC <= duration <= MAX_DUR_SEC):
                continue

            cid = f"{piece['id']}-{cue['id']}"
            old = prev.get(cid, {})
            clips.append(
                {
                    "id": cid,
                    "pieceId": piece["id"],
                    "title": piece.get("title") or piece["id"],
                    "audio": audio_rel,
                    "cueId": cue["id"],
                    "start": start,
                    "end": end,
                    "durationSec": round(duration * 1000) / 1000,
                    "text": old["text"]
                    if old.get("goldOk") and old.get("text")
                    else text,
                    "zhStatus": "reviewed"
                    if old.get("zhStatus") == "reviewed"
                    else zh_status,
                    "speaker": cue.get("speaker"),
                    "split": old.get("split") or split,
                    "register": old.get("register"),
                    "goldOk": old.get("goldOk"),
                    "rights": old.get("rights") or "archive-starter",
                    "notes": old.get("notes") or "",
                }
            )

    clips.sort(key=lambda c: c["id"])

    by_split = {"train": 0, "test": 0}
    sec = {"train": 0.0, "test": 0.0, "goldOk": 0.0, "pending": 0.0}
    gold_ok = 0
    pending = 0
    by_piece: dict[str, dict] = {}

    for c in clips:
        by_split[c["split"]] += 1
        sec[c["split"]] += c["durationSec"]
        if c.get("goldOk") is True:
            gold_ok += 1
            sec["goldOk"] += c["durationSec"]
        else:
            pending += 1
            sec["pending"] += c["durationSec"]
        slot = by_piece.setdefault(
            c["pieceId"], {"n": 0, "sec": 0.0, "split": c["split"]}
        )
        slot["n"] += 1
        slot["sec"] += c["durationSec"]

    total = sum(c["durationSec"] for c in clips)
    summary = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "clipCount": len(clips),
        "goldOkCount": gold_ok,
        "pendingReviewCount": pending,
        "durationSec": {
            "all": total,
            "train": sec["train"],
            "test": sec["test"],
            "goldOk": sec["goldOk"],
            "pending": sec["pending"],
        },
        "durationMin": {
            "all": round1(total / 60),
            "train": round1(sec["train"] / 60),
            "test": round1(sec["test"] / 60),
            "goldOk": round1(sec["goldOk"] / 60),
        },
        "testPieces": sorted(DEFAULT_TEST_PIECES),
        "byPiece": by_piece,
        "nextSteps": [
            "听校每条，设置 goldOk=true 并填写 register（sanbai/yunbai/changci）",
            "npm run asr:export-gold 会保留你已填的 register / goldOk / notes",
            "见 docs/YUEYU_ASR.md",
        ],
    }
    return clips, summary


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    clips, summary = export_clips()
    OUT_JSONL.write_text(
        "\n".join(json.dumps(c, ensure_ascii=False) for c in clips) + "\n",
        encoding="utf-8",
    )
    OUT_SUMMARY.write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Wrote {len(clips)} clips → {OUT_JSONL.relative_to(ROOT)}")
    print(
        f"Summary → {OUT_SUMMARY.relative_to(ROOT)} "
        f"({summary['durationMin']['all']} min total)"
    )


if __name__ == "__main__":
    main()

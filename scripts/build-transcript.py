#!/usr/bin/env python3
"""Parse SRT, apply known ASR corrections, emit JSON for the sync viewer."""

import json
import re
import sys
from pathlib import Path

# Manual overrides by cue index (1-based). Raw text preserved in `raw`.
MANUAL_FIXES: dict[int, str] = {
    1: "[序曲]",
    2: "[序曲]",
    3: "[序曲]",
    4: "[序曲]",
    5: "我要你的眼睛 你有眼看不见",
    6: "我要你的皮 你有皮不要脸呐",
    7: "我要你的脚 你有腿站不直呐",
}

# Pattern fixes applied after manual overrides
PATTERN_FIXES = [
    (re.compile(r"眼响"), "眼睛"),
    (re.compile(r"看不见p$"), "看不见"),
    (re.compile(r"交响"), "脚"),
    (re.compile(r"衣不要"), "皮不要"),
    (re.compile(r"镶镶"), "镶玉"),
]


def parse_srt_time(ts: str) -> float:
    h, m, rest = ts.split(":")
    s, ms = rest.split(",")
    return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000


def parse_srt(path: Path) -> list[dict]:
    content = path.read_text(encoding="utf-8")
    blocks = re.split(r"\n\s*\n", content.strip())
    cues = []

    for block in blocks:
        lines = block.strip().splitlines()
        if len(lines) < 3:
            continue
        try:
            index = int(lines[0].strip())
        except ValueError:
            continue
        timing = lines[1].strip()
        text = " ".join(line.strip() for line in lines[2:] if line.strip())
        if "-->" not in timing:
            continue
        start_str, end_str = [part.strip() for part in timing.split("-->")]
        cues.append(
            {
                "id": index,
                "start": parse_srt_time(start_str),
                "end": parse_srt_time(end_str),
                "raw": text,
                "text": text,
            }
        )

    return cues


def apply_corrections(cues: list[dict]) -> list[dict]:
    for cue in cues:
        cue_id = cue["id"]
        if cue_id in MANUAL_FIXES:
            cue["text"] = MANUAL_FIXES[cue_id]
            cue["corrected"] = True
            continue

        text = cue["text"]
        original = text
        for pattern, replacement in PATTERN_FIXES:
            text = pattern.sub(replacement, text)

        if text != original:
            cue["text"] = text
            cue["corrected"] = True

    return cues


def main() -> None:
    source = Path(
        sys.argv[1]
        if len(sys.argv) > 1
        else Path.home() / "Desktop/linguilistic project/新龙门客寨.srt"
    )
    output = Path(
        sys.argv[2]
        if len(sys.argv) > 2
        else Path(__file__).resolve().parent.parent / "data/transcripts/longmen-kezhai.json"
    )

    cues = apply_corrections(parse_srt(source))
    payload = {
        "id": "longmen-kezhai",
        "title": "新龙门客寨",
        "titleEn": "New Dragon Inn",
        "audio": "assets/audio/longmen-kezhai.m4a",
        "sourceSrt": "新龙门客寨.srt",
        "cueCount": len(cues),
        "correctedCount": sum(1 for c in cues if c.get("corrected")),
        "cues": cues,
    }

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(cues)} cues ({payload['correctedCount']} corrected) → {output}")


if __name__ == "__main__":
    main()

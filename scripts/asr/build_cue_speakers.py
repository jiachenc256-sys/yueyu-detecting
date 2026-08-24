#!/usr/bin/env python3
"""Rebuild assets/speak/cue-speakers.json from transcript speaker fields.

Only cues with `speaker` (and optional `speakerEn`) are exported.
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TRANSCRIPTS = ROOT / "data" / "transcripts"
OUT = ROOT / "assets" / "speak" / "cue-speakers.json"


def main() -> None:
    items: list[dict] = []
    for path in sorted(TRANSCRIPTS.glob("*.json")):
        if path.name.endswith(".base.json"):
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        piece_id = data.get("id") or path.stem
        for cue in data.get("cues") or []:
            speaker = cue.get("speaker")
            if not speaker:
                continue
            cue_id = int(cue["id"])
            items.append(
                {
                    "id": f"{piece_id}-{cue_id}",
                    "pieceId": piece_id,
                    "cueId": cue_id,
                    "speakerZh": speaker,
                    "speakerEn": cue.get("speakerEn") or speaker,
                }
            )
    out = {"schema": "yueyu-cue-speakers/v1", "n": len(items), "items": items}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUT} n={out['n']}")


if __name__ == "__main__":
    main()

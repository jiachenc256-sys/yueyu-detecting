#!/usr/bin/env python3
"""Build dictionary JSON from shengzhou-1000 + shengzhou-phrases CSVs."""
from __future__ import annotations

import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CAT_TO_SCENE = {
    "一、天文地理": "astronomy",
    "二、时间方位": "time",
    "三、植物": "plant",
    "四、动物": "animal",
    "五、房舍器具": "house",
    "六、服饰饮食": "food",
    "七、身体医疗": "body",
    "八、婚丧信仰": "ritual",
    "九、人品称谓": "people",
    "十、农工商文": "work",
    "十一、动作行为": "action",
    "十二、性质状态": "quality",
    "十三、数量": "number",
    "十四、代副词连词": "particle",
}
SCENE_ORDER = ["", *CAT_TO_SCENE.values()]


def parse_han(raw: str) -> tuple[str, str | None, str]:
    raw = raw.strip()
    m = re.match(r"^(.+?)（([^）]+)）$", raw) or re.match(r"^(.+?)\(([^)]+)\)$", raw)
    if m:
        return m.group(1), m.group(2), raw
    return raw, None, raw


def extract_chars(term: str) -> list[str]:
    chars: list[str] = []
    seen: set[str] = set()
    for ch in term:
        if "\u4e00" <= ch <= "\u9fff" or "\u3400" <= ch <= "\u4dbf":
            if ch not in seen:
                seen.add(ch)
                chars.append(ch)
    return chars


def main() -> None:
    char_rows = list(
        csv.DictReader((ROOT / "data/dictionary/shengzhou-1000/shengzhou-1000.csv").open(encoding="utf-8-sig"))
    )
    char_items = []
    for r in char_rows:
        han, sense, display = parse_han(r["单字"])
        char_items.append(
            {
                "id": r["编号"],
                "han": han,
                "hanDisplay": display,
                "sense": sense,
                "rhyme": r["音韵地位"].strip(),
                "oldMale": r["老男音"].strip(),
                "youngMale": r["青男音"].strip(),
            }
        )
    (ROOT / "data/dictionary/shengzhou-chars.json").write_text(
        json.dumps(
            {
                "schemaVersion": "1.0.0",
                "source": "shengzhou-1000.csv",
                "label": "嵊州单字·老男/青男",
                "n": len(char_items),
                "items": char_items,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    phrase_rows = list(
        csv.DictReader((ROOT / "data/dictionary/shengzhou-phrases/shengzhou-phrases.csv").open(encoding="utf-8-sig"))
    )
    phrase_items = []
    for r in phrase_rows:
        cat = r.get("类别名称", "").strip()
        term = r["词条"].strip()
        note = r.get("备注", "").strip()
        phrase_items.append(
            {
                "id": f"sz{r['编号']}",
                "zh": term,
                "reading": r["方言注音"].strip(),
                "en": "",
                "scene": CAT_TO_SCENE.get(cat, "daily"),
                "category": cat,
                "part": r.get("部分", "").strip(),
                "chars": extract_chars(term),
                "note": note,
                "source": "book",
            }
        )
    (ROOT / "data/dictionary/shengzhou-phrases.json").write_text(
        json.dumps(
            {
                "schemaVersion": "1.0.0",
                "source": "shengzhou-phrases.csv",
                "label": "嵊州方言词组（十四类）",
                "n": len(phrase_items),
                "scenes": SCENE_ORDER,
                "sceneLabelsZh": {v: k for k, v in CAT_TO_SCENE.items()},
                "items": phrase_items,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    (ROOT / "data/dictionary/shengzhou-phrase-scenes.json").write_text(
        json.dumps(
            {
                "schemaVersion": "1.0.0",
                "order": SCENE_ORDER,
                "labels": {
                    "zh-Hans": {**{v: k for k, v in CAT_TO_SCENE.items()}, "": "全部"},
                    "zh-Hant": {
                        "astronomy": "一、天文地理",
                        "time": "二、時間方位",
                        "plant": "三、植物",
                        "animal": "四、動物",
                        "house": "五、房舍器具",
                        "food": "六、服飾飲食",
                        "body": "七、身體醫療",
                        "ritual": "八、婚喪信仰",
                        "people": "九、人品稱謂",
                        "work": "十、農工商文",
                        "action": "十一、動作行為",
                        "quality": "十二、性質狀態",
                        "number": "十三、數量",
                        "particle": "十四、代副詞連詞",
                        "": "全部",
                    },
                    "en": {
                        "astronomy": "1 Astronomy & geography",
                        "time": "2 Time & place",
                        "plant": "3 Plants",
                        "animal": "4 Animals",
                        "house": "5 House & tools",
                        "food": "6 Clothing & food",
                        "body": "7 Body & medicine",
                        "ritual": "8 Marriage, death & belief",
                        "people": "9 People & kinship",
                        "work": "10 Farm, trade & letters",
                        "action": "11 Actions",
                        "quality": "12 Qualities",
                        "number": "13 Numbers",
                        "particle": "14 Pronouns & particles",
                        "": "All",
                    },
                },
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"chars={len(char_items)} phrases={len(phrase_items)}")


if __name__ == "__main__":
    main()

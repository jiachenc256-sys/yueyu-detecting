#!/usr/bin/env python3
"""OCR every page of a tanci PDF via Talcne and write data/tanci/<id>.pages.json."""

from __future__ import annotations

import argparse
import json
import ssl
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_API = "https://talcne.onrender.com"


def ocr_jpeg(api: str, jpeg: bytes, timeout: int = 120) -> str:
    boundary = uuid.uuid4().hex
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="page.jpg"\r\n'
        f"Content-Type: image/jpeg\r\n\r\n"
    ).encode() + jpeg + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(
        f"{api.rstrip('/')}/api/ocr",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, context=ctx, timeout=timeout) as resp:
        data = json.loads(resp.read().decode())
    if not data.get("success", True) and data.get("error"):
        raise RuntimeError(data.get("error") or data.get("detail") or "OCR failed")
    return (data.get("text") or "").strip()


def to_hant(text: str) -> str:
    try:
        from opencc import OpenCC  # type: ignore

        return OpenCC("s2t").convert(text)
    except Exception:
        try:
            from opencc_python_reimplemented import OpenCC  # type: ignore

            return OpenCC("s2t").convert(text)
        except Exception:
            pass
    # optional opencc-js not available in python; leave blank for site to convert later
    return ""


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", required=True)
    ap.add_argument("--id", default="pearl-tower-gift")
    ap.add_argument("--api", default=DEFAULT_API)
    ap.add_argument("--start", type=int, default=1)
    ap.add_argument("--end", type=int, default=0, help="Inclusive; 0 = last page")
    ap.add_argument("--sleep", type=float, default=0.4)
    ap.add_argument("--scale", type=float, default=1.4)
    args = ap.parse_args()

    pdf_path = Path(args.pdf).expanduser().resolve()
    out_path = ROOT / "data" / "tanci" / f"{args.id}.pages.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(pdf_path)
    end = args.end or doc.page_count
    end = min(end, doc.page_count)
    start = max(1, args.start)

    if out_path.exists():
        payload = json.loads(out_path.read_text(encoding="utf-8"))
    else:
        payload = {
            "id": args.id,
            "pageCount": doc.page_count,
            "pdf": f"../assets/tanci/{args.id.replace('-gift','')}/pearl-tower-revised-vol1.pdf"
            if "pearl" in args.id
            else "",
            "ocrEngine": "talcne",
            "pages": [],
        }

    by_n = {int(p["n"]): p for p in payload.get("pages", [])}
    for n in range(1, doc.page_count + 1):
        by_n.setdefault(n, {"n": n, "zh": "", "zhHant": "", "en": "", "status": "pending"})

    # Wake API
    try:
        ctx = ssl.create_default_context()
        urllib.request.urlopen(f"{args.api.rstrip('/')}/api/health", context=ctx, timeout=90).read()
        print("API awake")
    except Exception as exc:
        print("API wake warning:", exc)

    for n in range(start, end + 1):
        entry = by_n[n]
        if entry.get("zh") and entry.get("status") == "done":
            print(f"skip {n}")
            continue
        page = doc.load_page(n - 1)
        pix = page.get_pixmap(matrix=fitz.Matrix(args.scale, args.scale), alpha=False)
        jpeg = pix.tobytes("jpeg")
        try:
            zh = ocr_jpeg(args.api, jpeg)
            entry["zh"] = zh
            entry["zhHant"] = to_hant(zh) if zh else ""
            entry["status"] = "done" if zh else "empty"
            print(f"ok {n}/{doc.page_count} chars={len(zh)}")
        except Exception as exc:
            entry["status"] = "failed"
            entry["error"] = str(exc)[:200]
            print(f"fail {n}: {exc}")
        by_n[n] = entry
        payload["pageCount"] = doc.page_count
        payload["pages"] = [by_n[i] for i in range(1, doc.page_count + 1)]
        if "pearl" in args.id:
            payload["pdf"] = "../assets/tanci/pearl-tower/pearl-tower-revised-vol1.pdf"
        out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        time.sleep(args.sleep)

    doc.close()
    done = sum(1 for p in payload["pages"] if p.get("status") == "done")
    print(f"Finished. done={done}/{doc.page_count} → {out_path}")


if __name__ == "__main__":
    main()

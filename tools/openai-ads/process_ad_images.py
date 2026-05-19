"""Resize SFW ad source photos to 1200x1200 JPGs and upload to GCS.

Source:  ad-images/<Category>/postNN_<orig>.jpg
Output:  ad-images-resized/<Category>/<same>.jpg  (square 1200x1200, <500KB)
Upload:  gs://buildertrend-rip/sfw-ad-images/<Category>/<file>.jpg
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

from PIL import Image

KEY_PATH = r"C:\Users\tfalcon\builder-rip\gcs-key.json"
SRC_ROOT = Path(r"C:\Users\tfalcon\microsites\tools\openai-ads\ad-images")
OUT_ROOT = Path(r"C:\Users\tfalcon\microsites\tools\openai-ads\ad-images-resized")
BUCKET_NAME = "buildertrend-rip"
GCS_PREFIX = "sfw-ad-images"
TARGET = 1200
SIZE_LIMIT = 500_000  # bytes

# Posts where the reference doc flags people/crew in frame.
# For landscape sources (W>H), full image height is preserved by a square crop,
# so a "team" tag doesn't change vertical cropping. For portrait sources we
# always bias upward to keep faces; that rule fires automatically below.
TEAM_POST_IDS = {1}  # #1 = "Hardie-shake crew, Bellevue"

POST_ID_RE = re.compile(r"^post(\d+)_")


def post_id_of(name: str) -> int | None:
    m = POST_ID_RE.match(name)
    return int(m.group(1)) if m else None


def square_crop_box(w: int, h: int, bias_up_pct: float = 0.0) -> tuple[int, int, int, int]:
    """Return a (left, top, right, bottom) box for a square crop.

    bias_up_pct shifts the crop window upward (negative top offset) by that
    fraction of the available vertical slack. Used for portrait photos so
    faces aren't sliced off.
    """
    s = min(w, h)
    left = (w - s) // 2
    top = (h - s) // 2
    if h > w and bias_up_pct > 0:
        # available slack above center
        top = max(0, int(top - bias_up_pct * top * 2))
    return left, top, left + s, top + s


def process_one(src: Path, dst: Path, bias_up: bool) -> int:
    dst.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(src) as im:
        im = im.convert("RGB")
        w, h = im.size
        bias = 0.10 if (bias_up or h > w) else 0.0
        box = square_crop_box(w, h, bias)
        cropped = im.crop(box)
        resized = cropped.resize((TARGET, TARGET), Image.LANCZOS)
        for q in (85, 80, 75, 70):
            resized.save(
                dst,
                format="JPEG",
                quality=q,
                progressive=True,
                optimize=True,
            )
            if dst.stat().st_size < SIZE_LIMIT:
                return dst.stat().st_size
        # last attempt's size
        return dst.stat().st_size


def main_resize() -> list[dict]:
    results = []
    sources = sorted(SRC_ROOT.rglob("*.jpg")) + sorted(SRC_ROOT.rglob("*.JPG"))
    # de-dup case-insensitively
    seen = set()
    uniq = []
    for s in sources:
        key = str(s).lower()
        if key in seen:
            continue
        seen.add(key)
        uniq.append(s)
    for src in uniq:
        category = src.parent.name
        rel = src.relative_to(SRC_ROOT)
        # normalize extension to .jpg on output
        out_name = src.stem + ".jpg"
        dst = OUT_ROOT / category / out_name
        pid = post_id_of(src.name)
        bias_up = pid in TEAM_POST_IDS
        size = process_one(src, dst, bias_up=bias_up)
        ok = size < SIZE_LIMIT
        print(f"[{'OK' if ok else 'BIG'}] {rel} -> {dst.relative_to(OUT_ROOT)}  {size/1024:.0f} KB")
        results.append({
            "category": category,
            "post_id": pid,
            "src": str(src),
            "dst": str(dst),
            "size": size,
            "ok": ok,
        })
    return results


def main_upload(items: list[dict]) -> list[dict]:
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = KEY_PATH
    from google.cloud import storage

    client = storage.Client()
    bucket = client.bucket(BUCKET_NAME)
    out = []
    for it in items:
        dst = Path(it["dst"])
        object_path = f"{GCS_PREFIX}/{it['category']}/{dst.name}"
        blob = bucket.blob(object_path)
        blob.cache_control = "public, max-age=31536000"
        blob.content_type = "image/jpeg"
        blob.upload_from_filename(str(dst), content_type="image/jpeg")
        url = f"https://storage.googleapis.com/{BUCKET_NAME}/{object_path}"
        print(f"[UP] {object_path}  ({it['size']/1024:.0f} KB)")
        out.append({**it, "object_path": object_path, "url": url})
    return out


def main_verify(items: list[dict]) -> list[dict]:
    import urllib.request

    failures = []
    for it in items:
        req = urllib.request.Request(it["url"], method="HEAD")
        with urllib.request.urlopen(req, timeout=30) as r:
            status = r.status
            ctype = r.headers.get("Content-Type", "")
            clen = int(r.headers.get("Content-Length", "0"))
        ok = status == 200 and ctype.startswith("image/jpeg") and clen < SIZE_LIMIT
        flag = "OK" if ok else "FAIL"
        print(f"[{flag}] {status} {ctype} {clen} {it['url']}")
        if not ok:
            failures.append({**it, "status": status, "content_type": ctype, "length": clen})
    return failures


if __name__ == "__main__":
    print("=== RESIZE ===")
    items = main_resize()
    print(f"\nresized {len(items)} images, {sum(1 for x in items if not x['ok'])} over limit\n")
    print("=== UPLOAD ===")
    uploaded = main_upload(items)
    print(f"\nuploaded {len(uploaded)} objects\n")
    print("=== VERIFY ===")
    failures = main_verify(uploaded)
    if failures:
        print(f"\n{len(failures)} verification failures")
        sys.exit(1)
    # Persist final report
    report = {
        "bucket": BUCKET_NAME,
        "prefix": GCS_PREFIX,
        "items": [
            {
                "category": it["category"],
                "post_id": it["post_id"],
                "object_path": it["object_path"],
                "url": it["url"],
                "size": it["size"],
            }
            for it in uploaded
        ],
    }
    out_json = OUT_ROOT / "_upload_report.json"
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(report, indent=2))
    print(f"\nwrote {out_json}")

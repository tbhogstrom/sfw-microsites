import json
import sys
from pathlib import Path

from process_ad_images import (
    OUT_ROOT,
    main_resize,
    main_upload,
    main_verify,
)

# Re-derive item list from already-resized outputs (do NOT redo resize).
SRC_ROOT = Path(r"C:\Users\tfalcon\microsites\tools\openai-ads\ad-images")
items = []
for dst in sorted(OUT_ROOT.rglob("*.jpg")):
    category = dst.parent.name
    name = dst.name
    # post id from name
    import re
    m = re.match(r"^post(\d+)_", name)
    pid = int(m.group(1)) if m else None
    items.append({
        "category": category,
        "post_id": pid,
        "src": str(SRC_ROOT / category / name),
        "dst": str(dst),
        "size": dst.stat().st_size,
        "ok": dst.stat().st_size < 500_000,
    })

print(f"=== UPLOAD ({len(items)} items) ===")
uploaded = main_upload(items)
print(f"\nuploaded {len(uploaded)} objects\n")

print("=== VERIFY ===")
failures = main_verify(uploaded)
if failures:
    print(f"\n{len(failures)} verification failures")
    sys.exit(1)

report = {
    "bucket": "buildertrend-rip",
    "prefix": "sfw-ad-images",
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
out_json.write_text(json.dumps(report, indent=2))
print(f"\nwrote {out_json}")

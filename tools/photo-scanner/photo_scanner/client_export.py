"""Client photo export — AI safety pass and zip builder.

Adds a fourth analysis pass on top of the existing scanner pipeline that flags
photos as inappropriate for direct hand-off to a customer. Also exposes the
helpers used by the FastAPI routes.
"""
import json
import os
from datetime import datetime, timezone
from pathlib import PurePosixPath
from urllib.parse import urlparse


VALID_FLAGS = {"face", "mess", "junk", "ppe", "personal_property", "profanity"}


SAFETY_PROMPT = """\
Decide whether this construction job-site photo is appropriate to send directly to the
homeowner/customer as part of their job-photo package.

Flag the photo if any of the following are true:
- "face": a person's face or other identifying features are visible
- "mess": clutter, debris, lunch wrappers, truck cab, scattered tools, etc.
- "junk": blurry, very dark, accidental shot, extreme close-up of nothing identifiable
- "ppe": worker without PPE, unsafe ladder placement, or anything that looks unsafe
        whether or not it actually is
- "personal_property": interior of customer's home, their belongings, mail/letters,
        license plate, or anything privacy-sensitive
- "profanity": graffiti, off-color hand-written notes, gestures

Respond in JSON only:
{
  "ok": true | false,
  "flags": [zero or more of: "face", "mess", "junk", "ppe", "personal_property", "profanity"],
  "notes": "one short sentence explaining the flag(s), or empty string if ok"
}

A photo is "ok" only if flags is empty.
"""


def parse_safety_response(text: str) -> dict:
    """Parse the safety-pass JSON response. Returns a safe default on any error."""
    safe_default = {"ok": True, "flags": [], "notes": ""}
    if not text:
        return safe_default
    s = text.strip()
    if s.startswith("```"):
        lines = [l for l in s.split("\n") if not l.strip().startswith("```")]
        s = "\n".join(lines)
    start = s.find("{")
    end = s.rfind("}")
    if start == -1 or end == -1:
        return safe_default
    try:
        parsed = json.loads(s[start:end + 1])
    except json.JSONDecodeError:
        return safe_default
    raw_flags = parsed.get("flags") or []
    flags = [f for f in raw_flags if isinstance(f, str) and f in VALID_FLAGS]
    return {
        "ok": bool(parsed.get("ok")) and not flags,
        "flags": flags,
        "notes": str(parsed.get("notes") or ""),
    }


def filename_from_uri(uri: str, photo_id: str) -> str:
    """Derive a zip-safe filename from a CompanyCam URI. Falls back to <photo_id>.jpg."""
    image_exts = {".jpg", ".jpeg", ".png", ".webp", ".heic"}
    if not uri:
        return f"{photo_id}.jpg"
    path = urlparse(uri).path
    name = PurePosixPath(path).name
    ext = PurePosixPath(name).suffix.lower()
    if ext in image_exts and name:
        return name
    return f"{photo_id}.jpg"


def date_folder_for_taken_at(taken_at: str) -> str:
    """Convert a Unix-timestamp string or ISO timestamp to a YYYY-MM-DD folder name."""
    if not taken_at:
        return "unknown-date"
    if taken_at.isdigit():
        try:
            dt = datetime.fromtimestamp(int(taken_at), tz=timezone.utc)
            return dt.strftime("%Y-%m-%d")
        except (ValueError, OSError):
            return "unknown-date"
    try:
        cleaned = taken_at.replace("Z", "+00:00")
        dt = datetime.fromisoformat(cleaned)
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        return "unknown-date"


def compute_export_photo_set(catalog, project_id: str) -> set[str]:
    """Return the set of photo IDs that should appear in the export.

    Documents (triage_status == 'document') are always excluded.
    Curator-excluded photos (rows in client_export_selections with included=0) are excluded.
    Everything else is included by default.
    """
    rows = catalog.db.execute(
        "SELECT id, triage_status FROM photos WHERE project_id = ?",
        (project_id,),
    ).fetchall()
    excluded = catalog.get_excluded_photo_ids(project_id)
    return {
        r[0] for r in rows
        if r[1] != "document" and r[0] not in excluded
    }


import asyncio
import io
import logging
import sys

from PIL import Image

from photo_scanner.scanner import image_to_b64

ANTHROPIC_MODEL = "claude-sonnet-4-20250514"
MAX_IMAGE_DIM = 768
CONCURRENCY = 5

log = logging.getLogger("photo_scanner.client_export")


async def _safety_call_for_photo(anthropic_client, image: Image.Image) -> dict:
    b64, media_type = image_to_b64(image, max_dim=MAX_IMAGE_DIM)
    response = await anthropic_client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=512,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64",
                                              "media_type": media_type, "data": b64}},
                {"type": "text", "text": SAFETY_PROMPT},
            ],
        }],
    )
    return parse_safety_response(response.content[0].text)


async def run_safety_pass(catalog, project_id: str, cc_client, anthropic_client,
                          on_progress=None):
    """Run the client-export safety pass over every non-document photo in the project
    that has not already been checked. Persists status + flags to the catalog.
    """
    rows = catalog.db.execute(
        """
        SELECT id, uri FROM photos
        WHERE project_id = ?
          AND (triage_status IS NULL OR triage_status != 'document')
          AND client_export_status IS NULL
        """,
        (project_id,),
    ).fetchall()
    targets = [(r[0], r[1]) for r in rows]
    total = len(targets)
    print(f"[client_export] {total} photos to safety-check for project {project_id}",
          file=sys.stderr, flush=True)
    if on_progress:
        on_progress({"phase": "safety", "current": 0, "total": total})

    sem = asyncio.Semaphore(CONCURRENCY)
    completed = 0

    async def analyze(photo_id: str, uri: str):
        nonlocal completed
        async with sem:
            try:
                img_bytes = await cc_client.get_photo_bytes(uri)
                img = Image.open(io.BytesIO(img_bytes))
                if img.mode != "RGB":
                    img = img.convert("RGB")
                result = await _safety_call_for_photo(anthropic_client, img)
                status = "ok" if result["ok"] else "flagged"
                catalog.db.execute(
                    "UPDATE photos SET client_export_status = ?, client_export_flags = ? WHERE id = ?",
                    (status, json.dumps(result["flags"]), photo_id),
                )
                catalog.db.commit()
            except Exception as e:
                print(f"[client_export] error on {photo_id}: {e}",
                      file=sys.stderr, flush=True)
            finally:
                completed += 1
                if on_progress:
                    on_progress({"phase": "safety", "current": completed, "total": total})

    await asyncio.gather(*(analyze(pid, uri) for pid, uri in targets))


async def prepare_project_for_export(catalog, project_id: str, cc_client,
                                     anthropic_client, on_progress=None):
    """End-to-end prep: sync (if needed), run scanner triage (if needed), run safety pass.

    Idempotent: re-runs only fill in what hasn't been done.
    """
    from photo_scanner.companycam import CompanyCamClient
    from photo_scanner.scanner import analyze_project_from_catalog

    # 1. Sync if we have no photos for this project yet.
    have_photos = catalog.db.execute(
        "SELECT COUNT(*) FROM photos WHERE project_id = ?", (project_id,)
    ).fetchone()[0]

    if have_photos == 0:
        if on_progress:
            on_progress({"phase": "sync", "current": 0, "total": 0})
        raw_proj = await cc_client.get_project(project_id)
        catalog.upsert_project(CompanyCamClient.normalize_project(raw_proj))
        page = 1
        while True:
            raw_photos = await cc_client.list_project_photos(project_id, page=page, per_page=100)
            if not raw_photos:
                break
            for rp in raw_photos:
                catalog.upsert_photo(CompanyCamClient.normalize_photo(rp, project_id))
            if len(raw_photos) < 100:
                break
            page += 1
        catalog.set_project_synced(project_id)

    # 2. Run prescreen/triage if any photo lacks a triage_status.
    has_unanalyzed = catalog.db.execute(
        "SELECT COUNT(*) FROM photos WHERE project_id = ? AND triage_status IS NULL",
        (project_id,),
    ).fetchone()[0]

    if has_unanalyzed:
        await analyze_project_from_catalog(catalog, project_id, cc_client,
                                           anthropic_client, on_progress=on_progress)

    # 3. Run the safety pass for any photo not yet checked.
    await run_safety_pass(catalog, project_id, cc_client, anthropic_client,
                          on_progress=on_progress)

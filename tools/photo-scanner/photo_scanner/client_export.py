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

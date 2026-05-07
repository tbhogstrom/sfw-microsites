"""Video Store — Friday shoot-planning tool.

Given a video script document and the catalog, produce a ranked HTML shoot plan
for next Monday: which active CompanyCam projects within N miles of Portland are
likely to have the right work happening + visible conditions to film the shots.

See docs/superpowers/specs/2026-05-07-video-store-design.md.
"""
from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

from photo_scanner.catalog import Catalog
from photo_scanner.reports import ANTHROPIC_MODEL

# Portland centroid (downtown)
PORTLAND_LAT = 45.5152
PORTLAND_LNG = -122.6784

# A project is "active" if it has a photo within this many days
DEFAULT_ACTIVE_WINDOW_DAYS = 30


# ==== Section: Distance + activity filter ====


def haversine_miles(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in miles between two lat/lng points."""
    r_miles = 3958.7613
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * r_miles * math.asin(math.sqrt(a))


def filter_candidate_projects(
    catalog: Catalog,
    *,
    max_distance_miles: float = 20,
    now_ts: int,
    active_window_days: int = DEFAULT_ACTIVE_WINDOW_DAYS,
) -> list[dict]:
    """Return projects within `max_distance_miles` of Portland that have at least
    one photo taken within `active_window_days`. Each result has a `distance_miles`
    field added. Sorted by distance ascending.
    """
    cutoff = now_ts - active_window_days * 86400
    rows = catalog.db.execute(
        """
        SELECT p.*
        FROM projects p
        WHERE p.lat != 0 AND p.lng != 0
          AND EXISTS (
              SELECT 1 FROM photos ph
              WHERE ph.project_id = p.id
                AND CAST(ph.taken_at AS INTEGER) >= ?
          )
        """,
        (cutoff,),
    ).fetchall()

    results = []
    for row in rows:
        project = dict(row)
        d = haversine_miles(PORTLAND_LAT, PORTLAND_LNG, project["lat"], project["lng"])
        if d <= max_distance_miles:
            project["distance_miles"] = round(d, 2)
            results.append(project)

    results.sort(key=lambda p: p["distance_miles"])
    return results


# ==== Section: Shot extraction ====


SHOT_EXTRACT_PROMPT = """\
You are extracting a structured shot list from a video script document.

Read the document and identify every distinct visual shot/image referenced. Each
shot belongs to one of three CATEGORIES:

- "static_condition": a visible defect or material state that exists on a job
  site whether or not the crew is working that day. Examples: "peeling paint",
  "cracked caulking", "spongy wood", "discolored trim", "dry rot crumbling
  (on-camera, but the rot itself is the static thing)".
- "in_progress_action": requires the crew to be actively performing the work on
  the day of filming. Examples: "crew member cutting out section", "crew member
  installing moisture barrier", "removing affected board".
- "establishing": generic B-roll or wide shots of the home itself. Examples:
  "establishing shot of home", "wide shot of house", "MED of siding".

For each shot, also infer:
- "service": one of siding, deck, dry-rot, chimney, crawlspace, flashing, trim,
  beam, leak, lead-paint, mold, restoration, or null if generic.
- "required_phase": one of "before", "during", "after", or null. Set "during"
  for in-progress actions; null for static_condition and establishing unless the
  context clearly says otherwise.

If the document contains multiple scripts (multiple titles), return one entry per
script.

Respond with JSON only, no other text:
{
  "scripts": [
    {
      "title": "string",
      "narrator_summary": "1-2 sentence summary of what the narrator covers",
      "shots": [
        {"id": "kebab-id-unique-within-script", "category": "...",
         "description": "concise visual description",
         "service": "..." | null, "required_phase": "..." | null}
      ]
    }
  ]
}
"""


def _parse_json_from_text(text: str) -> dict:
    """Extract the outermost JSON object from a Claude text response."""
    text = text.strip()
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"No JSON object found in response: {text[:200]}")
    return json.loads(text[start:end + 1])


def _shot_cache_path(cache_dir: Path, script_text: str) -> Path:
    sha = hashlib.sha256(script_text.encode("utf-8")).hexdigest()
    return cache_dir / f"{sha}.json"


async def extract_shots(
    script_text: str,
    *,
    anthropic_client,
    cache_dir: Path,
    force_refresh: bool = False,
) -> dict:
    """Extract a structured shot list from a script document.

    Caches by SHA-256 of the script content. Editing the script invalidates.
    """
    cache_dir = Path(cache_dir)
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_path = _shot_cache_path(cache_dir, script_text)

    if not force_refresh and cache_path.exists():
        return json.loads(cache_path.read_text(encoding="utf-8"))

    response = await anthropic_client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=4096,
        messages=[{
            "role": "user",
            "content": f"{SHOT_EXTRACT_PROMPT}\n\n--- SCRIPT DOCUMENT ---\n{script_text}",
        }],
    )
    parsed = _parse_json_from_text(response.content[0].text)
    cache_path.write_text(json.dumps(parsed, indent=2), encoding="utf-8")
    return parsed

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


# ==== Section: Per-project triage ====


TRIAGE_PROMPT = """\
You are reviewing a single construction job site to plan video shoots for next week.

Inputs:
- Project metadata (name, address, notepad)
- A chronological list of photos from the last 7 days, oldest first

Goal: Produce a job summary and predict what the crew will be doing on the
upcoming Monday so a video editor can decide whether to send a crew there.

Be honest about uncertainty. If photos taper off mid-week or the project looks
done, say "idle" for the predicted phase and explain why. Do not invent activity
that the photos do not support.

"available_conditions" should list the visible static conditions and exposed
materials seen in recent photos that would still be present on Monday — these
are matched against shot lists. Examples: "dry rot exposed", "rotted sheathing
visible", "cedar siding removed", "moisture damage on plywood", "intact
weathered siding".

Respond with JSON only:
{
  "job_summary": "1-3 sentence narrative of what's been happening this week",
  "current_phase": "before | during | after | idle",
  "predicted_monday": {
    "phase": "before | during | after | idle",
    "work": "1-3 sentence prediction of what the crew will be doing Monday",
    "confidence": "high | medium | low",
    "reasoning": "1-2 sentences citing specific evidence from the timeline"
  },
  "available_conditions": ["short phrase", "another short phrase"]
}
"""


def _format_photo_for_triage(photo: dict) -> str:
    services = json.loads(photo["service_types"]) if photo.get("service_types") else []
    entities = json.loads(photo["entities"]) if photo.get("entities") else []
    damage = json.loads(photo["damage_details"]) if photo.get("damage_details") else {}
    parts = [
        f"  taken_at_ts={photo.get('taken_at','')}",
        f"  creator={photo.get('creator_name','')}",
        f"  phase={photo.get('phase','')}",
        f"  services={services}",
        f"  scene=\"{photo.get('scene','')}\"",
        f"  entities={entities}",
    ]
    notes = photo.get("marketing_notes") or ""
    if notes:
        parts.append(f"  notes=\"{notes}\"")
    if damage:
        parts.append(f"  damage={damage}")
    return f"- photo_id={photo['id']}\n" + "\n".join(parts)


def _get_recent_photos_for_triage(catalog: Catalog, project_id: str, now_ts: int, days: int = 7) -> list[dict]:
    cutoff = now_ts - days * 86400
    rows = catalog.db.execute(
        """
        SELECT * FROM photos
        WHERE project_id = ?
          AND CAST(taken_at AS INTEGER) >= ?
        ORDER BY CAST(taken_at AS INTEGER) ASC
        """,
        (project_id, cutoff),
    ).fetchall()
    return [dict(r) for r in rows]


async def triage_project(
    catalog: Catalog,
    project_id: str,
    *,
    week_of: str,
    now_ts: int,
    anthropic_client,
    force_refresh: bool = False,
) -> dict:
    """Triage a project's last 7 days of photos. Cached per project per week."""
    if not force_refresh:
        cached = catalog.get_video_triage(project_id, week_of)
        if cached is not None:
            return cached

    project = catalog.get_project(project_id)
    if not project:
        raise ValueError(f"Project {project_id!r} not found")

    photos = _get_recent_photos_for_triage(catalog, project_id, now_ts)
    photo_lines = [_format_photo_for_triage(p) for p in photos] if photos else ["(no photos in last 7 days)"]

    prompt_parts = [
        TRIAGE_PROMPT,
        "",
        "--- PROJECT ---",
        f"name: {project.get('name','')}",
        f"address: {project.get('address','')}",
        f"notepad: {(project.get('notepad') or '')[:1000]}",
        "",
        f"--- PHOTOS (last 7 days, {len(photos)} total, oldest first) ---",
        "\n".join(photo_lines),
        "",
        f"Planning for Monday: {week_of}",
    ]

    response = await anthropic_client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=2048,
        messages=[{"role": "user", "content": "\n".join(prompt_parts)}],
    )
    triage = _parse_json_from_text(response.content[0].text)
    catalog.set_video_triage(project_id, week_of, triage)
    return triage


# ==== Section: Shot matching ====


MATCH_SHOTS_PROMPT = """\
You are matching a video shot list to one job site.

You will be given:
- A triage of what's predicted to happen on Monday at this site
- A list of "available_conditions" — visible static conditions on the site
- A list of recent photos with IDs (so you can cite evidence)
- The full shot list across all scripts

For EACH shot, decide whether it can plausibly be filmed at this site on Monday:
- "static_condition" shots: match if the condition appears in available_conditions
  or the recent photos' scenes/entities. Set evidence_photo_id to the strongest
  matching photo's ID.
- "in_progress_action" shots: match only if the predicted Monday work clearly
  involves that action AND the predicted phase matches the shot's required_phase.
- "establishing" shots: match if the site is active (predicted phase != "idle").

Confidence levels:
- "high": clear, direct match with strong evidence
- "medium": plausible but not guaranteed
- "low": speculative — only include if it's a near miss worth flagging

Omit shots with no plausible match.

Respond with JSON only:
{
  "matches": [
    {"shot_id": "...", "confidence": "high|medium|low",
     "reason": "1 sentence citing evidence", "evidence_photo_id": "..." | null}
  ]
}
"""


async def match_shots_for_project(
    *,
    triage: dict,
    shot_list: dict,
    recent_photos: list[dict],
    anthropic_client,
) -> dict:
    """Run one Claude call to match shots → this project's Monday."""
    photo_index_lines = []
    for ph in recent_photos:
        scene = ph.get("scene") or ""
        entities = ph.get("entities") or []
        if isinstance(entities, str):
            try:
                entities = json.loads(entities)
            except (TypeError, ValueError):
                entities = []
        photo_index_lines.append(
            f"- photo_id={ph['id']}: scene=\"{scene}\", entities={entities}"
        )

    prompt = "\n".join([
        MATCH_SHOTS_PROMPT,
        "",
        "--- TRIAGE ---",
        json.dumps(triage, indent=2),
        "",
        f"--- RECENT PHOTOS ({len(recent_photos)}) ---",
        "\n".join(photo_index_lines) if photo_index_lines else "(none)",
        "",
        "--- SHOT LIST ---",
        json.dumps(shot_list, indent=2),
    ])

    response = await anthropic_client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )
    return _parse_json_from_text(response.content[0].text)

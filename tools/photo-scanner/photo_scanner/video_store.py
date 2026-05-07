"""Video Store — Friday shoot-planning tool.

Given a video script document and the catalog, produce a ranked HTML shoot plan
for next Monday: which active CompanyCam projects within N miles of Portland are
likely to have the right work happening + visible conditions to film the shots.

See docs/superpowers/specs/2026-05-07-video-store-design.md.
"""
from __future__ import annotations

import argparse
import asyncio
import base64
import datetime as _dt
import hashlib
import json
import math
import os
import sys
import webbrowser
from pathlib import Path

from photo_scanner.anthropic_auth import (
    describe_anthropic_auth,
    get_async_anthropic_client,
    load_project_env,
)

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
    try:
        return json.loads(text[start:end + 1])
    except json.JSONDecodeError as exc:
        snippet = text[start:start + 200]
        raise ValueError(f"Malformed JSON in response: {exc}\n{snippet}") from exc


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


# ==== Section: Location quality ====


LOCATION_QUALITY_PROMPT = """\
You are scoring a job site for video-shoot suitability based on a few wide
exterior photos.

Score three traits 1-5 (5 = best for video):
- curb_appeal: how attractive/well-maintained the home looks on camera
- wide_shot_room: how much space the videographer has to back up and frame the
  full elevation (street width, setback, obstructions like fences/cars/trees)
- landscaping: presence and quality of landscaping (mature plantings, clean
  yard, presentable hardscape)

Also produce 2-4 short callouts — concrete observations a video editor cares
about, e.g., "large front yard with mature landscaping", "clear sightline to
full elevation", "appears to be high-end craftsman in nice neighborhood",
"power lines crossing front of house — limits drone framing", "narrow lot, hard
to back up for wide shots".

Be honest. A modest home in a tight lot should score low. Don't over-score.

Respond with JSON only:
{"curb_appeal": 1-5, "wide_shot_room": 1-5, "landscaping": 1-5,
 "callouts": ["string", "string"]}
"""


def select_wide_shot_photos(
    catalog: Catalog,
    project_id: str,
    limit: int = 3,
    *,
    since_ts: int | None = None,
) -> list[dict]:
    """Pick up to `limit` photos best suited for location-quality scoring.
    Prefers phase=overview (highest marketing_score first), then top remaining
    photos by marketing_score. If `since_ts` is given, only photos with
    `taken_at >= since_ts` are considered.
    """
    if since_ts is not None:
        rows = catalog.db.execute(
            """
            SELECT * FROM photos
            WHERE project_id = ?
              AND scene IS NOT NULL
              AND CAST(taken_at AS INTEGER) >= ?
            """,
            (project_id, since_ts),
        ).fetchall()
    else:
        rows = catalog.db.execute(
            """
            SELECT * FROM photos
            WHERE project_id = ?
              AND scene IS NOT NULL
            """,
            (project_id,),
        ).fetchall()
    photos = [dict(r) for r in rows]
    overview = sorted(
        [p for p in photos if p.get("phase") == "overview"],
        key=lambda p: p.get("marketing_score") or 0, reverse=True,
    )
    others = sorted(
        [p for p in photos if p.get("phase") != "overview"],
        key=lambda p: p.get("marketing_score") or 0, reverse=True,
    )
    return (overview + others)[:limit]


async def score_location_quality(
    *,
    project: dict,
    wide_photos: list[dict],
    anthropic_client,
    fetch_bytes,
) -> dict:
    """Run a vision call on up to 3 wide photos and score the location.

    `fetch_bytes` is an async callable `(uri: str) -> bytes` so tests can stub it.
    Production passes `CompanyCamClient.get_photo_bytes`.
    """
    content_blocks: list[dict] = []
    for ph in wide_photos[:3]:
        try:
            raw = await fetch_bytes(ph["uri"])
        except Exception as e:
            # Skip photos that fail to download — log and continue
            print(f"[video_store] WARN: failed to fetch {ph['id']} ({e}); skipping in vision score",
                  flush=True)
            continue
        b64 = base64.standard_b64encode(raw).decode("ascii")
        content_blocks.append({
            "type": "image",
            "source": {"type": "base64", "media_type": "image/jpeg", "data": b64},
        })

    address_line = project.get("address") or "(address unknown)"
    content_blocks.append({
        "type": "text",
        "text": f"Project address: {address_line}\n\n{LOCATION_QUALITY_PROMPT}",
    })

    if not any(b.get("type") == "image" for b in content_blocks):
        # No images succeeded — bail out with a neutral score so the pipeline continues
        return {"curb_appeal": 3, "wide_shot_room": 3, "landscaping": 3,
                "callouts": ["No exterior photos available for scoring."]}

    response = await anthropic_client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=1024,
        messages=[{"role": "user", "content": content_blocks}],
    )
    return _parse_json_from_text(response.content[0].text)


# ==== Section: Ranking ====


_CONFIDENCE_WEIGHT = {"high": 3.0, "medium": 1.0, "low": 0.25}


def score_project(plan: dict) -> float:
    """Score formula:
        sum(confidence_weight per match) + 0.5 * (curb + wide + landscaping)
    """
    shots_total = sum(
        _CONFIDENCE_WEIGHT.get(m.get("confidence"), 0)
        for m in plan["matches"]["matches"]
    )
    loc = plan["location"]
    location_total = (loc.get("curb_appeal", 0) + loc.get("wide_shot_room", 0)
                      + loc.get("landscaping", 0))
    return shots_total + 0.5 * location_total


def rank_projects(plans: list[dict]) -> list[dict]:
    """Sort plans by (score desc, curb_appeal desc, distance_miles asc)."""
    def key(plan):
        return (
            -score_project(plan),
            -(plan["location"].get("curb_appeal", 0)),
            plan["project"].get("distance_miles", 9999),
        )
    return sorted(plans, key=key)


# ==== Section: HTML rendering ====


_TEMPLATES_DIR = Path(__file__).parent / "templates"


def _build_render_context(ranked: list[dict], shot_list: dict) -> dict:
    """Pre-compute per-script coverage and per-project shot groupings for the template."""
    # Index shots by id -> (script_title, shot_dict)
    shot_index: dict[str, tuple[str, dict]] = {}
    for script in shot_list["scripts"]:
        for shot in script["shots"]:
            shot_index[shot["id"]] = (script["title"], shot)

    matches_by_script: dict[str, dict[str, list[dict]]] = {}
    matched_shot_ids_by_script: dict[str, set] = {script["title"]: set() for script in shot_list["scripts"]}

    for plan in ranked:
        pid = plan["project"]["id"]
        per_script: dict[str, list[dict]] = {script["title"]: [] for script in shot_list["scripts"]}
        for m in plan["matches"]["matches"]:
            shot_meta = shot_index.get(m["shot_id"])
            if not shot_meta:
                continue
            title, shot = shot_meta
            evidence_photo = plan.get("evidence_photos", {}).get(m.get("evidence_photo_id") or "")
            per_script[title].append({
                "shot_id": m["shot_id"],
                "description": shot["description"],
                "category": shot["category"],
                "confidence": m.get("confidence", "low"),
                "reason": m.get("reason", ""),
                "thumb_uri": (evidence_photo or {}).get("thumb_uri", ""),
                "uri": (evidence_photo or {}).get("uri", ""),
            })
            matched_shot_ids_by_script[title].add(m["shot_id"])
        matches_by_script[pid] = per_script

    coverage_by_script = {
        script["title"]: {
            "matched": len(matched_shot_ids_by_script[script["title"]]),
            "total": len(script["shots"]),
        }
        for script in shot_list["scripts"]
    }

    total_matches = sum(len(plan["matches"]["matches"]) for plan in ranked)
    scripts_with_coverage = sum(1 for c in coverage_by_script.values() if c["matched"] > 0)

    return {
        "matches_by_script": matches_by_script,
        "coverage_by_script": coverage_by_script,
        "total_matches": total_matches,
        "scripts_with_coverage": scripts_with_coverage,
    }


def render_report(
    *,
    ranked: list[dict],
    shot_list: dict,
    week_of: str,
    max_distance_miles: float,
) -> str:
    """Render the final HTML report."""
    from jinja2 import Environment, FileSystemLoader, select_autoescape

    ctx = _build_render_context(ranked, shot_list)
    env = Environment(
        loader=FileSystemLoader(str(_TEMPLATES_DIR)),
        autoescape=select_autoescape(["html"]),
    )
    template = env.get_template("video_shoot_plan.html")
    return template.render(
        ranked=ranked, shot_list=shot_list,
        week_of=week_of, max_distance_miles=max_distance_miles,
        **ctx,
    )


# ==== Section: CLI helpers ====


def next_monday(today: _dt.date | None = None) -> _dt.date:
    """Return the next Monday strictly after `today` (today=Monday → +7 days)."""
    today = today or _dt.date.today()
    days_ahead = (0 - today.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7
    return today + _dt.timedelta(days=days_ahead)


def load_scripts(path: Path) -> str:
    """Load script content from a single file or concatenate every file in a directory."""
    path = Path(path)
    if path.is_file():
        return path.read_text(encoding="utf-8")
    if path.is_dir():
        chunks = []
        for f in sorted(path.iterdir()):
            if f.is_file():
                chunks.append(f"=== {f.name} ===\n{f.read_text(encoding='utf-8')}")
        return "\n\n".join(chunks)
    raise FileNotFoundError(f"Script path not found: {path}")


def _is_recent_enough(scored_at: str | None, days: int = 14) -> bool:
    if not scored_at:
        return False
    try:
        ts = _dt.datetime.fromisoformat(scored_at)
        return (_dt.datetime.now() - ts).days < days
    except (ValueError, TypeError):
        return False


# ==== Section: CLI orchestration ====


CACHE_DIR = Path(__file__).parent.parent / ".video_store_cache"


async def run(
    script_path: Path,
    *,
    week_of: _dt.date,
    max_distance_miles: float,
    output_path: Path,
    refresh_shots: bool,
    refresh_quality: bool,
    refresh_triage: bool,
) -> int:
    # If shots changed, the triage's available_conditions and the matcher's
    # context are also potentially stale — auto-refresh both to keep them
    # consistent.
    if refresh_shots:
        refresh_triage = True

    load_project_env()
    print(f"[video_store] Anthropic auth: {describe_anthropic_auth()}", file=sys.stderr)

    anthropic_client = get_async_anthropic_client()
    if not anthropic_client:
        print("[video_store] ERROR: no Anthropic auth configured.", file=sys.stderr)
        return 2

    # CompanyCam client is only needed if we have to fetch image bytes for vision.
    cc_client = None

    def _get_cc_client():
        nonlocal cc_client
        if cc_client is None:
            from photo_scanner.companycam import CompanyCamClient
            token = os.environ.get("COMPANYCAM_API_TOKEN", "")
            if not token:
                raise RuntimeError("COMPANYCAM_API_TOKEN not set; cannot fetch photos for vision scoring")
            cc_client = CompanyCamClient(token=token)
        return cc_client

    catalog = Catalog()
    week_of_iso = week_of.isoformat()
    now_ts = int(_dt.datetime.now().timestamp())

    print(f"[video_store] Planning for Monday {week_of_iso}", file=sys.stderr)

    # Step 1 — extract shots
    try:
        script_text = load_scripts(Path(script_path))
    except FileNotFoundError as e:
        print(f"[video_store] ERROR: {e}", file=sys.stderr)
        return 2

    shot_list = await extract_shots(
        script_text, anthropic_client=anthropic_client,
        cache_dir=CACHE_DIR, force_refresh=refresh_shots,
    )
    total_shots = sum(len(s["shots"]) for s in shot_list["scripts"])
    print(f"[video_store] Loaded {len(shot_list['scripts'])} script(s), "
          f"{total_shots} total shots", file=sys.stderr)

    # Step 2 — filter projects
    candidates = filter_candidate_projects(
        catalog, max_distance_miles=max_distance_miles, now_ts=now_ts,
    )
    print(f"[video_store] {len(candidates)} candidate project(s) within "
          f"{max_distance_miles} mi", file=sys.stderr)

    if not candidates:
        print("[video_store] No candidate projects. Nothing to plan.", file=sys.stderr)
        return 1

    # Steps 3-5 — per-project triage, matching, location quality
    plans: list[dict] = []
    for i, project in enumerate(candidates, 1):
        print(f"[video_store] [{i}/{len(candidates)}] {project['name']!r}", file=sys.stderr)
        try:
            triage = await triage_project(
                catalog, project["id"], week_of=week_of_iso, now_ts=now_ts,
                anthropic_client=anthropic_client, force_refresh=refresh_triage,
            )

            recent_rows = _get_recent_photos_for_triage(catalog, project["id"], now_ts)
            recent_for_match = [
                {"id": p["id"], "scene": p.get("scene", ""),
                 "entities": json.loads(p["entities"]) if p.get("entities") else []}
                for p in recent_rows
            ]
            evidence_photos = {p["id"]: {"thumb_uri": p.get("thumb_uri", ""),
                                         "uri": p.get("uri", "")} for p in recent_rows}

            # Phase strip from same recent photos (one entry per day, latest phase wins)
            strip: dict[str, str] = {}
            for p in recent_rows:
                try:
                    ts = int(p["taken_at"])
                except (TypeError, ValueError):
                    continue
                d = _dt.date.fromtimestamp(ts).isoformat()
                strip[d] = p.get("phase") or "idle"
            recent_phase_strip = [{"date": d, "phase": strip[d]} for d in sorted(strip)]

            matches = await match_shots_for_project(
                triage=triage, shot_list=shot_list, recent_photos=recent_for_match,
                anthropic_client=anthropic_client,
            )

            existing_loc = catalog.get_video_location_score(project["id"])
            loc_row = catalog.db.execute(
                "SELECT video_location_scored_at FROM projects WHERE id = ?", (project["id"],),
            ).fetchone()
            scored_at = loc_row[0] if loc_row else None

            if existing_loc and _is_recent_enough(scored_at) and not refresh_quality:
                location = existing_loc
            else:
                wide_photos = select_wide_shot_photos(
                    catalog, project["id"], limit=3,
                    since_ts=now_ts - 90 * 86400,
                )
                try:
                    cc = _get_cc_client()
                    location = await score_location_quality(
                        project=project, wide_photos=wide_photos,
                        anthropic_client=anthropic_client,
                        fetch_bytes=cc.get_photo_bytes,
                    )
                    catalog.set_video_location_score(
                        project["id"], location, scored_at=_dt.datetime.now().isoformat(),
                    )
                except RuntimeError as e:
                    print(f"[video_store] WARN: skipping location quality for {project['id']}: {e}",
                          file=sys.stderr)
                    location = {"curb_appeal": 3, "wide_shot_room": 3, "landscaping": 3,
                                "callouts": [f"Location not scored: {e}"]}

            plans.append({
                "project": project,
                "triage": triage,
                "matches": matches,
                "location": location,
                "evidence_photos": evidence_photos,
                "recent_phase_strip": recent_phase_strip,
            })
        except ValueError as e:
            print(f"[video_store] WARN: skipping {project['id']} due to LLM/parse error: {e}",
                  file=sys.stderr)
            continue

    # Step 6 — rank + render
    ranked = rank_projects(plans)
    html = render_report(
        ranked=ranked, shot_list=shot_list, week_of=week_of_iso,
        max_distance_miles=max_distance_miles,
    )
    output_path = Path(output_path)
    output_path.write_text(html, encoding="utf-8")
    print(f"[video_store] Wrote {output_path}", file=sys.stderr)

    try:
        webbrowser.open(output_path.resolve().as_uri())
    except Exception:
        pass
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="photo_scanner.video_store",
        description="Generate a Friday shoot plan for next Monday from a video script document.",
    )
    parser.add_argument("script", type=Path,
                        help="Path to a script file or a directory of script files")
    parser.add_argument("--week-of", type=str, default=None,
                        help="Monday of the week to plan (YYYY-MM-DD); default = next Monday")
    parser.add_argument("--max-distance", type=float, default=20.0,
                        help="Max distance from Portland in miles (default 20)")
    parser.add_argument("--out", type=Path, default=None,
                        help="Output HTML path (default video_shoot_plan_<week>.html)")
    parser.add_argument("--refresh-shots", action="store_true",
                        help="Re-extract shot list from the script. Implies --refresh-triage.")
    parser.add_argument("--refresh-quality", action="store_true")
    parser.add_argument("--refresh-triage", action="store_true")
    args = parser.parse_args()

    if args.week_of:
        week_of = _dt.date.fromisoformat(args.week_of)
    else:
        week_of = next_monday()

    if args.out is None:
        args.out = Path(f"video_shoot_plan_{week_of.isoformat()}.html")

    rc = asyncio.run(run(
        script_path=args.script,
        week_of=week_of,
        max_distance_miles=args.max_distance,
        output_path=args.out,
        refresh_shots=args.refresh_shots,
        refresh_quality=args.refresh_quality,
        refresh_triage=args.refresh_triage,
    ))
    sys.exit(rc)


if __name__ == "__main__":
    main()

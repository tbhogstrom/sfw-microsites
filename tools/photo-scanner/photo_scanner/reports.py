"""Daily homeowner report generation from analyzed photo data."""
import json
from pathlib import Path

MIN_PHOTOS_FOR_COUNT = 10

REPORT_PROMPT = """\
Write as SFW Construction — a licensed general contractor communicating directly with the homeowner. Tone is formal, professional, and authoritative. Language should reflect craftsmanship expertise, not sales. Use precise construction terminology (e.g., "building envelope," "substrate," "flashing detail") but remain clear to a homeowner.

Generate a daily project report.

Rules:
- Structured, confident sentences. No casual language, filler, or exaggeration.
- headline: professional and specific, under 12 words (e.g., "Window Flashing Corrections Complete — Building Envelope Secured")
- risk_before and risk_after: 1-2 sentences each, factual, describing the condition and its implications for the structure
- what_we_did: 2-3 sentences. Describe the work performed with industry terminology. Position as expert contractor, not handyman.
- value_statement: 1-2 sentences. Focus on building trust through clarity — what was protected, what was corrected, why it matters structurally.
- Do NOT generate photo_captions — photos are shown without descriptions
- No severity adjectives (major, severe, significant, extensive, critical). If the repair is structural, say that. Otherwise describe what was done and where.
- No humor, sarcasm, or casual phrasing.
- IMPORTANT: Never use declarative completion language like "all siding repaired", "all dry rot remediated", "all damage fixed". This creates legal liability. Use precise language: "addressed the identified damage at the south elevation," "corrected the flashing detail at the window head."

Respond in JSON only:
{
  "headline": "professional, specific headline",
  "risk_before": "condition and structural implications before today's work",
  "risk_after": "current condition after today's work",
  "what_we_did": "work performed today, using construction terminology",
  "value_statement": "why this work matters to the property",
  "issues_status": [
    {"issue": "name", "status": "resolved|in-progress|documented-only", "changed_today": true/false}
  ]
}
"""

ANTHROPIC_MODEL = "claude-sonnet-4-20250514"


def load_report_config() -> dict:
    config_path = Path(__file__).parent.parent / "report_config.json"
    if config_path.exists():
        with open(config_path) as f:
            return json.load(f)
    return {"risk_value_matrix": {}, "report_defaults": {"max_photos": 4, "tone": "friendly", "company_name": "SFW Construction"}}


def select_best_photos(photos: list[dict], max_photos: int = 4) -> list[dict]:
    """Pick the best photos for the report, preferring a mix of phases."""
    if len(photos) <= max_photos:
        return photos

    # Sort by score descending
    scored = sorted(photos, key=lambda p: p.get("marketing_score", 0), reverse=True)

    # Try to get phase diversity: pick best from each phase, then fill
    selected = []
    by_phase = {}
    for p in scored:
        phase = p.get("phase", "other")
        by_phase.setdefault(phase, []).append(p)

    # One from each phase that exists (before, during, after priority)
    for phase in ["before", "during", "after", "overview", "materials", "other"]:
        if phase in by_phase and len(selected) < max_photos:
            pick = by_phase[phase][0]
            if pick not in selected:
                selected.append(pick)

    # Fill remaining slots with highest scoring photos not already selected
    for p in scored:
        if len(selected) >= max_photos:
            break
        if p not in selected:
            selected.append(p)

    return selected[:max_photos]


async def generate_daily_report(
    catalog,
    project_id: str,
    date_ts_start: int,
    date_ts_end: int,
    anthropic_client,
) -> dict:
    """Generate a daily report for one project on one day.

    Args:
        catalog: Catalog instance
        project_id: CompanyCam project ID
        date_ts_start: Unix timestamp for start of day (00:00 UTC)
        date_ts_end: Unix timestamp for end of day (24:00 UTC)
        anthropic_client: AsyncAnthropic instance

    Returns:
        Report dict with headline, risk_before, risk_after, what_we_did,
        value_statement, photos (with captions), issues_status.
        Returns None if no photos for this date.
    """
    config = load_report_config()
    defaults = config.get("report_defaults", {})
    matrix = config.get("risk_value_matrix", {})
    max_photos = defaults.get("max_photos", 4)

    # Get today's photos
    day_photos = catalog.get_photos_for_date(project_id, date_ts_start, date_ts_end)
    if not day_photos:
        return None

    # Select best photos
    selected = select_best_photos(day_photos, max_photos)

    # Get project info and cumulative summary
    project = catalog.get_project(project_id)
    project_summary = catalog.get_project_summary_data(project_id)

    # Build relevant matrix entries
    day_services = set()
    for p in day_photos:
        for svc in json.loads(p.get("service_types", "[]")):
            day_services.add(svc)
    relevant_matrix = {svc: matrix[svc] for svc in day_services if svc in matrix}

    # Build photo data for prompt
    photo_lines = []
    for p in day_photos:
        services = json.loads(p["service_types"]) if p.get("service_types") else []
        damage = json.loads(p["damage_details"]) if p.get("damage_details") else {}
        line = f"- Photo {p['id']}: phase={p.get('phase')}, scene=\"{p.get('scene')}\", services={services}"
        if damage.get("water_damage"):
            line += f", water_damage=\"{damage['water_damage']}\""
        if damage.get("window_door_condition"):
            line += f", windows_doors=\"{damage['window_door_condition']}\""
        if damage.get("siding_details"):
            line += f", siding=\"{damage['siding_details']}\""
        photo_lines.append(line)

    selected_ids = [p["id"] for p in selected]

    # Get project scope context
    from photo_scanner.companycam import CompanyCamClient
    project_context = CompanyCamClient.get_project_context(project) if project else {"scope_of_work": "", "pages": []}
    scope_text = project_context["scope_of_work"]

    # Build the full prompt
    prompt_parts = [
        f"Project: {project['name'] if project else project_id}",
        f"Address: {project['address'] if project else ''}",
        f"Company: {defaults.get('company_name', 'SFW Construction')}",
    ]
    if scope_text:
        prompt_parts.append(f"\nScope of work:\n{scope_text}")
    prompt_parts.extend([
        "",
        f"Today's photos ({len(day_photos)} total):",
        "\n".join(photo_lines),
        "",
        f"Selected photos for report (generate captions for these): {selected_ids}",
    ])

    if project_summary:
        issues = project_summary.get("issues", [])
        if issues:
            prompt_parts.append("")
            prompt_parts.append("Cumulative project issues (from all previous analysis):")
            for issue in issues:
                prompt_parts.append(
                    f"- {issue['issue']} (service={issue.get('service_type')}, "
                    f"status={issue.get('resolution_status')}, "
                    f"before={issue.get('documented_before')}, "
                    f"during={issue.get('documented_during')}, "
                    f"after={issue.get('documented_after')})"
                )

    if relevant_matrix:
        prompt_parts.append("")
        prompt_parts.append("Risk/value framing to use (adapt, don't copy verbatim):")
        for svc, entry in relevant_matrix.items():
            prompt_parts.append(f"- {svc}: risk=\"{entry['risk']}\", value=\"{entry['value']}\"")

    prompt_parts.append("")
    prompt_parts.append(REPORT_PROMPT)

    full_prompt = "\n".join(prompt_parts)

    # Call Claude
    response = await anthropic_client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=1024,
        messages=[{"role": "user", "content": full_prompt}],
    )

    text = response.content[0].text.strip()
    # Parse JSON from response
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1:
        report = json.loads(text[start:end + 1])
    else:
        report = {"headline": "Daily Update", "what_we_did": text}

    # Attach selected photos (no captions for daily reports)
    report["photos"] = [
        {"photo_id": p["id"], "phase": p.get("phase", ""), "score": p.get("marketing_score", 0)}
        for p in selected
    ]
    report["total_day_photos"] = len(day_photos) if len(day_photos) >= MIN_PHOTOS_FOR_COUNT else None

    return report


WEEKLY_REPORT_PROMPT = """\
Write as SFW Construction — a licensed general contractor communicating directly with the homeowner. Tone is formal, professional, and authoritative. Language should reflect craftsmanship expertise, not sales. Use precise construction terminology (e.g., "building envelope," "substrate," "flashing detail") but remain clear to a homeowner.

Generate a weekly project report. This covers a full week of work.

Rules:
- Structured, confident sentences. No casual language, filler, or exaggeration.
- weekly_narrative: 3-4 sentences documenting the progression of work — initial conditions, work performed, current status
- risk_before and risk_after: 1-2 sentences each (for the whole week, not per day), factual, describing the condition and its structural implications
- what_we_did: 2-3 sentences summarizing the week's work with industry terminology
- value_statement: 1-2 sentences. Focus on building trust through clarity — what was protected, what was corrected, why it matters structurally.
- photo_captions: one concise sentence per photo using construction terminology, accessible to a homeowner
- daily_timeline: one entry per day, one-sentence professional summary. Include total_photos (total photo count for that day)
- headline: professional and specific, under 12 words
- Do NOT predict next week's work
- No severity adjectives (major, severe, significant, extensive, critical). If the repair is structural, say that. Otherwise describe what was done and where.
- No humor, sarcasm, or casual phrasing.
- IMPORTANT: Never use declarative completion language like "all siding repaired", "all dry rot remediated", "all damage fixed". This creates legal liability. Use precise language: "addressed the identified damage at the south elevation," "corrected the flashing detail at the window head."

Respond in JSON only:
{
  "headline": "professional, specific headline for the week",
  "weekly_narrative": "3-4 sentence progression of work",
  "risk_before": "condition at start of week",
  "risk_after": "condition at end of week",
  "what_we_did": "summary of work performed this week",
  "value_statement": "why this week's work matters to the property",
  "photo_captions": {"photo_id": "caption", ...},
  "issues_status": [
    {"issue": "name", "status": "resolved|in-progress|documented-only", "changed_this_week": true/false}
  ],
  "daily_timeline": [
    {"date": "YYYY-MM-DD", "summary": "one sentence", "photo_ids": ["id1", "id2"], "total_photos": 5}
  ]
}
"""


def select_best_photos_weekly(photos: list[dict], max_photos: int = 4) -> list[dict]:
    """Pick the best photos across a full week, preferring a narrative arc.

    Tries to get: early-week before -> mid-week during -> late-week after.
    Falls back to score-based selection.
    """
    if len(photos) <= max_photos:
        return photos

    # Sort by timestamp
    by_time = sorted(photos, key=lambda p: int(p.get("taken_at", "0")))

    # Split into thirds: early, mid, late
    third = max(1, len(by_time) // 3)
    early = by_time[:third]
    mid = by_time[third:third * 2]
    late = by_time[third * 2:]

    selected = []

    # Best "before" from early
    befores = [p for p in early if p.get("phase") == "before"]
    if befores:
        selected.append(max(befores, key=lambda p: p.get("marketing_score", 0)))
    elif early:
        selected.append(max(early, key=lambda p: p.get("marketing_score", 0)))

    # Best "during" from mid
    durings = [p for p in mid if p.get("phase") == "during"]
    if durings:
        selected.append(max(durings, key=lambda p: p.get("marketing_score", 0)))
    elif mid:
        selected.append(max(mid, key=lambda p: p.get("marketing_score", 0)))

    # Best "after" from late
    afters = [p for p in late if p.get("phase") == "after"]
    if afters:
        selected.append(max(afters, key=lambda p: p.get("marketing_score", 0)))
    elif late:
        selected.append(max(late, key=lambda p: p.get("marketing_score", 0)))

    # Fill remaining slots with highest scoring not already selected
    all_scored = sorted(photos, key=lambda p: p.get("marketing_score", 0), reverse=True)
    for p in all_scored:
        if len(selected) >= max_photos:
            break
        if p not in selected:
            selected.append(p)

    return selected[:max_photos]


async def generate_weekly_report(
    catalog,
    project_id: str,
    week_ts_start: int,
    week_ts_end: int,
    anthropic_client,
) -> dict:
    """Generate a weekly report for one project.

    Args:
        catalog: Catalog instance
        project_id: CompanyCam project ID
        week_ts_start: Unix timestamp for Monday 00:00 UTC
        week_ts_end: Unix timestamp for end of Friday (Saturday 00:00 UTC)
        anthropic_client: AsyncAnthropic instance

    Returns:
        Report dict or None if no photos for this week.
    """
    config = load_report_config()
    defaults = config.get("report_defaults", {})
    matrix = config.get("risk_value_matrix", {})
    max_photos = defaults.get("max_photos", 4)

    # Get all week's photos
    week_photos = catalog.get_photos_for_week(project_id, week_ts_start, week_ts_end)
    if not week_photos:
        return None

    # Select best photos for narrative arc
    selected = select_best_photos_weekly(week_photos, max_photos)

    # Get project info and cumulative summary
    project = catalog.get_project(project_id)
    project_summary = catalog.get_project_summary_data(project_id)

    # Collect services across the week
    week_services = set()
    for p in week_photos:
        for svc in json.loads(p.get("service_types", "[]")):
            week_services.add(svc)
    relevant_matrix = {svc: matrix[svc] for svc in week_services if svc in matrix}

    # Group photos by day for the prompt
    from collections import defaultdict
    from datetime import datetime, timezone
    days = defaultdict(list)
    for p in week_photos:
        ts = int(p.get("taken_at", "0"))
        day_str = datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")
        days[day_str].append(p)

    # Build photo data grouped by day
    day_sections = []
    for day_str in sorted(days.keys()):
        day_photos = days[day_str]
        lines = []
        for p in day_photos:
            services = json.loads(p["service_types"]) if p.get("service_types") else []
            damage = json.loads(p["damage_details"]) if p.get("damage_details") else {}
            line = f"  - Photo {p['id']}: phase={p.get('phase')}, scene=\"{p.get('scene')}\", services={services}"
            if damage.get("water_damage"):
                line += f", water_damage=\"{damage['water_damage']}\""
            if damage.get("window_door_condition"):
                line += f", windows_doors=\"{damage['window_door_condition']}\""
            if damage.get("siding_details"):
                line += f", siding=\"{damage['siding_details']}\""
            lines.append(line)
        day_sections.append(f"{day_str} ({len(day_photos)} photos):\n" + "\n".join(lines))

    selected_ids = [p["id"] for p in selected]

    # Check for existing daily reports
    daily_summaries = []
    for day_str in sorted(days.keys()):
        saved = catalog.get_daily_reports(day_str)
        for r in saved:
            if r["project_id"] == project_id:
                rd = json.loads(r["report_data"])
                daily_summaries.append(f"{day_str}: {rd.get('what_we_did', '')}")

    # Get project scope context
    from photo_scanner.companycam import CompanyCamClient
    project_context = CompanyCamClient.get_project_context(project) if project else {"scope_of_work": "", "pages": []}
    scope_text = project_context["scope_of_work"]

    # Build prompt
    prompt_parts = [
        f"Project: {project['name'] if project else project_id}",
        f"Address: {project['address'] if project else ''}",
        f"Company: {defaults.get('company_name', 'SFW Construction')}",
        f"Week: {sorted(days.keys())[0]} to {sorted(days.keys())[-1]}",
    ]
    if scope_text:
        prompt_parts.append(f"\nScope of work:\n{scope_text}")
    prompt_parts.extend([
        f"\nTotal photos this week: {len(week_photos)} across {len(days)} days",
        "",
        "Photos by day:",
        "\n\n".join(day_sections),
        "",
        f"Selected photos for report (generate captions for these): {selected_ids}",
    ])

    if daily_summaries:
        prompt_parts.append("")
        prompt_parts.append("Existing daily report summaries (for context, don't contradict):")
        for ds in daily_summaries:
            prompt_parts.append(f"- {ds}")

    if project_summary:
        issues = project_summary.get("issues", [])
        if issues:
            prompt_parts.append("")
            prompt_parts.append("Cumulative project issues:")
            for issue in issues:
                prompt_parts.append(
                    f"- {issue['issue']} (service={issue.get('service_type')}, "
                    f"status={issue.get('resolution_status')}, "
                    f"before={issue.get('documented_before')}, "
                    f"during={issue.get('documented_during')}, "
                    f"after={issue.get('documented_after')})"
                )

    if relevant_matrix:
        prompt_parts.append("")
        prompt_parts.append("Risk/value framing (adapt, don't copy verbatim):")
        for svc, entry in relevant_matrix.items():
            prompt_parts.append(f"- {svc}: risk=\"{entry['risk']}\", value=\"{entry['value']}\"")

    prompt_parts.append("")
    prompt_parts.append(WEEKLY_REPORT_PROMPT)

    full_prompt = "\n".join(prompt_parts)

    # Call Claude
    response = await anthropic_client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=2048,
        messages=[{"role": "user", "content": full_prompt}],
    )

    text = response.content[0].text.strip()
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1:
        report = json.loads(text[start:end + 1])
    else:
        report = {"headline": "Weekly Update", "what_we_did": text}

    # Attach selected photos with captions
    captions = report.get("photo_captions", {})
    report["photos"] = [
        {"photo_id": p["id"], "caption": captions.get(p["id"], p.get("scene", "")),
         "phase": p.get("phase", ""), "score": p.get("marketing_score", 0),
         "day": datetime.fromtimestamp(int(p.get("taken_at", "0")), tz=timezone.utc).strftime("%Y-%m-%d")}
        for p in selected
    ]

    # Suppress photo counts below threshold
    for day_entry in report.get("daily_timeline", []):
        if day_entry.get("total_photos", 0) < MIN_PHOTOS_FOR_COUNT:
            day_entry["total_photos"] = None

    return report


# ============================================================================
# Project-level report (Tasks 3-6 of 2026-04-17-project-report plan)
# ============================================================================

import asyncio
from photo_scanner.grid_builder import build_labeled_grid, encode_grid_jpeg_b64

PHOTO_POOL_MIN_SCORE_PRIMARY = 3
PHOTO_POOL_MIN_SCORE_FALLBACK = 2
GRID_CELL_SIZE = 256
TOP_FINALISTS = 12
FINAL_PHOTO_COUNT = 6


PROJECT_REPORT_PROMPT = """\
Write as SFW Construction — a licensed general contractor communicating directly with the homeowner. Tone is formal, professional, and authoritative. Language should reflect craftsmanship expertise, not sales. Use precise construction terminology (e.g., "building envelope," "substrate," "flashing detail") but remain clear to a homeowner.

Generate a project-level report covering the full arc of this project: the conditions we found, the work we performed, and the current status.

Rules:
- Structured, confident sentences. No casual language, filler, or exaggeration.
- headline: professional and specific, under 12 words.
- executive_summary: 2-3 sentences — the project at a glance.
- scope_narrative: 2-3 sentences — what the project set out to address, services involved.
- conditions_found: 2-3 sentences — what we documented at the start.
- work_performed: 3-4 sentences — phased description of the work.
- current_status: 2-3 sentences — what's resolved, what's in progress, what was documented-only.
- value_statement: 1-2 sentences — why this matters structurally to the property.
- issues_summary: one entry per issue with status (resolved | in-progress | documented-only).
- No severity adjectives (major, severe, significant, extensive, critical). If a repair is structural, say that. Otherwise describe what was done and where.
- No humor, sarcasm, or casual phrasing.
- IMPORTANT: Never use declarative completion language like "all siding repaired", "all dry rot remediated", "all damage fixed". This creates legal liability. Use precise language: "addressed the identified damage at the south elevation," "corrected the flashing detail at the window head."

Respond in JSON only:
{
  "headline": "professional, specific headline",
  "executive_summary": "2-3 sentences",
  "scope_narrative": "2-3 sentences",
  "conditions_found": "2-3 sentences",
  "work_performed": "3-4 sentences",
  "current_status": "2-3 sentences",
  "value_statement": "1-2 sentences",
  "issues_summary": [
    {"issue": "name", "service_type": "siding", "status": "resolved|in-progress|documented-only"}
  ]
}
"""


async def write_project_narrative(catalog, project_id: str, anthropic_client) -> dict:
    """Step 1 of the project report pipeline — text-only narrative generation.

    Raises ValueError if the project doesn't exist or has no analyzed summary.
    """
    project = catalog.get_project(project_id)
    if not project:
        raise ValueError(f"Project {project_id!r} not found in catalog")

    summary = catalog.get_project_summary_data(project_id)
    if not summary:
        raise ValueError(
            f"Project {project_id!r} has no summary — run project analysis first"
        )

    config = load_report_config()
    matrix = config.get("risk_value_matrix", {})
    defaults = config.get("report_defaults", {})

    scope = summary.get("scope_of_work", []) or []
    relevant_matrix = {svc: matrix[svc] for svc in scope if svc in matrix}

    prompt_parts = [
        f"Project: {project['name']}",
        f"Address: {project.get('address', '')}",
        f"Company: {defaults.get('company_name', 'SFW Construction')}",
        "",
        f"Project summary: {summary.get('project_summary', '')}",
    ]
    if scope:
        prompt_parts.append(f"Scope of work: {', '.join(scope)}")

    issues = summary.get("issues", []) or []
    if issues:
        prompt_parts.append("")
        prompt_parts.append("Documented issues:")
        for issue in issues:
            prompt_parts.append(
                f"- {issue['issue']} (service={issue.get('service_type')}, "
                f"status={issue.get('resolution_status')}, "
                f"before={issue.get('documented_before')}, "
                f"during={issue.get('documented_during')}, "
                f"after={issue.get('documented_after')})"
            )

    coverage = summary.get("coverage_assessment", {}) or {}
    if coverage:
        prompt_parts.append("")
        prompt_parts.append(f"Documentation coverage: {coverage}")

    if relevant_matrix:
        prompt_parts.append("")
        prompt_parts.append("Risk/value framing to use (adapt, don't copy verbatim):")
        for svc, entry in relevant_matrix.items():
            prompt_parts.append(f"- {svc}: risk=\"{entry['risk']}\", value=\"{entry['value']}\"")

    prompt_parts.append("")
    prompt_parts.append(PROJECT_REPORT_PROMPT)

    full_prompt = "\n".join(prompt_parts)

    response = await anthropic_client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=2048,
        messages=[{"role": "user", "content": full_prompt}],
    )

    text = response.content[0].text.strip()
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"Narrative response was not JSON: {text[:200]}")
    return json.loads(text[start:end + 1])


GRID_TRIAGE_PROMPT = """\
You are scoring a 3x3 grid of construction project photos (cells numbered 1-9, top-left to bottom-right) against a homeowner-facing project report.

For each cell that contains a real photo, score 1-5 for how well it would illustrate the report below. Skip cells that are duplicates of others you've already scored highly (give the duplicate a lower score). Skip empty/unreadable cells.

Score guide:
- 5: directly illustrates a key claim in the report (clear subject, good composition)
- 4: strong illustration, on-topic, decent composition
- 3: relevant but generic or weak composition
- 2: tangentially relevant
- 1: not useful for this report

Categorize each scored cell by which report section it would best support: "conditions", "work", or "status".

Report:
{narrative_text}

Respond in JSON only:
{{"scores": [{{"cell": 1, "score": 4, "phase_match": "conditions", "note": "why"}}]}}
"""


def _format_narrative_for_prompt(narrative: dict) -> str:
    fields = [
        ("Headline", narrative.get("headline", "")),
        ("Executive summary", narrative.get("executive_summary", "")),
        ("Conditions found", narrative.get("conditions_found", "")),
        ("Work performed", narrative.get("work_performed", "")),
        ("Current status", narrative.get("current_status", "")),
    ]
    return "\n".join(f"{label}: {value}" for label, value in fields if value)


async def score_grid_cells(grid_b64: str, narrative: dict, anthropic_client,
                            max_attempts: int = 3) -> list[dict]:
    """Stage 1 helper — score one grid's cells against the narrative.

    Returns a list of {cell, score, phase_match, note} dicts. Empty list on failure.
    """
    prompt_text = GRID_TRIAGE_PROMPT.format(narrative_text=_format_narrative_for_prompt(narrative))

    for attempt in range(max_attempts):
        try:
            response = await anthropic_client.messages.create(
                model=ANTHROPIC_MODEL,
                max_tokens=1024,
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "image", "source": {
                            "type": "base64", "media_type": "image/jpeg", "data": grid_b64,
                        }},
                        {"type": "text", "text": prompt_text},
                    ],
                }],
            )
            text = response.content[0].text.strip()
            start = text.find("{")
            end = text.rfind("}")
            if start == -1 or end == -1:
                return []
            payload = json.loads(text[start:end + 1])
            scores = payload.get("scores", [])
            return [s for s in scores if isinstance(s, dict) and "cell" in s and "score" in s]
        except Exception as e:
            if "429" in str(e) and attempt < max_attempts - 1:
                await asyncio.sleep(15 * (attempt + 1))
                continue
            return []
    return []


def select_finalists(scored_cells: list[dict], top_n: int = 12) -> list[dict]:
    """Pick the top-N scored cells across all grids by score (ties broken by phase_match presence)."""
    def sort_key(c):
        return (-c.get("score", 0), 0 if c.get("phase_match") else 1)
    return sorted(scored_cells, key=sort_key)[:top_n]


FINALIST_SELECTION_PROMPT = """\
You are picking the 6 best photos for a homeowner-facing project report from a grid of finalist candidates.

The grid contains numbered cells (1-9, top-left to bottom-right). Pick exactly 6 cells that together best illustrate the report. Aim for narrative coverage:
- 2 photos showing "conditions" (what we found at the start)
- 2 photos showing "work" (work in progress)
- 2 photos showing "status" (what's complete or current state)

For each pick, write a one-sentence caption in the same homeowner-facing tone as the report:
- Use precise construction terminology accessible to a homeowner.
- No severity adjectives (major, severe, significant, extensive, critical).
- No declarative completion language ("all repaired", "all fixed").

Avoid duplicate angles. If you can't find 2 strong photos for a role, pick more from a stronger role to reach 6 total.

Report:
{narrative_text}

Respond in JSON only:
{{"picks": [{{"cell": 1, "role": "conditions", "caption": "..."}}]}}
"""


async def pick_finalists_with_captions(
    finalist_grids: list[dict], narrative: dict, anthropic_client, max_attempts: int = 3,
) -> list[dict]:
    """Stage 2 helper — pick the final 6 with captions across the finalist grids.

    Each finalist_grids entry: {"b64": <base64 jpeg>, "cell_to_photo_id": {1: "id", ...}}.
    Returns a list of {photo_id, caption, role} dicts. Empty list on failure.
    """
    prompt_text = FINALIST_SELECTION_PROMPT.format(
        narrative_text=_format_narrative_for_prompt(narrative)
    )
    content = []
    for grid in finalist_grids:
        content.append({
            "type": "image",
            "source": {"type": "base64", "media_type": "image/jpeg", "data": grid["b64"]},
        })
    content.append({"type": "text", "text": prompt_text})

    for attempt in range(max_attempts):
        try:
            response = await anthropic_client.messages.create(
                model=ANTHROPIC_MODEL,
                max_tokens=2048,
                messages=[{"role": "user", "content": content}],
            )
            text = response.content[0].text.strip()
            start = text.find("{")
            end = text.rfind("}")
            if start == -1 or end == -1:
                return []
            payload = json.loads(text[start:end + 1])
            picks = payload.get("picks", [])
            cell_to_id = finalist_grids[0]["cell_to_photo_id"] if finalist_grids else {}
            out = []
            for p in picks:
                cell = p.get("cell")
                photo_id = cell_to_id.get(cell)
                if not photo_id:
                    continue
                out.append({
                    "photo_id": photo_id,
                    "role": p.get("role", "work"),
                    "caption": p.get("caption", ""),
                })
            return out
        except Exception as e:
            if "429" in str(e) and attempt < max_attempts - 1:
                await asyncio.sleep(15 * (attempt + 1))
                continue
            return []
    return []


PHASE_TO_ROLE = {
    "before": "conditions",
    "during": "work",
    "after": "status",
    "overview": "status",
    "materials": "work",
    "other": "work",
}


def finalist_score_fallback(finalists: list[dict], count: int = 6) -> list[dict]:
    """Stage 2 fallback — pick top-N by score, assign roles by phase, caption=scene.

    Used when stage 2 Claude call fails repeatedly so we still produce a usable report.
    """
    by_score = sorted(finalists, key=lambda f: -f.get("score", 0))[:count]
    out = []
    for f in by_score:
        phase = (f.get("phase") or "").lower()
        out.append({
            "photo_id": f.get("photo_id"),
            "role": PHASE_TO_ROLE.get(phase, "work"),
            "caption": f.get("scene", "") or "",
        })
    return out


def _phase_sort_key(p: dict) -> tuple:
    """Sort photos by phase order (before -> during -> after), then by taken_at."""
    order = {"before": 0, "during": 1, "after": 2, "overview": 3, "materials": 4, "other": 5}
    return (order.get((p.get("phase") or "").lower(), 9), int(p.get("taken_at") or "0"))


async def _select_photo_pool(catalog, project_id: str) -> list[dict]:
    """Return analyzed photos at score >= 3, falling back to >= 2 if too few."""
    primary = [
        p for p in catalog.get_project_photos(project_id, per_page=10000)
        if p.get("scene") and (p.get("marketing_score") or 0) >= PHOTO_POOL_MIN_SCORE_PRIMARY
    ]
    if len(primary) >= FINAL_PHOTO_COUNT:
        return sorted(primary, key=_phase_sort_key)
    fallback = [
        p for p in catalog.get_project_photos(project_id, per_page=10000)
        if p.get("scene") and (p.get("marketing_score") or 0) >= PHOTO_POOL_MIN_SCORE_FALLBACK
    ]
    return sorted(fallback, key=_phase_sort_key)


async def _fetch_photo_bytes_concurrent(cc_client, photos: list[dict]) -> dict[str, bytes]:
    """Fetch all photo bytes concurrently. Failed fetches are simply omitted from the result."""
    async def fetch_one(photo: dict):
        try:
            uri = photo.get("uri") or ""
            if not uri:
                return photo["id"], None
            data = await cc_client.get_photo_bytes(uri)
            return photo["id"], data
        except Exception:
            return photo["id"], None

    results = await asyncio.gather(*(fetch_one(p) for p in photos))
    return {pid: data for pid, data in results if data is not None}


def _build_triage_grids(photos: list[dict], bytes_by_id: dict[str, bytes]) -> list[dict]:
    """Chunk photos into 9-cell groups, build a labeled grid for each.

    Returns a list of dicts: {"b64": <base64 jpeg>, "cell_to_photo_id": {1: <id>, ...}}.
    """
    available = [p for p in photos if p["id"] in bytes_by_id]
    grids = []
    for i in range(0, len(available), 9):
        chunk = available[i:i + 9]
        grid_img = build_labeled_grid(
            [bytes_by_id[p["id"]] for p in chunk],
            cell_size=GRID_CELL_SIZE,
        )
        grids.append({
            "b64": encode_grid_jpeg_b64(grid_img),
            "cell_to_photo_id": {idx + 1: p["id"] for idx, p in enumerate(chunk)},
        })
    return grids


async def generate_project_report(catalog, project_id: str, anthropic_client, cc_client) -> dict:
    """Generate a project-level homeowner report.

    Pipeline:
      1. Write narrative from projects.summary (text-only).
      2. Pull photos at score >= 3 (fallback >= 2), stream bytes from CompanyCam.
      3. Stage 1: triage grids, score each cell against the narrative.
      4. Stage 2: assemble top finalists, pick final 6 with captions (or fall back).

    Returns the assembled report dict (suitable for catalog.save_project_report).
    """
    # Step 1 - narrative (raises ValueError on missing project/summary)
    narrative = await write_project_narrative(catalog, project_id, anthropic_client)

    summary_stats = catalog.get_project_summary(project_id) or {}
    stats = {
        "total_photos": summary_stats.get("photos_synced", 0),
        "analyzed": summary_stats.get("photos_analyzed", 0),
        "phases": summary_stats.get("phases", {}),
    }

    # Step 2 - photo pool & grids
    pool = await _select_photo_pool(catalog, project_id)
    photo_lookup = {p["id"]: p for p in pool}
    if not pool:
        return {**narrative, "photos": [], "stats": stats, "partial": True}

    bytes_by_id = await _fetch_photo_bytes_concurrent(cc_client, pool)
    if not bytes_by_id:
        return {**narrative, "photos": [], "stats": stats, "partial": True}
    triage_grids = _build_triage_grids(pool, bytes_by_id)

    # Step 3 - stage 1 triage (grids run concurrently)
    score_results = await asyncio.gather(*(
        score_grid_cells(g["b64"], narrative, anthropic_client) for g in triage_grids
    ))
    scored_with_meta: list[dict] = []
    for grid_idx, scores in enumerate(score_results):
        for s in scores:
            cell = s.get("cell")
            photo_id = triage_grids[grid_idx]["cell_to_photo_id"].get(cell)
            if not photo_id:
                continue
            photo = photo_lookup.get(photo_id, {})
            scored_with_meta.append({
                "grid_idx": grid_idx,
                "cell": cell,
                "photo_id": photo_id,
                "score": s.get("score", 0),
                "phase_match": s.get("phase_match"),
                "phase": photo.get("phase"),
                "scene": photo.get("scene"),
            })
    finalists = select_finalists(scored_with_meta, top_n=TOP_FINALISTS)

    if not finalists:
        return {**narrative, "photos": [], "stats": stats, "partial": True}

    # Step 4 - finalist grid + selection (single grid of up to 9 finalists for now)
    finalist_top = finalists[:9]
    finalist_grid_img = build_labeled_grid(
        [bytes_by_id[f["photo_id"]] for f in finalist_top if f["photo_id"] in bytes_by_id],
        cell_size=GRID_CELL_SIZE,
    )
    finalist_grids = [{
        "b64": encode_grid_jpeg_b64(finalist_grid_img),
        "cell_to_photo_id": {idx + 1: f["photo_id"] for idx, f in enumerate(finalist_top)},
    }]

    picks = await pick_finalists_with_captions(
        finalist_grids=finalist_grids, narrative=narrative, anthropic_client=anthropic_client,
    )

    if not picks:
        picks = finalist_score_fallback(finalists, count=FINAL_PHOTO_COUNT)

    final_photos = []
    for pick in picks[:FINAL_PHOTO_COUNT]:
        photo = photo_lookup.get(pick["photo_id"], {})
        final_photos.append({
            "photo_id": pick["photo_id"],
            "caption": pick.get("caption", "") or photo.get("scene", ""),
            "phase": photo.get("phase", ""),
            "role": pick.get("role", "work"),
        })

    partial = len(final_photos) < FINAL_PHOTO_COUNT
    return {**narrative, "photos": final_photos, "stats": stats, "partial": partial}

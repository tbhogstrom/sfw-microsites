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

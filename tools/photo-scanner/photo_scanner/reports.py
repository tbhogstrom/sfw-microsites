"""Daily homeowner report generation from analyzed photo data."""
import json
from pathlib import Path

REPORT_PROMPT = """\
Generate a daily project report for a homeowner. Be friendly and concise. Lead with risk and value.

Rules:
- Short sentences. No filler.
- risk_before and risk_after: 1-2 sentences each
- what_we_did: 2-3 sentences max
- value_statement: 1-2 sentences
- photo_captions: one short sentence per photo, homeowner-friendly (no jargon)
- headline: punchy, risk-focused, under 10 words

Respond in JSON only:
{
  "headline": "short risk-focused headline",
  "risk_before": "what was at risk before today's work",
  "risk_after": "current risk status after today's work",
  "what_we_did": "plain-language summary of today's work",
  "value_statement": "why this matters to the homeowner",
  "photo_captions": {"photo_id": "caption", ...},
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

    # Build the full prompt
    prompt_parts = [
        f"Project: {project['name'] if project else project_id}",
        f"Address: {project['address'] if project else ''}",
        f"Company: {defaults.get('company_name', 'SFW Construction')}",
        "",
        f"Today's photos ({len(day_photos)} total):",
        "\n".join(photo_lines),
        "",
        f"Selected photos for report (generate captions for these): {selected_ids}",
    ]

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

    # Attach selected photos with their captions
    captions = report.get("photo_captions", {})
    report["photos"] = [
        {"photo_id": p["id"], "caption": captions.get(p["id"], p.get("scene", "")),
         "phase": p.get("phase", ""), "score": p.get("marketing_score", 0)}
        for p in selected
    ]

    return report

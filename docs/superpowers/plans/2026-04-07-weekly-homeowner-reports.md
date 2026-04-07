# Weekly Homeowner Reports — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate weekly project reports for homeowners — a narrative arc of the week's work plus day-by-day timeline, for projects with 3+ business days of photo activity.

**Architecture:** Extend the existing daily reports system. Add `generate_weekly_report()` to `reports.py`, `weekly_reports` table and query methods to `catalog.py`, two new API routes to `server.py`, and a new "Weekly Reports" tab in the UI. Same risk→value matrix, same report card styling, same cumulative issue tracking.

**Tech Stack:** Python, FastAPI, SQLite, Anthropic Claude API, vanilla HTML/JS

**Spec:** `docs/superpowers/specs/2026-04-07-weekly-homeowner-reports-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `photo_scanner/catalog.py` | Add `weekly_reports` table, save/fetch/eligibility methods |
| Modify | `photo_scanner/reports.py` | Add `generate_weekly_report()`, `WEEKLY_REPORT_PROMPT`, `select_best_photos_weekly()` |
| Modify | `photo_scanner/server.py` | Add `/api/reports/generate-weekly` and `/api/reports/weekly` routes |
| Modify | `photo_scanner/templates/index.html` | Add "Weekly Reports" nav tab and section with week picker + report cards |
| Modify | `tests/test_reports.py` | Add weekly report tests |

---

## Task 1: Catalog — Weekly Reports Table and Methods

**Files:**
- Modify: `tools/photo-scanner/photo_scanner/catalog.py`
- Modify: `tools/photo-scanner/tests/test_reports.py`

- [ ] **Step 1: Write failing tests for weekly report storage and eligibility**

Append to `C:/Users/tfalcon/microsites/tools/photo-scanner/tests/test_reports.py`:

```python
def test_weekly_reports_table_exists(catalog):
    tables = {r[0] for r in catalog.db.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    ).fetchall()}
    assert "weekly_reports" in tables


def test_save_and_get_weekly_report(catalog):
    catalog.upsert_project({"id": "p1", "name": "Test", "address": "", "lat": 0, "lng": 0, "created_at": "", "photo_count": 0})
    report_data = {"headline": "Weekly Summary", "weekly_narrative": "Good week"}
    catalog.save_weekly_report("p1", "2026-03-31", report_data)
    reports = catalog.get_weekly_reports("2026-03-31")
    assert len(reports) == 1
    assert reports[0]["project_id"] == "p1"
    data = json.loads(reports[0]["report_data"])
    assert data["headline"] == "Weekly Summary"


def test_save_weekly_report_upserts(catalog):
    catalog.upsert_project({"id": "p1", "name": "Test", "address": "", "lat": 0, "lng": 0, "created_at": "", "photo_count": 0})
    catalog.save_weekly_report("p1", "2026-03-31", {"headline": "First"})
    catalog.save_weekly_report("p1", "2026-03-31", {"headline": "Updated"})
    reports = catalog.get_weekly_reports("2026-03-31")
    assert len(reports) == 1
    assert json.loads(reports[0]["report_data"])["headline"] == "Updated"


def test_get_eligible_weekly_projects(seeded_catalog):
    """Projects with 3+ distinct photo days in a week qualify."""
    # seeded_catalog has photos on 2 distinct days (around ts 1775400000 and 1775500000)
    # Need to add a 3rd day to make it eligible
    seeded_catalog.upsert_photo({
        "id": "d3-0", "project_id": "p1",
        "uri": "https://example.com/d3-0.jpg", "thumb_uri": "",
        "taken_at": str(1775600000), "creator_name": "Charlie",
    })
    seeded_catalog.update_photo_analysis("d3-0", {
        "triage_status": "picked", "scene": "Day 3 work",
        "service_types": ["siding"], "phase": "after",
        "entities": ["siding"], "marketing_score": 5,
        "marketing_notes": "Great", "before_after_potential": True,
    })

    # Wide range covering all 3 days
    eligible = seeded_catalog.get_eligible_weekly_projects(1775350000, 1775650000, min_days=3)
    assert len(eligible) == 1
    assert eligible[0]["project_id"] == "p1"
    assert eligible[0]["photo_days"] >= 3


def test_get_eligible_weekly_projects_below_threshold(seeded_catalog):
    """Projects with fewer than min_days don't qualify."""
    # seeded_catalog has photos on only 2 distinct days
    eligible = seeded_catalog.get_eligible_weekly_projects(1775350000, 1775550000, min_days=3)
    assert len(eligible) == 0


def test_get_photos_for_week(seeded_catalog):
    """Get all analyzed photos for a project in a week range."""
    # Covers both day 1 (ts ~1775400000) and day 2 (ts ~1775500000) photos
    photos = seeded_catalog.get_photos_for_week("p1", 1775350000, 1775550000)
    assert len(photos) == 7  # 4 day-1 + 3 day-2
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd C:/Users/tfalcon/microsites/tools/photo-scanner && python -m pytest tests/test_reports.py -v -k "weekly"`
Expected: FAIL — missing methods

- [ ] **Step 3: Add weekly_reports table and methods to catalog.py**

In `catalog.py`, add the table creation after the existing `daily_reports` table creation (in `_create_tables()`):

```python
        # weekly_reports table
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS weekly_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id TEXT NOT NULL,
                week_start TEXT NOT NULL,
                report_data TEXT NOT NULL,
                generated_at TEXT NOT NULL,
                UNIQUE(project_id, week_start)
            )
        """)
```

Add these methods after the existing `get_photos_for_date()` method (around line 199), before the `# --- Photos ---` section:

```python
    # --- Weekly Reports ---

    def save_weekly_report(self, project_id: str, week_start: str, report_data: dict):
        now = datetime.now(timezone.utc).isoformat()
        self.db.execute("""
            INSERT INTO weekly_reports (project_id, week_start, report_data, generated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(project_id, week_start) DO UPDATE SET
                report_data=excluded.report_data, generated_at=excluded.generated_at
        """, (project_id, week_start, json.dumps(report_data), now))
        self.db.commit()

    def get_weekly_reports(self, week_start: str) -> list[dict]:
        rows = self.db.execute("""
            SELECT wr.*, p.name as project_name, p.address as project_address
            FROM weekly_reports wr
            JOIN projects p ON wr.project_id = p.id
            WHERE wr.week_start = ?
            ORDER BY p.name
        """, (week_start,)).fetchall()
        return [dict(r) for r in rows]

    def get_eligible_weekly_projects(self, ts_start: int, ts_end: int, min_days: int = 3) -> list[dict]:
        """Find projects with min_days+ distinct photo days in the given timestamp range."""
        rows = self.db.execute("""
            SELECT p.project_id, pr.name, pr.address,
                   COUNT(DISTINCT date(CAST(p.taken_at AS INTEGER), 'unixepoch')) as photo_days,
                   COUNT(*) as photo_count
            FROM photos p
            JOIN projects pr ON p.project_id = pr.id
            WHERE p.scene IS NOT NULL
              AND CAST(p.taken_at AS INTEGER) >= ?
              AND CAST(p.taken_at AS INTEGER) < ?
            GROUP BY p.project_id
            HAVING photo_days >= ?
            ORDER BY photo_days DESC, photo_count DESC
        """, (ts_start, ts_end, min_days)).fetchall()
        return [dict(r) for r in rows]

    def get_photos_for_week(self, project_id: str, ts_start: int, ts_end: int) -> list[dict]:
        """Get all analyzed photos for a project in a week range, ordered by date then score."""
        rows = self.db.execute("""
            SELECT * FROM photos
            WHERE project_id = ? AND scene IS NOT NULL
              AND CAST(taken_at AS INTEGER) >= ? AND CAST(taken_at AS INTEGER) < ?
            ORDER BY CAST(taken_at AS INTEGER), marketing_score DESC
        """, (project_id, ts_start, ts_end)).fetchall()
        return [dict(r) for r in rows]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd C:/Users/tfalcon/microsites/tools/photo-scanner && python -m pytest tests/test_reports.py -v`
Expected: All tests PASS (9 existing + 6 new = 15)

- [ ] **Step 5: Commit**

```bash
cd C:/Users/tfalcon/microsites
git add -f tools/photo-scanner/photo_scanner/catalog.py tools/photo-scanner/tests/test_reports.py
git commit -m "feat: add weekly_reports table, eligibility query, and week photo range methods"
```

---

## Task 2: Weekly Report Generation — `reports.py`

**Files:**
- Modify: `tools/photo-scanner/photo_scanner/reports.py`
- Modify: `tools/photo-scanner/tests/test_reports.py`

- [ ] **Step 1: Add weekly report generation tests**

Append to `tests/test_reports.py`:

```python
from photo_scanner.reports import generate_weekly_report, select_best_photos_weekly


def test_select_best_photos_weekly():
    """Select photos across a week preferring narrative arc (before early, after late)."""
    photos = [
        {"id": "mon-1", "marketing_score": 4, "phase": "before", "taken_at": "1775100000"},
        {"id": "mon-2", "marketing_score": 3, "phase": "before", "taken_at": "1775100100"},
        {"id": "wed-1", "marketing_score": 5, "phase": "during", "taken_at": "1775270000"},
        {"id": "wed-2", "marketing_score": 3, "phase": "during", "taken_at": "1775270100"},
        {"id": "fri-1", "marketing_score": 5, "phase": "after", "taken_at": "1775440000"},
        {"id": "fri-2", "marketing_score": 4, "phase": "after", "taken_at": "1775440100"},
    ]
    selected = select_best_photos_weekly(photos, max_photos=4)
    assert len(selected) == 4
    ids = [p["id"] for p in selected]
    # Should have before, during, and after represented
    phases = [p["phase"] for p in selected]
    assert "before" in phases
    assert "after" in phases


@pytest.mark.asyncio
async def test_generate_weekly_report(seeded_catalog):
    """Generate a weekly report using mocked Claude response."""
    # Add a 3rd day to make eligible
    seeded_catalog.upsert_photo({
        "id": "d3-0", "project_id": "p1",
        "uri": "https://example.com/d3-0.jpg", "thumb_uri": "",
        "taken_at": str(1775600000), "creator_name": "Charlie",
    })
    seeded_catalog.update_photo_analysis("d3-0", {
        "triage_status": "picked", "scene": "Day 3 — siding complete",
        "service_types": ["siding"], "phase": "after",
        "entities": ["siding", "house"], "marketing_score": 5,
        "marketing_notes": "Great completion shot", "before_after_potential": True,
    })

    mock_report = json.dumps({
        "headline": "A Week of Structural Restoration",
        "weekly_narrative": "This week the crew addressed critical dry rot and began siding replacement.",
        "risk_before": "Exposed structural elements were vulnerable to weather.",
        "risk_after": "Wall cavity sealed and new siding going up.",
        "what_we_did": "Removed rot, installed flashing, started siding replacement.",
        "value_statement": "Your home's weather envelope is being restored.",
        "photo_captions": {"d1-1": "Rot exposed", "d2-0": "Flashing installed", "d2-2": "End of day", "d3-0": "Siding complete"},
        "issues_status": [
            {"issue": "Sill plate dry rot", "status": "resolved", "changed_this_week": True},
            {"issue": "Siding replacement", "status": "in-progress", "changed_this_week": True}
        ],
        "daily_timeline": [
            {"date": "2026-04-04", "summary": "Exposed and removed rotted sill plate.", "photo_ids": ["d1-0", "d1-1"]},
            {"date": "2026-04-05", "summary": "Installed flashing and house wrap.", "photo_ids": ["d2-0", "d2-1"]},
            {"date": "2026-04-06", "summary": "Began siding installation.", "photo_ids": ["d3-0"]}
        ]
    })

    mock_anthropic = AsyncMock()
    mock_anthropic.messages.create = AsyncMock(
        return_value=MagicMock(content=[MagicMock(text=mock_report)])
    )

    report = await generate_weekly_report(
        catalog=seeded_catalog,
        project_id="p1",
        week_ts_start=1775350000,
        week_ts_end=1775650000,
        anthropic_client=mock_anthropic,
    )

    assert report["headline"] == "A Week of Structural Restoration"
    assert report["weekly_narrative"] is not None
    assert len(report["photos"]) <= 4
    assert report["daily_timeline"] is not None
    assert len(report["daily_timeline"]) >= 1
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd C:/Users/tfalcon/microsites/tools/photo-scanner && python -m pytest tests/test_reports.py -v -k "weekly"`
Expected: FAIL — `ImportError: cannot import name 'generate_weekly_report'`

- [ ] **Step 3: Add weekly report prompt and generation to reports.py**

Append to the end of `reports.py`:

```python
WEEKLY_REPORT_PROMPT = """\
Generate a weekly project report for a homeowner. Be friendly and concise. Lead with risk and value.

This covers a full week of work. Provide both a narrative arc and a day-by-day timeline.

Rules:
- Short sentences. No filler.
- weekly_narrative: 3-4 sentences covering the week's arc — where we started, what we accomplished, where we stand now
- risk_before and risk_after: 1-2 sentences each (for the whole week, not per day)
- what_we_did: 2-3 sentences summarizing the week's work
- value_statement: 1-2 sentences
- photo_captions: one short sentence per photo, homeowner-friendly (no jargon)
- daily_timeline: one entry per day with photos, 1-sentence summary per day
- headline: punchy, risk-focused, under 10 words
- Do NOT predict next week's work

Respond in JSON only:
{
  "headline": "short risk-focused headline for the week",
  "weekly_narrative": "3-4 sentence arc of the week",
  "risk_before": "risk status at start of week",
  "risk_after": "risk status at end of week",
  "what_we_did": "summary of the week's work",
  "value_statement": "why this week matters",
  "photo_captions": {"photo_id": "caption", ...},
  "issues_status": [
    {"issue": "name", "status": "resolved|in-progress|documented-only", "changed_this_week": true/false}
  ],
  "daily_timeline": [
    {"date": "YYYY-MM-DD", "summary": "one sentence", "photo_ids": ["id1", "id2"]}
  ]
}
"""


def select_best_photos_weekly(photos: list[dict], max_photos: int = 4) -> list[dict]:
    """Pick the best photos across a full week, preferring a narrative arc.

    Tries to get: early-week before → mid-week during → late-week after.
    Falls back to score-based selection like daily.
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
        week_ts_end: Unix timestamp for Saturday 00:00 UTC (end of Friday)
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

    # Check for existing daily reports to include
    daily_summaries = []
    for day_str in sorted(days.keys()):
        saved = catalog.get_daily_reports(day_str)
        for r in saved:
            if r["project_id"] == project_id:
                rd = json.loads(r["report_data"])
                daily_summaries.append(f"{day_str}: {rd.get('what_we_did', '')}")

    # Build prompt
    prompt_parts = [
        f"Project: {project['name'] if project else project_id}",
        f"Address: {project['address'] if project else ''}",
        f"Company: {defaults.get('company_name', 'SFW Construction')}",
        f"Week: {sorted(days.keys())[0]} to {sorted(days.keys())[-1]}",
        f"Total photos this week: {len(week_photos)} across {len(days)} days",
        "",
        "Photos by day:",
        "\n\n".join(day_sections),
        "",
        f"Selected photos for report (generate captions for these): {selected_ids}",
    ]

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

    return report
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd C:/Users/tfalcon/microsites/tools/photo-scanner && python -m pytest tests/test_reports.py -v`
Expected: All tests PASS (15 existing + 2 new = 17)

- [ ] **Step 5: Commit**

```bash
cd C:/Users/tfalcon/microsites
git add -f tools/photo-scanner/photo_scanner/reports.py tools/photo-scanner/tests/test_reports.py
git commit -m "feat: add weekly report generation with narrative arc and day-by-day timeline"
```

---

## Task 3: Server API Routes for Weekly Reports

**Files:**
- Modify: `tools/photo-scanner/photo_scanner/server.py`

- [ ] **Step 1: Add weekly report import**

Find the existing import line:
```python
from photo_scanner.reports import generate_daily_report
```
Change it to:
```python
from photo_scanner.reports import generate_daily_report, generate_weekly_report
```

- [ ] **Step 2: Add weekly report routes**

Add after the existing `api_get_daily_reports` route (after line ~905):

```python
# --- Weekly Reports ---

@app.post("/api/reports/generate-weekly")
async def api_generate_weekly_reports(request: Request):
    """Generate weekly homeowner reports for a given week."""
    if not catalog:
        return JSONResponse({"error": "Catalog not initialized"}, status_code=503)

    body = await request.json()
    week_start_str = body.get("week_start")  # "2026-03-31" (Monday)
    project_id = body.get("project_id")  # optional

    if not week_start_str:
        return JSONResponse({"error": "week_start is required (YYYY-MM-DD, must be a Monday)"}, status_code=400)

    from datetime import datetime as dt, timezone as tz
    try:
        week_start = dt.strptime(week_start_str, "%Y-%m-%d").replace(tzinfo=tz.utc)
    except ValueError:
        return JSONResponse({"error": "Invalid date format. Use YYYY-MM-DD"}, status_code=400)

    ts_start = int(week_start.timestamp())
    ts_end = ts_start + 5 * 86400  # Mon-Fri (5 business days)

    from photo_scanner.scanner import get_async_anthropic_client
    anthropic_client = get_async_anthropic_client()
    if not anthropic_client:
        return JSONResponse({"error": "ANTHROPIC_API_KEY not configured"}, status_code=503)

    # Find eligible projects (3+ business days of photos)
    if project_id:
        project_ids = [project_id]
    else:
        eligible = catalog.get_eligible_weekly_projects(ts_start, ts_end, min_days=3)
        project_ids = [e["project_id"] for e in eligible]

    if not project_ids:
        return {"reports": [], "message": f"No projects with 3+ days of photos for week of {week_start_str}"}

    reports = []
    for pid in project_ids:
        try:
            report = await generate_weekly_report(
                catalog=catalog,
                project_id=pid,
                week_ts_start=ts_start,
                week_ts_end=ts_end,
                anthropic_client=anthropic_client,
            )
            if report:
                catalog.save_weekly_report(pid, week_start_str, report)
                project = catalog.get_project(pid)
                reports.append({
                    "project_id": pid,
                    "project_name": project["name"] if project else pid,
                    "project_address": project["address"] if project else "",
                    "week_start": week_start_str,
                    "report": report,
                })
        except Exception as e:
            reports.append({"project_id": pid, "error": str(e)})

    return {"reports": reports, "week_start": week_start_str}


@app.get("/api/reports/weekly")
async def api_get_weekly_reports(week_start: str = Query(...)):
    """Fetch saved weekly reports for a week."""
    if not catalog:
        return JSONResponse({"error": "Catalog not initialized"}, status_code=503)
    rows = catalog.get_weekly_reports(week_start)
    reports = []
    for r in rows:
        reports.append({
            "project_id": r["project_id"],
            "project_name": r["project_name"],
            "project_address": r["project_address"],
            "week_start": r["week_start"],
            "report": json.loads(r["report_data"]),
            "generated_at": r["generated_at"],
        })
    return {"reports": reports, "week_start": week_start}
```

- [ ] **Step 3: Verify server imports cleanly**

Run: `cd C:/Users/tfalcon/microsites/tools/photo-scanner && python -c "from photo_scanner.server import app; print('OK')"`

- [ ] **Step 4: Commit**

```bash
cd C:/Users/tfalcon/microsites
git add -f tools/photo-scanner/photo_scanner/server.py
git commit -m "feat: add /api/reports/generate-weekly and /api/reports/weekly endpoints"
```

---

## Task 4: Weekly Reports Tab in Web UI

**Files:**
- Modify: `tools/photo-scanner/photo_scanner/templates/index.html`

- [ ] **Step 1: Add "Weekly Reports" nav tab**

Find (around line 418):
```html
    <div class="nav-tab" data-section="reports" onclick="switchSection('reports')">Reports</div>
```
Add after it:
```html
    <div class="nav-tab" data-section="weekly-reports" onclick="switchSection('weekly-reports')">Weekly Reports</div>
```

- [ ] **Step 2: Add day-timeline CSS**

Add to the `<style>` block (after the existing report card CSS):

```css
/* Day timeline for weekly reports */
.day-entry {
    display: flex;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid #eee;
    font-family: -apple-system, sans-serif;
}
.day-entry:last-child { border-bottom: none; }
.day-entry .day-date {
    min-width: 90px;
    font-size: 13px;
    font-weight: 600;
    color: #555;
}
.day-entry .day-summary {
    flex: 1;
    font-size: 13px;
    color: #333;
    line-height: 1.5;
}
.day-entry .day-thumbs {
    display: flex;
    gap: 4px;
}
.day-entry .day-thumbs img {
    width: 60px;
    height: 45px;
    object-fit: cover;
    border-radius: 4px;
    background: #eee;
}
```

- [ ] **Step 3: Add Weekly Reports section container**

After the existing `#section-reports` closing `</div>` (around line 533), add:

```html
<div id="section-weekly-reports" class="main-section">
    <div style="padding:16px;max-width:720px;margin:0 auto;width:100%">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:16px">
            <label style="color:#888;font-size:12px">Week of:</label>
            <input type="date" id="weekly-report-date" style="background:#161b22;border:1px solid #30363d;border-radius:6px;padding:8px 12px;color:#ccc;font-size:13px">
            <button class="btn btn-primary" id="generate-weekly-btn" onclick="generateWeeklyReports()">Generate Weekly Reports</button>
            <button class="btn" onclick="loadSavedWeeklyReports()">Load Saved</button>
            <span id="weekly-report-status" style="color:#888;font-size:12px"></span>
        </div>
        <div id="weekly-reports-container"></div>
    </div>
</div>
```

- [ ] **Step 4: Add section switch handler**

In the `switchSection` function, find:
```javascript
    if (section === 'reports') initReportsTab();
```
Add after:
```javascript
    if (section === 'weekly-reports') initWeeklyReportsTab();
```

- [ ] **Step 5: Add JavaScript functions**

Add in the `<script>` block before `loadDashboard();`:

```javascript
// --- Weekly Reports ---
function initWeeklyReportsTab() {
    const dateInput = document.getElementById('weekly-report-date');
    if (!dateInput.value) {
        // Default to last Monday
        const now = new Date();
        const dayOfWeek = now.getDay();
        const lastMonday = new Date(now.getTime() - ((dayOfWeek === 0 ? 6 : dayOfWeek - 1) + 7) * 86400000);
        dateInput.value = lastMonday.toISOString().split('T')[0];
    }
    loadSavedWeeklyReports();
}

async function generateWeeklyReports() {
    const weekStart = document.getElementById('weekly-report-date').value;
    if (!weekStart) { alert('Pick a Monday'); return; }
    const statusEl = document.getElementById('weekly-report-status');
    const btn = document.getElementById('generate-weekly-btn');
    btn.disabled = true;
    statusEl.textContent = 'Generating weekly reports...';
    try {
        const resp = await fetch('/api/reports/generate-weekly', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({week_start: weekStart}),
        });
        const data = await resp.json();
        if (data.error) {
            statusEl.textContent = 'Error: ' + data.error;
        } else {
            statusEl.textContent = `Generated ${data.reports.length} weekly reports`;
            renderWeeklyReports(data.reports, weekStart);
        }
    } catch (e) {
        statusEl.textContent = 'Error: ' + e.message;
    } finally {
        btn.disabled = false;
    }
}

async function loadSavedWeeklyReports() {
    const weekStart = document.getElementById('weekly-report-date').value;
    if (!weekStart) return;
    const statusEl = document.getElementById('weekly-report-status');
    try {
        const data = await fetch(`/api/reports/weekly?week_start=${weekStart}`).then(r => r.json());
        if (data.reports && data.reports.length > 0) {
            statusEl.textContent = `${data.reports.length} saved weekly reports`;
            renderWeeklyReports(data.reports, weekStart);
        } else {
            statusEl.textContent = 'No saved weekly reports';
            document.getElementById('weekly-reports-container').innerHTML =
                '<div style="text-align:center;color:#888;padding:40px">No weekly reports yet. Click "Generate Weekly Reports" to create them.</div>';
        }
    } catch (e) {
        statusEl.textContent = '';
    }
}

function renderWeeklyReports(reports, weekStart) {
    const container = document.getElementById('weekly-reports-container');
    const wsDate = new Date(weekStart + 'T00:00:00');
    const weDate = new Date(wsDate.getTime() + 4 * 86400000);
    const weekRange = wsDate.toLocaleDateString('en-US', {month: 'long', day: 'numeric'})
        + ' – ' + weDate.toLocaleDateString('en-US', {month: 'long', day: 'numeric', year: 'numeric'});

    container.innerHTML = reports.map(r => {
        if (r.error) {
            return `<div class="report-card"><div class="report-header"><h2>Error</h2></div>
                <div class="report-section"><p style="color:#f85149">${r.error}</p></div></div>`;
        }
        const rpt = r.report;
        const photos = rpt.photos || [];
        const issues = rpt.issues_status || [];
        const timeline = rpt.daily_timeline || [];

        return `
        <div class="report-card">
            <div class="report-header" style="background:#1a2a3a">
                <div class="date-label">Weekly Project Report</div>
                <h2>${rpt.headline || 'Weekly Update'}</h2>
                <div class="meta">
                    <span>${r.project_name || ''}</span>
                    <span>Week of ${weekRange}</span>
                </div>
                ${r.project_address ? `<div style="font-size:12px;opacity:0.6;margin-top:2px;font-family:-apple-system,sans-serif">${r.project_address}</div>` : ''}
            </div>

            ${rpt.weekly_narrative ? `
            <div class="report-section">
                <div class="section-label">This Week's Progress</div>
                <p>${rpt.weekly_narrative}</p>
            </div>
            ` : ''}

            <div class="report-section">
                <div class="risk-boxes">
                    <div class="risk-box before">
                        <div class="section-label">Risk at Start of Week</div>
                        <p>${rpt.risk_before || ''}</p>
                    </div>
                    <div class="risk-arrow">&rarr;</div>
                    <div class="risk-box after">
                        <div class="section-label">After This Week's Work</div>
                        <p>${rpt.risk_after || ''}</p>
                    </div>
                </div>
            </div>

            <div class="report-section">
                <div class="section-label">What We Accomplished</div>
                <p>${rpt.what_we_did || ''}</p>
            </div>

            ${photos.length > 0 ? `
            <div class="report-section">
                <div class="section-label">This Week's Photos</div>
                <div class="report-photos">
                    ${photos.map(p => `
                        <div>
                            <img src="/api/photo/${p.photo_id}/thumb" loading="lazy" onerror="this.style.background='#ddd'">
                            <div class="caption">${p.caption || ''}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            <div class="report-section">
                <div class="section-label">The Value To Your Home</div>
                <p>${rpt.value_statement || ''}</p>
            </div>

            ${timeline.length > 0 ? `
            <div class="report-section">
                <div class="section-label">Day by Day</div>
                ${timeline.map(day => {
                    const dayDate = new Date(day.date + 'T00:00:00');
                    const dayLabel = dayDate.toLocaleDateString('en-US', {weekday: 'short', month: 'short', day: 'numeric'});
                    const thumbIds = (day.photo_ids || []).slice(0, 2);
                    return `
                    <div class="day-entry">
                        <div class="day-date">${dayLabel}</div>
                        <div class="day-summary">${day.summary || ''}</div>
                        ${thumbIds.length > 0 ? `
                        <div class="day-thumbs">
                            ${thumbIds.map(id => `<img src="/api/photo/${id}/thumb" loading="lazy" onerror="this.style.display='none'">`).join('')}
                        </div>
                        ` : ''}
                    </div>`;
                }).join('')}
            </div>
            ` : ''}

            ${issues.length > 0 ? `
            <div class="report-section" style="background:#fafafa">
                <div class="section-label">Project Issues — Weekly Status</div>
                ${issues.map(iss => {
                    const status = iss.status || 'unknown';
                    const dotClass = status.replace(/ /g, '-');
                    const label = status === 'resolved' ? 'Resolved' :
                        status === 'in-progress' ? 'In progress' :
                        status === 'documented-only' ? 'Documented' : 'Pending';
                    const changed = iss.changed_this_week ? ' — this week' : '';
                    return `
                        <div class="issue-row">
                            <span class="issue-dot ${dotClass}">&bull;</span>
                            <span style="flex:1">${iss.issue}</span>
                            <span style="font-size:12px;font-weight:500;color:${
                                status === 'resolved' ? '#2e7d32' :
                                status === 'in-progress' ? '#1976d2' : '#b8860b'
                            }">${label}${changed}</span>
                        </div>`;
                }).join('')}
            </div>
            ` : ''}

            <div class="report-footer">
                SFW Construction — Weekly Project Report
            </div>
        </div>`;
    }).join('');
}
```

- [ ] **Step 6: Verify server imports cleanly**

Run: `cd C:/Users/tfalcon/microsites/tools/photo-scanner && python -c "from photo_scanner.server import app; print('OK')"`

- [ ] **Step 7: Commit**

```bash
cd C:/Users/tfalcon/microsites
git add -f tools/photo-scanner/photo_scanner/templates/index.html
git commit -m "feat: add Weekly Reports tab with week picker and day-by-day timeline cards"
```

---

## Summary

| Task | What | Dependencies |
|------|------|-------------|
| 1 | Catalog: weekly_reports table + eligibility + week queries | None |
| 2 | reports.py: weekly generation with arc selection + prompt | Task 1 |
| 3 | Server API routes | Tasks 1, 2 |
| 4 | Weekly Reports tab UI | Task 3 |

Tasks are sequential: 1 → 2 → 3 → 4.

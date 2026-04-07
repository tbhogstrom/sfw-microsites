# Daily Homeowner Reports — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate daily project reports for homeowners — friendly, concise HTML cards showing risk mitigation, today's work, best photos, and project issue status, driven by cumulative photo analysis data.

**Architecture:** New `reports.py` module handles report generation (querying catalog, selecting photos, calling Claude with a report prompt + configurable risk→value matrix). New API routes in `server.py` for generating and fetching reports. New Reports tab in the UI renders styled report cards. A `daily_reports` table stores generated reports.

**Tech Stack:** Python, FastAPI, SQLite, Anthropic Claude API, vanilla HTML/JS

**Spec:** `docs/superpowers/specs/2026-04-07-daily-homeowner-reports-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `photo_scanner/reports.py` | Report generation logic: query catalog, select photos, build prompt, call Claude, parse response |
| Create | `report_config.json` | Risk→value matrix and report defaults (JSON config) |
| Modify | `photo_scanner/catalog.py` | Add `daily_reports` table, save/fetch report methods |
| Modify | `photo_scanner/server.py` | Add `/api/reports/*` routes |
| Modify | `photo_scanner/templates/index.html` | Add Reports tab with date picker and report card rendering |
| Create | `tests/test_reports.py` | Report generation tests |

---

## Task 1: Report Config File

**Files:**
- Create: `tools/photo-scanner/report_config.json`

- [ ] **Step 1: Create the risk→value matrix config**

Create `C:/Users/tfalcon/microsites/tools/photo-scanner/report_config.json`:

```json
{
  "risk_value_matrix": {
    "dry-rot": {
      "risk": "Dry rot compromises structural wood in your home, spreading silently and weakening load-bearing elements",
      "value": "Removing and replacing rotted wood stops the spread and restores structural integrity",
      "urgency": "high"
    },
    "leak": {
      "risk": "Water intrusion can cause hidden mold growth, damage insulation, and rot structural framing inside your walls",
      "value": "Sealing entry points protects your home's interior from moisture damage and health hazards",
      "urgency": "high"
    },
    "siding": {
      "risk": "Damaged or missing siding leaves your home exposed to weather, pests, and accelerating deterioration",
      "value": "New siding is your home's first line of defense — it protects the structure and restores curb appeal",
      "urgency": "medium"
    },
    "windows": {
      "risk": "Failing window frames and flashing allow water behind your walls where you can't see the damage building",
      "value": "Properly sealed windows stop hidden moisture intrusion and improve energy efficiency",
      "urgency": "high"
    },
    "doors": {
      "risk": "Deteriorated door frames and thresholds are common entry points for water and pest intrusion",
      "value": "Restored door framing seals your home's envelope and prevents costly interior damage",
      "urgency": "medium"
    },
    "trim": {
      "risk": "Rotting trim allows water to wick into the wall structure behind it",
      "value": "Fresh trim seals transitions and protects the underlying framing from moisture",
      "urgency": "medium"
    },
    "deck": {
      "risk": "A compromised deck is a safety hazard — rotted joists and boards can fail under load",
      "value": "Rebuilt deck structure ensures safe use for your family and extends the life of the investment",
      "urgency": "high"
    },
    "crawlspace": {
      "risk": "Moisture and rot in the crawlspace can undermine your home's foundation and floor structure",
      "value": "Crawlspace repairs protect the foundation and prevent floor sagging or structural failure",
      "urgency": "high"
    },
    "chimney": {
      "risk": "Deteriorated chimney flashing and masonry allows water into your roof and wall systems",
      "value": "Chimney repairs seal a critical roof penetration and prevent interior water damage",
      "urgency": "medium"
    },
    "flashing": {
      "risk": "Failed flashing at roof-wall junctions is one of the most common causes of hidden water damage",
      "value": "Proper flashing directs water away from vulnerable transitions in your home",
      "urgency": "high"
    },
    "beam": {
      "risk": "Compromised beams put your home's structural safety at risk",
      "value": "New structural beams restore load-bearing capacity and long-term safety",
      "urgency": "high"
    },
    "mold": {
      "risk": "Mold growth indicates moisture problems and poses health risks to your household",
      "value": "Mold remediation and moisture source correction protects your family's health",
      "urgency": "high"
    },
    "lead-paint": {
      "risk": "Lead paint disturbed during renovation creates toxic dust hazardous to your family",
      "value": "Proper containment and abatement eliminates the exposure risk",
      "urgency": "high"
    },
    "restoration": {
      "risk": "Accumulated deterioration reduces your home's safety, efficiency, and value",
      "value": "Comprehensive restoration brings your home back to solid, safe condition",
      "urgency": "medium"
    }
  },
  "report_defaults": {
    "max_photos": 4,
    "tone": "friendly",
    "company_name": "SFW Construction"
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd C:/Users/tfalcon/microsites
git add -f tools/photo-scanner/report_config.json
git commit -m "add risk-value matrix config for daily homeowner reports"
```

---

## Task 2: Catalog — `daily_reports` Table and Methods

**Files:**
- Modify: `tools/photo-scanner/photo_scanner/catalog.py`
- Create: `tools/photo-scanner/tests/test_reports.py` (partial — catalog tests)

- [ ] **Step 1: Write failing tests for report storage**

Create `C:/Users/tfalcon/microsites/tools/photo-scanner/tests/test_reports.py`:

```python
"""Tests for daily report generation and storage."""
import json
import pytest
from photo_scanner.catalog import Catalog


@pytest.fixture
def catalog(tmp_path):
    db = Catalog(tmp_path / "test.db")
    yield db
    db.close()


@pytest.fixture
def seeded_catalog(catalog):
    """Catalog with a project, photos across two days, and a project summary."""
    catalog.upsert_project({
        "id": "p1", "name": "Thelma Dobson", "address": "4523 NE Multnomah St, Portland OR",
        "lat": 45.5, "lng": -122.6, "created_at": "1774999578", "photo_count": 10,
    })
    # Day 1 photos (April 5) — Unix ts 1775433600 area
    for i in range(4):
        catalog.upsert_photo({
            "id": f"d1-{i}", "project_id": "p1",
            "uri": f"https://example.com/d1-{i}.jpg", "thumb_uri": "",
            "taken_at": str(1775400000 + i * 100), "creator_name": "Alice",
        })
        catalog.update_photo_analysis(f"d1-{i}", {
            "triage_status": "picked",
            "scene": f"Day 1 photo {i} — dry rot at sill plate",
            "service_types": ["dry-rot", "siding"],
            "phase": "before" if i < 2 else "during",
            "entities": ["sill plate", "rot", "framing"],
            "marketing_score": 3 + (i % 2),
            "marketing_notes": "Good documentation",
            "before_after_potential": True,
            "damage_details": {"water_damage": "Rot at sill plate", "siding_details": "Damaged lap siding"},
        })
    # Day 2 photos (April 6) — Unix ts 1775520000 area
    for i in range(3):
        catalog.upsert_photo({
            "id": f"d2-{i}", "project_id": "p1",
            "uri": f"https://example.com/d2-{i}.jpg", "thumb_uri": "",
            "taken_at": str(1775500000 + i * 100), "creator_name": "Bob",
        })
        catalog.update_photo_analysis(f"d2-{i}", {
            "triage_status": "picked",
            "scene": f"Day 2 photo {i} — new flashing installed",
            "service_types": ["flashing", "siding"],
            "phase": "during" if i < 2 else "after",
            "entities": ["flashing", "house wrap", "siding"],
            "marketing_score": 4,
            "marketing_notes": "Strong after shot",
            "before_after_potential": True,
            "damage_details": {"siding_details": "New lap siding being installed"},
        })
    # Project summary
    catalog.set_project_summary("p1", {
        "project_summary": "Sill plate and siding repair",
        "issues": [
            {"issue": "Sill plate dry rot", "service_type": "dry-rot", "resolution_status": "in-progress",
             "documented_before": True, "documented_during": True, "documented_after": False},
            {"issue": "Siding replacement", "service_type": "siding", "resolution_status": "in-progress",
             "documented_before": True, "documented_during": True, "documented_after": True},
        ],
    })
    return catalog


def test_daily_reports_table_exists(catalog):
    tables = {r[0] for r in catalog.db.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    ).fetchall()}
    assert "daily_reports" in tables


def test_save_and_get_report(catalog):
    catalog.upsert_project({"id": "p1", "name": "Test", "address": "", "lat": 0, "lng": 0, "created_at": "", "photo_count": 0})
    report_data = {"headline": "Test Report", "what_we_did": "Nothing"}
    catalog.save_daily_report("p1", "2026-04-06", report_data)
    reports = catalog.get_daily_reports("2026-04-06")
    assert len(reports) == 1
    assert reports[0]["project_id"] == "p1"
    data = json.loads(reports[0]["report_data"])
    assert data["headline"] == "Test Report"


def test_save_report_upserts(catalog):
    catalog.upsert_project({"id": "p1", "name": "Test", "address": "", "lat": 0, "lng": 0, "created_at": "", "photo_count": 0})
    catalog.save_daily_report("p1", "2026-04-06", {"headline": "First"})
    catalog.save_daily_report("p1", "2026-04-06", {"headline": "Updated"})
    reports = catalog.get_daily_reports("2026-04-06")
    assert len(reports) == 1
    assert json.loads(reports[0]["report_data"])["headline"] == "Updated"


def test_get_photos_for_date(seeded_catalog):
    """Get analyzed photos for a specific project on a specific date."""
    # Day 2 photos have taken_at around 1775500000
    photos = seeded_catalog.get_photos_for_date("p1", 1775490000, 1775510000)
    assert len(photos) == 3
    assert all(p["id"].startswith("d2-") for p in photos)


def test_get_photos_for_date_empty(seeded_catalog):
    """No photos for a date with no activity."""
    photos = seeded_catalog.get_photos_for_date("p1", 1776000000, 1776100000)
    assert len(photos) == 0
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd C:/Users/tfalcon/microsites/tools/photo-scanner && python -m pytest tests/test_reports.py -v`
Expected: FAIL — missing methods

- [ ] **Step 3: Add `daily_reports` table and methods to catalog.py**

In `catalog.py`, add the table in `_create_tables()` after the existing `photo_fts` triggers (around line 91, after the migrations block):

```python
        # daily_reports table
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS daily_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id TEXT NOT NULL,
                report_date TEXT NOT NULL,
                report_data TEXT NOT NULL,
                generated_at TEXT NOT NULL,
                UNIQUE(project_id, report_date)
            )
        """)
```

Add these methods after `get_project_summary_data()` (around line 155):

```python
    # --- Daily Reports ---

    def save_daily_report(self, project_id: str, report_date: str, report_data: dict):
        now = datetime.now(timezone.utc).isoformat()
        self.db.execute("""
            INSERT INTO daily_reports (project_id, report_date, report_data, generated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(project_id, report_date) DO UPDATE SET
                report_data=excluded.report_data, generated_at=excluded.generated_at
        """, (project_id, report_date, json.dumps(report_data), now))
        self.db.commit()

    def get_daily_reports(self, report_date: str) -> list[dict]:
        rows = self.db.execute("""
            SELECT dr.*, p.name as project_name, p.address as project_address
            FROM daily_reports dr
            JOIN projects p ON dr.project_id = p.id
            WHERE dr.report_date = ?
            ORDER BY p.name
        """, (report_date,)).fetchall()
        return [dict(r) for r in rows]

    def get_photos_for_date(self, project_id: str, ts_start: int, ts_end: int) -> list[dict]:
        """Get analyzed photos for a project within a Unix timestamp range."""
        rows = self.db.execute("""
            SELECT * FROM photos
            WHERE project_id = ? AND scene IS NOT NULL
              AND CAST(taken_at AS INTEGER) >= ? AND CAST(taken_at AS INTEGER) < ?
            ORDER BY marketing_score DESC, taken_at
        """, (project_id, ts_start, ts_end)).fetchall()
        return [dict(r) for r in rows]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd C:/Users/tfalcon/microsites/tools/photo-scanner && python -m pytest tests/test_reports.py -v`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
cd C:/Users/tfalcon/microsites
git add -f tools/photo-scanner/photo_scanner/catalog.py tools/photo-scanner/tests/test_reports.py
git commit -m "feat: add daily_reports table and date-based photo queries"
```

---

## Task 3: Report Generation Module — `reports.py`

**Files:**
- Create: `tools/photo-scanner/photo_scanner/reports.py`
- Modify: `tools/photo-scanner/tests/test_reports.py` (add generation tests)

- [ ] **Step 1: Add report generation tests**

Append to `tests/test_reports.py`:

```python
from unittest.mock import AsyncMock, MagicMock
from photo_scanner.reports import generate_daily_report, select_best_photos, load_report_config


def test_load_report_config():
    config = load_report_config()
    assert "risk_value_matrix" in config
    assert "dry-rot" in config["risk_value_matrix"]
    assert "report_defaults" in config


def test_select_best_photos():
    photos = [
        {"id": "a", "marketing_score": 5, "phase": "after", "scene": "After shot"},
        {"id": "b", "marketing_score": 3, "phase": "before", "scene": "Before shot"},
        {"id": "c", "marketing_score": 4, "phase": "during", "scene": "During shot"},
        {"id": "d", "marketing_score": 2, "phase": "during", "scene": "Bad shot"},
        {"id": "e", "marketing_score": 4, "phase": "before", "scene": "Good before"},
    ]
    selected = select_best_photos(photos, max_photos=4)
    assert len(selected) == 4
    # Should include the score-5 photo
    ids = [p["id"] for p in selected]
    assert "a" in ids
    # Should not include the score-2 photo
    assert "d" not in ids


def test_select_best_photos_few():
    """When fewer photos than max, return all."""
    photos = [
        {"id": "a", "marketing_score": 3, "phase": "before", "scene": "Shot"},
        {"id": "b", "marketing_score": 4, "phase": "after", "scene": "Shot"},
    ]
    selected = select_best_photos(photos, max_photos=4)
    assert len(selected) == 2


@pytest.mark.asyncio
async def test_generate_daily_report(seeded_catalog):
    """Generate a report using mocked Claude response."""
    mock_report = json.dumps({
        "headline": "Sealing Your Home Against Water Damage",
        "risk_before": "Exposed gaps were allowing water into the wall cavity.",
        "risk_after": "New flashing installed, wall cavity sealed.",
        "what_we_did": "Installed flashing and began siding replacement.",
        "value_statement": "Today's work stopped an active water intrusion path.",
        "photo_captions": {
            "d2-0": "New flashing being installed at the junction.",
            "d2-1": "House wrap applied over repaired framing.",
            "d2-2": "End of day — siding going up."
        },
        "issues_status": [
            {"issue": "Sill plate dry rot", "status": "in-progress", "changed_today": True},
            {"issue": "Siding replacement", "status": "in-progress", "changed_today": True}
        ]
    })

    mock_anthropic = AsyncMock()
    mock_anthropic.messages.create = AsyncMock(
        return_value=MagicMock(content=[MagicMock(text=mock_report)])
    )

    # Date range covering day 2 photos (around ts 1775500000)
    report = await generate_daily_report(
        catalog=seeded_catalog,
        project_id="p1",
        date_ts_start=1775490000,
        date_ts_end=1775510000,
        anthropic_client=mock_anthropic,
    )

    assert report["headline"] == "Sealing Your Home Against Water Damage"
    assert report["risk_before"] is not None
    assert len(report["photos"]) <= 4

    # Should be saved in catalog
    reports = seeded_catalog.get_daily_reports("2026-04-06")
    assert len(reports) == 0  # generate_daily_report returns but doesn't save — caller saves
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd C:/Users/tfalcon/microsites/tools/photo-scanner && python -m pytest tests/test_reports.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'photo_scanner.reports'`

- [ ] **Step 3: Implement reports.py**

Create `C:/Users/tfalcon/microsites/tools/photo-scanner/photo_scanner/reports.py`:

```python
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
        value_statement, photos (with captions), issues_status
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd C:/Users/tfalcon/microsites/tools/photo-scanner && python -m pytest tests/test_reports.py -v`
Expected: All 9 tests PASS

- [ ] **Step 5: Commit**

```bash
cd C:/Users/tfalcon/microsites
git add -f tools/photo-scanner/photo_scanner/reports.py tools/photo-scanner/tests/test_reports.py
git commit -m "feat: add report generation module with photo selection and Claude prompt"
```

---

## Task 4: Server API Routes for Reports

**Files:**
- Modify: `tools/photo-scanner/photo_scanner/server.py`

- [ ] **Step 1: Add report route imports**

At the top of `server.py`, after the existing `from photo_scanner.catalog import Catalog` line, add:

```python
from photo_scanner.reports import generate_daily_report, load_report_config
```

- [ ] **Step 2: Add report API routes**

Add after the existing catalog routes (after the `/api/catalog/export` route), before the photo-picker proxy section:

```python
# --- Daily Reports ---

@app.post("/api/reports/generate")
async def generate_reports(request: Request):
    """Generate daily homeowner reports for a given date."""
    if not catalog:
        return JSONResponse({"error": "Catalog not initialized"}, status_code=503)

    body = await request.json()
    date_str = body.get("date")  # "2026-04-06"
    project_id = body.get("project_id")  # optional

    if not date_str:
        return JSONResponse({"error": "date is required (YYYY-MM-DD)"}, status_code=400)

    # Parse date to Unix timestamp range
    from datetime import datetime as dt, timezone as tz
    try:
        day_start = dt.strptime(date_str, "%Y-%m-%d").replace(tzinfo=tz.utc)
    except ValueError:
        return JSONResponse({"error": "Invalid date format. Use YYYY-MM-DD"}, status_code=400)
    ts_start = int(day_start.timestamp())
    ts_end = ts_start + 86400

    from photo_scanner.scanner import get_async_anthropic_client
    anthropic_client = get_async_anthropic_client()
    if not anthropic_client:
        return JSONResponse({"error": "ANTHROPIC_API_KEY not configured"}, status_code=503)

    # Find projects with photos on this date
    if project_id:
        project_ids = [project_id]
    else:
        rows = catalog.db.execute(
            "SELECT DISTINCT project_id FROM photos WHERE scene IS NOT NULL AND CAST(taken_at AS INTEGER) >= ? AND CAST(taken_at AS INTEGER) < ?",
            (ts_start, ts_end),
        ).fetchall()
        project_ids = [r[0] for r in rows]

    if not project_ids:
        return {"reports": [], "message": f"No analyzed photos found for {date_str}"}

    reports = []
    for pid in project_ids:
        try:
            report = await generate_daily_report(
                catalog=catalog,
                project_id=pid,
                date_ts_start=ts_start,
                date_ts_end=ts_end,
                anthropic_client=anthropic_client,
            )
            if report:
                catalog.save_daily_report(pid, date_str, report)
                project = catalog.get_project(pid)
                reports.append({
                    "project_id": pid,
                    "project_name": project["name"] if project else pid,
                    "project_address": project["address"] if project else "",
                    "date": date_str,
                    "report": report,
                })
        except Exception as e:
            reports.append({"project_id": pid, "error": str(e)})

    return {"reports": reports, "date": date_str}


@app.get("/api/reports/daily")
async def get_daily_reports(date: str = Query(...)):
    """Fetch saved reports for a date."""
    if not catalog:
        return JSONResponse({"error": "Catalog not initialized"}, status_code=503)
    rows = catalog.get_daily_reports(date)
    reports = []
    for r in rows:
        reports.append({
            "project_id": r["project_id"],
            "project_name": r["project_name"],
            "project_address": r["project_address"],
            "date": r["report_date"],
            "report": json.loads(r["report_data"]),
            "generated_at": r["generated_at"],
        })
    return {"reports": reports, "date": date}
```

- [ ] **Step 3: Verify server imports cleanly**

Run: `cd C:/Users/tfalcon/microsites/tools/photo-scanner && python -c "from photo_scanner.server import app; print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
cd C:/Users/tfalcon/microsites
git add -f tools/photo-scanner/photo_scanner/server.py
git commit -m "feat: add /api/reports/generate and /api/reports/daily endpoints"
```

---

## Task 5: Reports Tab in Web UI

**Files:**
- Modify: `tools/photo-scanner/photo_scanner/templates/index.html`

- [ ] **Step 1: Add Reports tab to the navigation bar**

In `index.html` at line 341, after the Map tab, add:

```html
    <div class="nav-tab" data-section="reports" onclick="switchSection('reports')">Reports</div>
```

- [ ] **Step 2: Add report card CSS**

Add to the `<style>` block:

```css
/* Report cards — light theme for homeowner-facing content */
.report-card {
    max-width: 680px;
    margin: 24px auto;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    overflow: hidden;
    font-family: Georgia, serif;
    color: #333;
}
.report-card .report-header {
    background: #1a3a2a;
    padding: 20px 24px;
    color: #fff;
}
.report-card .report-header .date-label {
    font-size: 12px;
    opacity: 0.7;
    letter-spacing: 1px;
    text-transform: uppercase;
    font-family: -apple-system, sans-serif;
}
.report-card .report-header h2 {
    font-size: 22px;
    font-weight: 600;
    margin: 4px 0 0;
}
.report-card .report-header .meta {
    display: flex;
    justify-content: space-between;
    margin-top: 10px;
    font-size: 13px;
    opacity: 0.8;
    font-family: -apple-system, sans-serif;
}
.report-section {
    padding: 20px 24px;
    border-bottom: 1px solid #eee;
}
.report-section .section-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #888;
    font-weight: 600;
    margin-bottom: 8px;
    font-family: -apple-system, sans-serif;
}
.report-section p {
    font-size: 14px;
    line-height: 1.6;
    margin: 0;
}
.risk-boxes {
    display: flex;
    gap: 16px;
}
.risk-box {
    flex: 1;
    border-radius: 8px;
    padding: 14px;
}
.risk-box.before { background: #fef3e2; }
.risk-box.before .section-label { color: #b8860b; }
.risk-box.before p { color: #5a4a2a; }
.risk-box.after { background: #e8f5e9; }
.risk-box.after .section-label { color: #2e7d32; }
.risk-box.after p { color: #2a4a2a; }
.risk-arrow { display: flex; align-items: center; font-size: 24px; color: #888; }
.report-photos {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
}
.report-photos img {
    width: 100%;
    border-radius: 8px;
    height: 140px;
    object-fit: cover;
    background: #eee;
}
.report-photos .caption {
    font-size: 12px;
    color: #666;
    margin-top: 4px;
    font-family: -apple-system, sans-serif;
}
.issue-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    padding: 4px 0;
    font-family: -apple-system, sans-serif;
}
.issue-dot { font-size: 16px; }
.issue-dot.resolved { color: #2e7d32; }
.issue-dot.in-progress { color: #1976d2; }
.issue-dot.documented-only { color: #b8860b; }
.issue-dot.unknown { color: #888; }
.report-footer {
    padding: 14px 24px;
    background: #f0f0ee;
    text-align: center;
    font-size: 12px;
    color: #888;
    font-family: -apple-system, sans-serif;
}
```

- [ ] **Step 3: Add Reports section container**

After the `#section-map` div (around line 443), add:

```html
<div id="section-reports" class="main-section">
    <div style="padding:16px;max-width:720px;margin:0 auto;width:100%">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:16px">
            <input type="date" id="report-date" style="background:#161b22;border:1px solid #30363d;border-radius:6px;padding:8px 12px;color:#ccc;font-size:13px">
            <button class="btn btn-primary" id="generate-reports-btn" onclick="generateReports()">Generate Reports</button>
            <button class="btn" onclick="loadSavedReports()">Load Saved</button>
            <span id="report-status" style="color:#888;font-size:12px"></span>
        </div>
        <div id="reports-container"></div>
    </div>
</div>
```

- [ ] **Step 4: Add section switch handler for reports**

In the `switchSection` function (around line 1229), add:

```javascript
    if (section === 'reports') initReportsTab();
```

- [ ] **Step 5: Add report JavaScript functions**

Add to the `<script>` block:

```javascript
// --- Reports ---
function initReportsTab() {
    const dateInput = document.getElementById('report-date');
    if (!dateInput.value) {
        // Default to yesterday
        const yesterday = new Date(Date.now() - 86400000);
        dateInput.value = yesterday.toISOString().split('T')[0];
    }
    loadSavedReports();
}

async function generateReports() {
    const date = document.getElementById('report-date').value;
    if (!date) { alert('Pick a date'); return; }
    const statusEl = document.getElementById('report-status');
    const btn = document.getElementById('generate-reports-btn');
    btn.disabled = true;
    statusEl.textContent = 'Generating reports...';

    try {
        const resp = await fetch('/api/reports/generate', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({date}),
        });
        const data = await resp.json();
        if (data.error) {
            statusEl.textContent = 'Error: ' + data.error;
        } else {
            statusEl.textContent = `Generated ${data.reports.length} reports`;
            renderReports(data.reports, date);
        }
    } catch (e) {
        statusEl.textContent = 'Error: ' + e.message;
    } finally {
        btn.disabled = false;
    }
}

async function loadSavedReports() {
    const date = document.getElementById('report-date').value;
    if (!date) return;
    const statusEl = document.getElementById('report-status');
    try {
        const data = await fetch(`/api/reports/daily?date=${date}`).then(r => r.json());
        if (data.reports && data.reports.length > 0) {
            statusEl.textContent = `${data.reports.length} saved reports`;
            renderReports(data.reports, date);
        } else {
            statusEl.textContent = 'No saved reports for this date';
            document.getElementById('reports-container').innerHTML =
                '<div style="text-align:center;color:#888;padding:40px">No reports yet. Click "Generate Reports" to create them.</div>';
        }
    } catch (e) {
        statusEl.textContent = '';
    }
}

function renderReports(reports, date) {
    const container = document.getElementById('reports-container');
    const dateFormatted = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    container.innerHTML = reports.map(r => {
        if (r.error) {
            return `<div class="report-card"><div class="report-header"><h2>Error</h2></div>
                <div class="report-section"><p style="color:#f85149">${r.error}</p></div></div>`;
        }
        const rpt = r.report;
        const photos = rpt.photos || [];
        const issues = rpt.issues_status || [];

        return `
        <div class="report-card">
            <div class="report-header">
                <div class="date-label">Daily Project Update</div>
                <h2>${rpt.headline || 'Daily Update'}</h2>
                <div class="meta">
                    <span>${r.project_name || ''}</span>
                    <span>${dateFormatted}</span>
                </div>
                ${r.project_address ? `<div style="font-size:12px;opacity:0.6;margin-top:2px;font-family:-apple-system,sans-serif">${r.project_address}</div>` : ''}
            </div>

            <div class="report-section">
                <div class="risk-boxes">
                    <div class="risk-box before">
                        <div class="section-label">Risk Before Work</div>
                        <p>${rpt.risk_before || ''}</p>
                    </div>
                    <div class="risk-arrow">→</div>
                    <div class="risk-box after">
                        <div class="section-label">After Today's Work</div>
                        <p>${rpt.risk_after || ''}</p>
                    </div>
                </div>
            </div>

            <div class="report-section">
                <div class="section-label">What We Did Today</div>
                <p>${rpt.what_we_did || ''}</p>
            </div>

            ${photos.length > 0 ? `
            <div class="report-section">
                <div class="section-label">Today's Photos</div>
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

            ${issues.length > 0 ? `
            <div class="report-section" style="background:#fafafa">
                <div class="section-label">Project Issues — Status</div>
                ${issues.map(iss => {
                    const status = iss.status || 'unknown';
                    const dotClass = status.replace(' ', '-');
                    const label = status === 'resolved' ? 'Resolved' :
                        status === 'in-progress' ? 'In progress' :
                        status === 'documented-only' ? 'Documented' : 'Pending';
                    const changed = iss.changed_today ? ' — updated today' : '';
                    return `
                        <div class="issue-row">
                            <span class="issue-dot ${dotClass}">●</span>
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
                SFW Construction — Daily Project Report
            </div>
        </div>`;
    }).join('');
}
```

- [ ] **Step 6: Test manually**

Run: `cd C:/Users/tfalcon/microsites/tools/photo-scanner && python -c "from photo_scanner.server import app; print('OK')"`
Expected: `OK`

- [ ] **Step 7: Commit**

```bash
cd C:/Users/tfalcon/microsites
git add -f tools/photo-scanner/photo_scanner/templates/index.html
git commit -m "feat: add Reports tab with date picker and styled homeowner report cards"
```

---

## Summary

| Task | What | Dependencies |
|------|------|-------------|
| 1 | Report config JSON (risk→value matrix) | None |
| 2 | Catalog: daily_reports table + date queries | None |
| 3 | reports.py: generation module | Task 2 |
| 4 | Server API routes | Tasks 2, 3 |
| 5 | Reports tab UI | Task 4 |

Tasks 1 and 2 can run in parallel. Tasks 3-5 are sequential.

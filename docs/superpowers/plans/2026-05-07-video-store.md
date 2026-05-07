# Video Store Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Python tool inside `tools/photo-scanner` that takes a video script document and produces a ranked HTML shoot plan for next Monday: which active CompanyCam projects within 20 miles of Portland are likely to have the right work happening + the right visible conditions to film the shots described in the scripts.

**Architecture:** Single new module `photo_scanner/video_store.py` plus a Jinja template `photo_scanner/templates/video_shoot_plan.html`. Reuses existing `Catalog` (SQLite), `anthropic_auth` for credentials, and the same JSON-out-of-text parsing pattern used by `reports.py`. Six pipeline steps: extract shots → filter projects → triage each project → match shots → score location quality → rank + render. Caches that survive across runs are stored on the `projects` table (4 new columns) and in `tools/photo-scanner/.video_store_cache/<sha>.json` for the shot list.

**Tech Stack:** Python 3.11+, SQLite, `anthropic` SDK (async), `jinja2`, `argparse`. No new pip packages required. Tests use `pytest` + `pytest-asyncio` + `unittest.mock` matching existing patterns under `tools/photo-scanner/tests/`.

**Spec:** `docs/superpowers/specs/2026-05-07-video-store-design.md`

---

## File Structure

```
tools/photo-scanner/
├── photo_scanner/
│   ├── catalog.py                       # MODIFY — add 4 columns + helper methods (Task 1)
│   ├── video_store.py                   # CREATE — entire pipeline (Tasks 2-9)
│   └── templates/
│       └── video_shoot_plan.html        # CREATE — Jinja template (Task 8)
├── tests/
│   └── test_video_store.py              # CREATE — all unit tests (Tasks 1-10)
└── .video_store_cache/                  # auto-created at runtime (Task 3)
```

`video_store.py` is organized internally into clear sections with `# ==== Section: Name ====` headers so the engineer can navigate. If at any point a section grows past ~150 lines, split it out — but begin as one file matching the existing pattern (`client_export.py`, `report_project.py` are similarly single-file).

All new Anthropic calls use the existing constant:
```python
from photo_scanner.reports import ANTHROPIC_MODEL  # currently "claude-sonnet-4-20250514"
```

Run all commands and tests from `tools/photo-scanner/`:
```bash
cd tools/photo-scanner
python -m pytest tests/test_video_store.py -v
```

---

### Task 1: Catalog migration — add video-store columns

**Files:**
- Modify: `photo_scanner/catalog.py` (the `_create_tables` migration block, around lines 103-123)
- Test: `tests/test_video_store.py` (create file)

- [ ] **Step 1: Write the failing test**

Create `tests/test_video_store.py`:

```python
"""Tests for the video_store module."""
from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from photo_scanner.catalog import Catalog


@pytest.fixture
def catalog(tmp_path):
    db = Catalog(tmp_path / "test.db")
    yield db
    db.close()


def test_catalog_has_video_store_columns(catalog):
    cols = {r[1] for r in catalog.db.execute("PRAGMA table_info(projects)").fetchall()}
    assert "video_triage_json" in cols
    assert "video_triage_week" in cols
    assert "video_location_score_json" in cols
    assert "video_location_scored_at" in cols
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd tools/photo-scanner
python -m pytest tests/test_video_store.py::test_catalog_has_video_store_columns -v
```

Expected: FAIL with assertion error — none of the 4 columns exist yet.

- [ ] **Step 3: Add the migrations to `_create_tables`**

In `photo_scanner/catalog.py`, find the existing block of try/except migrations (the section that does `ALTER TABLE photos ADD COLUMN client_export_flags TEXT`). Append immediately after, before the `# daily_reports table` line:

```python
        # video_store columns on projects
        try:
            self.db.execute("SELECT video_triage_json FROM projects LIMIT 0")
        except sqlite3.OperationalError:
            self.db.execute("ALTER TABLE projects ADD COLUMN video_triage_json TEXT")
        try:
            self.db.execute("SELECT video_triage_week FROM projects LIMIT 0")
        except sqlite3.OperationalError:
            self.db.execute("ALTER TABLE projects ADD COLUMN video_triage_week TEXT")
        try:
            self.db.execute("SELECT video_location_score_json FROM projects LIMIT 0")
        except sqlite3.OperationalError:
            self.db.execute("ALTER TABLE projects ADD COLUMN video_location_score_json TEXT")
        try:
            self.db.execute("SELECT video_location_scored_at FROM projects LIMIT 0")
        except sqlite3.OperationalError:
            self.db.execute("ALTER TABLE projects ADD COLUMN video_location_scored_at TEXT")
```

- [ ] **Step 4: Add helper methods to `Catalog`**

After the existing `get_project_summary_data` method, add:

```python
    # --- Video store ---

    def set_video_triage(self, project_id: str, week_of: str, triage: dict):
        self.db.execute(
            "UPDATE projects SET video_triage_json = ?, video_triage_week = ? WHERE id = ?",
            (json.dumps(triage), week_of, project_id),
        )
        self.db.commit()

    def get_video_triage(self, project_id: str, week_of: str) -> dict | None:
        row = self.db.execute(
            "SELECT video_triage_json, video_triage_week FROM projects WHERE id = ?",
            (project_id,),
        ).fetchone()
        if not row or not row[0] or row[1] != week_of:
            return None
        return json.loads(row[0])

    def set_video_location_score(self, project_id: str, score: dict, scored_at: str):
        self.db.execute(
            "UPDATE projects SET video_location_score_json = ?, video_location_scored_at = ? WHERE id = ?",
            (json.dumps(score), scored_at, project_id),
        )
        self.db.commit()

    def get_video_location_score(self, project_id: str) -> dict | None:
        row = self.db.execute(
            "SELECT video_location_score_json FROM projects WHERE id = ?",
            (project_id,),
        ).fetchone()
        if not row or not row[0]:
            return None
        return json.loads(row[0])
```

- [ ] **Step 5: Add a test for the helper methods**

Append to `tests/test_video_store.py`:

```python
def test_video_triage_roundtrip(catalog):
    catalog.upsert_project({
        "id": "p1", "name": "Test", "address": "", "lat": 45.5, "lng": -122.6,
        "created_at": "", "photo_count": 0, "notepad": "",
    })
    triage = {"job_summary": "tearing off siding", "current_phase": "during"}
    catalog.set_video_triage("p1", "2026-05-11", triage)

    # Same week → returns triage
    assert catalog.get_video_triage("p1", "2026-05-11") == triage

    # Different week → cache miss
    assert catalog.get_video_triage("p1", "2026-05-18") is None


def test_video_location_score_roundtrip(catalog):
    catalog.upsert_project({
        "id": "p1", "name": "Test", "address": "", "lat": 45.5, "lng": -122.6,
        "created_at": "", "photo_count": 0, "notepad": "",
    })
    score = {"curb_appeal": 4, "wide_shot_room": 5, "landscaping": 3, "callouts": ["nice yard"]}
    catalog.set_video_location_score("p1", score, scored_at="2026-05-07T10:00:00")
    assert catalog.get_video_location_score("p1") == score
```

- [ ] **Step 6: Run all 3 tests to verify they pass**

```bash
python -m pytest tests/test_video_store.py -v
```

Expected: 3 PASS.

- [ ] **Step 7: Commit**

```bash
git add photo_scanner/catalog.py tests/test_video_store.py
git commit -m "feat(video-store): catalog migration + cache helpers"
```

---

### Task 2: Distance + activity filter

A pure function. No LLM. Establishes the project skeleton.

**Files:**
- Create: `photo_scanner/video_store.py`
- Test: `tests/test_video_store.py` (append)

- [ ] **Step 1: Write the failing test**

Append to `tests/test_video_store.py`:

```python
from photo_scanner import video_store


def test_haversine_portland_to_self():
    d = video_store.haversine_miles(45.5152, -122.6784, 45.5152, -122.6784)
    assert d == pytest.approx(0.0, abs=0.01)


def test_haversine_portland_to_gresham():
    # Gresham is ~13 miles east of Portland
    d = video_store.haversine_miles(45.5152, -122.6784, 45.5001, -122.4302)
    assert 11 < d < 15


def test_filter_active_local_projects(catalog):
    now = 1778400000  # 2026-05-07 ish
    week_ago = now - 5 * 86400

    # In-range, recently active
    catalog.upsert_project({"id": "p_local", "name": "Local",
                            "address": "Portland", "lat": 45.52, "lng": -122.68,
                            "created_at": "", "photo_count": 1, "notepad": ""})
    catalog.upsert_photo({"id": "ph1", "project_id": "p_local",
                          "uri": "x", "thumb_uri": "",
                          "taken_at": str(week_ago), "creator_name": ""})

    # In-range, no recent photos
    catalog.upsert_project({"id": "p_stale", "name": "Stale",
                            "address": "Portland", "lat": 45.51, "lng": -122.67,
                            "created_at": "", "photo_count": 1, "notepad": ""})
    catalog.upsert_photo({"id": "ph2", "project_id": "p_stale",
                          "uri": "x", "thumb_uri": "",
                          "taken_at": str(now - 60 * 86400), "creator_name": ""})

    # Out of range (Seattle)
    catalog.upsert_project({"id": "p_far", "name": "Far",
                            "address": "Seattle", "lat": 47.61, "lng": -122.33,
                            "created_at": "", "photo_count": 1, "notepad": ""})
    catalog.upsert_photo({"id": "ph3", "project_id": "p_far",
                          "uri": "x", "thumb_uri": "",
                          "taken_at": str(week_ago), "creator_name": ""})

    # Missing coords
    catalog.upsert_project({"id": "p_nocoord", "name": "NoCoord",
                            "address": "", "lat": 0, "lng": 0,
                            "created_at": "", "photo_count": 1, "notepad": ""})
    catalog.upsert_photo({"id": "ph4", "project_id": "p_nocoord",
                          "uri": "x", "thumb_uri": "",
                          "taken_at": str(week_ago), "creator_name": ""})

    results = video_store.filter_candidate_projects(
        catalog, max_distance_miles=20, now_ts=now, active_window_days=30
    )
    ids = {p["id"] for p in results}
    assert ids == {"p_local"}
    # distance is decorated onto the result
    assert results[0]["distance_miles"] < 1
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python -m pytest tests/test_video_store.py -v
```

Expected: FAIL — `module 'photo_scanner.video_store' has no attribute 'haversine_miles'`.

- [ ] **Step 3: Create `photo_scanner/video_store.py` with the filter logic**

```python
"""Video Store — Friday shoot-planning tool.

Given a video script document and the catalog, produce a ranked HTML shoot plan
for next Monday: which active CompanyCam projects within N miles of Portland are
likely to have the right work happening + visible conditions to film the shots.

See docs/superpowers/specs/2026-05-07-video-store-design.md.
"""
from __future__ import annotations

import math

from photo_scanner.catalog import Catalog

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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
python -m pytest tests/test_video_store.py -v
```

Expected: All tests PASS (5 total now).

- [ ] **Step 5: Commit**

```bash
git add photo_scanner/video_store.py tests/test_video_store.py
git commit -m "feat(video-store): distance + activity project filter"
```

---

### Task 3: Shot extractor — script doc → structured shot list (cached)

**Files:**
- Modify: `photo_scanner/video_store.py`
- Test: `tests/test_video_store.py` (append)

- [ ] **Step 1: Write the failing test**

Append to `tests/test_video_store.py`:

```python
SAMPLE_SCRIPT = """\
WHAT ARE SIGNS OF DRY ROT?
(NARRATOR)
Peeling paint, cracked caulking, soft or spongy wood, and discoloration around trim
or siding can all point to hidden moisture damage.    STILL IMAGES:
Peeling Paint
Cracked Caulking
Spongy Wood
Discolored Trim
You might also notice wood crumbling apart or feeling hollow when touched.
    CU: Touching Dry Rot Slow-Motion crumbling
"""


def _mock_anthropic_text_response(text: str):
    """Build a fake AsyncAnthropic.messages.create return value."""
    class _Block:
        def __init__(self, t): self.text = t
    class _Resp:
        def __init__(self, t): self.content = [_Block(t)]
    return _Resp(text)


@pytest.mark.asyncio
async def test_extract_shots_calls_anthropic_and_parses_json(tmp_path):
    extracted = {
        "scripts": [{
            "title": "What are signs of dry rot?",
            "narrator_summary": "Visual signs of dry rot.",
            "shots": [
                {"id": "dryrot-01", "category": "static_condition",
                 "description": "Peeling paint", "service": "dry-rot", "required_phase": None},
                {"id": "dryrot-02", "category": "in_progress_action",
                 "description": "Touching dry rot crumbling", "service": "dry-rot",
                 "required_phase": "during"},
            ],
        }]
    }
    fake_resp = _mock_anthropic_text_response(json.dumps(extracted))
    fake_client = AsyncMock()
    fake_client.messages.create = AsyncMock(return_value=fake_resp)

    cache_dir = tmp_path / ".cache"
    result = await video_store.extract_shots(
        SAMPLE_SCRIPT, anthropic_client=fake_client, cache_dir=cache_dir,
    )

    assert result == extracted
    assert fake_client.messages.create.called
    # Cache file written
    assert any(cache_dir.glob("*.json"))


@pytest.mark.asyncio
async def test_extract_shots_uses_cache_on_second_call(tmp_path):
    cached = {"scripts": []}
    cache_dir = tmp_path / ".cache"
    cache_dir.mkdir()
    import hashlib
    sha = hashlib.sha256(SAMPLE_SCRIPT.encode("utf-8")).hexdigest()
    (cache_dir / f"{sha}.json").write_text(json.dumps(cached))

    fake_client = AsyncMock()
    fake_client.messages.create = AsyncMock()
    result = await video_store.extract_shots(
        SAMPLE_SCRIPT, anthropic_client=fake_client, cache_dir=cache_dir,
    )

    assert result == cached
    assert not fake_client.messages.create.called  # cache hit


@pytest.mark.asyncio
async def test_extract_shots_force_refresh_skips_cache(tmp_path):
    cached = {"scripts": [{"title": "old"}]}
    fresh = {"scripts": [{"title": "new", "narrator_summary": "", "shots": []}]}
    cache_dir = tmp_path / ".cache"
    cache_dir.mkdir()
    import hashlib
    sha = hashlib.sha256(SAMPLE_SCRIPT.encode("utf-8")).hexdigest()
    (cache_dir / f"{sha}.json").write_text(json.dumps(cached))

    fake_resp = _mock_anthropic_text_response(json.dumps(fresh))
    fake_client = AsyncMock()
    fake_client.messages.create = AsyncMock(return_value=fake_resp)

    result = await video_store.extract_shots(
        SAMPLE_SCRIPT, anthropic_client=fake_client, cache_dir=cache_dir,
        force_refresh=True,
    )
    assert result == fresh
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
python -m pytest tests/test_video_store.py -v -k extract_shots
```

Expected: FAIL — `extract_shots` does not exist yet.

- [ ] **Step 3: Implement the extractor**

Append to `photo_scanner/video_store.py`:

```python
import hashlib
import json
import re
from pathlib import Path

from photo_scanner.reports import ANTHROPIC_MODEL


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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
python -m pytest tests/test_video_store.py -v -k extract_shots
```

Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add photo_scanner/video_store.py tests/test_video_store.py
git commit -m "feat(video-store): script shot extractor with content-hash cache"
```

---

### Task 4: Project triage — last-7-days summary + Monday prediction

**Files:**
- Modify: `photo_scanner/video_store.py`
- Test: `tests/test_video_store.py` (append)

- [ ] **Step 1: Write the failing test**

Append to `tests/test_video_store.py`:

```python
@pytest.fixture
def project_with_week_of_photos(catalog):
    """A project with daily photos progressing before → during over 5 days."""
    now = 1778400000
    catalog.upsert_project({
        "id": "p1", "name": "Bahar Residence",
        "address": "1234 NE Alberta St, Portland OR",
        "lat": 45.55, "lng": -122.65,
        "created_at": "", "photo_count": 7, "notepad": "5-day siding tear-off and replace",
    })
    timeline = [
        ("p1-d1-1", now - 6 * 86400, "before", ["siding"], "South elevation, intact rotted cedar siding visible"),
        ("p1-d1-2", now - 6 * 86400, "before", ["siding"], "Close-up of failed caulking and peeling paint"),
        ("p1-d2-1", now - 5 * 86400, "during", ["siding"], "Crew removing first run of cedar siding"),
        ("p1-d3-1", now - 4 * 86400, "during", ["siding", "dry-rot"], "Tear-off complete, sheathing exposed"),
        ("p1-d3-2", now - 4 * 86400, "during", ["dry-rot"], "Visible dry rot in sheathing at sill plate"),
        ("p1-d4-1", now - 3 * 86400, "during", ["dry-rot"], "Damaged sheathing being removed"),
        ("p1-d5-1", now - 2 * 86400, "during", ["siding"], "New sheathing installed, ready for moisture barrier"),
    ]
    for pid, ts, phase, services, scene in timeline:
        catalog.upsert_photo({
            "id": pid, "project_id": "p1",
            "uri": f"https://example.com/{pid}.jpg", "thumb_uri": "",
            "taken_at": str(ts), "creator_name": "Crew",
        })
        catalog.update_photo_analysis(pid, {
            "triage_status": "picked",
            "scene": scene,
            "service_types": services,
            "phase": phase,
            "entities": ["cedar siding", "sheathing"],
            "marketing_score": 4,
            "marketing_notes": "",
            "before_after_potential": True,
            "damage_details": {},
        })
    return catalog, "p1", now


@pytest.mark.asyncio
async def test_triage_project_calls_anthropic_and_caches(project_with_week_of_photos):
    catalog, project_id, now = project_with_week_of_photos
    week_of = "2026-05-11"

    triage_response = {
        "job_summary": "South-elevation siding tear-off; sheathing replacement underway.",
        "current_phase": "during",
        "predicted_monday": {
            "phase": "during",
            "work": "Continuing sheathing replacement, likely starting moisture barrier install.",
            "confidence": "high",
            "reasoning": "Steady daily progress; new sheathing installed Friday.",
        },
        "available_conditions": ["dry rot exposed", "rotted sheathing", "cedar siding removed"],
    }
    fake_resp = _mock_anthropic_text_response(json.dumps(triage_response))
    fake_client = AsyncMock()
    fake_client.messages.create = AsyncMock(return_value=fake_resp)

    result = await video_store.triage_project(
        catalog, project_id, week_of=week_of, now_ts=now,
        anthropic_client=fake_client,
    )

    assert result == triage_response
    assert fake_client.messages.create.called
    # Cached
    assert catalog.get_video_triage(project_id, week_of) == triage_response


@pytest.mark.asyncio
async def test_triage_project_uses_cache(project_with_week_of_photos):
    catalog, project_id, now = project_with_week_of_photos
    week_of = "2026-05-11"
    cached = {"job_summary": "cached", "current_phase": "before",
              "predicted_monday": {"phase": "during", "work": "", "confidence": "low", "reasoning": ""},
              "available_conditions": []}
    catalog.set_video_triage(project_id, week_of, cached)

    fake_client = AsyncMock()
    fake_client.messages.create = AsyncMock()
    result = await video_store.triage_project(
        catalog, project_id, week_of=week_of, now_ts=now,
        anthropic_client=fake_client,
    )

    assert result == cached
    assert not fake_client.messages.create.called


@pytest.mark.asyncio
async def test_triage_project_force_refresh(project_with_week_of_photos):
    catalog, project_id, now = project_with_week_of_photos
    week_of = "2026-05-11"
    catalog.set_video_triage(project_id, week_of, {"job_summary": "old"})

    fresh = {
        "job_summary": "fresh",
        "current_phase": "during",
        "predicted_monday": {"phase": "during", "work": "x", "confidence": "high", "reasoning": "y"},
        "available_conditions": [],
    }
    fake_resp = _mock_anthropic_text_response(json.dumps(fresh))
    fake_client = AsyncMock()
    fake_client.messages.create = AsyncMock(return_value=fake_resp)

    result = await video_store.triage_project(
        catalog, project_id, week_of=week_of, now_ts=now,
        anthropic_client=fake_client, force_refresh=True,
    )
    assert result == fresh
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
python -m pytest tests/test_video_store.py -v -k triage
```

Expected: FAIL — `triage_project` does not exist.

- [ ] **Step 3: Implement the triage**

Append to `photo_scanner/video_store.py`:

```python
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
        f"notepad: {project.get('notepad','')[:1000]}",
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
python -m pytest tests/test_video_store.py -v -k triage
```

Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add photo_scanner/video_store.py tests/test_video_store.py
git commit -m "feat(video-store): per-project triage with weekly cache"
```

---

### Task 5: Shot matcher — match shots to predicted Monday work

**Files:**
- Modify: `photo_scanner/video_store.py`
- Test: `tests/test_video_store.py` (append)

- [ ] **Step 1: Write the failing test**

Append to `tests/test_video_store.py`:

```python
@pytest.mark.asyncio
async def test_match_shots_returns_structured_matches():
    triage = {
        "job_summary": "tearing off siding",
        "current_phase": "during",
        "predicted_monday": {
            "phase": "during",
            "work": "Installing moisture barrier on south wall.",
            "confidence": "high", "reasoning": "",
        },
        "available_conditions": ["dry rot exposed", "rotted sheathing visible"],
    }
    shot_list = {"scripts": [{
        "title": "Signs of dry rot",
        "narrator_summary": "",
        "shots": [
            {"id": "dr-01", "category": "static_condition",
             "description": "Dry rot in sheathing", "service": "dry-rot", "required_phase": None},
            {"id": "dr-02", "category": "in_progress_action",
             "description": "Crew installing moisture barrier", "service": "dry-rot",
             "required_phase": "during"},
            {"id": "dr-03", "category": "establishing",
             "description": "Wide shot of home", "service": None, "required_phase": None},
        ],
    }]}
    recent_photos = [
        {"id": "ph-1", "scene": "Dry rot visible in exposed sheathing",
         "entities": ["dry rot", "sheathing"]},
    ]

    matches_payload = {"matches": [
        {"shot_id": "dr-01", "confidence": "high",
         "reason": "Sheathing rot exposed in recent photos.", "evidence_photo_id": "ph-1"},
        {"shot_id": "dr-02", "confidence": "high",
         "reason": "Predicted Monday work is moisture barrier install.",
         "evidence_photo_id": None},
        {"shot_id": "dr-03", "confidence": "medium",
         "reason": "Active site, presentable.", "evidence_photo_id": None},
    ]}
    fake_resp = _mock_anthropic_text_response(json.dumps(matches_payload))
    fake_client = AsyncMock()
    fake_client.messages.create = AsyncMock(return_value=fake_resp)

    result = await video_store.match_shots_for_project(
        triage=triage, shot_list=shot_list, recent_photos=recent_photos,
        anthropic_client=fake_client,
    )

    assert result == matches_payload
    # Verify the prompt included the photo IDs (so Claude can reference evidence)
    sent_msg = fake_client.messages.create.call_args.kwargs["messages"][0]["content"]
    assert "ph-1" in sent_msg
    assert "dr-01" in sent_msg
    assert "moisture barrier" in sent_msg
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python -m pytest tests/test_video_store.py -v -k match_shots
```

Expected: FAIL — `match_shots_for_project` does not exist.

- [ ] **Step 3: Implement the matcher**

Append to `photo_scanner/video_store.py`:

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
python -m pytest tests/test_video_store.py -v -k match_shots
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add photo_scanner/video_store.py tests/test_video_store.py
git commit -m "feat(video-store): shot matcher per project"
```

---

### Task 6: Location quality — vision call on best wide photos

**Files:**
- Modify: `photo_scanner/video_store.py`
- Test: `tests/test_video_store.py` (append)

- [ ] **Step 1: Write the failing test**

Append to `tests/test_video_store.py`:

```python
def test_select_wide_shot_photos_prefers_overview_then_score(catalog):
    catalog.upsert_project({"id": "p1", "name": "x", "address": "", "lat": 45.5, "lng": -122.6,
                            "created_at": "", "photo_count": 0, "notepad": ""})
    rows = [
        ("a", "during", 5),  # high score, not overview
        ("b", "overview", 3),  # overview, low score
        ("c", "overview", 5),  # overview, high score → best
        ("d", "before", 4),
    ]
    for pid, phase, score in rows:
        catalog.upsert_photo({"id": pid, "project_id": "p1",
                              "uri": f"u/{pid}", "thumb_uri": "",
                              "taken_at": "1778000000", "creator_name": ""})
        catalog.update_photo_analysis(pid, {
            "triage_status": "picked", "scene": "", "service_types": [],
            "phase": phase, "entities": [], "marketing_score": score,
            "marketing_notes": "", "before_after_potential": False,
            "damage_details": {},
        })

    picks = video_store.select_wide_shot_photos(catalog, "p1", limit=3)
    ids = [p["id"] for p in picks]
    # Overview photos first (highest score within overview), then non-overview by score
    assert ids[0] == "c"
    assert ids[1] == "b"
    assert "a" in ids  # highest non-overview score
    assert len(ids) == 3


@pytest.mark.asyncio
async def test_score_location_quality_calls_anthropic_with_images():
    project = {"id": "p1", "name": "x", "address": "", "lat": 45.5, "lng": -122.6}
    photos = [
        {"id": "ph1", "uri": "https://example.com/a.jpg", "thumb_uri": "", "scene": "wide front of house"},
    ]
    score_payload = {
        "curb_appeal": 4, "wide_shot_room": 5, "landscaping": 4,
        "callouts": ["Mature landscaping", "Clear sightline"],
    }
    fake_resp = _mock_anthropic_text_response(json.dumps(score_payload))
    fake_client = AsyncMock()
    fake_client.messages.create = AsyncMock(return_value=fake_resp)

    # Stub the photo-bytes fetch
    async def fake_fetch(uri):
        return b"\xff\xd8\xff\xd9"  # tiny fake JPEG bytes
    result = await video_store.score_location_quality(
        project=project, wide_photos=photos,
        anthropic_client=fake_client, fetch_bytes=fake_fetch,
    )

    assert result == score_payload
    # Verify the prompt sent includes image content blocks
    sent_msg = fake_client.messages.create.call_args.kwargs["messages"][0]["content"]
    image_blocks = [b for b in sent_msg if b.get("type") == "image"]
    assert len(image_blocks) == 1
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
python -m pytest tests/test_video_store.py -v -k "wide_shot or location_quality"
```

Expected: FAIL — neither function exists.

- [ ] **Step 3: Implement selection + scoring**

Append to `photo_scanner/video_store.py`:

```python
import base64

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


def select_wide_shot_photos(catalog: Catalog, project_id: str, limit: int = 3) -> list[dict]:
    """Pick up to `limit` photos best suited for location-quality scoring.
    Prefers phase=overview (highest marketing_score first), then top remaining
    photos by marketing_score.
    """
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
python -m pytest tests/test_video_store.py -v -k "wide_shot or location_quality"
```

Expected: 2 PASS.

- [ ] **Step 5: Commit**

```bash
git add photo_scanner/video_store.py tests/test_video_store.py
git commit -m "feat(video-store): vision-based location quality scoring"
```

---

### Task 7: Ranker — score formula + sort

**Files:**
- Modify: `photo_scanner/video_store.py`
- Test: `tests/test_video_store.py` (append)

- [ ] **Step 1: Write the failing test**

Append to `tests/test_video_store.py`:

```python
def test_score_project_combines_shots_and_quality():
    plan = {
        "matches": {"matches": [
            {"shot_id": "a", "confidence": "high", "reason": "", "evidence_photo_id": None},
            {"shot_id": "b", "confidence": "high", "reason": "", "evidence_photo_id": None},
            {"shot_id": "c", "confidence": "medium", "reason": "", "evidence_photo_id": None},
            {"shot_id": "d", "confidence": "low", "reason": "", "evidence_photo_id": None},
        ]},
        "location": {"curb_appeal": 4, "wide_shot_room": 5, "landscaping": 3, "callouts": []},
    }
    s = video_store.score_project(plan)
    # 2 high * 3 = 6, 1 med * 1 = 1, 1 low * 0.25 = 0.25, location = (4+5+3)*0.5 = 6
    assert s == pytest.approx(6 + 1 + 0.25 + 6)


def test_rank_projects_orders_by_score_then_curb_appeal_then_distance():
    plans = [
        {"project": {"id": "low_score", "distance_miles": 2},
         "matches": {"matches": [{"shot_id": "x", "confidence": "low",
                                  "reason": "", "evidence_photo_id": None}]},
         "location": {"curb_appeal": 5, "wide_shot_room": 5, "landscaping": 5, "callouts": []}},
        {"project": {"id": "high_score", "distance_miles": 18},
         "matches": {"matches": [{"shot_id": "x", "confidence": "high",
                                  "reason": "", "evidence_photo_id": None},
                                 {"shot_id": "y", "confidence": "high",
                                  "reason": "", "evidence_photo_id": None}]},
         "location": {"curb_appeal": 3, "wide_shot_room": 3, "landscaping": 3, "callouts": []}},
        {"project": {"id": "tie_a", "distance_miles": 5},
         "matches": {"matches": [{"shot_id": "x", "confidence": "medium",
                                  "reason": "", "evidence_photo_id": None}]},
         "location": {"curb_appeal": 4, "wide_shot_room": 4, "landscaping": 4, "callouts": []}},
        {"project": {"id": "tie_b", "distance_miles": 3},
         "matches": {"matches": [{"shot_id": "x", "confidence": "medium",
                                  "reason": "", "evidence_photo_id": None}]},
         "location": {"curb_appeal": 4, "wide_shot_room": 4, "landscaping": 4, "callouts": []}},
    ]
    ranked = video_store.rank_projects(plans)
    ids = [p["project"]["id"] for p in ranked]
    assert ids[0] == "high_score"
    # tie_a and tie_b have identical score+curb_appeal; tie_b is closer → before tie_a
    assert ids.index("tie_b") < ids.index("tie_a")
    assert ids[-1] == "low_score"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
python -m pytest tests/test_video_store.py -v -k "score_project or rank_projects"
```

Expected: FAIL.

- [ ] **Step 3: Implement ranking**

Append to `photo_scanner/video_store.py`:

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
python -m pytest tests/test_video_store.py -v -k "score_project or rank_projects"
```

Expected: 2 PASS.

- [ ] **Step 5: Commit**

```bash
git add photo_scanner/video_store.py tests/test_video_store.py
git commit -m "feat(video-store): project scoring and ranking"
```

---

### Task 8: HTML template + renderer

**Files:**
- Create: `photo_scanner/templates/video_shoot_plan.html`
- Modify: `photo_scanner/video_store.py`
- Test: `tests/test_video_store.py` (append)

- [ ] **Step 1: Write the failing test**

Append to `tests/test_video_store.py`:

```python
def test_render_report_produces_html_with_key_facts():
    ranked = [
        {
            "project": {"id": "p1", "name": "Bahar Residence",
                        "address": "1234 NE Alberta St, Portland OR",
                        "distance_miles": 3.2, "lat": 45.55, "lng": -122.65},
            "triage": {
                "job_summary": "South-elevation siding tear-off underway.",
                "current_phase": "during",
                "predicted_monday": {
                    "phase": "during",
                    "work": "Continuing sheathing replacement and starting moisture barrier.",
                    "confidence": "high",
                    "reasoning": "Steady daily progress.",
                },
                "available_conditions": ["dry rot exposed", "rotted sheathing"],
            },
            "matches": {"matches": [
                {"shot_id": "dr-01", "confidence": "high",
                 "reason": "Sheathing rot exposed in recent photos.",
                 "evidence_photo_id": "ph-1"},
                {"shot_id": "dr-02", "confidence": "high",
                 "reason": "Predicted Monday work is moisture barrier install.",
                 "evidence_photo_id": None},
            ]},
            "location": {"curb_appeal": 4, "wide_shot_room": 5, "landscaping": 4,
                         "callouts": ["Mature landscaping", "Clear sightline"]},
            "evidence_photos": {"ph-1": {"thumb_uri": "https://example.com/ph-1-t.jpg",
                                          "uri": "https://example.com/ph-1.jpg"}},
            "recent_phase_strip": [
                {"date": "2026-05-01", "phase": "before"},
                {"date": "2026-05-04", "phase": "during"},
                {"date": "2026-05-05", "phase": "during"},
            ],
        }
    ]
    shot_list = {"scripts": [{
        "title": "Signs of dry rot",
        "narrator_summary": "",
        "shots": [
            {"id": "dr-01", "category": "static_condition",
             "description": "Dry rot in sheathing", "service": "dry-rot", "required_phase": None},
            {"id": "dr-02", "category": "in_progress_action",
             "description": "Crew installing moisture barrier", "service": "dry-rot",
             "required_phase": "during"},
            {"id": "dr-03", "category": "establishing",
             "description": "Wide shot of home", "service": None, "required_phase": None},
        ],
    }]}

    html = video_store.render_report(
        ranked=ranked, shot_list=shot_list, week_of="2026-05-11",
        max_distance_miles=20,
    )
    # Header facts present
    assert "Week of" in html
    assert "2026-05-11" in html
    assert "1 project" in html or "1 projects" in html
    # Project card content
    assert "Bahar Residence" in html
    assert "1234 NE Alberta St" in html
    assert "3.2" in html  # distance
    assert "South-elevation siding tear-off" in html
    assert "moisture barrier" in html.lower()
    # Shot rows from both scripts
    assert "Dry rot in sheathing" in html
    assert "moisture barrier" in html.lower()
    # Script coverage shows 2/3 since dr-03 was not matched
    assert "2 / 3" in html or "2/3" in html
    # Address links to maps and zillow
    assert "google.com/maps" in html
    assert "zillow.com" in html
    # Callouts present
    assert "Mature landscaping" in html
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python -m pytest tests/test_video_store.py -v -k render_report
```

Expected: FAIL — `render_report` does not exist.

- [ ] **Step 3: Create the Jinja template**

Create `photo_scanner/templates/video_shoot_plan.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Video Shoot Plan — Week of {{ week_of }}</title>
<style>
  body { font-family: -apple-system, system-ui, Segoe UI, sans-serif;
         max-width: 1100px; margin: 0 auto; padding: 24px; color: #222; }
  h1 { margin: 0 0 4px 0; }
  .header-meta { color: #666; font-size: 14px; margin-bottom: 24px; }
  .summary { background: #f4f6f8; padding: 16px; border-radius: 8px; margin-bottom: 24px; }
  .summary h2 { margin-top: 0; font-size: 16px; }
  .script-cov { display: flex; align-items: center; gap: 8px; margin: 4px 0; font-size: 13px; }
  .script-cov .bar { flex: 1; height: 6px; background: #e0e4e8; border-radius: 3px; overflow: hidden; }
  .script-cov .bar > div { height: 100%; background: #2c7be5; }
  .project { border: 1px solid #e0e4e8; border-radius: 8px; padding: 16px;
             margin-bottom: 18px; }
  .project header { display: flex; align-items: center; flex-wrap: wrap;
                    gap: 12px; margin-bottom: 8px; }
  .project header .name { font-weight: 600; font-size: 18px; }
  .project header .meta { color: #666; font-size: 13px; }
  .project header .stars { color: #f0a000; }
  .links a { color: #2c7be5; text-decoration: none; margin-right: 8px; font-size: 13px; }
  .summary-line { font-size: 14px; line-height: 1.45; margin: 8px 0; }
  .pred { background: #fffbe5; padding: 10px 12px; border-radius: 6px;
          margin: 8px 0; font-size: 14px; }
  .pred .phase { display: inline-block; background: #2c7be5; color: white;
                 padding: 2px 8px; border-radius: 999px; font-size: 12px; margin-right: 6px; }
  .pill { display: inline-block; padding: 2px 8px; border-radius: 999px;
          font-size: 12px; font-weight: 600; }
  .pill.high { background: #d4edda; color: #155724; }
  .pill.medium { background: #fff3cd; color: #856404; }
  .pill.low { background: #f8d7da; color: #721c24; }
  .shot-group { margin: 8px 0; }
  .shot-group h4 { margin: 8px 0 4px 0; font-size: 13px; color: #444; }
  .shot { display: flex; align-items: flex-start; gap: 10px;
          padding: 6px 0; border-bottom: 1px dashed #eee; font-size: 13px; }
  .shot .thumb { width: 64px; height: 48px; object-fit: cover; border-radius: 4px; }
  .shot .body { flex: 1; }
  .shot .desc { font-weight: 500; }
  .shot .reason { color: #555; font-size: 12px; margin-top: 2px; }
  ul.callouts { margin: 4px 0 0 0; padding-left: 20px; font-size: 13px; }
  .strip { display: flex; gap: 4px; margin-top: 10px; }
  .strip .day { font-size: 11px; padding: 2px 6px; border-radius: 4px; background: #eee; color: #555; }
  .strip .day.before { background: #d4edda; color: #155724; }
  .strip .day.during { background: #fff3cd; color: #856404; }
  .strip .day.after  { background: #cfe2ff; color: #084298; }
  .strip .day.idle   { background: #f8d7da; color: #721c24; }
</style>
</head>
<body>

<h1>Video Shoot Plan</h1>
<div class="header-meta">
  Week of {{ week_of }} —
  {{ ranked|length }} project{{ '' if ranked|length == 1 else 's' }} •
  {{ total_matches }} matched shots •
  {{ scripts_with_coverage }} / {{ shot_list.scripts|length }} scripts covered •
  Within {{ max_distance_miles }} mi of Portland
</div>

<div class="summary">
  <h2>Script coverage</h2>
  {% for script in shot_list.scripts %}
    {% set cov = coverage_by_script.get(script.title, {"matched": 0, "total": script.shots|length}) %}
    <div class="script-cov">
      <div style="min-width: 240px;">{{ script.title }}</div>
      <div class="bar"><div style="width: {{ (100 * cov.matched / cov.total)|int if cov.total else 0 }}%"></div></div>
      <div>{{ cov.matched }} / {{ cov.total }}</div>
    </div>
  {% endfor %}
</div>

{% for plan in ranked %}
  {% set p = plan.project %}
  {% set t = plan.triage %}
  {% set loc = plan.location %}
  <div class="project">
    <header>
      <div class="name">{{ p.name }}</div>
      <div class="meta">{{ p.address }} • {{ "%.1f"|format(p.distance_miles) }} mi from PDX</div>
      <div class="stars">
        {% for _ in range(loc.curb_appeal) %}★{% endfor %}{% for _ in range(5 - loc.curb_appeal) %}☆{% endfor %}
      </div>
      <div class="links">
        <a target="_blank" href="https://www.google.com/maps/search/?api=1&query={{ p.lat }},{{ p.lng }}">Maps</a>
        <a target="_blank" href="https://www.zillow.com/homes/{{ p.address|urlencode }}_rb/">Zillow</a>
      </div>
    </header>

    <div class="summary-line">{{ t.job_summary }}</div>

    <div class="pred">
      <span class="phase">{{ t.predicted_monday.phase }}</span>
      <span class="pill {{ t.predicted_monday.confidence }}">{{ t.predicted_monday.confidence }} confidence</span>
      <div style="margin-top: 6px;">{{ t.predicted_monday.work }}</div>
    </div>

    {% for script in shot_list.scripts %}
      {% set script_matches = matches_by_script[p.id].get(script.title, []) %}
      {% if script_matches %}
        <div class="shot-group">
          <h4>{{ script.title }}</h4>
          {% for shot in script_matches %}
            <div class="shot">
              {% if shot.thumb_uri %}
                <img class="thumb" src="{{ shot.thumb_uri }}" alt="">
              {% endif %}
              <div class="body">
                <div class="desc">
                  <span class="pill {{ shot.confidence }}">{{ shot.confidence }}</span>
                  {{ shot.description }}
                </div>
                <div class="reason">{{ shot.reason }}</div>
              </div>
            </div>
          {% endfor %}
        </div>
      {% endif %}
    {% endfor %}

    {% if loc.callouts %}
      <ul class="callouts">
        {% for c in loc.callouts %}<li>{{ c }}</li>{% endfor %}
      </ul>
    {% endif %}

    {% if plan.recent_phase_strip %}
      <div class="strip">
        {% for d in plan.recent_phase_strip %}
          <div class="day {{ d.phase }}">{{ d.date[5:] }}</div>
        {% endfor %}
      </div>
    {% endif %}
  </div>
{% endfor %}

</body>
</html>
```

- [ ] **Step 4: Implement the renderer**

Append to `photo_scanner/video_store.py`:

```python
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
```

- [ ] **Step 5: Run test to verify it passes**

```bash
python -m pytest tests/test_video_store.py -v -k render_report
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add photo_scanner/video_store.py photo_scanner/templates/video_shoot_plan.html tests/test_video_store.py
git commit -m "feat(video-store): HTML report template + renderer"
```

---

### Task 9: CLI orchestration — `python -m photo_scanner.video_store`

Wires all the pieces together with argparse. Resolves `--week-of` to next Monday by default. Loads scripts (file or directory). Runs the pipeline.

**Files:**
- Modify: `photo_scanner/video_store.py`
- Test: `tests/test_video_store.py` (append)

- [ ] **Step 1: Write the failing test**

Append to `tests/test_video_store.py`:

```python
import datetime as _dt


def test_next_monday_from_thursday():
    thu = _dt.date(2026, 5, 7)  # Thursday
    assert video_store.next_monday(thu) == _dt.date(2026, 5, 11)


def test_next_monday_from_monday_returns_following_monday():
    mon = _dt.date(2026, 5, 11)
    assert video_store.next_monday(mon) == _dt.date(2026, 5, 18)


def test_next_monday_from_sunday():
    sun = _dt.date(2026, 5, 10)
    assert video_store.next_monday(sun) == _dt.date(2026, 5, 11)


def test_load_scripts_handles_file(tmp_path):
    p = tmp_path / "script.md"
    p.write_text("Some script content", encoding="utf-8")
    text = video_store.load_scripts(p)
    assert "Some script content" in text


def test_load_scripts_handles_directory(tmp_path):
    d = tmp_path / "scripts"
    d.mkdir()
    (d / "a.md").write_text("Script A", encoding="utf-8")
    (d / "b.md").write_text("Script B", encoding="utf-8")
    (d / "ignore.txt").write_text("Should be included too", encoding="utf-8")
    text = video_store.load_scripts(d)
    assert "Script A" in text
    assert "Script B" in text
    assert "Should be included too" in text
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
python -m pytest tests/test_video_store.py -v -k "next_monday or load_scripts"
```

Expected: FAIL.

- [ ] **Step 3: Implement helpers + CLI**

Append to `photo_scanner/video_store.py`:

```python
import argparse
import asyncio
import datetime as _dt
import os
import sys
import webbrowser

from photo_scanner.anthropic_auth import (
    describe_anthropic_auth,
    get_async_anthropic_client,
    load_project_env,
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
    except ValueError:
        return False
    return (_dt.datetime.now() - ts).days < days
```

- [ ] **Step 4: Implement the orchestration `run` + `main`**

Append to `photo_scanner/video_store.py`:

```python
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
    load_project_env()
    print(f"[video_store] Anthropic auth: {describe_anthropic_auth()}", file=sys.stderr)

    anthropic_client = get_async_anthropic_client()
    if not anthropic_client:
        print("[video_store] ERROR: no Anthropic auth configured.", file=sys.stderr)
        return 2

    # CompanyCam client is only needed if we have to fetch image bytes for vision.
    # Lazy-built because tests may run without the env var set.
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
    script_text = load_scripts(Path(script_path))
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

        triage = await triage_project(
            catalog, project["id"], week_of=week_of_iso, now_ts=now_ts,
            anthropic_client=anthropic_client, force_refresh=refresh_triage,
        )

        # Recent photos (with id, scene, entities) for matcher + evidence rendering
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
            wide_photos = select_wide_shot_photos(catalog, project["id"], limit=3)
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
    parser.add_argument("--refresh-shots", action="store_true")
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
```

- [ ] **Step 5: Run all tests to verify everything still passes**

```bash
python -m pytest tests/test_video_store.py -v
```

Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
git add photo_scanner/video_store.py tests/test_video_store.py
git commit -m "feat(video-store): CLI orchestration + week-of resolver"
```

---

### Task 10: End-to-end smoke test (mocked LLMs + CC)

Verify the full `run()` pipeline with all external calls mocked. Catches integration bugs without spending Anthropic tokens.

**Files:**
- Test: `tests/test_video_store.py` (append)

- [ ] **Step 1: Write the failing test**

Append to `tests/test_video_store.py`:

```python
@pytest.mark.asyncio
async def test_end_to_end_run_writes_report(tmp_path, monkeypatch):
    # Build a fake catalog under tmp_path. We point Catalog at this DB by setting
    # the working dir so its default path is tmp_path/catalog.db. Easier: pass
    # explicit db_path by monkeypatching Catalog().__init__'s default.
    db_path = tmp_path / "catalog.db"
    real_init = Catalog.__init__
    def patched_init(self, dbp=None):
        return real_init(self, dbp or db_path)
    monkeypatch.setattr(Catalog, "__init__", patched_init)

    cat = Catalog()
    now_ts = int(_dt.datetime.now().timestamp())

    cat.upsert_project({
        "id": "p1", "name": "Test Project",
        "address": "1234 NE Alberta St, Portland OR",
        "lat": 45.55, "lng": -122.65,
        "created_at": "", "photo_count": 1, "notepad": "",
    })
    cat.upsert_photo({"id": "ph1", "project_id": "p1",
                      "uri": "https://example.com/ph1.jpg", "thumb_uri": "",
                      "taken_at": str(now_ts - 3 * 86400), "creator_name": "Crew"})
    cat.update_photo_analysis("ph1", {
        "triage_status": "picked", "scene": "Dry rot in sheathing",
        "service_types": ["dry-rot"], "phase": "during",
        "entities": ["sheathing", "rot"], "marketing_score": 4,
        "marketing_notes": "", "before_after_potential": True, "damage_details": {},
    })
    cat.close()

    # Stub anthropic — different responses per pipeline step. Use call count.
    call_log = []
    async def fake_create(model, max_tokens, messages):
        # Inspect the prompt to decide which step we're in
        content = messages[0]["content"]
        text_content = content if isinstance(content, str) else " ".join(
            b.get("text", "") for b in content if isinstance(b, dict)
        )
        call_log.append(text_content[:80])
        if "extracting a structured shot list" in text_content:
            return _mock_anthropic_text_response(json.dumps({
                "scripts": [{"title": "Dry rot", "narrator_summary": "",
                             "shots": [
                                 {"id": "dr-01", "category": "static_condition",
                                  "description": "Dry rot in sheathing",
                                  "service": "dry-rot", "required_phase": None}
                             ]}]
            }))
        if "review" in text_content and "single construction job site" in text_content:
            return _mock_anthropic_text_response(json.dumps({
                "job_summary": "Active dry rot work",
                "current_phase": "during",
                "predicted_monday": {"phase": "during",
                                     "work": "Continuing repair",
                                     "confidence": "high", "reasoning": ""},
                "available_conditions": ["dry rot exposed"],
            }))
        if "matching a video shot list" in text_content:
            return _mock_anthropic_text_response(json.dumps({
                "matches": [
                    {"shot_id": "dr-01", "confidence": "high",
                     "reason": "Visible in recent photos.", "evidence_photo_id": "ph1"}
                ]
            }))
        # Vision call (location quality) — message is a list of blocks
        return _mock_anthropic_text_response(json.dumps({
            "curb_appeal": 4, "wide_shot_room": 4, "landscaping": 4,
            "callouts": ["Nice yard"]
        }))

    fake_anthropic = AsyncMock()
    fake_anthropic.messages.create = AsyncMock(side_effect=fake_create)
    monkeypatch.setattr(video_store, "get_async_anthropic_client", lambda: fake_anthropic)

    # Stub CompanyCamClient.get_photo_bytes to avoid real network
    class FakeCCClient:
        async def get_photo_bytes(self, uri):
            return b"\xff\xd8\xff\xd9"
    monkeypatch.setattr("photo_scanner.companycam.CompanyCamClient",
                        lambda token=None: FakeCCClient())
    monkeypatch.setenv("COMPANYCAM_API_TOKEN", "test")

    out = tmp_path / "plan.html"
    rc = await video_store.run(
        script_path=tmp_path / "script.md",
        week_of=_dt.date(2026, 5, 11),
        max_distance_miles=20.0,
        output_path=out,
        refresh_shots=False,
        refresh_quality=False,
        refresh_triage=False,
    )
    # Need a script file
    assert rc != 0  # we did not write the script yet, run should error gracefully

    (tmp_path / "script.md").write_text("dummy script", encoding="utf-8")
    rc = await video_store.run(
        script_path=tmp_path / "script.md",
        week_of=_dt.date(2026, 5, 11),
        max_distance_miles=20.0,
        output_path=out,
        refresh_shots=False,
        refresh_quality=False,
        refresh_triage=False,
    )
    assert rc == 0
    assert out.exists()
    html = out.read_text(encoding="utf-8")
    assert "Test Project" in html
    assert "Dry rot in sheathing" in html
    # Cache directory should now exist
    assert (Path(video_store.__file__).parent.parent / ".video_store_cache").exists()
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python -m pytest tests/test_video_store.py::test_end_to_end_run_writes_report -v
```

Expected: FAIL — likely because `run()` raises `FileNotFoundError` when the script doesn't exist, returning a non-zero rc differently than asserted, or because the run path doesn't catch the missing-script error gracefully.

- [ ] **Step 3: Make `run()` handle the missing-script case gracefully**

In `photo_scanner/video_store.py`, find the `# Step 1 — extract shots` block inside `run()` and wrap the load:

```python
    # Step 1 — extract shots
    try:
        script_text = load_scripts(Path(script_path))
    except FileNotFoundError as e:
        print(f"[video_store] ERROR: {e}", file=sys.stderr)
        return 2
```

- [ ] **Step 4: Run end-to-end test to verify it passes**

```bash
python -m pytest tests/test_video_store.py::test_end_to_end_run_writes_report -v
```

Expected: PASS.

- [ ] **Step 5: Run the full test suite one more time**

```bash
python -m pytest tests/test_video_store.py -v
```

Expected: All tests PASS (~17 total).

- [ ] **Step 6: Commit**

```bash
git add photo_scanner/video_store.py tests/test_video_store.py
git commit -m "feat(video-store): end-to-end smoke test + missing-script error handling"
```

---

### Task 11: README snippet for the new tool

Document the CLI so the editor can find it without reading the spec.

**Files:**
- Modify: `tools/photo-scanner/photo_scanner/__init__.py` (only if it has docs already; otherwise skip)
- Create or modify: `tools/photo-scanner/README.md`

- [ ] **Step 1: Check whether a README exists**

```bash
ls tools/photo-scanner/README.md 2>/dev/null || echo "no readme"
```

- [ ] **Step 2: Append (or create) a Video Store section**

Append to `tools/photo-scanner/README.md` (or create the file with this content if missing):

```markdown
## Video Store — Friday shoot planner

Generates a ranked HTML plan of which active CompanyCam projects are likely
to have the right work + visible conditions next Monday for filming the shots
in your video script document.

```bash
# From tools/photo-scanner/
python -m photo_scanner.video_store path/to/scripts.md

# Plan for a specific Monday (default = next Monday)
python -m photo_scanner.video_store path/to/scripts.md --week-of 2026-05-11

# Bigger radius
python -m photo_scanner.video_store path/to/scripts.md --max-distance 30

# Force re-extraction of the shot list (e.g., after editing the script)
python -m photo_scanner.video_store path/to/scripts.md --refresh-shots

# Force re-triage (default: cached per Monday)
python -m photo_scanner.video_store path/to/scripts.md --refresh-triage

# Force re-score location quality (default: cached for 14 days)
python -m photo_scanner.video_store path/to/scripts.md --refresh-quality
```

Output: `video_shoot_plan_<YYYY-MM-DD>.html` opens in your browser.
Caches: shot lists at `.video_store_cache/<sha>.json`; triage and location
quality on the `projects` table in `catalog.db`.

Spec: `docs/superpowers/specs/2026-05-07-video-store-design.md`
```

- [ ] **Step 3: Commit**

```bash
git add tools/photo-scanner/README.md
git commit -m "docs(video-store): README usage section"
```

---

## Self-Review

**Spec coverage check** (against `docs/superpowers/specs/2026-05-07-video-store-design.md`):

| Spec Section | Task |
|---|---|
| Architecture (single file + template + cache dir) | Tasks 2, 8 |
| 4 new project columns | Task 1 |
| CLI flags (`--week-of`, `--max-distance`, `--refresh-shots`, `--refresh-quality`, `--refresh-triage`, `--out`) | Task 9 |
| Pipeline Step 1 — extract shots, content-hash cache, three categories | Task 3 |
| Pipeline Step 2 — distance + activity filter | Task 2 |
| Pipeline Step 3 — per-project triage with weekly cache | Task 4 |
| Pipeline Step 4 — shot matcher with photo evidence index | Task 5 |
| Pipeline Step 5 — vision-based location quality (overview-first selection) | Task 6 |
| Pipeline Step 6 — rank + render | Tasks 7, 8 |
| Score formula | Task 7 |
| HTML report layout (header, script coverage bars, project cards, callouts, phase strip, maps/zillow links) | Task 8 |
| Caching: shot list, triage by week, location score by 14d freshness | Tasks 3, 4, 6, 9 |
| End-to-end orchestration | Task 9, smoked in Task 10 |
| Documentation | Task 11 |

No gaps.

**Placeholder scan:** No "TODO", "TBD", or "implement later" anywhere. Every step contains the actual code or command to run.

**Type consistency:** Function names, parameters, and JSON keys are consistent across tasks: `triage_project`, `match_shots_for_project`, `score_location_quality`, `score_project`, `rank_projects`, `render_report`, `next_monday`, `load_scripts`, `extract_shots`, `filter_candidate_projects`, `select_wide_shot_photos`. The plan dict shape `{project, triage, matches, location, evidence_photos, recent_phase_strip}` is used identically by tasks 7, 8, 9, 10. Match payload shape `{matches: [{shot_id, confidence, reason, evidence_photo_id}]}` is consistent. Triage payload shape `{job_summary, current_phase, predicted_monday: {phase, work, confidence, reasoning}, available_conditions}` is consistent.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-07-video-store.md`.** Auto mode is active, so I'm proceeding with subagent-driven execution unless the user redirects.

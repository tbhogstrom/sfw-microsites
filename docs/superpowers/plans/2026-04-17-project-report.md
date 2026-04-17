# Project Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate homeowner-facing project-level reports for analyzed CompanyCam projects, using a two-stage triage of photo grids to pick the 6 best photos that illustrate the report narrative.

**Architecture:** Add a `generate_project_report()` generator alongside the existing daily/weekly report generators in `reports.py`. Pipeline: (1) write narrative from `projects.summary` using a text-only Claude call; (2) build 3x3 photo grids of all score≥3 photos streamed from CompanyCam; (3) stage 1 grid triage scores each cell against the narrative; (4) stage 2 takes the top 12 finalists in 1-2 grids and picks the final 6 with captions. Persist to a new `project_reports` table; expose via CLI (`python -m photo_scanner.report_project <id>`) and a new "Project Reports" tab in the existing web UI.

**Tech Stack:** Python 3.14, FastAPI, SQLite (with FTS5), Pillow, anthropic SDK (async), httpx, pytest + pytest-asyncio, Jinja2, vanilla JS in the index template.

**Spec:** `docs/superpowers/specs/2026-04-17-project-report-design.md`

---

## File Structure

**Create:**
- `tools/photo-scanner/photo_scanner/grid_builder.py` — shared 3x3 contact-sheet builder with cell labels (used by both triage stages).
- `tools/photo-scanner/photo_scanner/report_project.py` — CLI entrypoint exposing `python -m photo_scanner.report_project <project_id>`.
- `tools/photo-scanner/photo_scanner/templates/project_report.html` — standalone HTML render of one project report.
- `tools/photo-scanner/tests/test_grid_builder.py` — unit tests for the grid builder.
- `tools/photo-scanner/tests/test_project_reports.py` — unit tests for catalog methods, narrative generator, finalist selection, fallback, end-to-end orchestration.

**Modify:**
- `tools/photo-scanner/photo_scanner/catalog.py` — add `project_reports` table + `save_project_report`, `get_project_report`, `list_project_reports` methods.
- `tools/photo-scanner/photo_scanner/reports.py` — add `generate_project_report` and the four pipeline-step helpers.
- `tools/photo-scanner/photo_scanner/server.py` — add 5 API routes + background task state for project reports.
- `tools/photo-scanner/photo_scanner/templates/index.html` — add third tab ("Project Reports") with picker, generate button, list/render of saved reports.

---

## Task 1: Add `project_reports` table + Catalog methods

**Files:**
- Modify: `tools/photo-scanner/photo_scanner/catalog.py` (add to `_create_tables`, add 3 methods)
- Test: `tools/photo-scanner/tests/test_project_reports.py` (new)

- [ ] **Step 1: Write the failing test for table existence and round-trip**

Create `tools/photo-scanner/tests/test_project_reports.py`:

```python
"""Tests for project report generation, storage, and pipeline helpers."""
import json
import pytest
from photo_scanner.catalog import Catalog


@pytest.fixture
def catalog(tmp_path):
    db = Catalog(tmp_path / "test.db")
    yield db
    db.close()


def test_project_reports_table_exists(catalog):
    tables = {r[0] for r in catalog.db.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    ).fetchall()}
    assert "project_reports" in tables


def test_save_and_get_project_report(catalog):
    catalog.upsert_project({
        "id": "p1", "name": "Test Project", "address": "123 Main St",
        "lat": 0, "lng": 0, "created_at": "", "photo_count": 0, "notepad": "",
    })
    report_data = {"headline": "Project Restoration Complete", "executive_summary": "Done."}
    new_id = catalog.save_project_report("p1", report_data, model="claude-sonnet-4-20250514")
    assert isinstance(new_id, int) and new_id > 0

    fetched = catalog.get_project_report(new_id)
    assert fetched is not None
    assert fetched["project_id"] == "p1"
    assert fetched["project_name"] == "Test Project"
    assert fetched["project_address"] == "123 Main St"
    assert fetched["model"] == "claude-sonnet-4-20250514"
    data = json.loads(fetched["report_data"])
    assert data["headline"] == "Project Restoration Complete"


def test_save_project_report_creates_history(catalog):
    """Each save creates a new row — no upsert."""
    catalog.upsert_project({
        "id": "p1", "name": "Test", "address": "", "lat": 0, "lng": 0,
        "created_at": "", "photo_count": 0, "notepad": "",
    })
    id1 = catalog.save_project_report("p1", {"headline": "v1"}, model="m1")
    id2 = catalog.save_project_report("p1", {"headline": "v2"}, model="m1")
    assert id1 != id2

    reports = catalog.list_project_reports(project_id="p1")
    assert len(reports) == 2
    # Newest first
    assert reports[0]["id"] == id2
    assert reports[1]["id"] == id1


def test_list_project_reports_latest_per_project(catalog):
    """Without project_id, return latest report per project."""
    for pid in ("p1", "p2"):
        catalog.upsert_project({
            "id": pid, "name": f"Project {pid}", "address": "", "lat": 0, "lng": 0,
            "created_at": "", "photo_count": 0, "notepad": "",
        })
    catalog.save_project_report("p1", {"headline": "p1 v1"}, model="m")
    catalog.save_project_report("p1", {"headline": "p1 v2"}, model="m")
    catalog.save_project_report("p2", {"headline": "p2 v1"}, model="m")

    latest = catalog.list_project_reports()
    assert len(latest) == 2
    headlines = {r["project_id"]: json.loads(r["report_data"])["headline"] for r in latest}
    assert headlines["p1"] == "p1 v2"
    assert headlines["p2"] == "p2 v1"


def test_get_project_report_missing(catalog):
    assert catalog.get_project_report(99999) is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd tools/photo-scanner && pytest tests/test_project_reports.py -v`
Expected: 5 FAILS — table missing, methods missing.

- [ ] **Step 3: Add table to `_create_tables` and the three methods**

In `tools/photo-scanner/photo_scanner/catalog.py`, after the `weekly_reports` table block in `_create_tables` (around line 129), add:

```python
        # project_reports table — one row per generation, history preserved
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS project_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id TEXT NOT NULL,
                report_data TEXT NOT NULL,
                generated_at TEXT NOT NULL,
                model TEXT
            )
        """)
        self.db.execute(
            "CREATE INDEX IF NOT EXISTS idx_project_reports_project ON project_reports(project_id)"
        )
```

Then, after the `get_weekly_reports` method (around line 239), add:

```python
    # --- Project Reports ---

    def save_project_report(self, project_id: str, report_data: dict, model: str = "") -> int:
        """Insert a new project report row. Returns the new row id."""
        now = datetime.now(timezone.utc).isoformat()
        cur = self.db.execute(
            """
            INSERT INTO project_reports (project_id, report_data, generated_at, model)
            VALUES (?, ?, ?, ?)
            """,
            (project_id, json.dumps(report_data), now, model),
        )
        self.db.commit()
        return cur.lastrowid

    def get_project_report(self, report_id: int) -> dict | None:
        row = self.db.execute(
            """
            SELECT pr.*, p.name AS project_name, p.address AS project_address
            FROM project_reports pr
            LEFT JOIN projects p ON pr.project_id = p.id
            WHERE pr.id = ?
            """,
            (report_id,),
        ).fetchone()
        return dict(row) if row else None

    def list_project_reports(self, project_id: str | None = None) -> list[dict]:
        """If project_id given: all reports for that project, newest first.
        Otherwise: latest report per project across all projects."""
        if project_id:
            rows = self.db.execute(
                """
                SELECT pr.*, p.name AS project_name, p.address AS project_address
                FROM project_reports pr
                LEFT JOIN projects p ON pr.project_id = p.id
                WHERE pr.project_id = ?
                ORDER BY pr.id DESC
                """,
                (project_id,),
            ).fetchall()
        else:
            rows = self.db.execute(
                """
                SELECT pr.*, p.name AS project_name, p.address AS project_address
                FROM project_reports pr
                LEFT JOIN projects p ON pr.project_id = p.id
                WHERE pr.id IN (
                    SELECT MAX(id) FROM project_reports GROUP BY project_id
                )
                ORDER BY pr.generated_at DESC
                """
            ).fetchall()
        return [dict(r) for r in rows]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd tools/photo-scanner && pytest tests/test_project_reports.py -v`
Expected: 5 PASS.

- [ ] **Step 5: Commit**

```bash
git -C "/c/Users/tfalcon/microsites" add tools/photo-scanner/photo_scanner/catalog.py tools/photo-scanner/tests/test_project_reports.py
git -C "/c/Users/tfalcon/microsites" commit -m "feat(photo-scanner): add project_reports table and catalog methods"
```

---

## Task 2: Build the labeled 3x3 grid utility

**Files:**
- Create: `tools/photo-scanner/photo_scanner/grid_builder.py`
- Test: `tools/photo-scanner/tests/test_grid_builder.py` (new)

- [ ] **Step 1: Write the failing tests**

Create `tools/photo-scanner/tests/test_grid_builder.py`:

```python
"""Tests for the labeled grid builder."""
import io
from PIL import Image
import pytest

from photo_scanner.grid_builder import build_labeled_grid, encode_grid_jpeg_b64


def _solid_image_bytes(color: tuple[int, int, int], size: int = 100) -> bytes:
    img = Image.new("RGB", (size, size), color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


def test_build_grid_full_3x3():
    cells = [_solid_image_bytes((i * 25, 100, 100)) for i in range(9)]
    grid = build_labeled_grid(cells, cell_size=128)
    assert grid.size == (128 * 3, 128 * 3)


def test_build_grid_partial_last_row():
    cells = [_solid_image_bytes((255, 0, 0)) for _ in range(5)]
    grid = build_labeled_grid(cells, cell_size=128)
    # Still 3x3 sized, missing cells stay as background
    assert grid.size == (128 * 3, 128 * 3)


def test_build_grid_skips_unreadable_bytes():
    cells = [_solid_image_bytes((0, 255, 0)), b"not-an-image", _solid_image_bytes((0, 0, 255))]
    # Should not raise — bad cells are silently skipped
    grid = build_labeled_grid(cells, cell_size=128)
    assert grid.size == (128 * 3, 128 * 3)


def test_encode_grid_jpeg_b64_returns_string():
    grid = Image.new("RGB", (256, 256), (10, 10, 10))
    encoded = encode_grid_jpeg_b64(grid)
    assert isinstance(encoded, str)
    assert len(encoded) > 100  # non-trivial output


def test_build_grid_raises_on_empty_input():
    with pytest.raises(ValueError):
        build_labeled_grid([], cell_size=128)


def test_build_grid_truncates_over_9_cells():
    cells = [_solid_image_bytes((i * 20, 0, 0)) for i in range(15)]
    grid = build_labeled_grid(cells, cell_size=128)
    assert grid.size == (128 * 3, 128 * 3)  # only first 9 used
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd tools/photo-scanner && pytest tests/test_grid_builder.py -v`
Expected: 6 FAILS — module missing.

- [ ] **Step 3: Implement the grid builder**

Create `tools/photo-scanner/photo_scanner/grid_builder.py`:

```python
"""Build labeled 3x3 contact-sheet grids from raw image bytes for vision triage."""
from __future__ import annotations

import base64
import io

from PIL import Image, ImageDraw, ImageFont

GRID_BG = (40, 40, 40)
LABEL_BG = (0, 0, 0, 180)
LABEL_FG = (255, 255, 255)


def _load_font(size: int = 22) -> ImageFont.ImageFont:
    try:
        return ImageFont.truetype("arial.ttf", size)
    except OSError:
        return ImageFont.load_default()


def build_labeled_grid(cells_bytes: list[bytes], cell_size: int = 256) -> Image.Image:
    """Compose up to 9 image bytes into a 3x3 grid with cell numbers 1-9 overlaid.

    Unreadable bytes are silently skipped (cell remains background).
    Inputs beyond the 9th are ignored. Empty input raises ValueError.
    """
    if not cells_bytes:
        raise ValueError("build_labeled_grid requires at least one cell")

    grid_px = cell_size * 3
    grid = Image.new("RGB", (grid_px, grid_px), GRID_BG)
    font = _load_font(max(16, cell_size // 12))

    for idx, raw in enumerate(cells_bytes[:9]):
        row, col = divmod(idx, 3)
        x, y = col * cell_size, row * cell_size
        try:
            with Image.open(io.BytesIO(raw)) as img:
                img = img.convert("RGB")
                img.thumbnail((cell_size, cell_size))
                ox = x + (cell_size - img.width) // 2
                oy = y + (cell_size - img.height) // 2
                grid.paste(img, (ox, oy))
        except Exception:
            # Bad bytes — leave the background in place
            pass

        # Draw cell label (1-indexed) in the top-left corner of each cell
        label = str(idx + 1)
        draw = ImageDraw.Draw(grid, "RGBA")
        pad = 4
        bbox = draw.textbbox((0, 0), label, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        draw.rectangle(
            [x + pad, y + pad, x + pad + tw + pad * 2, y + pad + th + pad * 2],
            fill=LABEL_BG,
        )
        draw.text((x + pad * 2, y + pad * 2), label, fill=LABEL_FG, font=font)

    return grid


def encode_grid_jpeg_b64(grid: Image.Image, quality: int = 85) -> str:
    """Return a base64-encoded JPEG of the grid, suitable for the Anthropic vision API."""
    buf = io.BytesIO()
    grid.save(buf, format="JPEG", quality=quality)
    return base64.b64encode(buf.getvalue()).decode()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd tools/photo-scanner && pytest tests/test_grid_builder.py -v`
Expected: 6 PASS.

- [ ] **Step 5: Commit**

```bash
git -C "/c/Users/tfalcon/microsites" add tools/photo-scanner/photo_scanner/grid_builder.py tools/photo-scanner/tests/test_grid_builder.py
git -C "/c/Users/tfalcon/microsites" commit -m "feat(photo-scanner): add labeled 3x3 grid builder utility"
```

---

## Task 3: Narrative-writing step (text-only Claude call)

**Files:**
- Modify: `tools/photo-scanner/photo_scanner/reports.py` (append at end)
- Test: `tools/photo-scanner/tests/test_project_reports.py` (append)

- [ ] **Step 1: Write the failing test**

Append to `tools/photo-scanner/tests/test_project_reports.py`:

```python
from unittest.mock import AsyncMock, MagicMock
from photo_scanner.reports import write_project_narrative


@pytest.fixture
def project_with_summary(catalog):
    catalog.upsert_project({
        "id": "p1", "name": "David Devore / Milwaukie Presbyterian",
        "address": "2416 SE Lake Rd, Milwaukie, OR",
        "lat": 0, "lng": 0, "created_at": "", "photo_count": 100, "notepad": "",
    })
    catalog.set_project_summary("p1", {
        "project_summary": "Comprehensive exterior restoration of a residential complex.",
        "scope_of_work": ["siding", "dry-rot", "windows"],
        "issues": [
            {"issue": "Paint failure on wood siding", "service_type": "siding",
             "resolution_status": "resolved",
             "documented_before": True, "documented_during": True, "documented_after": True},
            {"issue": "Dry rot at sill plates", "service_type": "dry-rot",
             "resolution_status": "in-progress",
             "documented_before": True, "documented_during": True, "documented_after": False},
        ],
        "coverage_assessment": {"documentation_quality": "good"},
    })
    return catalog


@pytest.mark.asyncio
async def test_write_project_narrative_returns_required_fields(project_with_summary):
    mock_text = json.dumps({
        "headline": "Exterior Restoration Substantially Complete",
        "executive_summary": "We completed comprehensive exterior restoration on the residential complex.",
        "scope_narrative": "The scope addressed siding replacement, dry rot, and windows.",
        "conditions_found": "We documented widespread paint failure and structural dry rot at the sills.",
        "work_performed": "Removed siding, replaced rotted framing, installed new siding.",
        "current_status": "Siding work resolved; dry rot remediation in progress at remaining elevations.",
        "value_statement": "These corrections protect the building envelope from further moisture intrusion.",
        "issues_summary": [
            {"issue": "Paint failure on wood siding", "service_type": "siding", "status": "resolved"},
            {"issue": "Dry rot at sill plates", "service_type": "dry-rot", "status": "in-progress"},
        ],
    })
    mock_anthropic = AsyncMock()
    mock_anthropic.messages.create = AsyncMock(
        return_value=MagicMock(content=[MagicMock(text=mock_text)])
    )

    narrative = await write_project_narrative(
        catalog=project_with_summary, project_id="p1", anthropic_client=mock_anthropic,
    )

    assert narrative["headline"]
    assert narrative["executive_summary"]
    assert narrative["work_performed"]
    assert narrative["value_statement"]
    assert len(narrative["issues_summary"]) == 2


@pytest.mark.asyncio
async def test_write_project_narrative_raises_without_summary(catalog):
    catalog.upsert_project({
        "id": "p1", "name": "No Summary", "address": "", "lat": 0, "lng": 0,
        "created_at": "", "photo_count": 0, "notepad": "",
    })
    mock_anthropic = AsyncMock()
    with pytest.raises(ValueError, match="no summary"):
        await write_project_narrative(
            catalog=catalog, project_id="p1", anthropic_client=mock_anthropic,
        )


@pytest.mark.asyncio
async def test_write_project_narrative_raises_for_unknown_project(catalog):
    mock_anthropic = AsyncMock()
    with pytest.raises(ValueError, match="not found"):
        await write_project_narrative(
            catalog=catalog, project_id="nonexistent", anthropic_client=mock_anthropic,
        )
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd tools/photo-scanner && pytest tests/test_project_reports.py -v -k narrative`
Expected: 3 FAILS — `write_project_narrative` not importable.

- [ ] **Step 3: Implement `write_project_narrative` and the project-report prompt**

Append to `tools/photo-scanner/photo_scanner/reports.py`:

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd tools/photo-scanner && pytest tests/test_project_reports.py -v -k narrative`
Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git -C "/c/Users/tfalcon/microsites" add tools/photo-scanner/photo_scanner/reports.py tools/photo-scanner/tests/test_project_reports.py
git -C "/c/Users/tfalcon/microsites" commit -m "feat(photo-scanner): add project report narrative writer"
```

---

## Task 4: Stage 1 — grid triage scoring helper

**Files:**
- Modify: `tools/photo-scanner/photo_scanner/reports.py`
- Test: `tools/photo-scanner/tests/test_project_reports.py` (append)

- [ ] **Step 1: Write the failing test**

Append to `tools/photo-scanner/tests/test_project_reports.py`:

```python
from photo_scanner.reports import score_grid_cells, select_finalists


@pytest.mark.asyncio
async def test_score_grid_cells_returns_per_cell_scores():
    mock_response = json.dumps({
        "scores": [
            {"cell": 1, "score": 5, "phase_match": "conditions", "note": "Clear before"},
            {"cell": 2, "score": 3, "phase_match": "conditions", "note": "Duplicate angle"},
            {"cell": 4, "score": 4, "phase_match": "work", "note": "Worker installing"},
        ]
    })
    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(
        return_value=MagicMock(content=[MagicMock(text=mock_response)])
    )

    fake_grid_b64 = "fakebase64data"
    narrative = {"headline": "Test", "work_performed": "Did the thing."}

    scored = await score_grid_cells(
        grid_b64=fake_grid_b64, narrative=narrative, anthropic_client=mock_client,
    )

    assert len(scored) == 3
    assert scored[0]["cell"] == 1
    assert scored[0]["score"] == 5


@pytest.mark.asyncio
async def test_score_grid_cells_returns_empty_on_parse_failure():
    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(
        return_value=MagicMock(content=[MagicMock(text="not json at all")])
    )
    scored = await score_grid_cells(
        grid_b64="x", narrative={"headline": "T"}, anthropic_client=mock_client,
    )
    assert scored == []


def test_select_finalists_picks_top_n_by_score():
    scored = [
        {"grid_idx": 0, "cell": 1, "photo_id": "a", "score": 5},
        {"grid_idx": 0, "cell": 2, "photo_id": "b", "score": 3},
        {"grid_idx": 0, "cell": 3, "photo_id": "c", "score": 4},
        {"grid_idx": 1, "cell": 1, "photo_id": "d", "score": 5},
        {"grid_idx": 1, "cell": 2, "photo_id": "e", "score": 2},
    ]
    finalists = select_finalists(scored, top_n=3)
    ids = [f["photo_id"] for f in finalists]
    assert ids == ["a", "d", "c"]


def test_select_finalists_returns_all_when_pool_smaller_than_n():
    scored = [
        {"grid_idx": 0, "cell": 1, "photo_id": "a", "score": 4},
        {"grid_idx": 0, "cell": 2, "photo_id": "b", "score": 3},
    ]
    finalists = select_finalists(scored, top_n=12)
    assert len(finalists) == 2
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd tools/photo-scanner && pytest tests/test_project_reports.py -v -k "score_grid_cells or select_finalists"`
Expected: 4 FAILS.

- [ ] **Step 3: Implement `score_grid_cells` and `select_finalists`**

Append to `tools/photo-scanner/photo_scanner/reports.py`:

```python
import asyncio

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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd tools/photo-scanner && pytest tests/test_project_reports.py -v -k "score_grid_cells or select_finalists"`
Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git -C "/c/Users/tfalcon/microsites" add tools/photo-scanner/photo_scanner/reports.py tools/photo-scanner/tests/test_project_reports.py
git -C "/c/Users/tfalcon/microsites" commit -m "feat(photo-scanner): add stage 1 grid triage scoring"
```

---

## Task 5: Stage 2 — finalist selection + captions + fallback

**Files:**
- Modify: `tools/photo-scanner/photo_scanner/reports.py`
- Test: `tools/photo-scanner/tests/test_project_reports.py` (append)

- [ ] **Step 1: Write the failing test**

Append to `tools/photo-scanner/tests/test_project_reports.py`:

```python
from photo_scanner.reports import pick_finalists_with_captions, finalist_score_fallback


@pytest.mark.asyncio
async def test_pick_finalists_with_captions_returns_six():
    mock_response = json.dumps({
        "picks": [
            {"cell": 1, "role": "conditions", "caption": "Paint failure exposing the substrate."},
            {"cell": 2, "role": "conditions", "caption": "Dry rot at the sill plate."},
            {"cell": 3, "role": "work", "caption": "Removing deteriorated siding."},
            {"cell": 4, "role": "work", "caption": "Installing new flashing detail."},
            {"cell": 5, "role": "status", "caption": "New siding installed and primed."},
            {"cell": 6, "role": "status", "caption": "Building envelope sealed at the south elevation."},
        ]
    })
    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(
        return_value=MagicMock(content=[MagicMock(text=mock_response)])
    )

    finalist_grids = [{"b64": "fake", "cell_to_photo_id": {1: "a", 2: "b", 3: "c", 4: "d", 5: "e", 6: "f"}}]
    narrative = {"headline": "Test", "work_performed": "Work."}

    picks = await pick_finalists_with_captions(
        finalist_grids=finalist_grids, narrative=narrative, anthropic_client=mock_client,
    )
    assert len(picks) == 6
    assert picks[0]["photo_id"] == "a"
    assert picks[0]["caption"]
    assert picks[0]["role"] == "conditions"


def test_finalist_score_fallback_assigns_roles_by_phase():
    finalists = [
        {"photo_id": "a", "score": 5, "phase": "before", "scene": "Before shot"},
        {"photo_id": "b", "score": 5, "phase": "before", "scene": "Another before"},
        {"photo_id": "c", "score": 4, "phase": "during", "scene": "During shot"},
        {"photo_id": "d", "score": 4, "phase": "during", "scene": "Another during"},
        {"photo_id": "e", "score": 4, "phase": "after", "scene": "After shot"},
        {"photo_id": "f", "score": 3, "phase": "after", "scene": "Another after"},
        {"photo_id": "g", "score": 2, "phase": "before", "scene": "Low score"},
    ]
    picks = finalist_score_fallback(finalists, count=6)
    assert len(picks) == 6
    roles = {p["role"] for p in picks}
    assert roles == {"conditions", "work", "status"}
    assert picks[0]["caption"] == "Before shot"  # caption defaults to scene


def test_finalist_score_fallback_handles_short_pool():
    finalists = [
        {"photo_id": "a", "score": 5, "phase": "before", "scene": "Only one"},
    ]
    picks = finalist_score_fallback(finalists, count=6)
    assert len(picks) == 1
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd tools/photo-scanner && pytest tests/test_project_reports.py -v -k "finalists_with_captions or score_fallback"`
Expected: 3 FAILS.

- [ ] **Step 3: Implement `pick_finalists_with_captions` and `finalist_score_fallback`**

Append to `tools/photo-scanner/photo_scanner/reports.py`:

```python
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
            # Currently treats finalist_grids as a single grid for ID mapping.
            # If we ever pass 2+ finalist grids, the prompt would need per-grid cell namespacing.
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd tools/photo-scanner && pytest tests/test_project_reports.py -v -k "finalists_with_captions or score_fallback"`
Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git -C "/c/Users/tfalcon/microsites" add tools/photo-scanner/photo_scanner/reports.py tools/photo-scanner/tests/test_project_reports.py
git -C "/c/Users/tfalcon/microsites" commit -m "feat(photo-scanner): add stage 2 finalist selection with score fallback"
```

---

## Task 6: Wire it all into `generate_project_report`

**Files:**
- Modify: `tools/photo-scanner/photo_scanner/reports.py`
- Test: `tools/photo-scanner/tests/test_project_reports.py` (append)

- [ ] **Step 1: Write the failing end-to-end test**

Append to `tools/photo-scanner/tests/test_project_reports.py`:

```python
from photo_scanner.reports import generate_project_report


@pytest.fixture
def project_with_photos(project_with_summary):
    """Add 4 analyzed photos at score >= 3 to the project_with_summary fixture."""
    cat = project_with_summary
    for i, (phase, score) in enumerate([("before", 5), ("before", 4), ("during", 5), ("after", 4)]):
        cat.upsert_photo({
            "id": f"ph{i}", "project_id": "p1",
            "uri": f"https://example.com/ph{i}.jpg", "thumb_uri": "",
            "taken_at": str(1775400000 + i * 100), "creator_name": "Alice",
        })
        cat.update_photo_analysis(f"ph{i}", {
            "triage_status": "picked", "scene": f"Photo {i} scene",
            "service_types": ["siding"], "phase": phase,
            "entities": ["wall"], "marketing_score": score,
            "marketing_notes": "Good shot", "before_after_potential": True,
            "damage_details": None,
        })
    return cat


@pytest.mark.asyncio
async def test_generate_project_report_e2e(project_with_photos, monkeypatch):
    """Full pipeline with mocked CompanyCam (returns dummy bytes) and Claude."""
    # Mock CompanyCam client
    mock_cc = AsyncMock()
    mock_cc.get_photo_bytes = AsyncMock(return_value=_solid_image_bytes_for_e2e())

    # Mock Claude — three different responses for the three call types
    narrative_text = json.dumps({
        "headline": "Restoration Substantially Complete",
        "executive_summary": "Exterior restoration completed.",
        "scope_narrative": "Siding and dry rot scope.",
        "conditions_found": "Documented paint failure and rot.",
        "work_performed": "Removed siding, addressed rot.",
        "current_status": "Siding addressed; rot remediation continuing.",
        "value_statement": "Building envelope is being restored.",
        "issues_summary": [],
    })
    score_text = json.dumps({
        "scores": [
            {"cell": 1, "score": 5, "phase_match": "conditions", "note": "x"},
            {"cell": 2, "score": 4, "phase_match": "conditions", "note": "x"},
            {"cell": 3, "score": 5, "phase_match": "work", "note": "x"},
            {"cell": 4, "score": 4, "phase_match": "status", "note": "x"},
        ]
    })
    finalist_text = json.dumps({
        "picks": [
            {"cell": 1, "role": "conditions", "caption": "Initial conditions documented."},
            {"cell": 2, "role": "conditions", "caption": "Rot exposed at the sill."},
            {"cell": 3, "role": "work", "caption": "New siding being installed."},
            {"cell": 4, "role": "status", "caption": "South elevation addressed."},
        ]
    })

    call_responses = [narrative_text, score_text, finalist_text]
    call_idx = {"i": 0}

    async def fake_create(**kwargs):
        idx = call_idx["i"]
        call_idx["i"] += 1
        text = call_responses[min(idx, len(call_responses) - 1)]
        return MagicMock(content=[MagicMock(text=text)])

    mock_anthropic = AsyncMock()
    mock_anthropic.messages.create = fake_create

    report = await generate_project_report(
        catalog=project_with_photos, project_id="p1",
        anthropic_client=mock_anthropic, cc_client=mock_cc,
    )

    assert report["headline"]
    assert report["executive_summary"]
    assert "photos" in report
    assert len(report["photos"]) >= 1  # 4 photos available, picks made
    assert report["photos"][0]["caption"]
    assert report["photos"][0]["role"] in ("conditions", "work", "status")
    assert "stats" in report
    assert report["stats"]["analyzed"] >= 4


def _solid_image_bytes_for_e2e() -> bytes:
    from PIL import Image
    import io
    img = Image.new("RGB", (200, 200), (50, 80, 120))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


@pytest.mark.asyncio
async def test_generate_project_report_partial_when_few_photos(project_with_summary, monkeypatch):
    """Project with no analyzed photos should still produce a report with partial=True."""
    mock_cc = AsyncMock()
    mock_anthropic = AsyncMock()
    mock_anthropic.messages.create = AsyncMock(
        return_value=MagicMock(content=[MagicMock(text=json.dumps({
            "headline": "h", "executive_summary": "x", "scope_narrative": "x",
            "conditions_found": "x", "work_performed": "x", "current_status": "x",
            "value_statement": "x", "issues_summary": [],
        }))])
    )
    report = await generate_project_report(
        catalog=project_with_summary, project_id="p1",
        anthropic_client=mock_anthropic, cc_client=mock_cc,
    )
    assert report["partial"] is True
    assert report["photos"] == []
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd tools/photo-scanner && pytest tests/test_project_reports.py -v -k generate_project_report`
Expected: 2 FAILS — `generate_project_report` not defined.

- [ ] **Step 3: Implement `generate_project_report`**

Append to `tools/photo-scanner/photo_scanner/reports.py`:

```python
from photo_scanner.grid_builder import build_labeled_grid, encode_grid_jpeg_b64

PHOTO_POOL_MIN_SCORE_PRIMARY = 3
PHOTO_POOL_MIN_SCORE_FALLBACK = 2
GRID_CELL_SIZE = 256
TOP_FINALISTS = 12
FINAL_PHOTO_COUNT = 6


def _phase_sort_key(p: dict) -> tuple:
    """Sort photos by phase order (before → during → after), then by taken_at."""
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
    async def fetch_one(photo: dict) -> tuple[str, bytes | None]:
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

    Returns the assembled report dict (also suitable for catalog.save_project_report).
    """
    # Step 1 — narrative (raises ValueError on missing project/summary)
    narrative = await write_project_narrative(catalog, project_id, anthropic_client)

    # Stats from the catalog (for the report header / partial flag)
    summary_stats = catalog.get_project_summary(project_id) or {}
    stats = {
        "total_photos": summary_stats.get("photos_synced", 0),
        "analyzed": summary_stats.get("photos_analyzed", 0),
        "phases": summary_stats.get("phases", {}),
    }

    # Step 2 — photo pool & grids
    pool = await _select_photo_pool(catalog, project_id)
    photo_lookup = {p["id"]: p for p in pool}
    if not pool:
        return {**narrative, "photos": [], "stats": stats, "partial": True}

    bytes_by_id = await _fetch_photo_bytes_concurrent(cc_client, pool)
    if not bytes_by_id:
        return {**narrative, "photos": [], "stats": stats, "partial": True}
    triage_grids = _build_triage_grids(pool, bytes_by_id)

    # Step 3 — stage 1 triage (grids run concurrently)
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

    # Step 4 — finalist grid + selection (single grid of up to 9 finalists for now)
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

    # Stage 2 fallback if Claude failed or returned nothing usable
    if not picks:
        picks = finalist_score_fallback(finalists, count=FINAL_PHOTO_COUNT)

    # Trim to FINAL_PHOTO_COUNT, attach phase from the catalog where missing
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
```

- [ ] **Step 4: Run all project-report tests to verify they pass**

Run: `cd tools/photo-scanner && pytest tests/test_project_reports.py -v`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git -C "/c/Users/tfalcon/microsites" add tools/photo-scanner/photo_scanner/reports.py tools/photo-scanner/tests/test_project_reports.py
git -C "/c/Users/tfalcon/microsites" commit -m "feat(photo-scanner): wire up generate_project_report orchestrator"
```

---

## Task 7: CLI entrypoint `python -m photo_scanner.report_project`

**Files:**
- Create: `tools/photo-scanner/photo_scanner/report_project.py`

- [ ] **Step 1: Implement the CLI module**

Create `tools/photo-scanner/photo_scanner/report_project.py`:

```python
"""CLI: python -m photo_scanner.report_project <project_id> [--output report.html] [--json out.json]

Generates a project-level homeowner report and saves it to the catalog.
Optionally writes a standalone HTML or JSON file to disk.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

from photo_scanner.anthropic_auth import (
    describe_anthropic_auth,
    get_async_anthropic_client,
    load_project_env,
)
from photo_scanner.catalog import Catalog
from photo_scanner.companycam import CompanyCamClient
from photo_scanner.reports import ANTHROPIC_MODEL, generate_project_report

TEMPLATES_DIR = Path(__file__).parent / "templates"


def _render_html(report: dict, project: dict) -> str:
    env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)))
    template = env.get_template("project_report.html")
    return template.render(
        report=report,
        project=project,
        report_json=json.dumps(report, indent=2),
    )


async def _run(project_id: str, output_html: Path | None, output_json: Path | None) -> int:
    load_project_env()
    print(f"[report_project] Anthropic auth: {describe_anthropic_auth()}", file=sys.stderr)

    catalog = Catalog()
    project = catalog.get_project(project_id)
    if not project:
        print(f"[report_project] ERROR: project {project_id!r} not found in catalog. Sync it first.",
              file=sys.stderr)
        return 2

    anthropic_client = get_async_anthropic_client()
    if not anthropic_client:
        print("[report_project] ERROR: no Anthropic auth configured.", file=sys.stderr)
        return 2

    import os
    cc_token = os.environ.get("COMPANYCAM_API_TOKEN", "")
    if not cc_token:
        print("[report_project] ERROR: COMPANYCAM_API_TOKEN not set in env/.env.", file=sys.stderr)
        return 2
    cc_client = CompanyCamClient(token=cc_token)

    print(f"[report_project] Generating report for {project['name']!r}...", file=sys.stderr)
    print(f"[report_project] Step 1: writing narrative", file=sys.stderr)
    try:
        report = await generate_project_report(
            catalog=catalog, project_id=project_id,
            anthropic_client=anthropic_client, cc_client=cc_client,
        )
    except ValueError as e:
        print(f"[report_project] ERROR: {e}", file=sys.stderr)
        return 2

    new_id = catalog.save_project_report(project_id, report, model=ANTHROPIC_MODEL)
    print(f"[report_project] Saved as project_reports.id = {new_id}", file=sys.stderr)
    print(f"[report_project] Headline: {report.get('headline','')}", file=sys.stderr)
    print(f"[report_project] Photos:   {len(report.get('photos', []))} (partial={report.get('partial')})",
          file=sys.stderr)

    if output_json:
        output_json.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(f"[report_project] Wrote JSON to {output_json}", file=sys.stderr)

    if output_html:
        html = _render_html(report, project)
        output_html.write_text(html, encoding="utf-8")
        print(f"[report_project] Wrote HTML to {output_html}", file=sys.stderr)

    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a project-level homeowner report.")
    parser.add_argument("project_id", help="CompanyCam project ID")
    parser.add_argument("--output", type=Path, default=None,
                        help="Optional: write standalone HTML to this path")
    parser.add_argument("--json", dest="output_json", type=Path, default=None,
                        help="Optional: write the raw report JSON to this path")
    args = parser.parse_args()
    rc = asyncio.run(_run(args.project_id, args.output, args.output_json))
    sys.exit(rc)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Verify the CLI parses args and shows usage**

Run: `cd tools/photo-scanner && python -m photo_scanner.report_project --help`
Expected: prints usage with `project_id`, `--output`, `--json`. Exits 0.

- [ ] **Step 3: Commit**

```bash
git -C "/c/Users/tfalcon/microsites" add tools/photo-scanner/photo_scanner/report_project.py
git -C "/c/Users/tfalcon/microsites" commit -m "feat(photo-scanner): add report_project CLI entrypoint"
```

---

## Task 8: HTML template `project_report.html`

**Files:**
- Create: `tools/photo-scanner/photo_scanner/templates/project_report.html`

- [ ] **Step 1: Create the template**

Create `tools/photo-scanner/photo_scanner/templates/project_report.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{ report.headline or 'Project Report' }} — {{ project.name }}</title>
<style>
  :root { --bg: #0a0a0a; --surface: #141414; --border: #2a2a2a; --text: #e5e5e5; --muted: #777; --accent: #3b82f6; --green: #22c55e; --yellow: #eab308; --orange: #f97316; --purple: #a78bfa; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: var(--bg); color: var(--text); padding: 24px; max-width: 980px; margin: 0 auto; line-height: 1.55; }
  .header { margin-bottom: 28px; padding-bottom: 18px; border-bottom: 1px solid var(--border); }
  .header h1 { font-size: 26px; font-weight: 700; margin-bottom: 6px; }
  .header .project-name { font-size: 14px; color: #aaa; }
  .header .project-address { font-size: 12px; color: var(--muted); margin-top: 2px; }
  .partial-flag { display: inline-block; margin-top: 8px; padding: 3px 10px; font-size: 11px; background: #f9731622; color: var(--orange); border: 1px solid #f9731644; border-radius: 4px; }
  .stats-bar { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
  .stat-box { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; min-width: 90px; }
  .stat-box .val { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .stat-box .label { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
  .section { margin-bottom: 28px; }
  .section h2 { font-size: 14px; font-weight: 600; color: var(--accent); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em; }
  .section p { color: #ddd; font-size: 14px; }
  .photo-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; margin-top: 14px; }
  .photo-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
  .photo-card img { width: 100%; height: 220px; object-fit: cover; display: block; background: #000; }
  .photo-card .caption { padding: 10px 12px; font-size: 12px; color: #ccc; }
  .photo-card .meta { padding: 0 12px 10px; font-size: 10px; color: var(--muted); }
  .value-statement { background: #3b82f614; border: 1px solid #3b82f644; border-radius: 8px; padding: 14px 16px; font-size: 14px; color: #cce6ff; }
  .issues-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .issues-table th, .issues-table td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border); }
  .issues-table th { color: var(--muted); font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; }
  .status-pill { display: inline-block; padding: 2px 8px; font-size: 10px; border-radius: 4px; }
  .status-pill.resolved { background: #22c55e22; color: var(--green); border: 1px solid #22c55e44; }
  .status-pill.in-progress { background: #eab30822; color: var(--yellow); border: 1px solid #eab30844; }
  .status-pill.documented-only { background: #ffffff10; color: var(--muted); border: 1px solid var(--border); }
</style>
</head>
<body>

<div class="header">
  <h1>{{ report.headline or 'Project Report' }}</h1>
  <div class="project-name">{{ project.name }}</div>
  <div class="project-address">{{ project.address }}</div>
  {% if report.partial %}<div class="partial-flag">Partial — fewer than 6 photos available</div>{% endif %}
</div>

{% if report.stats %}
<div class="stats-bar">
  <div class="stat-box"><div class="val">{{ report.stats.total_photos }}</div><div class="label">Photos</div></div>
  <div class="stat-box"><div class="val">{{ report.stats.analyzed }}</div><div class="label">Analyzed</div></div>
  {% if report.stats.phases.before %}<div class="stat-box"><div class="val">{{ report.stats.phases.before }}</div><div class="label">Before</div></div>{% endif %}
  {% if report.stats.phases.during %}<div class="stat-box"><div class="val">{{ report.stats.phases.during }}</div><div class="label">During</div></div>{% endif %}
  {% if report.stats.phases.after %}<div class="stat-box"><div class="val">{{ report.stats.phases.after }}</div><div class="label">After</div></div>{% endif %}
</div>
{% endif %}

{% if report.executive_summary %}
<div class="section"><h2>Executive Summary</h2><p>{{ report.executive_summary }}</p></div>
{% endif %}

{% if report.scope_narrative %}
<div class="section"><h2>Scope</h2><p>{{ report.scope_narrative }}</p></div>
{% endif %}

{% if report.conditions_found %}
<div class="section">
  <h2>Conditions Found</h2>
  <p>{{ report.conditions_found }}</p>
  {% set conditions_photos = report.photos | selectattr("role", "equalto", "conditions") | list %}
  {% if conditions_photos %}
  <div class="photo-grid">
    {% for p in conditions_photos %}
    <div class="photo-card">
      <img src="/api/photo/{{ p.photo_id }}/full" alt="{{ p.caption }}">
      <div class="caption">{{ p.caption }}</div>
      <div class="meta">{{ p.phase }}</div>
    </div>
    {% endfor %}
  </div>
  {% endif %}
</div>
{% endif %}

{% if report.work_performed %}
<div class="section">
  <h2>Work Performed</h2>
  <p>{{ report.work_performed }}</p>
  {% set work_photos = report.photos | selectattr("role", "equalto", "work") | list %}
  {% if work_photos %}
  <div class="photo-grid">
    {% for p in work_photos %}
    <div class="photo-card">
      <img src="/api/photo/{{ p.photo_id }}/full" alt="{{ p.caption }}">
      <div class="caption">{{ p.caption }}</div>
      <div class="meta">{{ p.phase }}</div>
    </div>
    {% endfor %}
  </div>
  {% endif %}
</div>
{% endif %}

{% if report.current_status %}
<div class="section">
  <h2>Current Status</h2>
  <p>{{ report.current_status }}</p>
  {% set status_photos = report.photos | selectattr("role", "equalto", "status") | list %}
  {% if status_photos %}
  <div class="photo-grid">
    {% for p in status_photos %}
    <div class="photo-card">
      <img src="/api/photo/{{ p.photo_id }}/full" alt="{{ p.caption }}">
      <div class="caption">{{ p.caption }}</div>
      <div class="meta">{{ p.phase }}</div>
    </div>
    {% endfor %}
  </div>
  {% endif %}
</div>
{% endif %}

{% if report.value_statement %}
<div class="section"><h2>What This Means for Your Property</h2><div class="value-statement">{{ report.value_statement }}</div></div>
{% endif %}

{% if report.issues_summary %}
<div class="section">
  <h2>Issues Summary</h2>
  <table class="issues-table">
    <thead><tr><th>Issue</th><th>Service</th><th>Status</th></tr></thead>
    <tbody>
      {% for issue in report.issues_summary %}
      <tr>
        <td>{{ issue.issue }}</td>
        <td>{{ issue.service_type }}</td>
        <td><span class="status-pill {{ issue.status }}">{{ issue.status }}</span></td>
      </tr>
      {% endfor %}
    </tbody>
  </table>
</div>
{% endif %}

</body>
</html>
```

- [ ] **Step 2: Render-test the template offline (no Claude calls)**

Run: `cd tools/photo-scanner && python -c "
from jinja2 import Environment, FileSystemLoader
env = Environment(loader=FileSystemLoader('photo_scanner/templates'))
t = env.get_template('project_report.html')
out = t.render(
    project={'name': 'Test', 'address': '123 St'},
    report={'headline': 'H', 'executive_summary': 'E', 'work_performed': 'W',
            'value_statement': 'V', 'photos': [], 'stats': {'total_photos': 1, 'analyzed': 1, 'phases': {}}, 'partial': False, 'issues_summary': []},
    report_json='{}',
)
assert '<title>H' in out and 'Test' in out
print('template renders OK, length=', len(out))
"`
Expected: prints `template renders OK, length= <number>`.

- [ ] **Step 3: Commit**

```bash
git -C "/c/Users/tfalcon/microsites" add tools/photo-scanner/photo_scanner/templates/project_report.html
git -C "/c/Users/tfalcon/microsites" commit -m "feat(photo-scanner): add project_report.html standalone template"
```

---

## Task 9: API routes in `server.py`

**Files:**
- Modify: `tools/photo-scanner/photo_scanner/server.py`

- [ ] **Step 1: Add background-task state and 5 routes**

Append to `tools/photo-scanner/photo_scanner/server.py` (after the existing daily/weekly route sections; place near `_report_task_state`):

```python
# --- Project Reports ---

_project_report_task_state: dict = {"status": "idle"}


@app.post("/api/reports/project/generate")
async def api_generate_project_report(request: Request):
    """Kick off project report generation in a background task."""
    global _project_report_task_state
    if not catalog:
        return JSONResponse({"error": "Catalog not initialized"}, status_code=503)
    if not cc_client:
        return JSONResponse({"error": "CompanyCam not configured"}, status_code=503)

    body = await request.json()
    project_id = body.get("project_id")
    if not project_id:
        return JSONResponse({"error": "project_id is required"}, status_code=400)

    project = catalog.get_project(project_id)
    if not project:
        return JSONResponse({"error": f"Project {project_id} not in catalog"}, status_code=404)

    summary = catalog.get_project_summary_data(project_id)
    if not summary:
        return JSONResponse(
            {"error": "Project has no summary — run analysis first"}, status_code=422
        )

    if _project_report_task_state.get("status") == "running":
        return JSONResponse(
            {"error": "Project report generation already running",
             "task": _project_report_task_state},
            status_code=409,
        )

    from photo_scanner.scanner import get_async_anthropic_client
    anthropic_client = get_async_anthropic_client()
    if not anthropic_client:
        return JSONResponse({"error": "Anthropic auth not configured"}, status_code=503)

    from photo_scanner.reports import ANTHROPIC_MODEL, generate_project_report

    _project_report_task_state = {
        "status": "running", "project_id": project_id,
        "project_name": project["name"], "step": "starting", "report_id": None,
    }

    async def run():
        global _project_report_task_state
        try:
            _project_report_task_state["step"] = "Generating report (narrative + triage + selection)"
            report = await generate_project_report(
                catalog=catalog, project_id=project_id,
                anthropic_client=anthropic_client, cc_client=cc_client,
            )
            new_id = catalog.save_project_report(project_id, report, model=ANTHROPIC_MODEL)
            _project_report_task_state["status"] = "complete"
            _project_report_task_state["step"] = f"Saved report id={new_id}"
            _project_report_task_state["report_id"] = new_id
        except ValueError as e:
            _project_report_task_state["status"] = "error"
            _project_report_task_state["step"] = str(e)
        except Exception as e:
            _project_report_task_state["status"] = "error"
            _project_report_task_state["step"] = f"Unexpected error: {e}"

    asyncio.create_task(run())
    return JSONResponse({"ok": True, "task": _project_report_task_state}, status_code=202)


@app.get("/api/reports/project/task")
async def api_project_report_task():
    return _project_report_task_state


@app.get("/api/reports/project/list")
async def api_list_project_reports(project_id: str | None = Query(None)):
    if not catalog:
        return JSONResponse({"error": "Catalog not initialized"}, status_code=503)
    rows = catalog.list_project_reports(project_id=project_id)
    out = []
    for r in rows:
        try:
            data = json.loads(r["report_data"])
        except Exception:
            data = {}
        out.append({
            "id": r["id"],
            "project_id": r["project_id"],
            "project_name": r.get("project_name"),
            "project_address": r.get("project_address"),
            "generated_at": r["generated_at"],
            "headline": data.get("headline", ""),
            "model": r.get("model"),
        })
    return {"reports": out}


@app.get("/api/reports/project/{report_id}")
async def api_get_project_report(report_id: int):
    if not catalog:
        return JSONResponse({"error": "Catalog not initialized"}, status_code=503)
    r = catalog.get_project_report(report_id)
    if not r:
        return JSONResponse({"error": "Report not found"}, status_code=404)
    try:
        report_data = json.loads(r["report_data"])
    except Exception:
        report_data = {}
    return {
        "id": r["id"],
        "project_id": r["project_id"],
        "project_name": r.get("project_name"),
        "project_address": r.get("project_address"),
        "generated_at": r["generated_at"],
        "model": r.get("model"),
        "report": report_data,
    }


@app.get("/reports/project/{report_id}", response_class=HTMLResponse)
async def render_project_report(report_id: int):
    if not catalog:
        return HTMLResponse("<h1>Catalog not initialized</h1>", status_code=503)
    r = catalog.get_project_report(report_id)
    if not r:
        return HTMLResponse("<h1>Report not found</h1>", status_code=404)
    try:
        report_data = json.loads(r["report_data"])
    except Exception:
        report_data = {}
    project = {"name": r.get("project_name") or "", "address": r.get("project_address") or ""}
    template = jinja_env.get_template("project_report.html")
    return template.render(
        report=report_data, project=project,
        report_json=json.dumps(report_data, indent=2),
    )
```

- [ ] **Step 2: Smoke-test the routes load**

Run: `cd tools/photo-scanner && python -c "from photo_scanner import server; routes = [r.path for r in server.app.routes]; print([p for p in routes if 'project' in p])"`
Expected: prints a list including `/api/reports/project/generate`, `/api/reports/project/task`, `/api/reports/project/list`, `/api/reports/project/{report_id}`, `/reports/project/{report_id}`.

- [ ] **Step 3: Commit**

```bash
git -C "/c/Users/tfalcon/microsites" add tools/photo-scanner/photo_scanner/server.py
git -C "/c/Users/tfalcon/microsites" commit -m "feat(photo-scanner): add project report API routes"
```

---

## Task 10: Web UI — "Project Reports" tab

**Files:**
- Modify: `tools/photo-scanner/photo_scanner/templates/index.html`

- [ ] **Step 1: Add the tab nav entry**

In `tools/photo-scanner/photo_scanner/templates/index.html`, find the line at ~447:

```html
<div class="nav-tab" data-section="weekly-reports" onclick="switchSection('weekly-reports')">Weekly Reports</div>
```

After it, add:

```html
<div class="nav-tab" data-section="project-reports" onclick="switchSection('project-reports')">Project Reports</div>
```

- [ ] **Step 2: Add the section markup**

Find the `<div id="section-weekly-reports" class="main-section">` block (~line 567). After its closing `</div>` (the section-level closing div, around line 580), insert:

```html
<div id="section-project-reports" class="main-section">
    <div class="section-header">
        <h2>Project Reports</h2>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <input type="search" id="project-report-search" placeholder="Search projects…"
                   style="background:#161b22;border:1px solid #30363d;border-radius:6px;padding:8px 12px;color:#ccc;font-size:13px;min-width:280px"
                   oninput="filterProjectReportPicker()">
            <select id="project-report-picker"
                    style="background:#161b22;border:1px solid #30363d;border-radius:6px;padding:8px 12px;color:#ccc;font-size:13px;min-width:280px">
                <option value="">— select an analyzed project —</option>
            </select>
            <button class="btn btn-primary" id="generate-project-report-btn" onclick="generateProjectReport()">Generate Project Report</button>
            <button class="btn" onclick="loadProjectReports()">Refresh</button>
            <span id="project-report-status" style="color:#888;font-size:12px"></span>
        </div>
    </div>
    <div id="project-reports-container"></div>
</div>
```

- [ ] **Step 3: Add the JS — picker init, generate, polling, render**

Find the `if (section === 'weekly-reports') initWeeklyReportsTab();` line (~1383). After it, add:

```javascript
    if (section === 'project-reports') initProjectReportsTab();
```

Then, at the end of the existing `<script>` block (after the daily/weekly report functions, before `</script>`), append:

```javascript
// --- Project Reports ---

let _projectReportProjectsCache = [];

async function initProjectReportsTab() {
    const picker = document.getElementById('project-report-picker');
    if (picker.options.length <= 1) {
        await loadProjectReportPicker();
    }
    loadProjectReports();
}

async function loadProjectReportPicker() {
    const picker = document.getElementById('project-report-picker');
    try {
        const data = await fetch('/api/companycam/projects?per_page=200').then(r => r.json());
        _projectReportProjectsCache = (data.projects || []).filter(p => p.last_analyzed);
        renderProjectReportPicker();
    } catch (e) {
        picker.innerHTML = '<option value="">— failed to load projects —</option>';
    }
}

function renderProjectReportPicker(filter = '') {
    const picker = document.getElementById('project-report-picker');
    const f = filter.trim().toLowerCase();
    const filtered = f
        ? _projectReportProjectsCache.filter(p => (p.name || '').toLowerCase().includes(f) || (p.address || '').toLowerCase().includes(f))
        : _projectReportProjectsCache;
    picker.innerHTML = '<option value="">— select an analyzed project —</option>' +
        filtered.map(p => `<option value="${p.id}">${escapeHtml(p.name)} (${escapeHtml(p.address || '')})</option>`).join('');
}

function filterProjectReportPicker() {
    const v = document.getElementById('project-report-search').value;
    renderProjectReportPicker(v);
}

function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function generateProjectReport() {
    const projectId = document.getElementById('project-report-picker').value;
    if (!projectId) { alert('Pick a project first'); return; }
    const btn = document.getElementById('generate-project-report-btn');
    const statusEl = document.getElementById('project-report-status');
    btn.disabled = true;
    statusEl.textContent = 'Starting…';
    try {
        const resp = await fetch('/api/reports/project/generate', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({project_id: projectId}),
        });
        const data = await resp.json();
        if (!resp.ok) {
            statusEl.textContent = 'Error: ' + (data.error || resp.status);
            btn.disabled = false;
            return;
        }
        await pollProjectReportTask(btn, statusEl);
    } catch (e) {
        statusEl.textContent = 'Error: ' + e.message;
        btn.disabled = false;
    }
}

async function pollProjectReportTask(btn, statusEl) {
    const interval = setInterval(async () => {
        try {
            const state = await fetch('/api/reports/project/task').then(r => r.json());
            statusEl.textContent = `${state.status}: ${state.step || ''}`;
            if (state.status === 'complete' || state.status === 'error') {
                clearInterval(interval);
                btn.disabled = false;
                if (state.status === 'complete') loadProjectReports();
            }
        } catch (e) {
            clearInterval(interval);
            btn.disabled = false;
            statusEl.textContent = 'Polling failed: ' + e.message;
        }
    }, 1500);
}

async function loadProjectReports() {
    const container = document.getElementById('project-reports-container');
    container.innerHTML = '<div style="color:#888;padding:20px">Loading…</div>';
    try {
        const data = await fetch('/api/reports/project/list').then(r => r.json());
        const reports = data.reports || [];
        if (reports.length === 0) {
            container.innerHTML = '<div style="text-align:center;color:#888;padding:40px">No project reports yet. Pick a project and click "Generate Project Report".</div>';
            return;
        }
        container.innerHTML = reports.map(r => `
            <div style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:14px;margin-bottom:10px">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
                    <div>
                        <div style="font-weight:600;font-size:14px">${escapeHtml(r.headline) || '(no headline)'}</div>
                        <div style="font-size:12px;color:#aaa">${escapeHtml(r.project_name || '')} — ${escapeHtml(r.project_address || '')}</div>
                        <div style="font-size:10px;color:#777;margin-top:4px">Generated ${escapeHtml(r.generated_at)} · model ${escapeHtml(r.model || '')}</div>
                    </div>
                    <div style="display:flex;gap:6px">
                        <a class="btn" target="_blank" href="/reports/project/${r.id}">Open</a>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (e) {
        container.innerHTML = `<div style="color:#f97316;padding:20px">Error: ${escapeHtml(e.message)}</div>`;
    }
}
```

- [ ] **Step 4: Smoke-test in browser**

Run the server (in a separate terminal):
`cd tools/photo-scanner && python -m photo_scanner.server`

Open `http://localhost:8000` (or whatever port it binds), click the **Project Reports** tab. Expected: tab loads, picker populates with analyzed projects, "No project reports yet" message shown until you generate one.

- [ ] **Step 5: Commit**

```bash
git -C "/c/Users/tfalcon/microsites" add tools/photo-scanner/photo_scanner/templates/index.html
git -C "/c/Users/tfalcon/microsites" commit -m "feat(photo-scanner): add Project Reports tab to web UI"
```

---

## Task 11: End-to-end run on the Milwaukie Presbyterian project

**Files:** none (manual verification + commit)

This task is the live test on the real project (`102316944` — David Devore / Milwaukie Presbyterian Church - Paint 04-06-2026). It uses real Claude + CompanyCam calls, so make sure `ANTHROPIC_API_KEY` (or Claude Code OAuth) and `COMPANYCAM_API_TOKEN` are configured in `tools/photo-scanner/.env`.

- [ ] **Step 1: Run the full test suite to confirm nothing regressed**

Run: `cd tools/photo-scanner && pytest -v`
Expected: all tests pass (existing + new project_reports + grid_builder).

- [ ] **Step 2: Generate the report via CLI and inspect output**

Run: `cd tools/photo-scanner && python -m photo_scanner.report_project 102316944 --output /c/Users/tfalcon/microsites/tools/photo-scanner/milwaukie-report.html --json /c/Users/tfalcon/microsites/tools/photo-scanner/milwaukie-report.json`
Expected: prints progress lines for the four pipeline steps. Final lines show `Saved as project_reports.id = N`, `Headline: ...`, `Photos: 6 (partial=False)`, and the two file paths. Exit code 0. Wall time roughly 60-180 seconds.

- [ ] **Step 3: Inspect the JSON output**

Open `tools/photo-scanner/milwaukie-report.json`. Verify it contains: `headline` (under 12 words, no severity adjectives, no "all repaired"), the seven narrative fields, `photos` (6 items each with `photo_id`/`caption`/`role`), `stats`, `partial: false`, `issues_summary` (covering the 9 documented issues).

- [ ] **Step 4: Open the HTML report in a browser**

Open `tools/photo-scanner/milwaukie-report.html` directly in a browser. Note that the `<img src="/api/photo/...">` URLs are relative, so they only load when served from the running FastAPI server — for the standalone HTML this is a known limitation (the photos won't display when opening the file directly; that's why the UI's "Open" button uses the server-rendered route instead).

Then start the server: `cd tools/photo-scanner && python -m photo_scanner.server`
Open the Project Reports tab → click "Open" on the Milwaukie report. Verify:
- Headline displays.
- All five narrative sections render in order.
- 6 photos load and are split sensibly into Conditions / Work / Status sections (2 each ideally; some flexibility OK).
- Captions are homeowner-facing, no severity adjectives, no completion language.
- Issues table renders with 9 rows colored by status.

- [ ] **Step 5: If the output is good, regenerate via the UI to confirm the UI flow**

In the Project Reports tab: pick the Milwaukie project from the picker → click "Generate Project Report". Watch the status text tick through the steps. When complete, the new report appears at the top of the list. Click "Open" — verify it renders the same way.

- [ ] **Step 6: Add `milwaukie-report.html` and `milwaukie-report.json` to `.gitignore`**

Append to `tools/photo-scanner/.gitignore`:

```
milwaukie-report.html
milwaukie-report.json
```

- [ ] **Step 7: Final commit**

```bash
git -C "/c/Users/tfalcon/microsites" add tools/photo-scanner/.gitignore
git -C "/c/Users/tfalcon/microsites" commit -m "chore(photo-scanner): ignore one-off project report outputs"
```

---

## Self-Review Notes

**Spec coverage check:**
- `project_reports` table + 3 catalog methods → Task 1 ✓
- `grid_builder.py` shared utility → Task 2 ✓
- Step 1 narrative writer → Task 3 ✓
- Step 2 photo pool + grid building → Task 6 (`_select_photo_pool`, `_fetch_photo_bytes_concurrent`, `_build_triage_grids`) ✓
- Step 3 stage 1 triage scoring → Task 4 (`score_grid_cells`, `select_finalists`) ✓
- Step 4 stage 2 finalist selection + captions → Task 5 (`pick_finalists_with_captions`, `finalist_score_fallback`) ✓
- Pipeline orchestrator → Task 6 (`generate_project_report`) ✓
- CLI entrypoint → Task 7 ✓
- 5 API routes → Task 9 ✓
- HTML template → Task 8 ✓
- Web UI tab → Task 10 ✓
- Error handling matrix from spec — covered: missing summary (Task 3 raises ValueError, Task 9 returns 422); few photos / fallback to score≥2 (Task 6 `_select_photo_pool`); stage 2 fallback (Task 6 calls `finalist_score_fallback`); 429 retry (Tasks 4 + 5 helpers); concurrent generation lock (Task 9 returns 409); partial flag (Task 6 sets it); photo fetch failures dropped (Task 6 `_fetch_photo_bytes_concurrent`).
- Tests from spec — all 7 listed test cases mapped: under-threshold finalists (Task 4 `test_select_finalists_returns_all_when_pool_smaller_than_n`), score-2 fallback (covered by `_select_photo_pool` logic, exercised by `test_generate_project_report_partial_when_few_photos`), partial-grid handling (Task 2 `test_build_grid_partial_last_row`), partial flag (Task 6 `test_generate_project_report_partial_when_few_photos`), no-summary error (Task 3 `test_write_project_narrative_raises_without_summary`), save/load round-trip (Task 1 `test_save_and_get_project_report`), e2e pipeline (Task 6 `test_generate_project_report_e2e`).

**Type consistency:** `score_grid_cells` returns `[{cell, score, phase_match, note}]`. The orchestrator wraps these into `[{grid_idx, cell, photo_id, score, phase_match, phase, scene}]` for `select_finalists`, then `finalists` are passed into both `pick_finalists_with_captions` (which only uses `photo_id` for cell mapping via `finalist_grids[*].cell_to_photo_id`) and `finalist_score_fallback` (which uses `photo_id`, `score`, `phase`, `scene`). Consistent.

**No placeholders.** Every step contains the actual content needed.

---

## Notes for the Implementer

- Existing daily/weekly reports use `claude-sonnet-4-20250514` via the `ANTHROPIC_MODEL` constant in `reports.py`. The project report reuses that constant — no model bump in this plan.
- The catalog uses string Unix timestamps in the `taken_at` column (cast to INTEGER for arithmetic). If you sort by `taken_at`, cast to int.
- Grid cell labels are 1-indexed throughout the prompts and the `cell_to_photo_id` mapping. Don't use 0-indexed cells.
- The stage 2 finalist grid currently caps at 9 photos (one 3x3 grid). If you raise `TOP_FINALISTS` above 9 and want stage 2 to see more candidates, you'd need per-grid cell namespacing in the prompt and the `cell_to_photo_id` map (e.g., `cell="A3"`). Out of scope for this plan — note left in `pick_finalists_with_captions`.
- The standalone HTML file written by `--output` references photos via `/api/photo/{id}/full` which only works when the FastAPI server is running. This is documented in Task 11 Step 4. If you need a fully self-contained HTML for emailing, that's a separate enhancement (embed images as base64).

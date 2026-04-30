# Client Photo Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Client Photo Export" feature to the existing `tools/photo-scanner` so an SFW operator can pick a CompanyCam project, auto-filter documents and AI-flag photos that may not be appropriate to send a customer, manually exclude any further unsuitable photos, and download the rest as a date-organized zip.

**Architecture:** Pure extension of `tools/photo-scanner`. Two new columns on the `photos` table and one new `client_export_selections` table. A new `client_export.py` module holds the AI pass and the zip builder. New FastAPI routes (`/client-export*`) added to the existing `server.py`. Two new Jinja templates (picker + review). Vanilla JS for click-to-toggle and progress polling.

**Tech Stack:** Python 3.11+, FastAPI, SQLite (via existing `Catalog`), Anthropic SDK, Pillow (already a dep), Jinja2, vanilla JS, `zipfile.ZipFile` for streaming, pytest + pytest-asyncio for tests.

**Spec reference:** `docs/superpowers/specs/2026-04-30-client-photo-export-design.md`

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `tools/photo-scanner/photo_scanner/catalog.py` | modify | Add 2 columns + 1 table migration; add 5 selection helpers |
| `tools/photo-scanner/photo_scanner/client_export.py` | create | Prompt, per-photo AI call, batch orchestration, zip builder |
| `tools/photo-scanner/photo_scanner/server.py` | modify | 6 new routes under `/client-export` |
| `tools/photo-scanner/photo_scanner/templates/client_export_index.html` | create | Project picker page |
| `tools/photo-scanner/photo_scanner/templates/client_export_review.html` | create | Photo review grid + export button |
| `tools/photo-scanner/tests/test_client_export.py` | create | Tests for catalog migrations, helpers, AI parser, zip filename derivation, selection-set logic |

`server.py` already exceeds 1500 lines but follows a flat route-handler pattern, so we follow the same convention. The pure functions (AI prompt parsing, zip filename derivation, selection-set computation) live in `client_export.py` so they're testable in isolation.

---

## Task 1: Catalog migrations — `client_export_status` and `client_export_flags` columns

**Files:**
- Modify: `tools/photo-scanner/photo_scanner/catalog.py`
- Test: `tools/photo-scanner/tests/test_client_export.py`

**Why TDD:** the migration block in `catalog.py` uses a try/except pattern that's easy to copy-paste wrong. A test that opens a fresh DB, then opens an *existing* DB without these columns, catches both regressions.

- [ ] **Step 1: Write the failing test**

Create `tools/photo-scanner/tests/test_client_export.py` with:

```python
"""Tests for client export catalog migrations, helpers, AI parser, zip helpers."""
import json
import sqlite3
import pytest
from pathlib import Path

from photo_scanner.catalog import Catalog


@pytest.fixture
def catalog(tmp_path):
    db = Catalog(tmp_path / "test.db")
    yield db
    db.close()


def test_photos_has_client_export_columns(catalog):
    """photos table has client_export_status and client_export_flags columns."""
    cols = {row[1] for row in catalog.db.execute("PRAGMA table_info(photos)")}
    assert "client_export_status" in cols
    assert "client_export_flags" in cols


def test_migration_adds_columns_to_existing_db(tmp_path):
    """Opening a Catalog against a DB created before these columns existed adds them."""
    db_path = tmp_path / "legacy.db"
    # Build a legacy schema by hand — same shape minus the new columns.
    conn = sqlite3.connect(str(db_path))
    conn.executescript("""
        CREATE TABLE photos (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            uri TEXT NOT NULL,
            thumb_uri TEXT DEFAULT '',
            taken_at TEXT DEFAULT '',
            creator_name TEXT DEFAULT '',
            triage_status TEXT,
            scene TEXT
        );
    """)
    conn.commit()
    conn.close()

    cat = Catalog(db_path)
    cols = {row[1] for row in cat.db.execute("PRAGMA table_info(photos)")}
    assert "client_export_status" in cols
    assert "client_export_flags" in cols
    cat.close()
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd tools/photo-scanner
pytest tests/test_client_export.py::test_photos_has_client_export_columns -v
```

Expected: FAIL — column does not exist on the `photos` table yet.

- [ ] **Step 3: Add the migration to `catalog.py`**

In `_create_tables` of `catalog.py`, add the new columns to the `CREATE TABLE photos` block (insert after the existing `damage_details` line near line 52):

```python
            damage_details TEXT,
            client_export_status TEXT,
            client_export_flags TEXT
        );
```

Then in the migrations area (after the `description` migration, around line 110), append:

```python
        try:
            self.db.execute("SELECT client_export_status FROM photos LIMIT 0")
        except sqlite3.OperationalError:
            self.db.execute("ALTER TABLE photos ADD COLUMN client_export_status TEXT")
        try:
            self.db.execute("SELECT client_export_flags FROM photos LIMIT 0")
        except sqlite3.OperationalError:
            self.db.execute("ALTER TABLE photos ADD COLUMN client_export_flags TEXT")
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_client_export.py -v
```

Expected: both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/photo-scanner/photo_scanner/catalog.py tools/photo-scanner/tests/test_client_export.py
git commit -m "feat(photo-scanner): add client_export columns to photos table"
```

---

## Task 2: Catalog migration — `client_export_selections` table + helper methods

**Files:**
- Modify: `tools/photo-scanner/photo_scanner/catalog.py`
- Test: `tools/photo-scanner/tests/test_client_export.py`

The selections table only stores rows when the curator has explicitly toggled a photo. The helpers we need:

- `get_selection(project_id, photo_id) -> bool | None` — True/False if a row exists, None otherwise.
- `set_selection(project_id, photo_id, included: bool)` — upsert.
- `get_excluded_photo_ids(project_id) -> set[str]` — every photo id the curator explicitly excluded.

- [ ] **Step 1: Write the failing test**

Append to `tests/test_client_export.py`:

```python
def test_client_export_selections_table_exists(catalog):
    cursor = catalog.db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='client_export_selections'"
    )
    assert cursor.fetchone() is not None


def test_set_and_get_selection(catalog):
    catalog.set_selection("p1", "photo-a", included=False)
    assert catalog.get_selection("p1", "photo-a") is False

    catalog.set_selection("p1", "photo-a", included=True)
    assert catalog.get_selection("p1", "photo-a") is True

    assert catalog.get_selection("p1", "photo-missing") is None


def test_get_excluded_photo_ids(catalog):
    catalog.set_selection("p1", "a", included=False)
    catalog.set_selection("p1", "b", included=True)
    catalog.set_selection("p1", "c", included=False)
    catalog.set_selection("p2", "x", included=False)  # different project — must not leak

    excluded = catalog.get_excluded_photo_ids("p1")
    assert excluded == {"a", "c"}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_client_export.py -v
```

Expected: the three new tests FAIL — table and methods don't exist.

- [ ] **Step 3: Add the table to `_create_tables`**

In `catalog.py`, in the same `executescript` block, add:

```python
            CREATE TABLE IF NOT EXISTS client_export_selections (
                project_id TEXT NOT NULL,
                photo_id TEXT NOT NULL,
                included INTEGER NOT NULL,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (project_id, photo_id)
            );
```

Place it after the existing `project_reports` index, before the closing `"""`.

- [ ] **Step 4: Add the three helper methods**

At the bottom of the `Catalog` class in `catalog.py`, add a new section:

```python
    # --- Client export selections ---

    def set_selection(self, project_id: str, photo_id: str, included: bool):
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()
        self.db.execute(
            """
            INSERT INTO client_export_selections (project_id, photo_id, included, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(project_id, photo_id) DO UPDATE SET
                included = excluded.included,
                updated_at = excluded.updated_at
            """,
            (project_id, photo_id, 1 if included else 0, now),
        )
        self.db.commit()

    def get_selection(self, project_id: str, photo_id: str) -> bool | None:
        row = self.db.execute(
            "SELECT included FROM client_export_selections WHERE project_id = ? AND photo_id = ?",
            (project_id, photo_id),
        ).fetchone()
        if row is None:
            return None
        return bool(row[0])

    def get_excluded_photo_ids(self, project_id: str) -> set[str]:
        rows = self.db.execute(
            "SELECT photo_id FROM client_export_selections WHERE project_id = ? AND included = 0",
            (project_id,),
        ).fetchall()
        return {r[0] for r in rows}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pytest tests/test_client_export.py -v
```

Expected: all five tests PASS.

- [ ] **Step 6: Commit**

```bash
git add tools/photo-scanner/photo_scanner/catalog.py tools/photo-scanner/tests/test_client_export.py
git commit -m "feat(photo-scanner): add client_export_selections table + helpers"
```

---

## Task 3: Pure helpers — JSON parser, zip filename derivation, export-set computation

**Files:**
- Create: `tools/photo-scanner/photo_scanner/client_export.py`
- Test: `tools/photo-scanner/tests/test_client_export.py`

These are the easy-to-test pure functions that the AI orchestration and zip endpoint depend on.

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_client_export.py`:

```python
from photo_scanner import client_export


def test_parse_safety_response_ok():
    text = '{"ok": true, "flags": [], "notes": ""}'
    result = client_export.parse_safety_response(text)
    assert result == {"ok": True, "flags": [], "notes": ""}


def test_parse_safety_response_flagged_with_codefence():
    text = '```json\n{"ok": false, "flags": ["face","mess"], "notes": "worker visible"}\n```'
    result = client_export.parse_safety_response(text)
    assert result["ok"] is False
    assert result["flags"] == ["face", "mess"]
    assert "worker" in result["notes"]


def test_parse_safety_response_drops_unknown_flags():
    """Unknown flag values are filtered out so we don't leak garbage into the badge UI."""
    text = '{"ok": false, "flags": ["face","bogus","mess"], "notes": ""}'
    result = client_export.parse_safety_response(text)
    assert result["flags"] == ["face", "mess"]


def test_parse_safety_response_invalid_json_returns_safe_default():
    """Invalid JSON falls back to ok=True with empty flags so a bad response doesn't lose the photo."""
    result = client_export.parse_safety_response("not json at all")
    assert result == {"ok": True, "flags": [], "notes": ""}


def test_filename_from_uri_jpg():
    uri = "https://api.companycam.com/photos/123abc/abc.jpg"
    assert client_export.filename_from_uri(uri, "photo-1") == "abc.jpg"


def test_filename_from_uri_no_extension():
    uri = "https://example.com/photos/streamhandler"
    assert client_export.filename_from_uri(uri, "photo-1") == "photo-1.jpg"


def test_filename_from_uri_with_query_string():
    uri = "https://example.com/photos/foo.jpg?signature=abc&exp=1"
    assert client_export.filename_from_uri(uri, "photo-1") == "foo.jpg"


def test_date_folder_from_unix_timestamp():
    # 2026-04-15 12:00 UTC = 1776297600
    assert client_export.date_folder_for_taken_at("1776297600") == "2026-04-15"


def test_date_folder_handles_iso_string():
    assert client_export.date_folder_for_taken_at("2026-04-15T12:00:00Z") == "2026-04-15"


def test_date_folder_falls_back_when_unparseable():
    assert client_export.date_folder_for_taken_at("") == "unknown-date"
    assert client_export.date_folder_for_taken_at("garbage") == "unknown-date"


def test_compute_export_photo_set_documents_excluded(catalog):
    """Documents are filtered out before the curator ever sees them."""
    catalog.upsert_project({
        "id": "p1", "name": "P", "address": "", "lat": 0, "lng": 0,
        "created_at": "", "photo_count": 0, "notepad": "",
    })
    for pid, status in [("a", "picked"), ("b", "document"), ("c", "skip")]:
        catalog.upsert_photo({
            "id": pid, "project_id": "p1", "uri": "u", "thumb_uri": "t",
            "taken_at": "", "creator_name": "", "description": "",
        })
        catalog.db.execute("UPDATE photos SET triage_status = ? WHERE id = ?", (status, pid))
    catalog.db.commit()

    included_ids = client_export.compute_export_photo_set(catalog, "p1")
    assert included_ids == {"a", "c"}


def test_compute_export_photo_set_respects_curator_exclusions(catalog):
    catalog.upsert_project({
        "id": "p1", "name": "P", "address": "", "lat": 0, "lng": 0,
        "created_at": "", "photo_count": 0, "notepad": "",
    })
    for pid, status in [("a", "picked"), ("b", "picked"), ("c", "picked")]:
        catalog.upsert_photo({
            "id": pid, "project_id": "p1", "uri": "u", "thumb_uri": "t",
            "taken_at": "", "creator_name": "", "description": "",
        })
        catalog.db.execute("UPDATE photos SET triage_status = ? WHERE id = ?", (status, pid))
    catalog.db.commit()

    catalog.set_selection("p1", "b", included=False)

    included_ids = client_export.compute_export_photo_set(catalog, "p1")
    assert included_ids == {"a", "c"}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_client_export.py -v
```

Expected: every new test FAILS with `ModuleNotFoundError` or `AttributeError` because `client_export.py` doesn't exist yet.

- [ ] **Step 3: Create `client_export.py` with the pure helpers**

Create `tools/photo-scanner/photo_scanner/client_export.py`:

```python
"""Client photo export — AI safety pass and zip builder.

Adds a fourth analysis pass on top of the existing scanner pipeline that flags
photos as inappropriate for direct hand-off to a customer. Also exposes the
helpers used by the FastAPI routes.
"""
import json
import os
from datetime import datetime, timezone
from pathlib import PurePosixPath
from urllib.parse import urlparse


VALID_FLAGS = {"face", "mess", "junk", "ppe", "personal_property", "profanity"}


SAFETY_PROMPT = """\
Decide whether this construction job-site photo is appropriate to send directly to the
homeowner/customer as part of their job-photo package.

Flag the photo if any of the following are true:
- "face": a person's face or other identifying features are visible
- "mess": clutter, debris, lunch wrappers, truck cab, scattered tools, etc.
- "junk": blurry, very dark, accidental shot, extreme close-up of nothing identifiable
- "ppe": worker without PPE, unsafe ladder placement, or anything that looks unsafe
        whether or not it actually is
- "personal_property": interior of customer's home, their belongings, mail/letters,
        license plate, or anything privacy-sensitive
- "profanity": graffiti, off-color hand-written notes, gestures

Respond in JSON only:
{
  "ok": true | false,
  "flags": [zero or more of: "face", "mess", "junk", "ppe", "personal_property", "profanity"],
  "notes": "one short sentence explaining the flag(s), or empty string if ok"
}

A photo is "ok" only if flags is empty.
"""


def parse_safety_response(text: str) -> dict:
    """Parse the safety-pass JSON response. Returns a safe default on any error."""
    safe_default = {"ok": True, "flags": [], "notes": ""}
    if not text:
        return safe_default
    s = text.strip()
    if s.startswith("```"):
        lines = [l for l in s.split("\n") if not l.strip().startswith("```")]
        s = "\n".join(lines)
    start = s.find("{")
    end = s.rfind("}")
    if start == -1 or end == -1:
        return safe_default
    try:
        parsed = json.loads(s[start:end + 1])
    except json.JSONDecodeError:
        return safe_default
    raw_flags = parsed.get("flags") or []
    flags = [f for f in raw_flags if isinstance(f, str) and f in VALID_FLAGS]
    return {
        "ok": bool(parsed.get("ok")) and not flags,
        "flags": flags,
        "notes": str(parsed.get("notes") or ""),
    }


def filename_from_uri(uri: str, photo_id: str) -> str:
    """Derive a zip-safe filename from a CompanyCam URI. Falls back to <photo_id>.jpg."""
    image_exts = {".jpg", ".jpeg", ".png", ".webp", ".heic"}
    if not uri:
        return f"{photo_id}.jpg"
    path = urlparse(uri).path
    name = PurePosixPath(path).name
    ext = PurePosixPath(name).suffix.lower()
    if ext in image_exts and name:
        return name
    return f"{photo_id}.jpg"


def date_folder_for_taken_at(taken_at: str) -> str:
    """Convert a Unix-timestamp string or ISO timestamp to a YYYY-MM-DD folder name."""
    if not taken_at:
        return "unknown-date"
    if taken_at.isdigit():
        try:
            dt = datetime.fromtimestamp(int(taken_at), tz=timezone.utc)
            return dt.strftime("%Y-%m-%d")
        except (ValueError, OSError):
            return "unknown-date"
    try:
        cleaned = taken_at.replace("Z", "+00:00")
        dt = datetime.fromisoformat(cleaned)
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        return "unknown-date"


def compute_export_photo_set(catalog, project_id: str) -> set[str]:
    """Return the set of photo IDs that should appear in the export.

    Documents (triage_status == 'document') are always excluded.
    Curator-excluded photos (rows in client_export_selections with included=0) are excluded.
    Everything else is included by default.
    """
    rows = catalog.db.execute(
        "SELECT id, triage_status FROM photos WHERE project_id = ?",
        (project_id,),
    ).fetchall()
    excluded = catalog.get_excluded_photo_ids(project_id)
    return {
        r[0] for r in rows
        if r[1] != "document" and r[0] not in excluded
    }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_client_export.py -v
```

Expected: all tests PASS (the 5 from prior tasks plus the 11 new ones).

- [ ] **Step 5: Commit**

```bash
git add tools/photo-scanner/photo_scanner/client_export.py tools/photo-scanner/tests/test_client_export.py
git commit -m "feat(photo-scanner): add client_export helpers (parser, filename, set computation)"
```

---

## Task 4: AI safety pass — `run_safety_pass` + per-photo analyzer

**Files:**
- Modify: `tools/photo-scanner/photo_scanner/client_export.py`
- Test: `tools/photo-scanner/tests/test_client_export.py`

The pass mirrors the deep-analysis structure: per-photo concurrent calls, max_dim 768, JSON in/out, persist to the catalog.

- [ ] **Step 1: Write the failing test**

Append to `tests/test_client_export.py`:

```python
import asyncio
from unittest.mock import AsyncMock, MagicMock


def _make_anthropic_response(text: str):
    """Build a fake Anthropic response object with .content[0].text."""
    block = MagicMock()
    block.text = text
    resp = MagicMock()
    resp.content = [block]
    return resp


def test_run_safety_pass_persists_results_to_catalog(catalog):
    """A safety pass over two photos writes status + flags to both rows."""
    catalog.upsert_project({
        "id": "p1", "name": "P", "address": "", "lat": 0, "lng": 0,
        "created_at": "", "photo_count": 0, "notepad": "",
    })
    for pid in ["a", "b"]:
        catalog.upsert_photo({
            "id": pid, "project_id": "p1",
            "uri": f"https://example.com/{pid}.jpg",
            "thumb_uri": f"https://example.com/{pid}-thumb.jpg",
            "taken_at": "1776297600", "creator_name": "", "description": "",
        })
        catalog.db.execute("UPDATE photos SET triage_status = 'picked' WHERE id = ?", (pid,))
    catalog.db.commit()

    cc_client = MagicMock()
    cc_client.get_photo_bytes = AsyncMock(return_value=_one_pixel_jpeg())

    anthropic_client = MagicMock()
    anthropic_client.messages.create = AsyncMock(side_effect=[
        _make_anthropic_response('{"ok": true, "flags": [], "notes": ""}'),
        _make_anthropic_response('{"ok": false, "flags": ["face"], "notes": "worker visible"}'),
    ])

    asyncio.run(client_export.run_safety_pass(catalog, "p1", cc_client, anthropic_client))

    a = catalog.get_photo("a")
    b = catalog.get_photo("b")
    assert a["client_export_status"] == "ok"
    assert json.loads(a["client_export_flags"]) == []
    assert b["client_export_status"] == "flagged"
    assert json.loads(b["client_export_flags"]) == ["face"]


def _one_pixel_jpeg() -> bytes:
    """Smallest valid JPEG so PIL can open it without crashing."""
    import io
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (1, 1), (0, 0, 0)).save(buf, format="JPEG")
    return buf.getvalue()
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_client_export.py::test_run_safety_pass_persists_results_to_catalog -v
```

Expected: FAIL — `run_safety_pass` doesn't exist.

- [ ] **Step 3: Add `analyze_one_photo` and `run_safety_pass` to `client_export.py`**

Append to `client_export.py`:

```python
import asyncio
import io
import logging
import sys

from PIL import Image

from photo_scanner.scanner import image_to_b64

ANTHROPIC_MODEL = "claude-sonnet-4-20250514"
MAX_IMAGE_DIM = 768
CONCURRENCY = 5

log = logging.getLogger("photo_scanner.client_export")


async def _safety_call_for_photo(anthropic_client, image: Image.Image) -> dict:
    b64, media_type = image_to_b64(image, max_dim=MAX_IMAGE_DIM)
    response = await anthropic_client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=512,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64",
                                              "media_type": media_type, "data": b64}},
                {"type": "text", "text": SAFETY_PROMPT},
            ],
        }],
    )
    return parse_safety_response(response.content[0].text)


async def run_safety_pass(catalog, project_id: str, cc_client, anthropic_client,
                          on_progress=None):
    """Run the client-export safety pass over every non-document photo in the project
    that has not already been checked. Persists status + flags to the catalog.
    """
    rows = catalog.db.execute(
        """
        SELECT id, uri FROM photos
        WHERE project_id = ?
          AND (triage_status IS NULL OR triage_status != 'document')
          AND client_export_status IS NULL
        """,
        (project_id,),
    ).fetchall()
    targets = [(r[0], r[1]) for r in rows]
    total = len(targets)
    print(f"[client_export] {total} photos to safety-check for project {project_id}",
          file=sys.stderr, flush=True)
    if on_progress:
        on_progress({"phase": "safety", "current": 0, "total": total})

    sem = asyncio.Semaphore(CONCURRENCY)
    completed = 0

    async def analyze(photo_id: str, uri: str):
        nonlocal completed
        async with sem:
            try:
                img_bytes = await cc_client.get_photo_bytes(uri)
                img = Image.open(io.BytesIO(img_bytes))
                if img.mode != "RGB":
                    img = img.convert("RGB")
                result = await _safety_call_for_photo(anthropic_client, img)
                status = "ok" if result["ok"] else "flagged"
                catalog.db.execute(
                    "UPDATE photos SET client_export_status = ?, client_export_flags = ? WHERE id = ?",
                    (status, json.dumps(result["flags"]), photo_id),
                )
                catalog.db.commit()
            except Exception as e:
                print(f"[client_export] error on {photo_id}: {e}",
                      file=sys.stderr, flush=True)
            finally:
                completed += 1
                if on_progress:
                    on_progress({"phase": "safety", "current": completed, "total": total})

    await asyncio.gather(*(analyze(pid, uri) for pid, uri in targets))
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_client_export.py -v
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/photo-scanner/photo_scanner/client_export.py tools/photo-scanner/tests/test_client_export.py
git commit -m "feat(photo-scanner): add client-export safety pass over project photos"
```

---

## Task 5: Background orchestrator — `prepare_project_for_export`

**Files:**
- Modify: `tools/photo-scanner/photo_scanner/client_export.py`

When the operator picks an unscanned project, we need to (a) sync from CompanyCam if not synced, (b) run prescreen+triage if it hasn't run, (c) run the safety pass. This is glue around existing functions plus the new safety pass — easier to test through the route smoke test in Task 9 than to unit-test directly.

- [ ] **Step 1: Add `prepare_project_for_export` to `client_export.py`**

Append to `client_export.py`:

```python
async def prepare_project_for_export(catalog, project_id: str, cc_client,
                                     anthropic_client, on_progress=None):
    """End-to-end prep: sync (if needed), run scanner triage (if needed), run safety pass.

    Idempotent: re-runs only fill in what hasn't been done.
    """
    from photo_scanner.companycam import CompanyCamClient
    from photo_scanner.scanner import analyze_project_from_catalog

    # 1. Sync if we have no photos for this project yet.
    have_photos = catalog.db.execute(
        "SELECT COUNT(*) FROM photos WHERE project_id = ?", (project_id,)
    ).fetchone()[0]

    if have_photos == 0:
        if on_progress:
            on_progress({"phase": "sync", "current": 0, "total": 0})
        raw_proj = await cc_client.get_project(project_id)
        catalog.upsert_project(CompanyCamClient.normalize_project(raw_proj))
        page = 1
        while True:
            raw_photos = await cc_client.list_project_photos(project_id, page=page, per_page=100)
            if not raw_photos:
                break
            for rp in raw_photos:
                catalog.upsert_photo(CompanyCamClient.normalize_photo(rp, project_id))
            if len(raw_photos) < 100:
                break
            page += 1
        catalog.set_project_synced(project_id)

    # 2. Run prescreen/triage if any photo lacks a triage_status.
    has_unanalyzed = catalog.db.execute(
        "SELECT COUNT(*) FROM photos WHERE project_id = ? AND triage_status IS NULL",
        (project_id,),
    ).fetchone()[0]

    if has_unanalyzed:
        await analyze_project_from_catalog(catalog, project_id, cc_client,
                                           anthropic_client, on_progress=on_progress)

    # 3. Run the safety pass for any photo not yet checked.
    await run_safety_pass(catalog, project_id, cc_client, anthropic_client,
                          on_progress=on_progress)
```

- [ ] **Step 2: Quick smoke check — module imports cleanly**

```bash
cd tools/photo-scanner
python -c "from photo_scanner import client_export; print('ok')"
```

Expected: `ok`.

- [ ] **Step 3: Commit**

```bash
git add tools/photo-scanner/photo_scanner/client_export.py
git commit -m "feat(photo-scanner): add prepare_project_for_export orchestrator"
```

---

## Task 6: Server route — project picker page

**Files:**
- Modify: `tools/photo-scanner/photo_scanner/server.py`
- Create: `tools/photo-scanner/photo_scanner/templates/client_export_index.html`

The picker is a server-rendered page. It hits `catalog.list_projects()` and decorates each with a status badge derived from existing fields plus a query against `photos.client_export_status`.

- [ ] **Step 1: Add the route to `server.py`**

In `server.py`, after the existing `cc_get_project_photos` route (around line 470), add:

```python
# --- Client photo export ---

def _client_export_status(project_id: str) -> str:
    """Return one of: 'unscanned', 'analyzed', 'check-done'."""
    if catalog is None:
        return "unscanned"
    total = catalog.db.execute(
        "SELECT COUNT(*) FROM photos WHERE project_id = ?", (project_id,)
    ).fetchone()[0]
    if total == 0:
        return "unscanned"
    has_unanalyzed = catalog.db.execute(
        "SELECT 1 FROM photos WHERE project_id = ? AND triage_status IS NULL LIMIT 1",
        (project_id,),
    ).fetchone()
    if has_unanalyzed:
        return "unscanned"
    has_unchecked = catalog.db.execute(
        """
        SELECT 1 FROM photos
        WHERE project_id = ?
          AND (triage_status IS NULL OR triage_status != 'document')
          AND client_export_status IS NULL
        LIMIT 1
        """,
        (project_id,),
    ).fetchone()
    if has_unchecked:
        return "analyzed"
    return "check-done"


@app.get("/client-export", response_class=HTMLResponse)
async def client_export_index(q: str | None = Query(None)):
    if catalog is None:
        return HTMLResponse("<h1>Catalog not initialized</h1>", status_code=503)
    projects = catalog.list_projects(query=q, page=1, per_page=200)
    for p in projects:
        p["export_status"] = _client_export_status(p["id"])
    template = jinja_env.get_template("client_export_index.html")
    return HTMLResponse(template.render(projects=projects, query=q or ""))
```

- [ ] **Step 2: Create `client_export_index.html`**

Create `tools/photo-scanner/photo_scanner/templates/client_export_index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Client Photo Export — Pick a Project</title>
<style>
  :root {
    --bg:#0a0a0a; --surface:#141414; --border:#2a2a2a;
    --text:#e5e5e5; --muted:#777; --accent:#3b82f6;
    --green:#22c55e; --orange:#f97316;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: var(--bg); color: var(--text); padding: 24px; }
  header { max-width: 960px; margin: 0 auto 20px; }
  h1 { font-size: 20px; margin-bottom: 12px; }
  .search { width: 100%; padding: 8px 12px; background: var(--surface); border: 1px solid var(--border); color: var(--text); border-radius: 6px; font-size: 14px; }
  .list { max-width: 960px; margin: 0 auto; display: flex; flex-direction: column; gap: 8px; }
  .row { display: flex; align-items: center; gap: 14px; padding: 12px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; text-decoration: none; color: inherit; }
  .row:hover { border-color: var(--accent); }
  .row .meta { flex: 1; min-width: 0; }
  .row .name { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .row .addr { font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .badge { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
  .badge.unscanned { background: #f9731622; color: var(--orange); border: 1px solid #f9731644; }
  .badge.analyzed { background: #3b82f622; color: var(--accent); border: 1px solid #3b82f644; }
  .badge.check-done { background: #22c55e22; color: var(--green); border: 1px solid #22c55e44; }
</style>
</head>
<body>
<header>
  <h1>Client Photo Export</h1>
  <form method="get" action="/client-export">
    <input class="search" type="search" name="q" value="{{ query }}" placeholder="Search projects by name or address..." autofocus>
  </form>
</header>
<div class="list">
{% for p in projects %}
  <a class="row" href="/client-export/{{ p.id }}">
    <div class="meta">
      <div class="name">{{ p.name }}</div>
      <div class="addr">{{ p.address }}</div>
    </div>
    <span class="badge {{ p.export_status }}">
      {% if p.export_status == 'unscanned' %}Needs analysis
      {% elif p.export_status == 'analyzed' %}Needs safety check
      {% else %}Ready{% endif %}
    </span>
  </a>
{% else %}
  <div style="text-align:center; padding: 40px; color: var(--muted);">No projects in the catalog yet.</div>
{% endfor %}
</div>
</body>
</html>
```

- [ ] **Step 3: Manual smoke test**

Start the server (or restart if running):

```bash
cd tools/photo-scanner
python -m photo_scanner.server
```

Visit `http://localhost:8000/client-export` in a browser. Verify the page loads, projects are listed, and badges show. Try the search box.

- [ ] **Step 4: Commit**

```bash
git add tools/photo-scanner/photo_scanner/server.py tools/photo-scanner/photo_scanner/templates/client_export_index.html
git commit -m "feat(photo-scanner): add /client-export project picker page"
```

---

## Task 7: Server route — review page (GET) and run-check (POST) + status (GET)

**Files:**
- Modify: `tools/photo-scanner/photo_scanner/server.py`
- Create: `tools/photo-scanner/photo_scanner/templates/client_export_review.html`

The review page renders the photo grid for a project. It uses the existing `_task_state` global for background-task progress so we don't have to invent another one.

- [ ] **Step 1: Add the routes to `server.py`**

After `client_export_index` in `server.py`, add:

```python
@app.get("/client-export/{project_id}", response_class=HTMLResponse)
async def client_export_review(project_id: str):
    if catalog is None:
        return HTMLResponse("<h1>Catalog not initialized</h1>", status_code=503)
    project = catalog.get_project(project_id)
    if project is None:
        # Try fetching from CompanyCam so we can render a "Run analysis" page anyway.
        project = {"id": project_id, "name": project_id, "address": ""}

    status = _client_export_status(project_id)

    photos = []
    if status == "check-done":
        rows = catalog.db.execute(
            """
            SELECT id, uri, thumb_uri, taken_at, triage_status,
                   client_export_status, client_export_flags
            FROM photos
            WHERE project_id = ?
              AND (triage_status IS NULL OR triage_status != 'document')
            ORDER BY CAST(taken_at AS INTEGER), id
            """,
            (project_id,),
        ).fetchall()
        excluded = catalog.get_excluded_photo_ids(project_id)
        import json as _json
        photos = [
            {
                "id": r[0],
                "uri": r[1],
                "thumb_uri": r[2] or r[1],
                "taken_at": r[3],
                "triage_status": r[4],
                "client_export_status": r[5],
                "flags": _json.loads(r[6]) if r[6] else [],
                "included": r[0] not in excluded,
            }
            for r in rows
        ]

    template = jinja_env.get_template("client_export_review.html")
    return HTMLResponse(template.render(
        project=project, status=status, photos=photos,
        included_count=sum(1 for p in photos if p["included"]),
        total_count=len(photos),
    ))


@app.post("/client-export/{project_id}/run-check")
async def client_export_run_check(project_id: str):
    global _task_state
    if cc_client is None:
        return JSONResponse({"error": "CompanyCam not configured"}, status_code=503)
    if catalog is None:
        return JSONResponse({"error": "Catalog not initialized"}, status_code=503)
    if _task_state.get("status") == "running":
        return JSONResponse({"error": "Task already running", "task": _task_state}, status_code=409)

    from photo_scanner import client_export as ce
    from photo_scanner.scanner import get_async_anthropic_client
    anthropic_client = get_async_anthropic_client()
    if not anthropic_client:
        return JSONResponse({"error": "No Anthropic auth configured"}, status_code=503)

    _task_state = {"status": "running", "project_id": project_id, "progress": {}}

    async def run():
        global _task_state
        try:
            def on_progress(info: dict):
                _task_state["progress"] = info
            await ce.prepare_project_for_export(catalog, project_id, cc_client,
                                                anthropic_client, on_progress=on_progress)
            _task_state["status"] = "complete"
        except Exception as e:
            _task_state["status"] = "error"
            _task_state["progress"] = {"error": str(e)}

    asyncio.create_task(run())
    return {"ok": True, "task": _task_state}


@app.get("/client-export/{project_id}/status")
async def client_export_status(project_id: str):
    return _task_state
```

- [ ] **Step 2: Create `client_export_review.html`**

Create `tools/photo-scanner/photo_scanner/templates/client_export_review.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>{{ project.name }} — Client Photo Export</title>
<style>
  :root {
    --bg:#0a0a0a; --surface:#141414; --border:#2a2a2a;
    --text:#e5e5e5; --muted:#777; --accent:#3b82f6;
    --green:#22c55e; --orange:#f97316; --red:#ef4444;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: var(--bg); color: var(--text); }
  header { position: sticky; top: 0; z-index: 10; background: var(--surface); border-bottom: 1px solid var(--border); padding: 12px 20px; display: flex; align-items: center; gap: 16px; }
  header h1 { font-size: 16px; font-weight: 600; }
  header .addr { color: var(--muted); font-size: 12px; }
  header .spacer { flex: 1; }
  header .counter { font-size: 13px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .btn { padding: 8px 16px; border-radius: 5px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text); text-decoration: none; }
  .btn-primary { background: var(--accent); color: #fff; border-color: var(--accent); }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
  .container { padding: 20px; }
  .empty { text-align: center; color: var(--muted); padding: 60px 20px; }
  .empty .btn { margin-top: 16px; display: inline-block; }
  .progress { margin-top: 14px; font-size: 13px; color: var(--muted); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px; }
  .tile { position: relative; background: var(--surface); border: 2px solid transparent; border-radius: 6px; overflow: hidden; cursor: pointer; aspect-ratio: 4 / 3; user-select: none; }
  .tile img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .tile.excluded { opacity: 0.35; border-color: var(--red); }
  .tile.excluded::after { content: '✕'; position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); font-size: 60px; color: var(--red); font-weight: 700; text-shadow: 0 0 6px #000; }
  .tile .flags { position: absolute; bottom: 4px; left: 4px; right: 4px; display: flex; flex-wrap: wrap; gap: 3px; }
  .flag { font-size: 9px; padding: 1px 5px; background: var(--orange); color: #000; border-radius: 3px; font-weight: 600; }
</style>
</head>
<body>
<header>
  <a href="/client-export" class="btn">← Projects</a>
  <div>
    <h1>{{ project.name }}</h1>
    <div class="addr">{{ project.address }}</div>
  </div>
  <div class="spacer"></div>
  {% if status == 'check-done' %}
    <span class="counter" id="counter">{{ included_count }} of {{ total_count }} included</span>
    <a class="btn btn-primary" id="export-btn" href="/client-export/{{ project.id }}/zip">Export ZIP</a>
  {% endif %}
</header>

<div class="container">
{% if status != 'check-done' %}
  <div class="empty">
    <div>This project hasn't been prepared for export yet.</div>
    <button class="btn btn-primary" id="run-check-btn">Run analysis</button>
    <div class="progress" id="progress"></div>
  </div>
{% else %}
  <div class="grid" id="grid">
  {% for photo in photos %}
    <div class="tile {% if not photo.included %}excluded{% endif %}"
         data-photo-id="{{ photo.id }}"
         data-included="{{ '1' if photo.included else '0' }}">
      <img loading="lazy" src="{{ photo.thumb_uri }}" alt="">
      {% if photo.flags %}
        <div class="flags">
        {% for f in photo.flags %}<span class="flag">{{ f }}</span>{% endfor %}
        </div>
      {% endif %}
    </div>
  {% endfor %}
  </div>
{% endif %}
</div>

<script>
const PROJECT_ID = {{ project.id|tojson }};

const runBtn = document.getElementById('run-check-btn');
if (runBtn) {
  runBtn.addEventListener('click', async () => {
    runBtn.disabled = true;
    const progressEl = document.getElementById('progress');
    progressEl.textContent = 'Starting...';
    const r = await fetch(`/client-export/${PROJECT_ID}/run-check`, { method: 'POST' });
    if (!r.ok) {
      const err = await r.json();
      progressEl.textContent = 'Error: ' + (err.error || 'unknown');
      runBtn.disabled = false;
      return;
    }
    const poll = async () => {
      const s = await fetch(`/client-export/${PROJECT_ID}/status`).then(r => r.json());
      const p = s.progress || {};
      if (s.status === 'complete') { window.location.reload(); return; }
      if (s.status === 'error') { progressEl.textContent = 'Error: ' + (p.error || 'unknown'); return; }
      const phase = p.phase || '...';
      const cur = p.current ?? '';
      const tot = p.total ?? '';
      progressEl.textContent = `${phase}: ${cur}/${tot}`;
      setTimeout(poll, 1000);
    };
    poll();
  });
}

const grid = document.getElementById('grid');
const counter = document.getElementById('counter');
if (grid) {
  let included = parseInt(counter.dataset.included || counter.textContent.split(' ')[0], 10);
  const total = parseInt(counter.textContent.split(' ')[2], 10);

  grid.addEventListener('click', async (e) => {
    const tile = e.target.closest('.tile');
    if (!tile) return;
    const id = tile.dataset.photoId;
    const wasIncluded = tile.dataset.included === '1';
    const nowIncluded = !wasIncluded;

    // Optimistic UI update.
    tile.classList.toggle('excluded', !nowIncluded);
    tile.dataset.included = nowIncluded ? '1' : '0';
    included += nowIncluded ? 1 : -1;
    counter.textContent = `${included} of ${total} included`;

    try {
      const r = await fetch(`/client-export/${PROJECT_ID}/toggle`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ photo_id: id, included: nowIncluded }),
      });
      if (!r.ok) throw new Error('toggle failed');
    } catch (err) {
      // Revert on failure.
      tile.classList.toggle('excluded', !wasIncluded);
      tile.dataset.included = wasIncluded ? '1' : '0';
      included += wasIncluded ? 1 : -1;
      counter.textContent = `${included} of ${total} included`;
    }
  });
}
</script>
</body>
</html>
```

- [ ] **Step 3: Manual smoke test the review page (without running the AI yet)**

```bash
python -m photo_scanner.server
```

Open `http://localhost:8000/client-export/<some-project-id>`. If the project hasn't been analyzed, you should see the "Run analysis" button (don't click it yet — toggle wiring comes in the next task). If the project is already analyzed and safety-checked from a prior run, you should see the photo grid and counter.

- [ ] **Step 4: Commit**

```bash
git add tools/photo-scanner/photo_scanner/server.py tools/photo-scanner/photo_scanner/templates/client_export_review.html
git commit -m "feat(photo-scanner): add /client-export/<id> review page + run-check route"
```

---

## Task 8: Server route — toggle inclusion

**Files:**
- Modify: `tools/photo-scanner/photo_scanner/server.py`

The toggle endpoint persists per-photo selections to the catalog.

- [ ] **Step 1: Add the route to `server.py`**

After `client_export_status` in `server.py`, add:

```python
@app.post("/client-export/{project_id}/toggle")
async def client_export_toggle(project_id: str, request: Request):
    if catalog is None:
        return JSONResponse({"error": "Catalog not initialized"}, status_code=503)
    body = await request.json()
    photo_id = body.get("photo_id")
    included = bool(body.get("included"))
    if not photo_id:
        return JSONResponse({"error": "photo_id required"}, status_code=400)
    catalog.set_selection(project_id, photo_id, included)
    return {"ok": True, "photo_id": photo_id, "included": included}
```

- [ ] **Step 2: Manual smoke test**

In the browser on a `check-done` project, click a photo. Verify the tile turns red/dim and the counter decrements. Click again — it should restore. Reload — selections should persist.

In a separate terminal:

```bash
sqlite3 tools/photo-scanner/catalog.db "SELECT * FROM client_export_selections;"
```

Expected: rows reflecting your clicks.

- [ ] **Step 3: Commit**

```bash
git add tools/photo-scanner/photo_scanner/server.py
git commit -m "feat(photo-scanner): add /client-export/<id>/toggle endpoint"
```

---

## Task 9: Zip export endpoint

**Files:**
- Modify: `tools/photo-scanner/photo_scanner/client_export.py`
- Modify: `tools/photo-scanner/photo_scanner/server.py`
- Test: `tools/photo-scanner/tests/test_client_export.py`

The zip is built in-memory (small enough for a single project), then returned as a `Response` with `media_type="application/zip"`. Streaming would be nicer but `zipfile` doesn't stream cleanly, and a typical project zip is well under 500MB.

- [ ] **Step 1: Write the failing test**

Append to `tests/test_client_export.py`:

```python
import zipfile

def test_build_zip_groups_by_date_and_excludes_documents(catalog):
    catalog.upsert_project({
        "id": "p1", "name": "P", "address": "", "lat": 0, "lng": 0,
        "created_at": "", "photo_count": 0, "notepad": "",
    })
    photos = [
        {"id": "a", "uri": "https://e.com/a.jpg", "taken_at": "1776297600", "status": "picked"},
        {"id": "b", "uri": "https://e.com/b.jpg", "taken_at": "1776297600", "status": "picked"},
        {"id": "c", "uri": "https://e.com/c.jpg", "taken_at": "1776384000", "status": "picked"},
        {"id": "d", "uri": "https://e.com/d.jpg", "taken_at": "1776297600", "status": "document"},
    ]
    for p in photos:
        catalog.upsert_photo({
            "id": p["id"], "project_id": "p1",
            "uri": p["uri"], "thumb_uri": p["uri"],
            "taken_at": p["taken_at"], "creator_name": "", "description": "",
        })
        catalog.db.execute("UPDATE photos SET triage_status = ? WHERE id = ?",
                           (p["status"], p["id"]))
    catalog.db.commit()
    catalog.set_selection("p1", "b", included=False)  # curator excluded

    fetched = []
    async def fake_get_bytes(uri):
        fetched.append(uri)
        return _one_pixel_jpeg()
    cc = MagicMock()
    cc.get_photo_bytes = fake_get_bytes

    zip_bytes = asyncio.run(client_export.build_export_zip(catalog, "p1", cc))

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        names = sorted(zf.namelist())

    # Document 'd' and curator-excluded 'b' must not be in the zip.
    assert any(n.endswith("/2026-04-15/a.jpg") for n in names)
    assert any(n.endswith("/2026-04-16/c.jpg") for n in names)
    assert not any("b.jpg" in n for n in names)
    assert not any("d.jpg" in n for n in names)
```

(`io` is already imported at the top of the test file via the `_one_pixel_jpeg` helper.)

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_client_export.py::test_build_zip_groups_by_date_and_excludes_documents -v
```

Expected: FAIL — `build_export_zip` doesn't exist.

- [ ] **Step 3: Add `build_export_zip` to `client_export.py`**

Append to `client_export.py`:

```python
import re
import zipfile


def _slugify(name: str) -> str:
    s = re.sub(r"[^A-Za-z0-9._-]+", "-", name).strip("-")
    return s or "project"


async def build_export_zip(catalog, project_id: str, cc_client) -> bytes:
    """Fetch every included photo and return zip bytes.

    Structure:
      <slug>_<today>/
        YYYY-MM-DD/
          <filename>.jpg
    """
    project = catalog.get_project(project_id) or {"name": project_id}
    project_slug = _slugify(project["name"])
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    top_folder = f"{project_slug}_{today}"

    included_ids = compute_export_photo_set(catalog, project_id)
    rows = catalog.db.execute(
        "SELECT id, uri, taken_at FROM photos WHERE project_id = ?",
        (project_id,),
    ).fetchall()
    targets = [(r[0], r[1], r[2]) for r in rows if r[0] in included_ids]

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for photo_id, uri, taken_at in targets:
            try:
                data = await cc_client.get_photo_bytes(uri)
            except Exception as e:
                print(f"[client_export] zip: skipping {photo_id}: {e}",
                      file=sys.stderr, flush=True)
                continue
            date_folder = date_folder_for_taken_at(taken_at)
            filename = filename_from_uri(uri, photo_id)
            arcname = f"{top_folder}/{date_folder}/{filename}"
            zf.writestr(arcname, data)
    return buf.getvalue()
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_client_export.py -v
```

Expected: all tests PASS.

- [ ] **Step 5: Add the FastAPI route to `server.py`**

After `client_export_toggle`, add:

```python
from fastapi.responses import Response


@app.get("/client-export/{project_id}/zip")
async def client_export_zip(project_id: str):
    if cc_client is None:
        return JSONResponse({"error": "CompanyCam not configured"}, status_code=503)
    if catalog is None:
        return JSONResponse({"error": "Catalog not initialized"}, status_code=503)

    from photo_scanner import client_export as ce
    project = catalog.get_project(project_id) or {"name": project_id}
    slug = ce._slugify(project["name"])
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    zip_bytes = await ce.build_export_zip(catalog, project_id, cc_client)

    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{slug}_{today}.zip"',
        },
    )
```

`Response` import — check if already imported at the top of `server.py`. If not, add it to the existing FastAPI imports. Same for `datetime` / `timezone`.

- [ ] **Step 6: Add the imports if missing**

At the top of `server.py`, replace the existing `fastapi.responses` import line so it includes `Response`:

```python
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response
```

And add (if not already present):

```python
from datetime import datetime, timezone
```

- [ ] **Step 7: Manual smoke test**

```bash
python -m photo_scanner.server
```

On a `check-done` project, click **Export ZIP**. Verify the browser downloads a `<slug>_<today>.zip`. Open it: photos should be in `YYYY-MM-DD` subfolders, and curator-excluded / document photos should NOT be present.

- [ ] **Step 8: Commit**

```bash
git add tools/photo-scanner/photo_scanner/client_export.py tools/photo-scanner/photo_scanner/server.py tools/photo-scanner/tests/test_client_export.py
git commit -m "feat(photo-scanner): add zip export endpoint for client photos"
```

---

## Task 10: Add navigation link from existing photo-scanner UI

**Files:**
- Modify: `tools/photo-scanner/photo_scanner/templates/index.html`

Make the new feature discoverable from the existing scanner UI. A small link in the existing top-bar / nav is enough — no need to redesign.

- [ ] **Step 1: Find the right spot in `index.html`**

```bash
grep -n "<body" /c/Users/tfalcon/microsites/tools/photo-scanner/photo_scanner/templates/index.html
```

Use the grep output to identify the header section near the top of the body.

- [ ] **Step 2: Add the link**

Find a stable location in the existing top bar (look for an existing nav row, typically near the `.topbar` element). Add a link inline:

```html
<a href="/client-export" class="btn" style="margin-left: auto;">Client Export →</a>
```

If no obvious top-bar exists in the template (it's mostly client-rendered), skip this step entirely — operators will hit the URL directly.

- [ ] **Step 3: Manual smoke test**

Reload `http://localhost:8000/`. Verify the link is visible and goes to `/client-export`.

- [ ] **Step 4: Commit (if changes were made)**

```bash
git add tools/photo-scanner/photo_scanner/templates/index.html
git commit -m "feat(photo-scanner): add Client Export nav link to scanner home"
```

---

## Task 11: End-to-end manual test on a real project

**Files:** none (manual verification)

- [ ] **Step 1: Pick an unscanned CompanyCam project ID**

Use a small project (under 50 photos) so this finishes quickly. Find one in CompanyCam, copy the ID.

- [ ] **Step 2: Walk through the flow**

1. Visit `http://localhost:8000/client-export`. Confirm it lists projects.
2. Search for the picked project; click it.
3. On the review page, click **Run analysis**. Watch the progress text update through `sync` → `triage` → `safety`.
4. When the page reloads, scan the grid. Verify:
   - Documents are absent.
   - At least some flagged photos show orange badges (`face`, `personal_property`, etc.) under the thumbnail.
   - Counter shows `N of N included`.
5. Click 2-3 photos to exclude them. Counter decrements. Reload the page — selections persist.
6. Click **Export ZIP**. Download the zip; open it.
7. Verify:
   - Top folder is `<project-slug>_<today>/`.
   - Subfolders are `YYYY-MM-DD/`.
   - Excluded photos and documents are not present.
   - File count = `included_count` from the counter.

- [ ] **Step 3: Document any issues**

If anything is off (badge missing, photo missing, layout broken), note the specifics and fix in a follow-up commit before declaring done.

---

## Self-review notes

**Spec coverage:**
- ✅ Architecture / extension of photo-scanner — Task 6/7/8/9.
- ✅ Two new columns + selections table — Task 1/2.
- ✅ Safety AI pass with six flags — Task 4.
- ✅ Hybrid: reuse existing triage for documents, new pass for safety — Task 4 (`run_safety_pass` skips `triage_status='document'`); Task 5 (`prepare_project_for_export` runs scanner triage if needed).
- ✅ On-demand for unscanned projects — Task 5/7 (`prepare_project_for_export` + `/run-check`).
- ✅ Flag-don't-hide UX — Task 7 review page renders ALL non-document photos with badges.
- ✅ Default included, click to exclude — Task 7 review page; Task 8 toggle.
- ✅ Persistent selections — Task 2 helpers + Task 8 endpoint.
- ✅ Originals organized by date in zip — Task 9.
- ✅ Filename derivation — Task 3.

**Type / signature consistency:**
- `set_selection`, `get_selection`, `get_excluded_photo_ids` — used consistently across Tasks 2, 3, 7, 8, 9.
- `compute_export_photo_set` — defined Task 3, used in Task 9 `build_export_zip`.
- `_task_state` reuses the existing global from `server.py`; status values `running` / `complete` / `error` match what the existing scanner-analyze route uses.
- `prepare_project_for_export(catalog, project_id, cc_client, anthropic_client, on_progress)` — same shape as the existing `analyze_project_from_catalog`, so `on_progress` callbacks are compatible.

No placeholders. No "TBD". No "similar to Task N" without code. Every code step has the exact code.

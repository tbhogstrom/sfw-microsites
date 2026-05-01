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
    # Build a legacy schema by hand — full production shape minus the two new columns.
    # Must include every column the FTS triggers reference, otherwise the trigger
    # creation in _create_tables fails on this legacy DB.
    conn = sqlite3.connect(str(db_path))
    conn.executescript("""
        CREATE TABLE photos (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            uri TEXT NOT NULL,
            thumb_uri TEXT DEFAULT '',
            taken_at TEXT DEFAULT '',
            creator_name TEXT DEFAULT '',
            description TEXT DEFAULT '',
            triage_status TEXT,
            scene TEXT,
            service_types TEXT,
            phase TEXT,
            entities TEXT,
            marketing_score INTEGER,
            marketing_notes TEXT,
            before_after_potential INTEGER DEFAULT 0,
            damage_details TEXT
        );
    """)
    conn.commit()
    conn.close()

    cat = Catalog(db_path)
    cols = {row[1] for row in cat.db.execute("PRAGMA table_info(photos)")}
    assert "client_export_status" in cols
    assert "client_export_flags" in cols
    cat.close()


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
    # 2026-04-15 12:00 UTC = 1776254400
    assert client_export.date_folder_for_taken_at("1776254400") == "2026-04-15"


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


import io
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
    assert any("a.jpg" in n for n in names)
    assert any("c.jpg" in n for n in names)
    assert not any("b.jpg" in n for n in names)
    assert not any("d.jpg" in n for n in names)
    # Verify date folders are present in the path.
    # 1776297600 = 2026-04-16 UTC, 1776384000 = 2026-04-17 UTC.
    assert any("/2026-04-16/" in n for n in names)
    assert any("/2026-04-17/" in n for n in names)

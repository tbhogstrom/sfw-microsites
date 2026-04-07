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
    # Day 1 photos (April 5)
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
    # Day 2 photos (April 6)
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
    photos = seeded_catalog.get_photos_for_date("p1", 1775490000, 1775510000)
    assert len(photos) == 3
    assert all(p["id"].startswith("d2-") for p in photos)


def test_get_photos_for_date_empty(seeded_catalog):
    photos = seeded_catalog.get_photos_for_date("p1", 1776000000, 1776100000)
    assert len(photos) == 0

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

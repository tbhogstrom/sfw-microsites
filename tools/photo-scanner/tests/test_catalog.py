"""Tests for the SQLite catalog module."""
import pytest
from pathlib import Path
from photo_scanner.catalog import Catalog


@pytest.fixture
def catalog(tmp_path):
    """Create a fresh in-memory catalog for each test."""
    db = Catalog(tmp_path / "test.db")
    yield db
    db.close()


def test_catalog_creates_tables(catalog):
    """Tables exist after init."""
    cursor = catalog.db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    )
    tables = {row[0] for row in cursor.fetchall()}
    assert "projects" in tables
    assert "photos" in tables
    assert "photo_fts" in tables


def test_upsert_project(catalog):
    """Upsert a project and retrieve it."""
    catalog.upsert_project({
        "id": "123",
        "name": "Test Project",
        "address": "123 Main St, Portland OR",
        "lat": 45.52,
        "lng": -122.68,
        "created_at": "2026-04-01T00:00:00",
        "photo_count": 10,
    })
    project = catalog.get_project("123")
    assert project["name"] == "Test Project"
    assert project["photo_count"] == 10


def test_upsert_project_updates_existing(catalog):
    """Upserting same ID updates the record."""
    catalog.upsert_project({"id": "123", "name": "Old Name", "address": "", "lat": 0, "lng": 0, "created_at": "", "photo_count": 5})
    catalog.upsert_project({"id": "123", "name": "New Name", "address": "", "lat": 0, "lng": 0, "created_at": "", "photo_count": 15})
    project = catalog.get_project("123")
    assert project["name"] == "New Name"
    assert project["photo_count"] == 15


def test_upsert_photo(catalog):
    """Upsert a photo and retrieve it."""
    catalog.upsert_project({"id": "p1", "name": "Proj", "address": "", "lat": 0, "lng": 0, "created_at": "", "photo_count": 1})
    catalog.upsert_photo({
        "id": "photo1",
        "project_id": "p1",
        "uri": "https://example.com/full.jpg",
        "thumb_uri": "https://example.com/thumb.jpg",
        "taken_at": "2026-04-01T10:00:00",
        "creator_name": "Alice",
    })
    photo = catalog.get_photo("photo1")
    assert photo["uri"] == "https://example.com/full.jpg"
    assert photo["creator_name"] == "Alice"
    assert photo["scene"] is None  # not yet analyzed


def test_update_photo_analysis(catalog):
    """Write analysis results to a photo."""
    catalog.upsert_project({"id": "p1", "name": "Proj", "address": "", "lat": 0, "lng": 0, "created_at": "", "photo_count": 1})
    catalog.upsert_photo({"id": "photo1", "project_id": "p1", "uri": "https://example.com/full.jpg", "thumb_uri": "", "taken_at": "", "creator_name": ""})
    catalog.update_photo_analysis("photo1", {
        "triage_status": "picked",
        "scene": "Cedar shake siding with white trim",
        "service_types": ["siding", "trim"],
        "phase": "after",
        "entities": ["siding", "trim", "house"],
        "marketing_score": 5,
        "marketing_notes": "Great composition, clear light",
        "before_after_potential": True,
    })
    photo = catalog.get_photo("photo1")
    assert photo["scene"] == "Cedar shake siding with white trim"
    assert photo["marketing_score"] == 5
    assert photo["service_types"] == '["siding", "trim"]'


def test_list_projects(catalog):
    """List projects with optional search."""
    catalog.upsert_project({"id": "1", "name": "Gary Bracelin", "address": "Portland OR", "lat": 0, "lng": 0, "created_at": "2026-03-25", "photo_count": 47})
    catalog.upsert_project({"id": "2", "name": "Cindy Smith", "address": "Seattle WA", "lat": 0, "lng": 0, "created_at": "2026-02-23", "photo_count": 200})
    all_projects = catalog.list_projects()
    assert len(all_projects) == 2
    filtered = catalog.list_projects(query="Gary")
    assert len(filtered) == 1
    assert filtered[0]["name"] == "Gary Bracelin"


def test_get_unanalyzed_photos(catalog):
    """Get photos that haven't been analyzed yet."""
    catalog.upsert_project({"id": "p1", "name": "Proj", "address": "", "lat": 0, "lng": 0, "created_at": "", "photo_count": 2})
    catalog.upsert_photo({"id": "a", "project_id": "p1", "uri": "https://a.jpg", "thumb_uri": "", "taken_at": "", "creator_name": ""})
    catalog.upsert_photo({"id": "b", "project_id": "p1", "uri": "https://b.jpg", "thumb_uri": "", "taken_at": "", "creator_name": ""})
    catalog.update_photo_analysis("a", {"triage_status": "picked", "scene": "test", "service_types": [], "phase": "before", "entities": [], "marketing_score": 3, "marketing_notes": "", "before_after_potential": False})
    unanalyzed = catalog.get_unanalyzed_photos("p1")
    assert len(unanalyzed) == 1
    assert unanalyzed[0]["id"] == "b"


def test_search_photos_fts(catalog):
    """Full-text search across analyzed photos."""
    catalog.upsert_project({"id": "p1", "name": "Proj", "address": "", "lat": 0, "lng": 0, "created_at": "", "photo_count": 2})
    catalog.upsert_photo({"id": "a", "project_id": "p1", "uri": "https://a.jpg", "thumb_uri": "", "taken_at": "", "creator_name": ""})
    catalog.upsert_photo({"id": "b", "project_id": "p1", "uri": "https://b.jpg", "thumb_uri": "", "taken_at": "", "creator_name": ""})
    catalog.update_photo_analysis("a", {"triage_status": "picked", "scene": "Cedar shake siding restoration", "service_types": ["siding"], "phase": "after", "entities": ["siding", "house"], "marketing_score": 5, "marketing_notes": "Excellent composition", "before_after_potential": True})
    catalog.update_photo_analysis("b", {"triage_status": "picked", "scene": "Rotted deck boards with mold", "service_types": ["deck", "mold"], "phase": "before", "entities": ["deck", "mold"], "marketing_score": 4, "marketing_notes": "Good damage documentation", "before_after_potential": True})

    results = catalog.search_photos(q="cedar")
    assert len(results) == 1
    assert results[0]["id"] == "a"

    results = catalog.search_photos(q="mold")
    assert len(results) == 1
    assert results[0]["id"] == "b"


def test_search_photos_filters(catalog):
    """Filter by service, phase, min_score."""
    catalog.upsert_project({"id": "p1", "name": "Proj", "address": "", "lat": 0, "lng": 0, "created_at": "", "photo_count": 2})
    catalog.upsert_photo({"id": "a", "project_id": "p1", "uri": "https://a.jpg", "thumb_uri": "", "taken_at": "2026-04-01", "creator_name": ""})
    catalog.upsert_photo({"id": "b", "project_id": "p1", "uri": "https://b.jpg", "thumb_uri": "", "taken_at": "2026-04-02", "creator_name": ""})
    catalog.update_photo_analysis("a", {"triage_status": "picked", "scene": "Siding install", "service_types": ["siding"], "phase": "during", "entities": [], "marketing_score": 3, "marketing_notes": "", "before_after_potential": False})
    catalog.update_photo_analysis("b", {"triage_status": "picked", "scene": "Finished deck", "service_types": ["deck"], "phase": "after", "entities": [], "marketing_score": 5, "marketing_notes": "", "before_after_potential": True})

    results = catalog.search_photos(service="deck")
    assert len(results) == 1
    assert results[0]["id"] == "b"

    results = catalog.search_photos(phase="during")
    assert len(results) == 1
    assert results[0]["id"] == "a"

    results = catalog.search_photos(min_score=4)
    assert len(results) == 1
    assert results[0]["id"] == "b"

    results = catalog.search_photos(before_after_only=True)
    assert len(results) == 1
    assert results[0]["id"] == "b"


def test_catalog_stats(catalog):
    """Aggregate stats across all analyzed photos."""
    catalog.upsert_project({"id": "p1", "name": "Proj", "address": "", "lat": 0, "lng": 0, "created_at": "", "photo_count": 2})
    catalog.upsert_photo({"id": "a", "project_id": "p1", "uri": "", "thumb_uri": "", "taken_at": "", "creator_name": ""})
    catalog.upsert_photo({"id": "b", "project_id": "p1", "uri": "", "thumb_uri": "", "taken_at": "", "creator_name": ""})
    catalog.update_photo_analysis("a", {"triage_status": "picked", "scene": "Siding", "service_types": ["siding"], "phase": "after", "entities": [], "marketing_score": 5, "marketing_notes": "", "before_after_potential": True})
    catalog.update_photo_analysis("b", {"triage_status": "picked", "scene": "Deck", "service_types": ["deck"], "phase": "before", "entities": [], "marketing_score": 3, "marketing_notes": "", "before_after_potential": False})

    stats = catalog.get_stats()
    assert stats["projects_analyzed"] == 1
    assert stats["photos_analyzed"] == 2
    assert stats["marketing_picks"] == 1
    assert stats["before_after_count"] == 1
    assert stats["service_counts"]["siding"] == 1
    assert stats["service_counts"]["deck"] == 1

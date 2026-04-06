"""Tests for URL-based scanner pipeline that reads from catalog."""
import json
import io
import pytest
from pathlib import Path
from unittest.mock import AsyncMock, patch, MagicMock
from PIL import Image

from photo_scanner.catalog import Catalog
from photo_scanner.scanner import analyze_project_from_catalog


def make_test_image(width=100, height=100) -> bytes:
    """Create a minimal JPEG image as bytes."""
    img = Image.new("RGB", (width, height), color=(128, 128, 128))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


@pytest.fixture
def catalog(tmp_path):
    db = Catalog(tmp_path / "test.db")
    yield db
    db.close()


@pytest.fixture
def seeded_catalog(catalog):
    """Catalog with one project and 3 unanalyzed photos."""
    catalog.upsert_project({"id": "p1", "name": "Test Project", "address": "Portland OR", "lat": 45.5, "lng": -122.6, "created_at": "2026-04-01", "photo_count": 3})
    for i in range(3):
        catalog.upsert_photo({
            "id": f"photo{i}",
            "project_id": "p1",
            "uri": f"https://example.com/photo{i}.jpg",
            "thumb_uri": f"https://example.com/thumb{i}.jpg",
            "taken_at": f"2026-04-0{i+1}",
            "creator_name": "Alice",
        })
    return catalog


@pytest.mark.asyncio
async def test_analyze_project_runs_triage_and_deep(seeded_catalog):
    """Full pipeline: triage picks photos, deep analysis writes results."""
    test_image_bytes = make_test_image()

    triage_response = json.dumps({
        "picks": [{"cell": 1, "service": "siding"}, {"cell": 2, "service": "deck"}],
        "documents": [3],
        "skips": [],
    })
    deep_response = json.dumps({
        "scene": "Test scene description",
        "service_types": ["siding"],
        "phase": "after",
        "entities": ["house", "siding"],
        "marketing_score": 4,
        "marketing_notes": "Good shot",
        "before_after_potential": True,
    })

    mock_cc = AsyncMock()
    mock_cc.get_photo_bytes = AsyncMock(return_value=test_image_bytes)

    mock_anthropic = AsyncMock()
    mock_anthropic.messages.create = AsyncMock(
        side_effect=[
            MagicMock(content=[MagicMock(text=triage_response)]),  # triage
            MagicMock(content=[MagicMock(text=deep_response)]),    # deep photo0
            MagicMock(content=[MagicMock(text=deep_response)]),    # deep photo1
        ]
    )

    progress_updates = []
    def on_progress(update):
        progress_updates.append(update)

    await analyze_project_from_catalog(
        catalog=seeded_catalog,
        project_id="p1",
        cc_client=mock_cc,
        anthropic_client=mock_anthropic,
        on_progress=on_progress,
    )

    # Picked photos got deep analysis
    photo0 = seeded_catalog.get_photo("photo0")
    assert photo0["scene"] == "Test scene description"
    assert photo0["marketing_score"] == 4

    # Document was marked
    photo2 = seeded_catalog.get_photo("photo2")
    assert photo2["triage_status"] == "document"
    assert photo2["scene"] is None

    # Project marked as analyzed
    project = seeded_catalog.get_project("p1")
    assert project["last_analyzed"] is not None

    # Progress was reported
    assert len(progress_updates) > 0


@pytest.mark.asyncio
async def test_analyze_skips_already_analyzed(seeded_catalog):
    """Photos with existing analysis are skipped."""
    seeded_catalog.update_photo_analysis("photo0", {
        "triage_status": "picked", "scene": "Already done", "service_types": ["siding"],
        "phase": "after", "entities": [], "marketing_score": 5,
        "marketing_notes": "", "before_after_potential": False,
    })

    test_image_bytes = make_test_image()
    triage_response = json.dumps({
        "picks": [{"cell": 1, "service": "deck"}, {"cell": 2, "service": "trim"}],
        "documents": [],
        "skips": [],
    })
    deep_response = json.dumps({
        "scene": "New analysis", "service_types": ["deck"], "phase": "before",
        "entities": ["deck"], "marketing_score": 3, "marketing_notes": "", "before_after_potential": False,
    })

    mock_cc = AsyncMock()
    mock_cc.get_photo_bytes = AsyncMock(return_value=test_image_bytes)

    mock_anthropic = AsyncMock()
    mock_anthropic.messages.create = AsyncMock(
        side_effect=[
            MagicMock(content=[MagicMock(text=triage_response)]),
            MagicMock(content=[MagicMock(text=deep_response)]),
            MagicMock(content=[MagicMock(text=deep_response)]),
        ]
    )

    await analyze_project_from_catalog(
        catalog=seeded_catalog,
        project_id="p1",
        cc_client=mock_cc,
        anthropic_client=mock_anthropic,
    )

    # photo0 keeps its original analysis
    photo0 = seeded_catalog.get_photo("photo0")
    assert photo0["scene"] == "Already done"
    assert photo0["marketing_score"] == 5

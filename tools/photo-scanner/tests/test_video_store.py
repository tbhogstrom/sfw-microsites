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

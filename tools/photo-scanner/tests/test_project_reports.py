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


# ============================================================================
# Task 3-6: pipeline helper + orchestrator tests
# ============================================================================

from unittest.mock import AsyncMock, MagicMock
from photo_scanner.reports import (
    write_project_narrative,
    score_grid_cells,
    select_finalists,
    pick_finalists_with_captions,
    finalist_score_fallback,
    generate_project_report,
)


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

    scored = await score_grid_cells(
        grid_b64="fakebase64data",
        narrative={"headline": "Test", "work_performed": "Did the thing."},
        anthropic_client=mock_client,
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
    picks = await pick_finalists_with_captions(
        finalist_grids=finalist_grids,
        narrative={"headline": "Test", "work_performed": "Work."},
        anthropic_client=mock_client,
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
    assert picks[0]["caption"] == "Before shot"


def test_finalist_score_fallback_handles_short_pool():
    finalists = [
        {"photo_id": "a", "score": 5, "phase": "before", "scene": "Only one"},
    ]
    picks = finalist_score_fallback(finalists, count=6)
    assert len(picks) == 1


def _solid_image_bytes_for_e2e() -> bytes:
    from PIL import Image
    import io
    img = Image.new("RGB", (200, 200), (50, 80, 120))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


@pytest.fixture
def project_with_photos(project_with_summary):
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
async def test_generate_project_report_e2e(project_with_photos):
    mock_cc = AsyncMock()
    mock_cc.get_photo_bytes = AsyncMock(return_value=_solid_image_bytes_for_e2e())

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
    assert len(report["photos"]) >= 1
    assert report["photos"][0]["caption"]
    assert report["photos"][0]["role"] in ("conditions", "work", "status")
    assert "stats" in report


@pytest.mark.asyncio
async def test_generate_project_report_partial_when_few_photos(project_with_summary):
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

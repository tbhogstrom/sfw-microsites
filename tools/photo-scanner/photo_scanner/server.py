"""
Photo Scanner — FastAPI dev server for browsing scan results.
Reloads from disk on each API call so you see live progress during scans.
Proxies upload/write requests to the photo-picker server (localhost:3000).
"""

import argparse
import asyncio
import base64
import io
import json
import os
import sys
import webbrowser
from pathlib import Path

import httpx
from fastapi import FastAPI, Query, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from jinja2 import Environment, FileSystemLoader
from PIL import Image, ImageDraw, ImageFont

from photo_scanner.catalog import Catalog
from photo_scanner.companycam import CompanyCamClient
from photo_scanner.reports import generate_daily_report, generate_weekly_report
from photo_scanner.anthropic_auth import (
    describe_anthropic_auth,
    get_async_anthropic_client as build_async_anthropic_client,
    load_project_env,
)

SERVICE_TO_MICROSITE = {
    "siding": "siding-repair",
    "deck": "deck-repair",
    "dry-rot": "dry-rot",
    "chimney": "chimney-repair",
    "crawlspace": "crawlspace-rot",
    "flashing": "flashing-repair",
    "trim": "trim-repair",
    "beam": "beam-repair",
    "leak": "leak-repair",
    "lead-paint": "lead-paint",
    "mold": "mold-testing",
    "restoration": "restoration",
}

app = FastAPI(title="Photo Scanner Viewer")

SOURCE_DIR: Path = Path(".")
PHOTO_PICKER_URL = "http://localhost:4000"  # photo-picker server
TEMPLATES_DIR = Path(__file__).parent / "templates"

jinja_env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)))

# Catalog and CompanyCam client — initialized in main() when token is available
catalog: Catalog | None = None
cc_client: CompanyCamClient | None = None

# Background task state for analysis
_task_state: dict = {"status": "idle", "project_id": None, "progress": {}}


def load_results() -> dict:
    """Reload results from disk each time — live updates during scan."""
    results_path = SOURCE_DIR / "scan_results.json"
    if results_path.exists():
        try:
            with open(results_path) as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            return {}
    return {}


STATIC_DIR = Path(__file__).parent / "static"


@app.get("/static/{path:path}")
async def serve_static(path: str):
    file_path = STATIC_DIR / path
    if file_path.is_file():
        return FileResponse(file_path)
    return JSONResponse({"error": "not found"}, status_code=404)


@app.get("/", response_class=HTMLResponse)
async def index():
    template = jinja_env.get_template("index.html")
    return template.render(service_to_microsite=SERVICE_TO_MICROSITE)


REPORT_PROMPT = """\
These 9 photos are from a single construction job site visit. Analyze what work is being done.

Respond in JSON only:
{
  "services": ["primary service types from: siding, deck, dry-rot, chimney, crawlspace, flashing, trim, beam, leak, lead-paint, mold, restoration, painting, roofing, general"],
  "tasks": ["specific activities visible: demolition, framing, insulation, painting, siding install, trim work, etc."],
  "phase": "one of: assessment, demolition, in-progress, finishing, complete",
  "summary": "one sentence describing the work being done at this job site"
}
"""

# Report state — stored in memory during generation
report_state = {"status": "idle", "projects": [], "stats": {}, "path": ""}


def get_anthropic_client_sync():
    return build_async_anthropic_client()


def build_report_grid(images: list[Path], cell_size: int = 256) -> Image.Image:
    grid_size = cell_size * 3
    grid = Image.new("RGB", (grid_size, grid_size), (40, 40, 40))
    for idx, img_path in enumerate(images[:9]):
        row, col = divmod(idx, 3)
        x, y = col * cell_size, row * cell_size
        try:
            with Image.open(img_path) as img:
                img.thumbnail((cell_size, cell_size))
                ox = x + (cell_size - img.width) // 2
                oy = y + (cell_size - img.height) // 2
                grid.paste(img, (ox, oy))
        except Exception:
            pass
    return grid


def find_report_images(report_path: Path) -> dict[str, list[Path]]:
    EXTS = {".jpg", ".jpeg", ".png", ".webp"}
    folders: dict[str, list[Path]] = {}
    for entry in sorted(report_path.iterdir()):
        if entry.is_dir() and not entry.name.startswith("."):
            images = sorted(
                p for p in entry.iterdir()
                if p.is_file() and p.suffix.lower() in EXTS
            )
            if images:
                folders[entry.name] = images
    return folders


async def analyze_report_grid(client, grid_img: Image.Image) -> dict:
    buf = io.BytesIO()
    grid_img.save(buf, format="JPEG", quality=85)
    b64 = base64.b64encode(buf.getvalue()).decode()

    for attempt in range(3):
        try:
            response = await client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=512,
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": b64}},
                        {"type": "text", "text": REPORT_PROMPT},
                    ],
                }],
            )
            text = response.content[0].text.strip()
            if text.startswith("```"):
                lines = text.split("\n")
                lines = [l for l in lines if not l.strip().startswith("```")]
                text = "\n".join(lines)
            start = text.find("{")
            end = text.rfind("}")
            if start != -1 and end != -1:
                return json.loads(text[start:end + 1])
            return {"services": [], "tasks": [], "phase": "unknown", "summary": "Could not parse response"}
        except Exception as e:
            if "429" in str(e) and attempt < 2:
                await asyncio.sleep(15 * (attempt + 1))
            else:
                return {"services": [], "tasks": [], "phase": "unknown", "summary": f"Error: {e}"}


async def generate_report(report_path: Path):
    global report_state
    report_state = {"status": "running", "projects": [], "stats": {}, "path": str(report_path)}

    client = get_anthropic_client_sync()
    if not client:
        report_state["status"] = "error"
        report_state["stats"] = {"error": "No Anthropic auth configured"}
        return

    folders = find_report_images(report_path)
    total_photos = sum(len(imgs) for imgs in folders.values())
    total_projects = len(folders)
    report_state["stats"] = {"total_projects": total_projects, "total_photos": total_photos, "analyzed": 0}

    # Generate thumbs dir
    thumbs_dir = report_path / ".thumbs"
    thumbs_dir.mkdir(exist_ok=True)

    projects = []
    analyzed = 0

    for folder_name, images in sorted(folders.items()):
        # Make thumbnail of first image for the card
        first_thumb_rel = f"{folder_name}/{images[0].name}"
        thumb_path = thumbs_dir / first_thumb_rel
        if not thumb_path.exists():
            thumb_path.parent.mkdir(parents=True, exist_ok=True)
            try:
                with Image.open(images[0]) as img:
                    img.thumbnail((320, 320))
                    img.save(thumb_path, "JPEG", quality=80)
            except Exception:
                pass

        # Build grids and analyze
        all_services = set()
        all_tasks = set()
        all_phases = []
        all_summaries = []

        grids = [images[i:i+9] for i in range(0, len(images), 9)]
        for grid_batch in grids:
            grid_img = build_report_grid(grid_batch)
            result = await analyze_report_grid(client, grid_img)
            for s in result.get("services", []):
                all_services.add(s)
            for t in result.get("tasks", []):
                all_tasks.add(t)
            all_phases.append(result.get("phase", "unknown"))
            all_summaries.append(result.get("summary", ""))

        # Pick dominant phase
        from collections import Counter
        phase_counts = Counter(all_phases)
        dominant_phase = phase_counts.most_common(1)[0][0] if phase_counts else "unknown"

        # Pick best summary (longest, most descriptive)
        best_summary = max(all_summaries, key=len) if all_summaries else ""

        project = {
            "name": folder_name,
            "photo_count": len(images),
            "grid_count": len(grids),
            "services": sorted(all_services),
            "tasks": sorted(all_tasks),
            "phase": dominant_phase,
            "summary": best_summary,
            "thumbnail": f".thumbs/{first_thumb_rel}",
        }
        projects.append(project)
        analyzed += 1
        report_state["projects"] = projects
        report_state["stats"]["analyzed"] = analyzed

    # Compute aggregate stats
    service_counts = {}
    phase_counts_agg = {}
    for p in projects:
        for s in p["services"]:
            service_counts[s] = service_counts.get(s, 0) + 1
        phase_counts_agg[p["phase"]] = phase_counts_agg.get(p["phase"], 0) + 1

    report_state["stats"]["service_counts"] = dict(sorted(service_counts.items(), key=lambda x: -x[1]))
    report_state["stats"]["phase_counts"] = phase_counts_agg
    report_state["status"] = "complete"


@app.get("/report", response_class=HTMLResponse)
async def report_page(path: str = Query(...)):
    """Kick off report generation and serve the report page."""
    report_path = Path(path).resolve()
    if not report_path.is_dir():
        return HTMLResponse(f"<h1>Error: {path} is not a directory</h1>", status_code=400)

    # Start generation in background if not already running for this path
    if report_state["status"] != "running" or report_state["path"] != str(report_path):
        asyncio.create_task(generate_report(report_path))

    template = jinja_env.get_template("report.html")
    return template.render(report_path=str(report_path))


@app.get("/api/report")
async def report_data():
    return report_state


@app.get("/report-photos/{path:path}")
async def serve_report_photo(path: str):
    """Serve photos from the report path."""
    rp = Path(report_state.get("path", ""))
    if not rp.is_dir():
        return {"error": "no report path"}
    file_path = rp / path
    if file_path.is_file():
        return FileResponse(file_path)
    return {"error": "not found"}


@app.get("/api/results")
async def get_results(
    microsite: str | None = Query(None),
    min_score: int = Query(0),
    phase: str | None = Query(None),
    folder: str | None = Query(None),
):
    results = load_results()
    folders = results.get("folders", {})
    filtered = {}

    for folder_name, folder_data in folders.items():
        if folder and folder_name != folder:
            continue
        photos = []
        for photo in folder_data.get("photos", []):
            score = photo.get("marketing_score", 0)
            if score < min_score:
                continue
            if phase and phase != "all" and photo.get("phase") != phase:
                continue
            if microsite:
                service_types = photo.get("service_types", [])
                microsites = [SERVICE_TO_MICROSITE.get(s, s) for s in service_types]
                if microsite not in microsites:
                    continue
            photos.append(photo)
        if photos:
            filtered[folder_name] = {"photo_count": len(photos), "photos": photos}

    return {**results, "folders": filtered}


@app.get("/api/stats")
async def get_stats():
    results = load_results()
    stats = results.get("stats", {})
    progress = results.get("progress", {})
    folders = results.get("folders", {})

    service_counts: dict[str, int] = {}
    score_dist = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    phase_counts: dict[str, int] = {}
    total_analyzed = 0

    for folder_data in folders.values():
        for photo in folder_data.get("photos", []):
            if not photo.get("scene"):
                continue
            total_analyzed += 1
            for svc in photo.get("service_types", []):
                service_counts[svc] = service_counts.get(svc, 0) + 1
            score = photo.get("marketing_score", 0)
            if 1 <= score <= 5:
                score_dist[score] += 1
            p = photo.get("phase", "other")
            phase_counts[p] = phase_counts.get(p, 0) + 1

    return {
        "pipeline_stats": stats,
        "progress": progress,
        "total_analyzed": total_analyzed,
        "service_counts": dict(sorted(service_counts.items(), key=lambda x: -x[1])),
        "score_distribution": score_dist,
        "phase_counts": phase_counts,
        "marketing_candidates": sum(v for k, v in score_dist.items() if k >= 4),
    }


@app.get("/api/grids")
async def get_grids():
    """Return grid metadata for the triage viewer."""
    results = load_results()
    return {
        "grids": results.get("grids", []),
        "progress": results.get("progress", {}),
    }


# --- CompanyCam project browsing ---

@app.get("/api/companycam/projects")
async def cc_list_projects(
    q: str | None = Query(None),
    page: int = Query(1),
    per_page: int = Query(50),
):
    if cc_client is None:
        return JSONResponse({"error": "CompanyCam not configured (no COMPANYCAM_API_TOKEN)"}, status_code=503)
    # Fetch multiple pages to get more projects (CC API returns max 50 per page)
    raw_projects = []
    fetch_page = 1
    while len(raw_projects) < per_page:
        batch = await cc_client.list_projects(page=fetch_page, per_page=50, query=q)
        if not batch:
            break
        raw_projects.extend(batch)
        if len(batch) < 50:
            break
        fetch_page += 1
    projects = [CompanyCamClient.normalize_project(p) for p in raw_projects]
    # Merge sync/analysis status and summaries from catalog
    if catalog is not None:
        for proj in projects:
            local = catalog.get_project(proj["id"])
            if local:
                proj["last_synced"] = local.get("last_synced")
                proj["last_analyzed"] = local.get("last_analyzed")
                summary = catalog.get_project_summary(proj["id"])
                if summary:
                    proj["summary"] = summary
            else:
                proj["last_synced"] = None
                proj["last_analyzed"] = None
    # Pass through feature_image from CompanyCam
    for proj, raw in zip(projects, raw_projects):
        fi = raw.get("feature_image")
        if isinstance(fi, list) and fi:
            proj["feature_image"] = fi[0].get("url", "") if isinstance(fi[0], dict) else fi[0]
        elif isinstance(fi, str):
            proj["feature_image"] = fi
        else:
            proj["feature_image"] = None
    return {"projects": projects, "page": page, "per_page": per_page}


@app.get("/api/companycam/projects/{project_id}")
async def cc_get_project(project_id: str):
    if cc_client is None:
        return JSONResponse({"error": "CompanyCam not configured"}, status_code=503)
    raw = await cc_client.get_project(project_id)
    proj = CompanyCamClient.normalize_project(raw)
    # Merge catalog status and stats
    if catalog is not None:
        local = catalog.get_project(project_id)
        if local:
            proj["last_synced"] = local.get("last_synced")
            proj["last_analyzed"] = local.get("last_analyzed")
        else:
            proj["last_synced"] = None
            proj["last_analyzed"] = None
        # Analysis stats for this project
        photos = catalog.get_project_photos(project_id, per_page=10000)
        analyzed = [p for p in photos if p.get("scene")]
        proj["photos_synced"] = len(photos)
        proj["photos_analyzed"] = len(analyzed)
        proj["marketing_picks"] = sum(1 for p in analyzed if (p.get("marketing_score") or 0) >= 4)
        # Project summary (generated after analysis)
        proj["project_summary"] = catalog.get_project_summary_data(project_id)
    return proj


@app.get("/api/companycam/projects/{project_id}/photos")
async def cc_get_project_photos(
    project_id: str,
    page: int = Query(1),
    per_page: int = Query(50),
):
    if cc_client is None:
        return JSONResponse({"error": "CompanyCam not configured"}, status_code=503)
    raw_photos = await cc_client.list_project_photos(project_id, page=page, per_page=per_page)
    photos = [CompanyCamClient.normalize_photo(p, project_id) for p in raw_photos]
    # Merge analysis data from catalog
    if catalog is not None:
        for photo in photos:
            local = catalog.get_photo(photo["id"])
            if local:
                for field in ("triage_status", "scene", "service_types", "phase",
                              "entities", "marketing_score", "marketing_notes", "before_after_potential"):
                    photo[field] = local.get(field)
    return {"photos": photos, "page": page, "per_page": per_page}


# --- Sync and analyze ---

@app.post("/api/companycam/projects/{project_id}/sync")
async def cc_sync_project(project_id: str):
    if cc_client is None:
        return JSONResponse({"error": "CompanyCam not configured"}, status_code=503)
    if catalog is None:
        return JSONResponse({"error": "Catalog not initialized"}, status_code=503)

    # Fetch project metadata and upsert
    raw_proj = await cc_client.get_project(project_id)
    proj = CompanyCamClient.normalize_project(raw_proj)
    catalog.upsert_project(proj)

    # Paginate all photos
    page = 1
    total_synced = 0
    while True:
        raw_photos = await cc_client.list_project_photos(project_id, page=page, per_page=100)
        if not raw_photos:
            break
        for raw_photo in raw_photos:
            photo = CompanyCamClient.normalize_photo(raw_photo, project_id)
            catalog.upsert_photo(photo)
            total_synced += 1
        if len(raw_photos) < 100:
            break
        page += 1

    catalog.set_project_synced(project_id)
    return {"ok": True, "project_id": project_id, "photos_synced": total_synced}


@app.post("/api/companycam/projects/{project_id}/analyze")
async def cc_analyze_project(project_id: str):
    global _task_state
    if cc_client is None:
        return JSONResponse({"error": "CompanyCam not configured"}, status_code=503)
    if catalog is None:
        return JSONResponse({"error": "Catalog not initialized"}, status_code=503)

    local = catalog.get_project(project_id)
    if not local:
        return JSONResponse({"error": "Project not found in catalog. Sync it first."}, status_code=404)

    if _task_state.get("status") == "running":
        return JSONResponse({"error": "Analysis already running", "task": _task_state}, status_code=409)

    from photo_scanner.scanner import analyze_project_from_catalog, get_async_anthropic_client
    anthropic_client = get_async_anthropic_client()
    if not anthropic_client:
        return JSONResponse({"error": "No Anthropic auth configured"}, status_code=503)

    _task_state = {"status": "running", "project_id": project_id, "progress": {}}

    async def run_analysis():
        global _task_state
        try:
            def on_progress(info: dict):
                _task_state["progress"] = info
            await analyze_project_from_catalog(catalog, project_id, cc_client, anthropic_client, on_progress=on_progress)
            catalog.set_project_analyzed(project_id)
            _task_state["status"] = "complete"
        except Exception as e:
            _task_state["status"] = "error"
            _task_state["progress"] = {"error": str(e)}

    asyncio.create_task(run_analysis())
    return {"ok": True, "project_id": project_id, "task": _task_state}


@app.get("/api/companycam/task")
async def cc_task_status():
    return _task_state


@app.post("/api/companycam/batch")
async def cc_batch_sync_analyze(request: Request):
    global _task_state
    if cc_client is None:
        return JSONResponse({"error": "CompanyCam not configured"}, status_code=503)
    if catalog is None:
        return JSONResponse({"error": "Catalog not initialized"}, status_code=503)

    body = await request.json()
    project_ids = body.get("project_ids", [])
    do_analyze = body.get("analyze", False)

    from photo_scanner.scanner import analyze_project_from_catalog, get_async_anthropic_client
    anthropic_client = None
    if do_analyze:
        anthropic_client = get_async_anthropic_client()
        if not anthropic_client:
            return JSONResponse({"error": "No Anthropic auth configured"}, status_code=503)

    results = []
    for pid in project_ids:
        # Sync
        try:
            raw_proj = await cc_client.get_project(pid)
            proj = CompanyCamClient.normalize_project(raw_proj)
            catalog.upsert_project(proj)
            page = 1
            synced = 0
            while True:
                raw_photos = await cc_client.list_project_photos(pid, page=page, per_page=100)
                if not raw_photos:
                    break
                for rp in raw_photos:
                    catalog.upsert_photo(CompanyCamClient.normalize_photo(rp, pid))
                    synced += 1
                if len(raw_photos) < 100:
                    break
                page += 1
            catalog.set_project_synced(pid)
            result = {"project_id": pid, "synced": synced}
        except Exception as e:
            results.append({"project_id": pid, "error": str(e)})
            continue

        # Analyze inline (blocking per project)
        if do_analyze and anthropic_client:
            try:
                await analyze_project_from_catalog(catalog, pid, cc_client, anthropic_client)
                catalog.set_project_analyzed(pid)
                result["analyzed"] = True
            except Exception as e:
                result["analyze_error"] = str(e)

        results.append(result)

    return {"ok": True, "results": results}


# --- Photo proxy ---

@app.get("/api/photo/{photo_id}/full")
async def proxy_photo_full(photo_id: str):
    if catalog is None:
        return JSONResponse({"error": "Catalog not initialized"}, status_code=503)
    if cc_client is None:
        return JSONResponse({"error": "CompanyCam not configured"}, status_code=503)
    photo = catalog.get_photo(photo_id)
    if not photo:
        return JSONResponse({"error": "Photo not found in catalog"}, status_code=404)
    uri = photo.get("uri", "")
    if not uri:
        return JSONResponse({"error": "No URI for photo"}, status_code=404)
    img_bytes = await cc_client.get_photo_bytes(uri)
    from fastapi.responses import Response
    return Response(content=img_bytes, media_type="image/jpeg")


@app.get("/api/photo/{photo_id}/thumb")
async def proxy_photo_thumb(photo_id: str):
    if catalog is None:
        return JSONResponse({"error": "Catalog not initialized"}, status_code=503)
    if cc_client is None:
        return JSONResponse({"error": "CompanyCam not configured"}, status_code=503)
    photo = catalog.get_photo(photo_id)
    if not photo:
        return JSONResponse({"error": "Photo not found in catalog"}, status_code=404)
    uri = photo.get("thumb_uri") or photo.get("uri", "")
    if not uri:
        return JSONResponse({"error": "No URI for photo"}, status_code=404)
    img_bytes = await cc_client.get_photo_bytes(uri)
    from fastapi.responses import Response
    return Response(content=img_bytes, media_type="image/jpeg")


# --- Catalog search and stats ---

@app.get("/api/catalog/search")
async def catalog_search(
    q: str | None = Query(None),
    service: str | None = Query(None),
    phase: str | None = Query(None),
    min_score: int = Query(0),
    project: str | None = Query(None),
    before_after_only: bool = Query(False),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    page: int = Query(1),
    per_page: int = Query(50),
):
    if catalog is None:
        return JSONResponse({"error": "Catalog not initialized"}, status_code=503)
    photos = catalog.search_photos(
        q=q, service=service, phase=phase, min_score=min_score,
        project_id=project, before_after_only=before_after_only,
        date_from=date_from, date_to=date_to, page=page, per_page=per_page,
    )
    return {"photos": photos, "page": page, "per_page": per_page, "count": len(photos)}


@app.get("/api/catalog/stats")
async def catalog_stats():
    if catalog is None:
        return JSONResponse({"error": "Catalog not initialized"}, status_code=503)
    stats = catalog.get_stats()
    weekly = catalog.get_weekly_activity()
    return {**stats, "weekly_activity": weekly}


@app.get("/api/catalog/export/{project_id}")
async def catalog_export(project_id: str):
    if catalog is None:
        return JSONResponse({"error": "Catalog not initialized"}, status_code=503)
    project = catalog.get_project(project_id)
    if not project:
        return JSONResponse({"error": "Project not found"}, status_code=404)
    photos = catalog.get_project_photos(project_id, per_page=10000)
    return {"project": project, "photos": photos, "photo_count": len(photos)}


@app.get("/photos/{path:path}")
async def serve_photo(path: str):
    file_path = SOURCE_DIR / path
    if file_path.is_file():
        return FileResponse(file_path)
    return {"error": "not found"}


@app.get("/thumbs/{path:path}")
async def serve_thumb(path: str):
    file_path = SOURCE_DIR / ".thumbs" / path
    if file_path.is_file():
        return FileResponse(file_path)
    file_path = SOURCE_DIR / path
    if file_path.is_file():
        return FileResponse(file_path)
    return {"error": "not found"}


@app.get("/grids/{path:path}")
async def serve_grid(path: str):
    file_path = SOURCE_DIR / ".grids" / path
    if file_path.is_file():
        return FileResponse(file_path)
    return {"error": "not found"}


# --- Curated gallery presets ---

CURATED_GALLERIES = [
    {
        "id": "victorian-home-restoration",
        "name": "Victorian Home Restoration",
        "microsite": "siding-repair",
        "description": "Full restoration of a Victorian home with collapsed roof section. Before: dramatic structural damage, peeling paint, severe dry rot. During: beam installation, framing repair. After: restored Craftsman exterior with new siding and trim.",
        "photos": [
            {"path": "Thelma Dobson 03-13-2026/183-Mar 23 2026 11_14am-h98M.jpg", "alt": "Dramatic structural damage to Victorian home with collapsed upper floor section"},
            {"path": "Thelma Dobson 03-13-2026/102-Mar 16 2026 02_23pm-beXS.jpg", "alt": "Deteriorated wooden siding with peeling paint and dry rot at foundation level"},
            {"path": "Thelma Dobson 03-13-2026/106-Mar 16 2026 02_25pm-WGGo.jpg", "alt": "Severe peeling paint and rot damage on white wood siding and trim"},
            {"path": "Thelma Dobson 03-13-2026/100-Mar 16 2026 02_23pm-jE3h.jpg", "alt": "Deteriorated roof trim and fascia board with extensive dry rot"},
            {"path": "Thelma Dobson 03-13-2026/50-Mar 13 2026 11_12am-Dv2u.jpg", "alt": "Door frame demolition revealing extensive dry rot in sill plate and foundation"},
            {"path": "Thelma Dobson 03-13-2026/154-Mar 18 2026 02_59pm-ZnsZ.jpg", "alt": "Worker installing structural beam header above exterior opening"},
            {"path": "Thelma Dobson 03-13-2026/Customer Provided Photo-13-Mar 12 2026 02_23pm-ooM7.jpg", "alt": "Restored home front porch with green siding, white trim, and red front door"},
            {"path": "Thelma Dobson 03-13-2026/Customer Provided Photo-26-Mar 12 2026 02_23pm-vKiw.jpg", "alt": "Fully restored two-story Craftsman house with new siding and renovated porch"},
        ],
    },
    {
        "id": "deck-siding-restoration",
        "name": "Deck & Siding Restoration",
        "microsite": "siding-repair",
        "description": "Complete deck and siding restoration showing severe rot damage through paint removal to finished deck. Great close-up craft shots.",
        "photos": [
            {"path": "Nathan Silpakit 02-24-2026/10-Feb 24 2026 09_14am-CTzW.jpg", "alt": "Damaged wood siding with exposed rot and weathered gray paint"},
            {"path": "Nathan Silpakit 02-24-2026/15-Feb 24 2026 09_43am-J7zR.jpg", "alt": "Severely rotted wooden deck structure with extensive dry rot damage"},
            {"path": "Nathan Silpakit 02-24-2026/18-Feb 24 2026 09_43am-3MkE.jpg", "alt": "Close-up of severely rotted beam junction showing extensive decay"},
            {"path": "Nathan Silpakit 02-24-2026/19-Feb 24 2026 09_44am-3ZBy.jpg", "alt": "Deteriorated deck railing with dry rot and insect damage"},
            {"path": "Nathan Silpakit 02-24-2026/27-Feb 24 2026 10_46am-jGXY.jpg", "alt": "Scraper tool removing peeling paint from weathered wood siding"},
            {"path": "Nathan Silpakit 02-24-2026/28-Feb 24 2026 10_46am-W6mW.jpg", "alt": "Putty knife scraping paint layers from wood siding during restoration"},
            {"path": "Nathan Silpakit 02-24-2026/14-Feb 24 2026 09_17am-43mv.jpg", "alt": "Finished wooden deck with outdoor furniture and planters"},
        ],
    },
    {
        "id": "structural-rot-cedar-shake",
        "name": "Structural Rot & Cedar Shake Repair",
        "microsite": "siding-repair",
        "description": "Major crawlspace and structural repair with cedar shake siding installation. Dramatic before shots of joist rot, workers in action, finished cedar exterior.",
        "photos": [
            {"path": "Cindy Smith 02-23-2026/127-Feb 26 2026 03_06pm-Du2F.jpg", "alt": "Deteriorated floor joists and subflooring showing extensive dry rot in crawlspace"},
            {"path": "Cindy Smith 02-23-2026/13-Feb 23 2026 10_54am-AqqN.jpg", "alt": "Severely deteriorated door frame and threshold with extensive dry rot"},
            {"path": "Cindy Smith 02-23-2026/15-Feb 23 2026 10_54am-wp43.jpg", "alt": "Severely rotted structural timber showing extensive decay"},
            {"path": "Cindy Smith 02-23-2026/12-Feb 23 2026 10_52am-Rfm8.jpg", "alt": "Worker examining dry rot damage on structural beams and cedar shingle siding"},
            {"path": "Cindy Smith 02-23-2026/112-Feb 26 2026 08_45am-oN6h.jpg", "alt": "Two workers installing insulation between ceiling joists"},
            {"path": "Cindy Smith 02-23-2026/120-Feb 26 2026 11_27am-GwGb.jpg", "alt": "Exposed wall framing showing water damage and pink insulation during repair"},
            {"path": "Cindy Smith 02-23-2026/235-Mar 03 2026 03_42pm-C78z.jpg", "alt": "House exterior with new cedar shake siding and modern white trim"},
            {"path": "Cindy Smith 02-23-2026/456-Mar 09 2026 03_15pm-AJuh.jpg", "alt": "Cedar shake siding installation with quality craftsmanship detail"},
        ],
    },
    {
        "id": "dry-rot-siding-repair",
        "name": "Dry Rot & Siding Repair",
        "microsite": "siding-repair",
        "description": "Dramatic rot reveals at roof-wall junctions, workers installing house wrap and siding, window flashing repair.",
        "photos": [
            {"path": "Gary Bracelin 03-25-2026/1-Mar 25 2026 11_18am-B2nt.jpg", "alt": "Deteriorated deck boards with significant dry rot against white siding"},
            {"path": "Gary Bracelin 03-25-2026/10-Mar 25 2026 01_54pm-Es3Z.jpg", "alt": "Severe dry rot at roof-wall junction with deteriorated flashing"},
            {"path": "Gary Bracelin 03-25-2026/11-Mar 25 2026 01_59pm-Jf4Z.jpg", "alt": "Severe dry rot damage to trim and framing at exterior building corner"},
            {"path": "Gary Bracelin 03-25-2026/13-Mar 25 2026 02_31pm-XFXs.jpg", "alt": "Close-up of severely rotted structural beam with exposed decay"},
            {"path": "Gary Bracelin 03-25-2026/12-Mar 25 2026 02_16pm-JUGP.jpg", "alt": "Pry bar revealing dry rot damage in beam with peeling paint and moss"},
            {"path": "Gary Bracelin 03-25-2026/29-Mar 26 2026 11_06am-J2hg.jpg", "alt": "Workers installing house wrap and siding on exterior wall"},
            {"path": "Gary Bracelin 03-25-2026/33-Mar 26 2026 04_02pm-ZrvR.jpg", "alt": "Worker repairing window flashing and trim from ladder"},
        ],
    },
    {
        "id": "foundation-rot-siding",
        "name": "Foundation Rot & Siding Replacement",
        "microsite": "siding-repair",
        "description": "Foundation-level structural rot repair with full siding replacement. Workers measuring and installing new siding, dramatic crawlspace damage documentation.",
        "photos": [
            {"path": "James DeForest 03-13-2026/10-Mar 13 2026 09_18am-3XkJ.jpg", "alt": "Severely deteriorated foundation sill plate with extensive dry rot"},
            {"path": "James DeForest 03-13-2026/140-Mar 23 2026 10_55am-7S8j.jpg", "alt": "Warped and damaged horizontal siding along house exterior"},
            {"path": "James DeForest 03-13-2026/14-Mar 13 2026 10_58am-XDMg.jpg", "alt": "Rotted sill plate and foundation damage at structural corner"},
            {"path": "James DeForest 03-13-2026/17-Mar 13 2026 11_07am-Hfty.jpg", "alt": "Severe dry rot exposed in structural beam during repair work"},
            {"path": "James DeForest 03-13-2026/18-Mar 13 2026 11_08am-naXG.jpg", "alt": "Crowbar exposing rotted floor joists and subflooring in crawlspace"},
            {"path": "James DeForest 03-13-2026/105-Mar 18 2026 04_04pm-gnhZ.jpg", "alt": "Two workers installing new wood siding on exterior wall"},
            {"path": "James DeForest 03-13-2026/124-Mar 19 2026 01_59pm-3GHP.jpg", "alt": "Worker installing white siding below window with precision"},
        ],
    },
]


EXTERNAL_GALLERIES: list[dict] = []  # loaded from --galleries flag or JSON files


def load_external_galleries(gallery_paths: list[Path]):
    """Load gallery JSON files. Each file has a lightboxGalleries array."""
    for gpath in gallery_paths:
        if not gpath.exists():
            print(f"Warning: gallery file not found: {gpath}", file=sys.stderr)
            continue
        try:
            with open(gpath) as f:
                data = json.load(f)
            site = data.get("site", "")
            for g in data.get("lightboxGalleries", []):
                EXTERNAL_GALLERIES.append({
                    "id": g["id"],
                    "name": g["name"],
                    "microsite": site,
                    "description": f"{g['name']} — {len(g['images'])} photos for {site}",
                    "photos": [{"path": img["path"], "alt": img["alt"]} for img in g["images"]],
                })
            print(f"Loaded {len(data.get('lightboxGalleries', []))} galleries from {gpath.name}", file=sys.stderr)
        except Exception as e:
            print(f"Error loading {gpath}: {e}", file=sys.stderr)


@app.get("/api/curated-galleries")
async def get_curated_galleries():
    return {"galleries": EXTERNAL_GALLERIES + CURATED_GALLERIES}


# --- Daily Reports ---

# Report generation state (background task)
_report_task_state: dict = {"status": "idle"}


@app.post("/api/reports/generate")
async def api_generate_reports(request: Request):
    """Generate daily homeowner reports: sync → analyze → report. Runs in background."""
    global _report_task_state
    if not catalog:
        return JSONResponse({"error": "Catalog not initialized"}, status_code=503)
    if not cc_client:
        return JSONResponse({"error": "CompanyCam not configured"}, status_code=503)

    body = await request.json()
    date_str = body.get("date")
    project_id = body.get("project_id")

    if not date_str:
        return JSONResponse({"error": "date is required (YYYY-MM-DD)"}, status_code=400)

    from datetime import datetime as dt, timezone as tz
    try:
        day_start = dt.strptime(date_str, "%Y-%m-%d").replace(tzinfo=tz.utc)
    except ValueError:
        return JSONResponse({"error": "Invalid date format. Use YYYY-MM-DD"}, status_code=400)
    ts_start = int(day_start.timestamp())
    ts_end = ts_start + 86400

    from photo_scanner.scanner import get_async_anthropic_client, analyze_project_from_catalog
    anthropic_client = get_async_anthropic_client()
    if not anthropic_client:
        return JSONResponse({"error": "Anthropic auth not configured"}, status_code=503)

    if _report_task_state["status"] == "running":
        return JSONResponse({"error": "Report generation already running"}, status_code=409)

    _report_task_state = {"status": "running", "date": date_str, "step": "discovering", "reports": []}

    async def run():
        global _report_task_state
        try:
            # Step 1: Discover projects with photos on this date from CompanyCam
            _report_task_state["step"] = "Discovering projects with photos on " + date_str
            target_ts_start = ts_start
            target_ts_end = ts_end

            # Fetch all active projects from CompanyCam
            all_projects = []
            page = 1
            while len(all_projects) < 200:
                batch = await cc_client.list_projects(page=page, per_page=50)
                if not batch:
                    break
                all_projects.extend(batch)
                if len(batch) < 50:
                    break
                page += 1

            # Filter to projects updated around the target date (within 2 days buffer)
            buffer = 2 * 86400
            candidates = [p for p in all_projects
                          if p.get("updated_at", 0) >= (target_ts_start - buffer)
                          and p.get("photo_count", 0) > 0]

            if project_id:
                candidates = [p for p in candidates if str(p["id"]) == project_id]
                if not candidates:
                    # Force include the specified project
                    try:
                        raw = await cc_client.get_project(project_id)
                        candidates = [raw]
                    except Exception:
                        pass

            _report_task_state["step"] = f"Found {len(candidates)} candidate projects. Syncing..."

            # Step 2: Sync each candidate and check for photos on the target date
            projects_with_photos = []
            for i, raw in enumerate(candidates):
                proj = CompanyCamClient.normalize_project(raw)
                pid = proj["id"]
                _report_task_state["step"] = f"Syncing {proj['name']} ({i+1}/{len(candidates)})"

                catalog.upsert_project(proj)
                pg = 1
                synced = 0
                while True:
                    photos = await cc_client.list_project_photos(pid, page=pg, per_page=100)
                    if not photos:
                        break
                    for rp in photos:
                        catalog.upsert_photo(CompanyCamClient.normalize_photo(rp, pid))
                        synced += 1
                    if len(photos) < 100:
                        break
                    pg += 1
                catalog.set_project_synced(pid)

                # Check if this project has photos on the target date
                day_photos = catalog.db.execute(
                    "SELECT COUNT(*) FROM photos WHERE project_id = ? AND CAST(taken_at AS INTEGER) >= ? AND CAST(taken_at AS INTEGER) < ?",
                    (pid, target_ts_start, target_ts_end),
                ).fetchone()[0]
                if day_photos > 0:
                    projects_with_photos.append(pid)

            if not projects_with_photos:
                _report_task_state["status"] = "complete"
                _report_task_state["step"] = f"No projects had photos on {date_str}"
                return

            # Check which projects already have saved reports (for resume)
            existing = catalog.get_daily_reports(date_str)
            existing_pids = {r["project_id"] for r in existing}

            total = len(projects_with_photos)
            skipped = 0
            reports = []

            # Process each project end-to-end: analyze → generate → save
            for i, pid in enumerate(projects_with_photos):
                proj = catalog.get_project(pid)
                pname = proj["name"] if proj else pid
                progress = f"({i+1}/{total})"

                # Skip projects that already have a saved report
                if pid in existing_pids:
                    skipped += 1
                    _report_task_state["step"] = f"Skipping {pname} {progress} — report already saved"
                    continue

                # Analyze unanalyzed photos
                unanalyzed = catalog.get_unanalyzed_photos(pid)
                if unanalyzed:
                    _report_task_state["step"] = f"Analyzing {pname} ({len(unanalyzed)} new photos) {progress}"
                    try:
                        await analyze_project_from_catalog(
                            catalog=catalog, project_id=pid,
                            cc_client=cc_client, anthropic_client=anthropic_client,
                        )
                    except Exception as e:
                        _report_task_state["step"] = f"Analysis error on {pname}: {e}"
                        reports.append({"project_id": pid, "error": f"analysis: {e}"})
                        continue

                # Generate and save report
                _report_task_state["step"] = f"Generating report for {pname} {progress}"
                try:
                    report = await generate_daily_report(
                        catalog=catalog, project_id=pid,
                        date_ts_start=ts_start, date_ts_end=ts_end,
                        anthropic_client=anthropic_client,
                    )
                    if report:
                        catalog.save_daily_report(pid, date_str, report)
                        reports.append({
                            "project_id": pid,
                            "project_name": proj["name"] if proj else pid,
                            "project_address": proj["address"] if proj else "",
                            "date": date_str,
                            "report": report,
                        })
                except Exception as e:
                    reports.append({"project_id": pid, "error": f"report: {e}"})

            _report_task_state["reports"] = reports
            _report_task_state["status"] = "complete"
            done = len([r for r in reports if "report" in r])
            errors = len([r for r in reports if "error" in r])
            parts = [f"{done} generated"]
            if skipped:
                parts.append(f"{skipped} already saved")
            if errors:
                parts.append(f"{errors} errors")
            _report_task_state["step"] = f"Done — {', '.join(parts)}"

        except Exception as e:
            _report_task_state["status"] = "error"
            _report_task_state["step"] = f"Error: {e}"

    import asyncio
    asyncio.create_task(run())
    return {"ok": True, "message": "Report generation started (sync → analyze → report)"}


@app.get("/api/reports/task")
async def api_report_task_status():
    """Poll report generation progress."""
    return _report_task_state


@app.get("/api/reports/daily")
async def api_get_daily_reports(date: str = Query(...)):
    """Fetch saved reports for a date."""
    if not catalog:
        return JSONResponse({"error": "Catalog not initialized"}, status_code=503)
    rows = catalog.get_daily_reports(date)
    reports = []
    for r in rows:
        reports.append({
            "project_id": r["project_id"],
            "project_name": r["project_name"],
            "project_address": r["project_address"],
            "date": r["report_date"],
            "report": json.loads(r["report_data"]),
            "generated_at": r["generated_at"],
        })
    return {"reports": reports, "date": date}


# --- Weekly Reports ---

@app.post("/api/reports/generate-weekly")
async def api_generate_weekly_reports(request: Request):
    """Generate weekly homeowner reports for a given week."""
    if not catalog:
        return JSONResponse({"error": "Catalog not initialized"}, status_code=503)

    body = await request.json()
    week_start_str = body.get("week_start")  # "2026-03-31" (Monday)
    project_id = body.get("project_id")  # optional

    if not week_start_str:
        return JSONResponse({"error": "week_start is required (YYYY-MM-DD, must be a Monday)"}, status_code=400)

    from datetime import datetime as dt, timezone as tz
    try:
        week_start = dt.strptime(week_start_str, "%Y-%m-%d").replace(tzinfo=tz.utc)
    except ValueError:
        return JSONResponse({"error": "Invalid date format. Use YYYY-MM-DD"}, status_code=400)

    ts_start = int(week_start.timestamp())
    ts_end = ts_start + 5 * 86400  # Mon-Fri (5 business days)

    from photo_scanner.scanner import get_async_anthropic_client
    anthropic_client = get_async_anthropic_client()
    if not anthropic_client:
        return JSONResponse({"error": "Anthropic auth not configured"}, status_code=503)

    # Find eligible projects (3+ business days of photos)
    if project_id:
        project_ids = [project_id]
    else:
        eligible = catalog.get_eligible_weekly_projects(ts_start, ts_end, min_days=3)
        project_ids = [e["project_id"] for e in eligible]

    if not project_ids:
        return {"reports": [], "message": f"No projects with 3+ days of photos for week of {week_start_str}"}

    # Check which projects already have saved weekly reports (for resume)
    existing = catalog.get_weekly_reports(week_start_str)
    existing_pids = {r["project_id"] for r in existing}

    reports = []
    skipped = 0
    for pid in project_ids:
        if pid in existing_pids:
            skipped += 1
            continue
        try:
            report = await generate_weekly_report(
                catalog=catalog,
                project_id=pid,
                week_ts_start=ts_start,
                week_ts_end=ts_end,
                anthropic_client=anthropic_client,
            )
            if report:
                catalog.save_weekly_report(pid, week_start_str, report)
                project = catalog.get_project(pid)
                reports.append({
                    "project_id": pid,
                    "project_name": project["name"] if project else pid,
                    "project_address": project["address"] if project else "",
                    "week_start": week_start_str,
                    "report": report,
                })
        except Exception as e:
            reports.append({"project_id": pid, "error": str(e)})

    return {"reports": reports, "skipped": skipped, "week_start": week_start_str}


@app.get("/api/reports/weekly")
async def api_get_weekly_reports(week_start: str = Query(...)):
    """Fetch saved weekly reports for a week."""
    if not catalog:
        return JSONResponse({"error": "Catalog not initialized"}, status_code=503)
    rows = catalog.get_weekly_reports(week_start)
    reports = []
    for r in rows:
        reports.append({
            "project_id": r["project_id"],
            "project_name": r["project_name"],
            "project_address": r["project_address"],
            "week_start": r["week_start"],
            "report": json.loads(r["report_data"]),
            "generated_at": r["generated_at"],
        })
    return {"reports": reports, "week_start": week_start}


# --- Report Publishing ---

@app.post("/api/reports/publish")
async def api_publish_reports(request: Request):
    """Publish reports to the web portal. Renders self-contained HTML with base64 photos."""
    if not catalog or not cc_client:
        return JSONResponse({"error": "Catalog or CompanyCam not configured"}, status_code=503)

    load_project_env()
    portal_url = os.environ.get("PORTAL_URL")
    portal_key = os.environ.get("PORTAL_INGEST_KEY")
    if not portal_url or not portal_key:
        return JSONResponse({"error": "PORTAL_URL and PORTAL_INGEST_KEY must be set in .env"}, status_code=503)

    body = await request.json()
    report_type = body.get("type", "daily")  # "daily" or "weekly"
    date_str = body.get("date") or body.get("week_start")

    if not date_str:
        return JSONResponse({"error": "date or week_start required"}, status_code=400)

    # Fetch saved reports
    if report_type == "weekly":
        rows = catalog.get_weekly_reports(date_str)
    else:
        rows = catalog.get_daily_reports(date_str)

    if not rows:
        return JSONResponse({"error": f"No saved {report_type} reports for {date_str}"}, status_code=404)

    # Load logo as base64
    logo_path = Path(__file__).parent / "static" / "sfw-emblem.png"
    logo_b64 = ""
    if logo_path.exists():
        import base64 as b64mod
        logo_b64 = "data:image/png;base64," + b64mod.b64encode(logo_path.read_bytes()).decode()

    # Render each report as self-contained HTML
    publish_reports = []
    for r in rows:
        report_data = json.loads(r["report_data"]) if isinstance(r["report_data"], str) else r["report_data"]
        photos = report_data.get("photos", [])

        # Fetch photo thumbnails and convert to base64
        photo_b64 = {}
        for p in photos:
            pid = p.get("photo_id")
            if pid:
                photo_record = catalog.get_photo(pid)
                if photo_record:
                    uri = photo_record.get("thumb_uri") or photo_record.get("uri")
                    if uri:
                        try:
                            img_bytes = await cc_client.get_photo_bytes(uri)
                            photo_b64[pid] = "data:image/jpeg;base64," + b64mod.b64encode(img_bytes).decode()
                        except Exception:
                            pass

        # Render self-contained HTML
        html = render_report_html(report_data, r.get("project_name", ""), r.get("project_address", ""),
                                  date_str, report_type, logo_b64, photo_b64)

        publish_reports.append({
            "project_id": r["project_id"],
            "project_name": r.get("project_name", ""),
            "project_address": r.get("project_address", ""),
            "html": html,
        })

    # POST to portal in batches of 3 to stay under Vercel's 4.5MB payload limit
    import httpx
    published = 0
    errors = []
    batch_size = 1
    async with httpx.AsyncClient(timeout=60) as client:
        for i in range(0, len(publish_reports), batch_size):
            batch = publish_reports[i:i + batch_size]
            ingest_body = {
                "type": report_type,
                "reports": batch,
            }
            if report_type == "weekly":
                ingest_body["week_start"] = date_str
            else:
                ingest_body["date"] = date_str

            resp = await client.post(
                f"{portal_url}/api/ingest",
                json=ingest_body,
                headers={"Authorization": f"Bearer {portal_key}"},
            )
            if resp.status_code != 200:
                errors.append(f"Batch {i//batch_size+1}: {resp.status_code} {resp.text[:200]}")
            else:
                published += resp.json().get("published", 0)

    if errors and published == 0:
        return JSONResponse({"error": f"All batches failed: {'; '.join(errors)}"}, status_code=502)

    return {"ok": True, "published": published, "errors": errors if errors else None, "portal_url": portal_url}


def render_report_html(report: dict, project_name: str, project_address: str,
                       date_str: str, report_type: str, logo_b64: str, photo_b64: dict) -> str:
    """Render a single report as self-contained HTML with embedded images."""
    from photo_scanner import report_style as brand
    rpt = report
    photos = rpt.get("photos", [])
    issues = rpt.get("issues_status", [])
    timeline = rpt.get("daily_timeline", [])

    # Format date
    if report_type == "weekly":
        from datetime import datetime, timedelta
        ws = datetime.strptime(date_str, "%Y-%m-%d")
        we = ws + timedelta(days=4)
        date_display = f"Week of {ws.strftime('%B %d')} – {we.strftime('%B %d, %Y')}"
        label = "Weekly Project Report"
    else:
        from datetime import datetime
        d = datetime.strptime(date_str, "%Y-%m-%d")
        date_display = d.strftime("%A, %B %d, %Y")
        label = "Daily Project Update"
    header_bg = brand.HEADER_BG

    css = f"""
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }}
        body {{ background: {brand.BG_LIGHT}; }}
        .report-card {{ max-width: 680px; margin: 24px auto; background: {brand.CARD_BG}; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); overflow: hidden; font-family: {brand.FONT_FAMILY}; color: {brand.TEXT_DARK}; }}
        .report-header {{ padding: 20px 24px; color: {brand.HEADER_TEXT}; position: relative; padding-right: 90px; }}
        .report-logo {{ position: absolute; top: 50%; right: 20px; height: 50px; opacity: 0.85; transform: translateY(-50%); }}
        .date-label {{ font-size: 12px; opacity: 0.7; letter-spacing: 1px; text-transform: uppercase; }}
        .report-header h2 {{ font-size: {brand.H2_SIZE}; font-weight: 700; margin: 4px 0 0; }}
        .report-section {{ padding: 20px 24px; border-bottom: 1px solid {brand.BORDER}; }}
        .section-label {{ font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: {brand.SECTION_LABEL_COLOR}; font-weight: 600; margin-bottom: 8px; }}
        .report-section p {{ font-size: {brand.BODY_SIZE}; line-height: 1.6; }}
        .risk-boxes {{ display: flex; gap: 16px; }}
        .risk-box {{ flex: 1; border-radius: 8px; padding: 14px; }}
        .risk-box.before {{ background: {brand.RISK_BEFORE_BG}; }}
        .risk-box.before .section-label {{ color: {brand.RISK_BEFORE_LABEL}; }}
        .risk-box.before p {{ color: {brand.RISK_BEFORE_TEXT}; }}
        .risk-box.after {{ background: {brand.RISK_AFTER_BG}; }}
        .risk-box.after .section-label {{ color: {brand.RISK_AFTER_LABEL}; }}
        .risk-box.after p {{ color: {brand.RISK_AFTER_TEXT}; }}
        .risk-arrow {{ display: flex; align-items: center; font-size: 24px; color: {brand.SECTION_LABEL_COLOR}; }}
        .report-photos {{ display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }}
        .report-photos img {{ width: 100%; border-radius: 8px; height: 160px; object-fit: cover; background: {brand.BORDER}; }}
        .report-photos .caption {{ font-size: 12px; color: {brand.CAPTION_COLOR}; margin-top: 4px; }}
        .issue-row {{ display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 4px 0; }}
        .report-footer {{ padding: 14px 24px; background: {brand.FOOTER_BG}; text-align: center; font-size: 12px; color: {brand.SECTION_LABEL_COLOR}; }}
        .day-entry {{ display: flex; gap: 12px; padding: 12px 0; border-bottom: 1px solid {brand.BORDER}; }}
        .day-entry:last-child {{ border-bottom: none; }}
        .day-date {{ min-width: 90px; font-size: 13px; font-weight: 600; color: {brand.TEXT_DARK}; }}
        .day-summary {{ flex: 1; font-size: 13px; color: {brand.TEXT_DARK}; line-height: 1.5; }}
        .day-thumbs {{ display: flex; gap: 4px; }}
        .day-thumbs img {{ width: 60px; height: 45px; object-fit: cover; border-radius: 4px; }}
    </style>
    """

    logo_img = f'<img class="report-logo" src="{logo_b64}">' if logo_b64 else ''

    # Photos HTML
    photos_html = ""
    if photos:
        photo_items = []
        for p in photos:
            pid = p.get("photo_id", "")
            src = photo_b64.get(pid, "")
            if report_type == "weekly":
                caption = p.get("caption", "")
                photo_items.append(f'<div><img src="{src}"><div class="caption">{caption}</div></div>')
            else:
                photo_items.append(f'<div><img src="{src}"></div>')
        total_day_photos = rpt.get("total_day_photos", len(photos))
        if report_type == "weekly":
            photos_label = "Selected Photos — This Week"
        else:
            if total_day_photos:
                photos_label = f"Selected Photos — {total_day_photos} documented today"
            else:
                photos_label = "Selected Photos"
        photos_html = f'<div class="report-section"><div class="section-label">{photos_label}</div><div class="report-photos">{"".join(photo_items)}</div></div>'

    # Issues HTML
    issues_html = ""
    if issues:
        issue_items = []
        for iss in issues:
            status = iss.get("status", "unknown")
            color = brand.STATUS_RESOLVED if status == "resolved" else brand.STATUS_IN_PROGRESS if status == "in-progress" else brand.STATUS_DOCUMENTED
            status_label = "Resolved" if status == "resolved" else "In progress" if status == "in-progress" else "Documented" if status == "documented-only" else "Pending"
            changed_key = "changed_this_week" if report_type == "weekly" else "changed_today"
            changed = f" — {'this week' if report_type == 'weekly' else 'updated today'}" if iss.get(changed_key) else ""
            issue_items.append(f'<div class="issue-row"><span style="color:{color};font-size:16px">●</span><span style="flex:1">{iss.get("issue","")}</span><span style="font-size:12px;font-weight:500;color:{color}">{status_label}{changed}</span></div>')
        bg = "background:#fafafa"
        issues_html = f'<div class="report-section" style="{bg}"><div class="section-label">Project Issues — Status</div>{"".join(issue_items)}</div>'

    # Timeline HTML (weekly only)
    timeline_html = ""
    if timeline and report_type == "weekly":
        from datetime import datetime
        captions = rpt.get("photo_captions", {})
        day_items = []
        for day in timeline:
            try:
                dd = datetime.strptime(day["date"], "%Y-%m-%d")
                day_label = dd.strftime("%a, %b %d")
            except Exception:
                day_label = day.get("date", "")
            total_photos = day.get("total_photos", len(day.get("photo_ids") or []))
            photo_ids = day.get("photo_ids") or []
            photo_grid = ""
            if photo_ids:
                photo_items_day = []
                for tid in photo_ids:
                    src = photo_b64.get(tid, "")
                    caption = captions.get(tid, "")
                    photo_items_day.append(f'<div><img src="{src}"><div class="caption">{caption}</div></div>')
                photo_grid = f'<div class="report-photos">{"".join(photo_items_day)}</div>'
            day_items.append(
                f'<div style="margin-bottom:16px">'
                f'<div class="section-label">{day_label}{f" — {total_photos} documented" if total_photos else ""}</div>'
                f'<div class="day-summary" style="margin-bottom:8px">{day.get("summary","")}</div>'
                f'{photo_grid}'
                f'</div>'
            )
        timeline_html = f'<div class="report-section">{"".join(day_items)}</div>'

    # Weekly narrative
    narrative_html = ""
    if rpt.get("weekly_narrative") and report_type == "weekly":
        narrative_html = f'<div class="report-section"><div class="section-label">Weekly Summary</div><p>{rpt["weekly_narrative"]}</p></div>'

    what_label = "Work Performed This Week" if report_type == "weekly" else "Work Performed Today"

    html = f"""{css}
<div class="report-card">
    <div class="report-header" style="background:{header_bg}">
        {logo_img}
        <div class="date-label">{label}</div>
        <h2>{rpt.get('headline', 'Project Update')}</h2>
        <div style="font-size:13px;opacity:0.8;margin-top:10px">{project_name}</div>
        <div style="font-size:12px;opacity:0.6;margin-top:2px">{project_address}</div>
        <div style="font-size:12px;opacity:0.6;margin-top:2px">{date_display}</div>
    </div>
    {narrative_html}
    <div class="report-section">
        <div class="risk-boxes">
            <div class="risk-box before"><div class="section-label">{'Condition at Start of Week' if report_type == 'weekly' else 'Condition Before Work'}</div><p>{rpt.get('risk_before','')}</p></div>
            <div class="risk-arrow">→</div>
            <div class="risk-box after"><div class="section-label">{"Condition After This Week" if report_type == 'weekly' else "Condition After Work"}</div><p>{rpt.get('risk_after','')}</p></div>
        </div>
    </div>
    <div class="report-section"><div class="section-label">{what_label}</div><p>{rpt.get('what_we_did','')}</p></div>
    {photos_html}
    <div class="report-section"><div class="section-label">Value to Your Property</div><p>{rpt.get('value_statement','')}</p></div>
    {timeline_html}
    {issues_html}
    <div class="report-footer">SFW Construction — {label}</div>
</div>"""

    return html


# --- Data Explorer ---

@app.get("/api/data/overview")
async def data_overview():
    """Return a full data landscape: CC API fields, catalog tables, tag lists."""
    result = {"companycam": {}, "catalog": {}, "tags": []}

    # CompanyCam API shape — fetch a sample project and photo
    if cc_client:
        try:
            projects = await cc_client.list_projects(per_page=1)
            if projects:
                raw_proj = projects[0]
                result["companycam"]["project_fields"] = sorted(raw_proj.keys())
                def safe_str(v):
                    if isinstance(v, bytes):
                        return v.decode('utf-8', errors='replace')[:200]
                    if isinstance(v, (str, list, dict)):
                        return str(v)[:200]
                    return v
                result["companycam"]["project_sample"] = {
                    k: safe_str(v) for k, v in raw_proj.items()
                }
                # Notepad (scope of work)
                import re
                notepad = raw_proj.get("notepad", "")
                result["companycam"]["notepad_sample"] = re.sub(r'<[^>]*>', '', notepad).strip()[:500] if notepad else None

                # Project labels
                try:
                    resp = await cc_client._client.get(f"/projects/{raw_proj['id']}/labels")
                    if resp.status_code == 200:
                        result["companycam"]["project_labels"] = resp.json()
                except Exception:
                    pass

                # Photos
                photos = await cc_client.list_project_photos(str(raw_proj["id"]), per_page=1)
                if photos:
                    result["companycam"]["photo_fields"] = sorted(photos[0].keys())
                    result["companycam"]["photo_sample"] = {
                        k: safe_str(v) for k, v in photos[0].items() if k != "uris"
                    }
                    result["companycam"]["photo_uri_types"] = [u.get("type") for u in photos[0].get("uris", [])]

            # Global tags
            resp = await cc_client._client.get("/tags")
            if resp.status_code == 200:
                result["tags"] = resp.json()
        except Exception as e:
            result["companycam"]["error"] = str(e)

    # Catalog tables
    if catalog:
        result["catalog"]["projects"] = catalog.db.execute("SELECT COUNT(*) FROM projects").fetchone()[0]
        result["catalog"]["photos_total"] = catalog.db.execute("SELECT COUNT(*) FROM photos").fetchone()[0]
        result["catalog"]["photos_analyzed"] = catalog.db.execute("SELECT COUNT(*) FROM photos WHERE scene IS NOT NULL").fetchone()[0]
        result["catalog"]["daily_reports"] = catalog.db.execute("SELECT COUNT(*) FROM daily_reports").fetchone()[0]
        try:
            result["catalog"]["weekly_reports"] = catalog.db.execute("SELECT COUNT(*) FROM weekly_reports").fetchone()[0]
        except Exception:
            result["catalog"]["weekly_reports"] = 0

        # Schema info
        tables = {}
        for row in catalog.db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").fetchall():
            tname = row[0]
            cols = catalog.db.execute(f"PRAGMA table_info({tname})").fetchall()
            tables[tname] = [{"name": c[1], "type": c[2], "notnull": bool(c[3]), "pk": bool(c[5])} for c in cols]
        result["catalog"]["schema"] = tables

        # Sample data from each table
        for tname in tables:
            rows = catalog.db.execute(f"SELECT * FROM {tname} LIMIT 3").fetchall()
            if rows:
                result["catalog"][f"{tname}_sample"] = [
                    {k: (v.decode('utf-8', errors='replace') if isinstance(v, bytes) else v) for k, v in dict(r).items()}
                    for r in rows
                ]

    return result


@app.get("/api/data/projects-text")
async def data_projects_text(page: int = Query(1), per_page: int = Query(50)):
    """Return all projects with their notepad text from CompanyCam."""
    if not cc_client:
        return JSONResponse({"error": "CompanyCam not configured"}, status_code=503)
    import re
    raw_projects = []
    fetch_page = 1
    while len(raw_projects) < per_page:
        batch = await cc_client.list_projects(page=fetch_page, per_page=50)
        if not batch:
            break
        raw_projects.extend(batch)
        if len(batch) < 50:
            break
        fetch_page += 1

    results = []
    for p in raw_projects[:per_page]:
        notepad = p.get("notepad", "")
        clean_notepad = re.sub(r'<[^>]*>', '', notepad).strip() if notepad else ""
        results.append({
            "id": str(p["id"]),
            "name": p.get("name", ""),
            "status": p.get("status", ""),
            "photo_count": p.get("photo_count", 0),
            "notepad": clean_notepad,
            "created_at": p.get("created_at", ""),
            "updated_at": p.get("updated_at", ""),
        })
    return {"projects": results}


# --- Photo-picker proxy endpoints ---

@app.get("/api/picker/config")
async def picker_config():
    """Proxy to photo-picker config (microsites + categories)."""
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(f"{PHOTO_PICKER_URL}/api/config")
        return JSONResponse(r.json())


@app.get("/api/picker/v2-components/{microsite}")
async def picker_v2_components(microsite: str):
    """Get current lightbox galleries, before/after pairs, video embeds."""
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(f"{PHOTO_PICKER_URL}/api/v2-components/{microsite}")
        return JSONResponse(r.json())


@app.post("/api/picker/process")
async def picker_process(request: Request):
    """Proxy image processing (resize, format convert) to photo-picker."""
    body = await request.json()
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(f"{PHOTO_PICKER_URL}/api/process", json=body)
        return JSONResponse(r.json(), status_code=r.status_code)


@app.post("/api/picker/upload")
async def picker_upload(request: Request):
    """Proxy blob upload to photo-picker."""
    body = await request.json()
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(f"{PHOTO_PICKER_URL}/api/upload", json=body)
        return JSONResponse(r.json(), status_code=r.status_code)


@app.post("/api/picker/write-images")
async def picker_write_images(request: Request):
    """Proxy images.json write to photo-picker."""
    body = await request.json()
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(f"{PHOTO_PICKER_URL}/api/write-images", json=body)
        return JSONResponse(r.json(), status_code=r.status_code)


@app.post("/api/upload-to-gallery")
async def upload_to_gallery(request: Request):
    """High-level: process + upload + add to lightbox gallery in one call.

    Body: {
        photoPath: "folder/file.jpg",  (relative to source_dir)
        microsite: "siding-repair",
        galleryId: "homepage-gallery",
        galleryName: "Homepage Gallery",  (used if creating new gallery)
        alt: "description text"
    }
    """
    body = await request.json()
    photo_path = body["photoPath"]
    microsite = body["microsite"]
    gallery_id = body["galleryId"]
    gallery_name = body.get("galleryName", gallery_id)
    alt = body.get("alt", "")

    # Read the original image file
    file_path = SOURCE_DIR / photo_path
    if not file_path.is_file():
        return JSONResponse({"error": f"File not found: {photo_path}"}, status_code=404)

    with open(file_path, "rb") as f:
        raw_b64 = base64.b64encode(f.read()).decode()

    # Step 1: Process (resize to gallery size, convert to webp)
    async with httpx.AsyncClient(timeout=60) as client:
        process_resp = await client.post(f"{PHOTO_PICKER_URL}/api/process", json={
            "imageData": raw_b64,
            "mimeType": "image/jpeg",
            "options": {"width": 800, "height": 600, "quality": 85, "format": "webp"},
        })
        if process_resp.status_code != 200:
            return JSONResponse({"error": "Process failed", "detail": process_resp.text}, status_code=500)
        processed = process_resp.json()

        # Step 2: Upload to Vercel Blob (strip client names — use gallery + hash)
        import hashlib
        content_hash = hashlib.md5(processed["imageData"][:1000].encode()).hexdigest()[:8]
        filename = f"{gallery_id}-{content_hash}.webp"
        upload_resp = await client.post(f"{PHOTO_PICKER_URL}/api/upload", json={
            "imageData": processed["imageData"],
            "mimeType": "image/webp",
            "filename": filename,
            "microsite": microsite,
            "category": "gallery",
        })
        if upload_resp.status_code != 200:
            return JSONResponse({"error": "Upload failed", "detail": upload_resp.text}, status_code=500)
        uploaded = upload_resp.json()
        blob_url = uploaded["url"]

        # Step 3: Read current v2 components
        v2_resp = await client.get(f"{PHOTO_PICKER_URL}/api/v2-components/{microsite}")
        v2_data = v2_resp.json()

        galleries = v2_data.get("lightboxGalleries", [])

        # Find or create gallery
        gallery = None
        for g in galleries:
            if g["id"] == gallery_id:
                gallery = g
                break
        if gallery is None:
            gallery = {"id": gallery_id, "name": gallery_name, "images": []}
            galleries.append(gallery)

        # Add image if not duplicate
        if not any(img["src"] == blob_url for img in gallery["images"]):
            gallery["images"].append({"src": blob_url, "alt": alt})

        # Step 4: Write back
        write_resp = await client.post(f"{PHOTO_PICKER_URL}/api/write-images", json={
            "microsite": microsite,
            "type": "v2-full",
            "beforeAfterPairs": v2_data.get("beforeAfterPairs", []),
            "lightboxGalleries": galleries,
            "videoEmbeds": v2_data.get("videoEmbeds", []),
        })
        if write_resp.status_code != 200:
            return JSONResponse({"error": "Write failed", "detail": write_resp.text}, status_code=500)

    return {"ok": True, "url": blob_url, "gallery": gallery_id, "imageCount": len(gallery["images"])}


def main():
    global SOURCE_DIR, catalog, cc_client

    parser = argparse.ArgumentParser(description="Photo Scanner Viewer")
    parser.add_argument("source_dir", type=Path, nargs="?", default=None, help="Directory with scan_results.json (optional if using CompanyCam)")
    parser.add_argument("--port", type=int, default=8080, help="Server port (default: 8080)")
    parser.add_argument("--galleries", type=Path, nargs="*", default=[], help="JSON gallery files to load")
    args = parser.parse_args()

    if args.source_dir:
        SOURCE_DIR = args.source_dir.resolve()
        results_path = SOURCE_DIR / "scan_results.json"
        if not results_path.exists():
            print(f"Note: {results_path} not found yet. Start the scanner to see live results.", file=sys.stderr)
    else:
        print("No source_dir provided — CompanyCam-only mode", file=sys.stderr)

    # Initialize catalog (always)
    catalog = Catalog()
    print(f"Catalog: {Path(__file__).parent.parent / 'catalog.db'}", file=sys.stderr)

    # Initialize CompanyCam client (if token available)
    load_project_env()
    cc_token = os.environ.get("COMPANYCAM_API_TOKEN")
    if cc_token:
        cc_client = CompanyCamClient(token=cc_token)
        print("CompanyCam: connected", file=sys.stderr)
    else:
        print("CompanyCam: no token (COMPANYCAM_API_TOKEN not set)", file=sys.stderr)

    print(f"Anthropic auth: {describe_anthropic_auth()}", file=sys.stderr)

    # Load external gallery files
    if args.galleries:
        load_external_galleries([Path(g).resolve() for g in args.galleries])

    url = f"http://localhost:{args.port}"
    print(f"Photo Scanner Viewer at {url}")
    if args.source_dir:
        print(f"Source: {SOURCE_DIR}")
    webbrowser.open(url)

    uvicorn.run(app, host="0.0.0.0", port=args.port, log_level="warning")


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


@app.get("/reports/forward/milwaukie", response_class=HTMLResponse)
async def render_milwaukie_forward():
    """One-off forward-looking report for the Milwaukie Presbyterian project."""
    from datetime import datetime
    template = jinja_env.get_template("milwaukie_forward.html")
    today = datetime.now().strftime("%B %d, %Y")
    return template.render(today=today)


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


if __name__ == "__main__":
    main()

"""
Photo Scanner — Three-pass pipeline for analyzing construction job photos.

Pass 1: Pre-screen (Pillow) — filter documents, receipts, screenshots
Pass 2: Triage (3x3 grid via Anthropic) — pick marketing-worthy photos, flag documents
Pass 3: Deep analysis (concurrent via Anthropic) — full structured tagging

Uses Anthropic Claude API for speed (concurrent requests). Falls back to Ollama if no API key.
Results are saved incrementally so the live viewer can show progress.
"""

import argparse
import asyncio
import base64
import io
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from PIL import Image, ImageDraw, ImageFont

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ANTHROPIC_MODEL = "claude-sonnet-4-20250514"
OLLAMA_MODEL = "gemma3:12b"
CONCURRENCY = 5  # max parallel Anthropic requests (50 req/min limit)

SKIP_FILENAME_PATTERNS = [
    re.compile(r"^Consumables", re.IGNORECASE),
    re.compile(r"^Receipts?", re.IGNORECASE),
    re.compile(r"^T&M\s*Sheet", re.IGNORECASE),
    re.compile(r"^Screenshot", re.IGNORECASE),
]

TRIAGE_PROMPT = """\
You are looking at a 3x3 grid of photos from a construction job site. Each cell is numbered 1 through 9, left to right, top to bottom.

Your task: examine EVERY cell individually and classify it as either a PICK (good for marketing) or a DOCUMENT/SKIP.

PICK — good for marketing a home repair website: clear shots of repair work, damage, completed projects, building exteriors, tools in action, before/after conditions.
DOCUMENT — photos of paperwork: receipts, invoices, T&M sheets, timecards, material lists, handwritten notes, forms, business cards, phone screenshots.
SKIP — other non-marketing photos: blurry, very dark, extreme close-ups of nothing identifiable, duplicate angles.

For each cell, classify it. For picks, identify the service type from:
siding, deck, dry-rot, chimney, crawlspace, flashing, trim, beam, leak, lead-paint, mold, restoration

Look at each cell carefully. The counts will vary per grid.

Respond in JSON only:
{"picks": [{"cell": NUMBER, "service": "TYPE"}], "documents": [CELL_NUMBERS], "skips": [CELL_NUMBERS]}

All 9 cells must appear in exactly one of picks, documents, or skips.
If no photos are suitable: {"picks": [], "documents": [], "skips": [1,2,3,4,5,6,7,8,9]}
"""

DEEP_PROMPT = """\
Analyze this construction/home repair photo. Respond in JSON only, no other text.

{
  "scene": "one-line description of what is shown",
  "service_types": ["list from: siding, deck, dry-rot, chimney, crawlspace, flashing, trim, beam, leak, lead-paint, mold, restoration"],
  "phase": "one of: before, during, after, materials, overview, other",
  "entities": ["visible objects: tools, materials, building parts, damage types"],
  "marketing_score": 1-5,
  "marketing_notes": "why this score — composition, lighting, clarity, subject interest",
  "before_after_potential": true or false
}
"""


def log(msg: str):
    print(msg, file=sys.stderr, flush=True)


# --- Vision API backends ---

def get_anthropic_client():
    """Return an Anthropic client if API key is available, else None."""
    # Load .env from the photo-scanner directory
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        return None
    import anthropic
    return anthropic.Anthropic(api_key=key)


def get_async_anthropic_client():
    """Return an async Anthropic client if API key is available, else None."""
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        return None
    import anthropic
    return anthropic.AsyncAnthropic(api_key=key)


def image_to_b64(image: Image.Image | Path, max_dim: int = 0) -> tuple[str, str]:
    """Convert image to base64 + media_type. Optionally resize."""
    if isinstance(image, Path):
        img = Image.open(image)
    else:
        img = image

    if max_dim:
        img.thumbnail((max_dim, max_dim))
    if img.mode != "RGB":
        img = img.convert("RGB")

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    b64 = base64.b64encode(buf.getvalue()).decode()
    return b64, "image/jpeg"


def call_anthropic_vision(client, image: Image.Image | Path, prompt: str,
                          max_dim: int = 0) -> str:
    """Send image + prompt to Claude, return text response."""
    b64, media_type = image_to_b64(image, max_dim)
    response = client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
                {"type": "text", "text": prompt},
            ],
        }],
    )
    return response.content[0].text


async def call_anthropic_vision_async(client, image: Image.Image | Path,
                                       prompt: str, max_dim: int = 0) -> str:
    """Async version with retry on rate limits."""
    b64, media_type = image_to_b64(image, max_dim)
    max_retries = 3
    for attempt in range(max_retries + 1):
        try:
            response = await client.messages.create(
                model=ANTHROPIC_MODEL,
                max_tokens=1024,
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
                        {"type": "text", "text": prompt},
                    ],
                }],
            )
            return response.content[0].text
        except Exception as e:
            if "429" in str(e) and attempt < max_retries:
                wait = 15 * (attempt + 1)  # 15s, 30s, 45s
                log(f"[Rate limit] Waiting {wait}s before retry {attempt + 1}/{max_retries}")
                await asyncio.sleep(wait)
            else:
                raise


def call_ollama_vision(image: Image.Image | Path, prompt: str) -> str:
    """Fallback: send image + prompt to local Ollama."""
    import ollama
    b64, _ = image_to_b64(image)
    response = ollama.chat(
        model=OLLAMA_MODEL,
        messages=[{"role": "user", "content": prompt, "images": [b64]}],
    )
    return response["message"]["content"]


def call_vision(client, image: Image.Image | Path, prompt: str,
                max_dim: int = 0) -> str:
    """Route to Anthropic or Ollama based on available client."""
    if client:
        return call_anthropic_vision(client, image, prompt, max_dim)
    return call_ollama_vision(image, prompt)


# --- Helpers ---

def find_images(source_dir: Path) -> dict[str, list[Path]]:
    """Walk source_dir recursively. Any directory containing images becomes a group.
    Group key is the relative path from source_dir (e.g. 'Construction Photos/2024/David Craig')."""
    folders: dict[str, list[Path]] = {}

    for dirpath, dirnames, filenames in os.walk(source_dir):
        # Skip hidden directories
        dirnames[:] = [d for d in dirnames if not d.startswith(".")]
        dp = Path(dirpath)
        images = sorted(
            dp / f for f in filenames
            if Path(f).suffix.lower() in ALLOWED_EXTENSIONS
        )
        if images:
            rel = str(dp.relative_to(source_dir))
            if rel == ".":
                folders["."] = images
            else:
                folders[rel.replace("\\", "/")] = images

    return folders


def make_thumbnail(img_path: Path, thumb_path: Path, size: int = 320):
    thumb_path.parent.mkdir(parents=True, exist_ok=True)
    if thumb_path.exists():
        return
    with Image.open(img_path) as img:
        img.thumbnail((size, size))
        img.save(thumb_path, "JPEG", quality=80)


def prescreen_image(img_path: Path) -> str | None:
    name = img_path.name
    for pattern in SKIP_FILENAME_PATTERNS:
        if pattern.search(name):
            return "filename_match"
    try:
        file_size = img_path.stat().st_size
        if file_size < 20_000:
            return "too_small"
        with Image.open(img_path) as img:
            img.verify()
    except Exception:
        return "unreadable"
    return None


def build_grid(images: list[Path], cell_size: int = 256) -> Image.Image:
    grid_size = cell_size * 3
    grid = Image.new("RGB", (grid_size, grid_size), (40, 40, 40))
    draw = ImageDraw.Draw(grid)
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
        label = str(idx + 1)
        try:
            font = ImageFont.truetype("arial.ttf", 20)
        except OSError:
            font = ImageFont.load_default()
        bbox = draw.textbbox((0, 0), label, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        lx, ly = x + 4, y + 4
        draw.rectangle([lx - 2, ly - 2, lx + tw + 4, ly + th + 4], fill=(0, 0, 0, 180))
        draw.text((lx, ly), label, fill="white", font=font)
    return grid


def parse_json_response(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines)
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1:
        return json.loads(text[start : end + 1])
    raise ValueError(f"No JSON found in response: {text[:200]}")


# --- Incremental save ---

def compute_stats(results: dict[str, list[dict]], total_images: int) -> dict:
    prescreened_out = sum(1 for ps in results.values() for p in ps if p.get("prescreen") == "skip")
    triage_picked = sum(1 for ps in results.values() for p in ps if p.get("triage") == "picked")
    triage_documents = sum(1 for ps in results.values() for p in ps if p.get("triage") == "document")
    deep_analyzed = sum(1 for ps in results.values() for p in ps if p.get("scene"))
    return {
        "total_images": total_images,
        "prescreened_out": prescreened_out,
        "triage_candidates": total_images - prescreened_out,
        "triage_picked": triage_picked,
        "triage_documents": triage_documents,
        "deep_analyzed": deep_analyzed,
    }


def save_results(results: dict[str, list[dict]], source_dir: Path, stats: dict,
                 progress: dict | None = None, grids: list[dict] | None = None,
                 model_used: str = ""):
    clean_folders = {}
    for folder_name, photos in results.items():
        clean_photos = [{k: v for k, v in p.items() if k != "abs_path"} for p in photos]
        clean_folders[folder_name] = {"photo_count": len(clean_photos), "photos": clean_photos}

    output = {
        "scan_date": datetime.now().isoformat(),
        "source_dir": str(source_dir),
        "model": model_used,
        "stats": stats,
        "progress": progress or {},
        "grids": grids or [],
        "folders": clean_folders,
    }
    with open(source_dir / "scan_results.json", "w") as f:
        json.dump(output, f, indent=2)


# --- Pass implementations ---

def run_prescreen(folders: dict[str, list[Path]], thumbs_dir: Path) -> dict[str, list[dict]]:
    results: dict[str, list[dict]] = {}
    total = sum(len(imgs) for imgs in folders.values())
    skipped = 0
    candidates = 0
    for folder_name, images in folders.items():
        folder_results = []
        for img_path in images:
            rel_path = f"{folder_name}/{img_path.name}" if folder_name != "." else img_path.name
            try:
                make_thumbnail(img_path, thumbs_dir / rel_path)
            except Exception:
                pass
            skip_reason = prescreen_image(img_path)
            record = {
                "filename": img_path.name, "path": rel_path,
                "thumb": f".thumbs/{rel_path}", "abs_path": str(img_path),
            }
            if skip_reason:
                record["prescreen"] = "skip"
                record["skip_reason"] = skip_reason
                record["triage"] = "skipped"
                skipped += 1
            else:
                record["prescreen"] = "candidate"
                candidates += 1
            folder_results.append(record)
        results[folder_name] = folder_results
    log(f"[Pre-screen] {total} images found, {skipped} filtered, {candidates} candidates")
    return results


def run_triage(results: dict[str, list[dict]], source_dir: Path,
               total_images: int, client, model_used: str) -> tuple[dict[str, list[dict]], list[dict]]:
    candidates = []
    for folder_name, photos in results.items():
        for photo in photos:
            if photo.get("prescreen") == "candidate" and photo.get("triage") is None:
                candidates.append((folder_name, photo))

    total_grids = (len(candidates) + 8) // 9
    log(f"[Triage] {len(candidates)} candidates -> {total_grids} grids")

    grids_dir = source_dir / ".grids"
    grids_dir.mkdir(exist_ok=True)
    grids_meta: list[dict] = []

    for grid_idx in range(total_grids):
        batch = candidates[grid_idx * 9 : (grid_idx + 1) * 9]
        grid_paths = [Path(item[1]["abs_path"]) for item in batch]
        grid_filename = f"grid_{grid_idx + 1:04d}.jpg"

        log(f"[Triage] Grid {grid_idx + 1}/{total_grids} ({len(batch)} photos)")

        picks_result = []
        try:
            grid_img = build_grid(grid_paths)
            grid_img.save(grids_dir / grid_filename, "JPEG", quality=90)

            response_text = call_vision(client, grid_img, TRIAGE_PROMPT)
            parsed = parse_json_response(response_text)
            picks = parsed.get("picks", [])
            doc_cells = {c for c in parsed.get("documents", []) if isinstance(c, int)}
            picked_cells = set()
            service_hints = {}
            for pick in picks:
                cell = pick.get("cell")
                if isinstance(cell, int) and 1 <= cell <= 9:
                    picked_cells.add(cell)
                    service_hints[cell] = pick.get("service", "")

            for i, (folder_name, photo) in enumerate(batch):
                cell_num = i + 1
                if cell_num in picked_cells:
                    photo["triage"] = "picked"
                    photo["triage_service_hint"] = service_hints.get(cell_num, "")
                    picks_result.append({"cell": cell_num, "path": photo["path"],
                                         "service": service_hints.get(cell_num, "")})
                elif cell_num in doc_cells:
                    photo["triage"] = "document"
                else:
                    photo["triage"] = "skipped"

        except Exception as e:
            log(f"[Triage] Grid {grid_idx + 1} error: {e}")
            for _, photo in batch:
                photo["triage"] = "picked"
                photo["triage_service_hint"] = ""
                picks_result.append({"cell": 0, "path": photo["path"], "service": "", "error": str(e)})

        grids_meta.append({
            "grid_index": grid_idx + 1, "total_grids": total_grids,
            "grid_image": f".grids/{grid_filename}", "cell_count": len(batch),
            "picks": picks_result,
            "cells": [{"cell": i + 1, "path": batch[i][1]["path"],
                        "status": batch[i][1].get("triage", "skipped")} for i in range(len(batch))],
        })

        stats = compute_stats(results, total_images)
        progress = {"phase": "triage", "grid": grid_idx + 1, "total_grids": total_grids}
        save_results(results, source_dir, stats, progress, grids_meta, model_used)

    picked_count = sum(1 for ps in results.values() for p in ps if p.get("triage") == "picked")
    log(f"[Triage] {picked_count} photos picked for deep analysis")
    return results, grids_meta


async def run_deep_analysis_concurrent(results: dict[str, list[dict]], source_dir: Path,
                                        total_images: int, grids_meta: list[dict],
                                        model_used: str):
    """Pass 3 with concurrent Anthropic API calls."""
    async_client = get_async_anthropic_client()
    if not async_client:
        log("[Deep] No Anthropic API key — falling back to sequential Ollama")
        run_deep_analysis_sequential(results, source_dir, total_images, grids_meta, None, model_used)
        return

    picked = [
        (folder, photo)
        for folder, photos in results.items()
        for photo in photos
        if photo.get("triage") == "picked" and not photo.get("scene")
    ]
    log(f"[Deep] Analyzing {len(picked)} photos with {CONCURRENCY} concurrent requests")

    sem = asyncio.Semaphore(CONCURRENCY)
    completed = 0

    async def analyze_one(folder_name: str, photo: dict):
        nonlocal completed
        async with sem:
            img_path = Path(photo["abs_path"])
            try:
                response_text = await call_anthropic_vision_async(
                    async_client, img_path, DEEP_PROMPT, max_dim=768
                )
                analysis = parse_json_response(response_text)
                photo["scene"] = analysis.get("scene", "")
                photo["service_types"] = analysis.get("service_types", [])
                photo["phase"] = analysis.get("phase", "other")
                photo["entities"] = analysis.get("entities", [])
                photo["marketing_score"] = analysis.get("marketing_score", 1)
                photo["marketing_notes"] = analysis.get("marketing_notes", "")
                photo["before_after_potential"] = analysis.get("before_after_potential", False)
            except Exception as e:
                log(f"[Deep] Error on {photo['path']}: {e}")
                photo["error"] = str(e)

            completed += 1
            if completed % 5 == 0 or completed == len(picked):
                log(f"[Deep] {completed}/{len(picked)} complete")
                stats = compute_stats(results, total_images)
                progress = {"phase": "deep", "current": completed, "total": len(picked)}
                save_results(results, source_dir, stats, progress, grids_meta, model_used)

    tasks = [analyze_one(folder, photo) for folder, photo in picked]
    await asyncio.gather(*tasks)

    # Final save
    stats = compute_stats(results, total_images)
    progress = {"phase": "deep", "current": len(picked), "total": len(picked)}
    save_results(results, source_dir, stats, progress, grids_meta, model_used)


def run_deep_analysis_sequential(results: dict[str, list[dict]], source_dir: Path,
                                  total_images: int, grids_meta: list[dict],
                                  client, model_used: str):
    """Pass 3 sequential fallback (Ollama or single-threaded Anthropic)."""
    picked = [
        (folder, photo)
        for folder, photos in results.items()
        for photo in photos
        if photo.get("triage") == "picked" and not photo.get("scene")
    ]
    log(f"[Deep] Analyzing {len(picked)} photos sequentially")

    for idx, (folder_name, photo) in enumerate(picked):
        img_path = Path(photo["abs_path"])
        log(f"[Deep] {idx + 1}/{len(picked)}: {photo['path']}")
        try:
            response_text = call_vision(client, img_path, DEEP_PROMPT, max_dim=768)
            analysis = parse_json_response(response_text)
            photo["scene"] = analysis.get("scene", "")
            photo["service_types"] = analysis.get("service_types", [])
            photo["phase"] = analysis.get("phase", "other")
            photo["entities"] = analysis.get("entities", [])
            photo["marketing_score"] = analysis.get("marketing_score", 1)
            photo["marketing_notes"] = analysis.get("marketing_notes", "")
            photo["before_after_potential"] = analysis.get("before_after_potential", False)
        except Exception as e:
            log(f"[Deep] Error on {photo['path']}: {e}")
            photo["error"] = str(e)

        stats = compute_stats(results, total_images)
        progress = {"phase": "deep", "current": idx + 1, "total": len(picked)}
        save_results(results, source_dir, stats, progress, grids_meta, model_used)


def load_existing_results(results_path: Path) -> dict | None:
    if results_path.exists():
        try:
            with open(results_path) as f:
                return json.load(f)
        except Exception:
            pass
    return None


def main():
    parser = argparse.ArgumentParser(description="Photo Scanner — analyze construction photos")
    parser.add_argument("source_dir", type=Path, help="Directory of photo folders")
    parser.add_argument("--resume", action="store_true", help="Skip already-analyzed images")
    parser.add_argument("--prescreen-only", action="store_true", help="Run only pre-screen pass")
    parser.add_argument("--triage-only", action="store_true", help="Run pre-screen + triage only")
    parser.add_argument("--ollama", action="store_true", help="Force Ollama instead of Anthropic")
    args = parser.parse_args()

    source_dir = args.source_dir.resolve()
    if not source_dir.is_dir():
        log(f"Error: {source_dir} is not a directory")
        sys.exit(1)

    # Set up API client
    client = None if args.ollama else get_anthropic_client()
    if client:
        model_used = ANTHROPIC_MODEL
        log(f"Using Anthropic API ({ANTHROPIC_MODEL})")
    else:
        model_used = OLLAMA_MODEL
        log("Using Ollama (local)")

    thumbs_dir = source_dir / ".thumbs"
    thumbs_dir.mkdir(exist_ok=True)

    log(f"Scanning: {source_dir}")
    start = time.time()

    folders = find_images(source_dir)
    total_images = sum(len(imgs) for imgs in folders.values())
    log(f"Found {total_images} images in {len(folders)} folders")

    if total_images == 0:
        log("No images found. Exiting.")
        sys.exit(0)

    # Resume
    existing = None
    analyzed_paths = set()
    if args.resume:
        existing = load_existing_results(source_dir / "scan_results.json")
        if existing:
            for folder_data in existing.get("folders", {}).values():
                for photo in folder_data.get("photos", []):
                    if photo.get("scene"):  # only skip successfully analyzed, retry errors
                        analyzed_paths.add(photo["path"])
            log(f"[Resume] {len(analyzed_paths)} photos already analyzed")

    # Pass 1: Pre-screen
    results = run_prescreen(folders, thumbs_dir)
    stats = compute_stats(results, total_images)
    save_results(results, source_dir, stats, {"phase": "prescreen", "complete": True}, model_used=model_used)

    if args.prescreen_only:
        log(f"Pre-screen complete in {time.time() - start:.1f}s")
        return

    # Resume: restore
    if existing and analyzed_paths:
        existing_by_path = {}
        for folder_data in existing.get("folders", {}).values():
            for photo in folder_data.get("photos", []):
                existing_by_path[photo["path"]] = photo
        for folder_name, photos in results.items():
            for photo in photos:
                if photo["path"] in existing_by_path:
                    old = existing_by_path[photo["path"]]
                    for key in ["triage", "triage_service_hint", "scene", "service_types",
                                "phase", "entities", "marketing_score", "marketing_notes",
                                "before_after_potential", "error"]:
                        if key in old:
                            photo[key] = old[key]

    # Pass 2: Triage (sequential — grids need to be built one at a time anyway)
    results, grids_meta = run_triage(results, source_dir, total_images, client, model_used)

    if args.triage_only:
        log(f"Triage complete in {time.time() - start:.1f}s")
        return

    # Pass 3: Deep analysis (concurrent if Anthropic, sequential if Ollama)
    if client:
        asyncio.run(run_deep_analysis_concurrent(results, source_dir, total_images, grids_meta, model_used))
    else:
        run_deep_analysis_sequential(results, source_dir, total_images, grids_meta, client, model_used)

    # Final save
    stats = compute_stats(results, total_images)
    save_results(results, source_dir, stats, {"phase": "complete"}, grids_meta, model_used)
    elapsed = time.time() - start
    log(f"Scan complete in {elapsed / 60:.1f} minutes")


def build_grid_from_images(images: list, cell_size: int = 256) -> Image.Image:
    """Build a numbered 3x3 grid from PIL Image objects (instead of file paths)."""
    grid_size = cell_size * 3
    grid = Image.new("RGB", (grid_size, grid_size), (40, 40, 40))
    draw = ImageDraw.Draw(grid)
    for idx, img in enumerate(images[:9]):
        row, col = divmod(idx, 3)
        x, y = col * cell_size, row * cell_size
        try:
            thumb = img.copy()
            thumb.thumbnail((cell_size, cell_size))
            ox = x + (cell_size - thumb.width) // 2
            oy = y + (cell_size - thumb.height) // 2
            grid.paste(thumb, (ox, oy))
        except Exception:
            pass
        label = str(idx + 1)
        try:
            font = ImageFont.truetype("arial.ttf", 20)
        except OSError:
            font = ImageFont.load_default()
        bbox = draw.textbbox((0, 0), label, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        lx, ly = x + 4, y + 4
        draw.rectangle([lx - 2, ly - 2, lx + tw + 4, ly + th + 4], fill=(0, 0, 0, 180))
        draw.text((lx, ly), label, fill="white", font=font)
    return grid


async def analyze_project_from_catalog(catalog, project_id: str, cc_client,
                                        anthropic_client, on_progress=None):
    """Analyze a project's photos from CompanyCam URLs and write results to the catalog.

    Pass 1 (Triage): Downloads photos 9 at a time, builds a grid, calls Anthropic with
    TRIAGE_PROMPT, then marks each photo as picked/document/skip in the catalog.

    Pass 2 (Deep): For each "picked" photo that still has no scene, downloads from URL
    and calls Anthropic with DEEP_PROMPT, writing full analysis to the catalog.
    """

    def _progress(msg: str, **kwargs):
        if on_progress:
            on_progress({"message": msg, **kwargs})

    # --- Triage pass ---
    unanalyzed = catalog.get_unanalyzed_photos(project_id)
    total_photos = len(unanalyzed)
    log(f"[Catalog] Project {project_id}: {total_photos} unanalyzed photos")

    total_grids = (total_photos + 8) // 9
    _progress(f"Starting triage: {total_photos} photos in {total_grids} grids",
              phase="triage", total=total_photos)

    for grid_idx in range(total_grids):
        batch = unanalyzed[grid_idx * 9 : (grid_idx + 1) * 9]
        log(f"[Triage] Grid {grid_idx + 1}/{total_grids} ({len(batch)} photos)")

        # Download all images in this batch into memory
        pil_images = []
        for photo in batch:
            try:
                img_bytes = await cc_client.get_photo_bytes(photo["uri"])
                img = Image.open(io.BytesIO(img_bytes))
                if img.mode != "RGB":
                    img = img.convert("RGB")
                pil_images.append(img)
            except Exception as e:
                log(f"[Triage] Failed to download {photo['id']}: {e}")
                pil_images.append(Image.new("RGB", (256, 256), (60, 60, 60)))

        try:
            grid_img = build_grid_from_images(pil_images)
            b64, media_type = image_to_b64(grid_img)

            response = await anthropic_client.messages.create(
                model=ANTHROPIC_MODEL,
                max_tokens=1024,
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "image", "source": {"type": "base64",
                                                      "media_type": media_type, "data": b64}},
                        {"type": "text", "text": TRIAGE_PROMPT},
                    ],
                }],
            )
            parsed = parse_json_response(response.content[0].text)
            picks = parsed.get("picks", [])
            doc_cells = {c for c in parsed.get("documents", []) if isinstance(c, int)}
            picked_cells = set()
            service_hints: dict[int, str] = {}
            for pick in picks:
                cell = pick.get("cell")
                if isinstance(cell, int) and 1 <= cell <= 9:
                    picked_cells.add(cell)
                    service_hints[cell] = pick.get("service", "")

            for i, photo in enumerate(batch):
                cell_num = i + 1
                if cell_num in picked_cells:
                    catalog.update_photo_analysis(photo["id"], {
                        "triage_status": "picked",
                        "scene": None,
                        "service_types": [service_hints.get(cell_num, "")],
                        "phase": None,
                        "entities": [],
                        "marketing_score": None,
                        "marketing_notes": "",
                        "before_after_potential": False,
                    })
                elif cell_num in doc_cells:
                    catalog.update_photo_analysis(photo["id"], {
                        "triage_status": "document",
                        "scene": None,
                        "service_types": [],
                        "phase": None,
                        "entities": [],
                        "marketing_score": None,
                        "marketing_notes": "",
                        "before_after_potential": False,
                    })
                else:
                    catalog.update_photo_analysis(photo["id"], {
                        "triage_status": "skip",
                        "scene": None,
                        "service_types": [],
                        "phase": None,
                        "entities": [],
                        "marketing_score": None,
                        "marketing_notes": "",
                        "before_after_potential": False,
                    })

        except Exception as e:
            log(f"[Triage] Grid {grid_idx + 1} error: {e}")
            for photo in batch:
                catalog.update_photo_analysis(photo["id"], {
                    "triage_status": "picked",
                    "scene": None,
                    "service_types": [],
                    "phase": None,
                    "entities": [],
                    "marketing_score": None,
                    "marketing_notes": "",
                    "before_after_potential": False,
                })

        _progress(f"Triage grid {grid_idx + 1}/{total_grids} complete",
                  phase="triage", grid=grid_idx + 1, total_grids=total_grids)

    # --- Deep analysis pass ---
    all_photos = catalog.get_project_photos(project_id, per_page=10000)
    picked_photos = [p for p in all_photos
                     if p.get("triage_status") == "picked" and p.get("scene") is None]
    log(f"[Deep] {len(picked_photos)} picked photos to deeply analyze")
    _progress(f"Starting deep analysis: {len(picked_photos)} photos",
              phase="deep", total=len(picked_photos))

    sem = asyncio.Semaphore(CONCURRENCY)
    completed = 0

    async def analyze_one(photo: dict):
        nonlocal completed
        async with sem:
            try:
                img_bytes = await cc_client.get_photo_bytes(photo["uri"])
                img = Image.open(io.BytesIO(img_bytes))

                b64, media_type = image_to_b64(img, max_dim=768)
                response = await anthropic_client.messages.create(
                    model=ANTHROPIC_MODEL,
                    max_tokens=1024,
                    messages=[{
                        "role": "user",
                        "content": [
                            {"type": "image", "source": {"type": "base64",
                                                          "media_type": media_type, "data": b64}},
                            {"type": "text", "text": DEEP_PROMPT},
                        ],
                    }],
                )
                analysis = parse_json_response(response.content[0].text)
                catalog.update_photo_analysis(photo["id"], {
                    "triage_status": "picked",
                    "scene": analysis.get("scene", ""),
                    "service_types": analysis.get("service_types", []),
                    "phase": analysis.get("phase", "other"),
                    "entities": analysis.get("entities", []),
                    "marketing_score": analysis.get("marketing_score", 1),
                    "marketing_notes": analysis.get("marketing_notes", ""),
                    "before_after_potential": analysis.get("before_after_potential", False),
                })
            except Exception as e:
                log(f"[Deep] Error on {photo['id']}: {e}")

            completed += 1
            _progress(f"Deep analysis {completed}/{len(picked_photos)}",
                      phase="deep", current=completed, total=len(picked_photos))

    tasks = [analyze_one(photo) for photo in picked_photos]
    await asyncio.gather(*tasks)

    catalog.set_project_analyzed(project_id)
    _progress("Analysis complete", phase="complete")
    log(f"[Catalog] Project {project_id} analysis complete")


if __name__ == "__main__":
    main()

# Video Store — Design Spec

**Date:** 2026-05-07
**Location:** `tools/photo-scanner/photo_scanner/video_store.py`
**Purpose:** Help the video editor plan their Friday shoot decisions for the following week. Given a document of video scripts (with shot lists) and the photo-scanner catalog, produce a prioritized list of CompanyCam projects that are likely to have the right conditions and crew activity next Monday for filming.

---

## Problem

Every Friday the video editor needs to decide which active job sites are worth visiting the following week to capture footage for marketing videos. Currently this is a manual scan: open CompanyCam, look at recent photos for each active job, guess what crew will be doing Monday, cross-reference against shot lists held in script docs.

We already have:
- A `catalog.db` (SQLite) with every CompanyCam project and analyzed photo (scene description, service types, phase, entities, marketing notes, damage details)
- Existing report patterns in `photo_scanner/reports.py` and `report_project.py`
- An Anthropic-backed analysis pipeline

We do not have:
- A way to ingest a script document and extract shot requirements
- Project-level "what's happening next week" intelligence
- A ranking that combines shot availability with location quality

---

## Architecture

```
tools/photo-scanner/
├── photo_scanner/
│   ├── video_store.py         # NEW — the tool
│   └── templates/
│       └── video_shoot_plan.html  # NEW — report template
└── .video_store_cache/        # NEW — script-hash-keyed shot lists
    └── <script-sha>.json
```

New columns on existing `projects` table:
- `video_triage_json` TEXT — last triage output (Step 3)
- `video_triage_week` TEXT — ISO date (Monday) the triage covers
- `video_location_score_json` TEXT — last location-quality output (Step 5)
- `video_location_scored_at` TEXT — invalidation timestamp

No new tables. No new pip packages.

---

## CLI

```bash
# Generate next week's shoot plan from a script document
python -m photo_scanner.video_store path/to/scripts.md

# Options
  --week-of 2026-05-11        # Monday of the week to plan for; default = next Monday
  --max-distance 20           # miles from Portland centroid; default = 20
  --refresh-shots             # re-extract shots from the script even if cached
  --refresh-quality           # re-score location quality
  --refresh-triage            # re-run project triage even if cached for this week
  --out report.html           # output path; default = video_shoot_plan_<week>.html
```

`scripts.md` may be a single file or a directory of script files. Plain text or markdown.

---

## Pipeline

```
1. Load scripts → extract shot list (cached by script hash)
2. Pull active projects from catalog, filter to ≤20mi of Portland
3. For each project: triage last 7 days of photos → job summary +
                     predicted Monday phase + predicted Monday work
4. For each project: match shots to predicted Monday work + available conditions
5. For each project: score location quality (curb appeal, wide-shot room, landscaping)
6. Rank projects → render HTML report
```

### Step 1 — Extract shot list

One Anthropic call per script document. Input: the raw script text. Output:

```json
{
  "scripts": [
    {
      "title": "What are signs of dry rot?",
      "narrator_summary": "Walks viewer through visual signs of dry rot.",
      "shots": [
        {
          "id": "dryrot-01",
          "category": "static_condition",
          "description": "Peeling paint on exterior wall",
          "service": "dry-rot",
          "required_phase": null
        },
        {
          "id": "dryrot-02",
          "category": "in_progress_action",
          "description": "Touching dry rot, slow-motion crumbling",
          "service": "dry-rot",
          "required_phase": "during"
        },
        {
          "id": "dryrot-03",
          "category": "establishing",
          "description": "Establishing wide shot of home",
          "service": null,
          "required_phase": null
        }
      ]
    }
  ]
}
```

**Shot categories** drive matching logic:
- `static_condition` — a visible defect or material state. Available any time the project is active and the condition exists in the catalog.
- `in_progress_action` — requires the crew to be actively doing the work on the day of filming.
- `establishing` — generic B-roll. Available at any active site that looks presentable.

**Cache:** SHA-256 of the script content is the cache key. File at `.video_store_cache/<sha>.json`. Editing the script invalidates the cache. `--refresh-shots` forces re-extraction.

### Step 2 — Project filter

Active projects only. Definition of "active": at least one photo in the last 30 days.

Distance filter: Haversine from Portland centroid `(45.5152, -122.6784)` against the existing `lat`/`lng` columns. Drop projects with missing or zero coordinates (warn in stderr — these are excluded from the plan, not the catalog).

### Step 3 — Project triage (the core)

One Anthropic call per surviving project. Text-only — vision is reserved for Step 5. Inputs:

- Project name, address, distance from PDX, `notepad`
- Every photo from the last 7 days, oldest first:
  - `taken_at`, `creator_name`, `phase`, `service_types`, `scene`, `entities`, `marketing_notes`, `damage_details`

Prompt asks for a structured JSON response:

```json
{
  "job_summary": "Dry rot repair on the south elevation cedar siding. Crew completed tear-off Wed-Fri exposing rotted sheathing and structural framing. Replacement sheathing started Friday.",
  "current_phase": "during",
  "predicted_monday": {
    "phase": "during",
    "work": "Continuing sheathing replacement, likely starting moisture barrier install. Siding tear-off appears complete on south wall; west wall may begin tear-off if crew expands scope.",
    "confidence": "high",
    "reasoning": "Photos Mon-Fri show consistent crew activity, no signs of pause. Phase progression: before(Mon) → during(Tue-Fri). Notepad mentions 5-day estimate which finishes mid-next-week."
  },
  "available_conditions": [
    "dry rot exposed",
    "rotted sheathing",
    "structural framing visible",
    "cedar siding removed",
    "moisture damage on plywood"
  ]
}
```

**Confidence** is one of `high` / `medium` / `low`. Triage is allowed to return `predicted_monday.phase = "idle"` with a reason — projects can stall.

**Cache:** stored in `projects.video_triage_json` keyed by `video_triage_week`. If `video_triage_week` matches the requested `--week-of`, reuse it. `--refresh-triage` forces re-run. Triage is cheap enough to re-run on the whole filtered set in a few minutes.

### Step 4 — Shot matching

One Anthropic call per project. Inputs: the project's `predicted_monday.work`, `available_conditions`, recent service types, the full extracted shot list, **and a compact index of the last 7 days of photos as `(photo_id, scene, entities)` tuples** so Claude can populate `evidence_photo_id` for `static_condition` matches. Output:

```json
{
  "matches": [
    {
      "shot_id": "dryrot-02",
      "confidence": "high",
      "reason": "Crew is actively replacing rotted sheathing Monday — touching/handling exposed dry rot is in-frame work.",
      "evidence_photo_id": "abc123"
    },
    {
      "shot_id": "dryrot-03",
      "confidence": "high",
      "reason": "Active site, presentable wide-shot location — see Step 5 callouts.",
      "evidence_photo_id": null
    }
  ]
}
```

`evidence_photo_id` is optional — used only for `static_condition` shots where we want to surface a thumbnail in the report proving the condition is there.

This step is not cached — it re-runs whenever the shot list or triage changes. It is the cheapest step (small prompt, structured response).

### Step 5 — Location quality

One Anthropic vision call per project. Inputs: up to 3 of the project's best wide/establishing photos. Selection rule: photos where `phase = 'overview'` ranked by `marketing_score` desc, then top remaining photos by `marketing_score` desc. Output:

```json
{
  "curb_appeal": 4,
  "wide_shot_room": 5,
  "landscaping": 4,
  "callouts": [
    "Large front yard with mature landscaping",
    "Clear sightline to full elevation from across the street",
    "Appears to be high-end craftsman in a desirable neighborhood"
  ]
}
```

All scores are 1–5 integers. `callouts` is a short list of one-liners surfaced in the report.

**Cache:** stored in `projects.video_location_score_json` with `video_location_scored_at` timestamp. Invalidated when a newer photo arrives or when `--refresh-quality` is passed. Persists across weeks — location quality doesn't change unless the project does.

### Step 6 — Rank + render

Score formula:

```
score = (high_confidence_shots * 3)
      + (medium_confidence_shots * 1)
      + (low_confidence_shots * 0.25)
      + ((curb_appeal + wide_shot_room + landscaping) * 0.5)
```

Ties broken by curb appeal, then by distance from PDX (closer first).

Render to HTML via Jinja2 (same pattern as `report_project.py`).

---

## HTML Report Layout

Filename default: `video_shoot_plan_<YYYY-MM-DD>.html` where the date is the Monday being planned for.

**Header bar**
- Title: "Video Shoot Plan — Week of Mon May 11"
- Counts: N projects in plan • N total matched shots • N/M scripts covered
- Generated-at timestamp

**Script coverage summary**
- Per script: "X / Y shots available this week" with a horizontal progress bar
- Tells the editor at a glance which videos are shootable now vs which need more weeks of activity

**Ranked project cards** (highest score first)

Each card:
- Header row: project name • address (deep-linked to Google Maps + Zillow) • distance from PDX • curb-appeal stars
- **Job summary** — narrative paragraph from triage
- **Monday prediction** — phase badge, work paragraph, confidence pill (green/yellow/red)
- **Available shots** — grouped by script. Each shot row: confidence pill, description, matched reason, evidence thumbnail (clickable to full image) when present
- **Location callouts** — bullet list of vision-derived callouts
- **Recent activity strip** — last 7 days as horizontal phase markers, so velocity is visible at a glance

Visual style matches the existing `report_*.html` family.

---

## Dependencies

All already in `requirements.txt`:
- `anthropic`
- `httpx`
- `jinja2`
- The local `Catalog` class from `catalog.py`
- `anthropic_auth.py` for credentials

No new packages. No external APIs beyond Anthropic and CompanyCam (already in use).

---

## Non-Goals (V1)

- No calendar export, no crew assignment, no scheduling integration
- No video file management or recording
- No Zillow API integration — the report deep-links the address so the editor can spot-check
- No multi-week planning — single Monday at a time
- No UI for editing the extracted shot list — the script doc is the source of truth, edit it and re-run with `--refresh-shots`
- No automatic refresh of the catalog itself — assumes the user has run the regular CompanyCam sync first

---

## Usage Flow

```
1. Editor runs the regular catalog sync (existing tool)

2. python -m photo_scanner.video_store ./scripts/dry-rot-and-siding.md
   → Extracts shot list (cached if unchanged)
   → Filters to ~30-50 active Portland-area projects
   → Triages each (one LLM call per project)
   → Matches shots per project (one LLM call per project)
   → Scores location quality where missing/stale
   → Writes video_shoot_plan_2026-05-11.html
   → Opens in browser

3. Editor reviews ranked list, picks 3-5 projects to visit Monday
```

Subsequent runs the same week are fast: triage and quality are cached, only the matching step re-runs (and only if shots changed).

---

## Open Questions

None blocking V1. Future enhancements (out of scope):
- Slack/email digest mode instead of HTML
- Multi-day prediction (Tue/Wed/Thu of the planned week)
- Historical scoring: did the predicted shots actually get filmed?
- Auto-detect "this script needs more weeks of project activity" and suggest follow-up

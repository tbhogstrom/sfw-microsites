# Project Report — Design Spec

**Date:** 2026-04-17
**Location:** `tools/photo-scanner/`
**Purpose:** Generate a homeowner-facing project-level report from already-analyzed CompanyCam project data, then use a two-stage triage of photo grids to select the 6 best photos that illustrate the report narrative.

---

## Problem

The photo-scanner already produces daily and weekly homeowner reports for an individual day or week of work. There's no equivalent for a whole project: a single document that summarizes the start condition → work performed → current status across the full project arc, with a curated set of photos that illustrate the narrative.

The first project this is needed for is **David Devore / Milwaukie Presbyterian Church - Paint 04-06-2026** (`project_id = 102316944`): 197 synced photos, 164 analyzed, 23 marketing picks, and an existing rich `summary` JSON containing `project_summary`, `scope_of_work`, 9 detailed `issues` (each with before/during/after photo IDs and resolution status), and a `coverage_assessment`.

---

## Decisions

- **Audience / tone:** Homeowner-facing. Extends the same licensed-contractor tone as the existing daily/weekly reports (no severity adjectives, no completion language like "all repaired", construction terminology accessible to a homeowner).
- **Photo pool fed into triage:** All analyzed photos with `marketing_score >= 3` for the project (~60-80 expected for Milwaukie). Falls back to score ≥2 if fewer than 6 exist at ≥3.
- **Final photo count:** 6 photos.
- **Selection criteria:** Best illustrators of the report narrative — picks are graded by how well they support the freshly-written text, not by raw visual marketing quality.
- **Triage approach:** Two-stage. Stage 1 grid triage scores all cells; stage 2 assembles the top 12 finalists into 1-2 finalist grids and picks the final 6 + writes captions in one shot (so the final 6 are picked as a *coherent set*, not independently).
- **Trigger:** Both CLI and a new "Project Reports" tab in the existing web UI.
- **Persistence:** New `project_reports` table — one row per generation, history preserved (no upsert-on-conflict; regeneration creates a new row).

---

## Architecture

### Module placement

```
tools/photo-scanner/photo_scanner/
  reports.py                # +generate_project_report() alongside daily/weekly
  grid_builder.py           # NEW — shared 3x3 grid building from streamed CC bytes
  catalog.py                # +project_reports table, +save/get methods
  server.py                 # +API routes, +background task state for project reports
  templates/
    index.html              # +Project Reports tab (3rd tab)
    project_report.html     # NEW — standalone HTML render of one project report
  __main__.py               # +report_project subcommand
```

### Data flow

```
CLI or UI button
    │
    ▼
generate_project_report(catalog, project_id, anthropic_client, cc_client)
    │
    ├── Step 1 — Write narrative (1 text-only Claude call)
    │       inputs: projects.summary, project metadata, risk_value_matrix
    │       output: report JSON (headline, sections, issues_summary)
    │
    ├── Step 2 — Pull photos & build grids
    │       query: photos WHERE project_id=? AND marketing_score >= 3
    │       sort: by phase (before → during → after) for grid coherence
    │       fetch: stream bytes from CompanyCam in parallel batches
    │       build: 3x3 grids with cell labels 1-9, track cell→photo_id map
    │
    ├── Step 3 — Stage 1 grid triage (~7-9 vision calls, concurrent)
    │       prompt: score each cell 1-5 vs the narrative
    │       output: scored cells across all grids
    │       cull: top 12 finalists by score
    │
    ├── Step 4 — Stage 2 finalist selection (1 vision call)
    │       prompt: pick 6 from finalists; 2 conditions / 2 work / 2 status; write captions
    │       output: 6 photo_ids + captions + roles
    │
    └── Save to project_reports table; return report
```

---

## Data Model

### New table: `project_reports`

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `project_id` | TEXT NOT NULL | FK → projects.id |
| `report_data` | TEXT NOT NULL | Full report JSON (see shape below) |
| `generated_at` | TEXT NOT NULL | ISO timestamp |
| `model` | TEXT | Claude model used (for traceability) |

No `UNIQUE(project_id)` — regenerating creates a new row, history preserved. UI shows latest by default with a history dropdown.

**New `Catalog` methods:**
- `save_project_report(project_id, report_data, model) -> int` (returns new row id)
- `get_project_report(report_id) -> dict | None` (joined with project name/address)
- `list_project_reports(project_id=None) -> list[dict]` (newest first; without project_id returns latest per project)

### Report JSON shape (stored in `report_data`)

```json
{
  "headline": "string, < 12 words",
  "executive_summary": "2-3 sentences — the project at a glance",
  "scope_narrative": "2-3 sentences — what we set out to do, services involved",
  "conditions_found": "2-3 sentences — what we documented at the start",
  "work_performed": "3-4 sentences — phased description",
  "current_status": "2-3 sentences — what's resolved, what's in progress, what was documented-only",
  "value_statement": "1-2 sentences — why this matters to the property",
  "issues_summary": [
    {"issue": "name", "service_type": "siding", "status": "resolved|in-progress|documented-only"}
  ],
  "photos": [
    {"photo_id": "...", "caption": "...", "phase": "before|during|after|...", "role": "conditions|work|status"}
  ],
  "stats": {"total_photos": 197, "analyzed": 164, "phases": {"before": 41, "during": 90, "after": 2}},
  "partial": false
}
```

The `role` field on each photo lets the template slot it into the right section (conditions / work / status). `partial: true` when fewer than 6 photos were available or stage 2 returned fewer than 6.

---

## Generator Pipeline — `generate_project_report`

### Step 1 — Write the narrative (text-only)

- **Inputs:** `projects.summary` (project_summary, scope_of_work, issues, coverage_assessment), project name/address, the `risk_value_matrix` from `report_config.json` filtered to the services in scope.
- **Single Claude call** (text-only, Sonnet). No vision yet.
- **Prompt:** Reuses the homeowner-tone rules from the existing `REPORT_PROMPT` in `reports.py` (no severity adjectives, no declarative completion language, structured confident sentences). Asks for the report JSON shape above (minus `photos`, `stats`, `partial` which are added later).

### Step 2 — Pull photos & build grids

- Query catalog: `SELECT * FROM photos WHERE project_id=? AND scene IS NOT NULL AND marketing_score >= 3 ORDER BY phase, taken_at`. Phase ordering ensures grids tend to be phase-coherent (helps Claude judge cells in context).
- Stream photo bytes from CompanyCam concurrently via `cc_client.get_photo_bytes()` (asyncio.gather batched).
- Build 3x3 grids using a shared `grid_builder.build_labeled_grid(images, cell_size=256)` — produces 768x768 contact sheets with cell numbers 1-9 overlaid in a corner.
- Maintain `grid_index → {cell_id → photo_id}` mapping per grid.

### Step 3 — Stage 1: triage scoring

- For each grid, send to Claude (vision):
  - The grid image (base64 JPEG, quality 85).
  - The narrative JSON written in step 1 (so Claude knows what it's scoring against).
  - Cell IDs (1-9).
- **Prompt:** `"Score each numbered cell 1-5 for how well it illustrates the report below. Skip duplicate angles of cells you've already scored highly. Return JSON: {\"scores\": [{\"cell\": 1, \"score\": 4, \"phase_match\": \"conditions\", \"note\": \"why\"}]}."`
- Run grids concurrently (asyncio.gather) with the same retry/backoff pattern as `analyze_report_grid` in `server.py` (3 attempts, exponential 15s backoff on 429).
- Collect all scored cells across grids → take the top **12 finalists** by score (over-pull so stage 2 has options).

### Step 4 — Stage 2: finalist selection + captions

- Build 1-2 finalist grids from the top 12 (e.g., one 4x3 grid, or two 3x3 grids of 6 cells each — implementation choice based on what renders cleanest at the chosen cell size).
- Single Claude call (vision):
  - The finalist grid(s).
  - The narrative.
  - The role categories (`conditions` / `work` / `status`).
- **Prompt:** `"Pick 6 photos for this report. Aim for narrative coverage: 2 illustrating conditions found, 2 illustrating work performed, 2 illustrating current status. For each pick, write a one-sentence caption in homeowner-facing construction terminology — no severity adjectives, no completion language. Avoid duplicate angles. Return JSON: {\"picks\": [{\"cell\": 3, \"role\": \"conditions\", \"caption\": \"...\"}]}."`
- Map cell IDs back to photo IDs, attach captions, set `phase` from the catalog data, return the assembled report.

**Total Claude calls:** 1 (narrative) + ~7-9 (stage 1 grids, concurrent) + 1 (stage 2) = ~10-11 calls per report.

---

## CLI

```bash
python -m photo_scanner.report_project <project_id> [--output report.html] [--json report.json]
```

- Loads catalog, builds Anthropic + CompanyCam clients (existing patterns).
- Runs `generate_project_report`, saves to `project_reports`, optionally writes a standalone HTML/JSON file.
- Prints per-step progress to stderr (matches existing scanner progress style).

---

## API Routes (added to `server.py`)

| Method | Path | Description |
|---|---|---|
| POST | `/api/reports/project/generate` | Body: `{"project_id": "..."}`. Kicks off generation in a background task (mirrors `_report_task_state`). Returns 202 immediately. |
| GET | `/api/reports/project/task` | Polls background task — `{status, project_id, step, error}`. |
| GET | `/api/reports/project/list?project_id=...` | Saved reports for that project, newest first (id, generated_at, headline). Without `project_id`: returns latest report per project across all projects. |
| GET | `/api/reports/project/{report_id}` | Single report by ID — full `report_data` JSON joined with project name/address. |
| GET | `/reports/project/{report_id}` | HTML render via `project_report.html` template (for sharing/printing/PDF). |

---

## Web UI — Project Reports Tab

Third tab in `index.html`, alongside Reports and Weekly Reports.

### Top bar

- Project picker — searchable dropdown populated from `/api/companycam/projects` (same source as Projects tab).
- "Generate Project Report" button.
- Status text — mirrors daily/weekly tab patterns.

### Body

- **Idle state:** list of all saved project reports across projects (project name, headline, generated_at, "View" button).
- **Generating state:** live progress polling `/api/reports/project/task`, showing the current pipeline step.
- **Complete state:** render the new report inline using the same card style as daily/weekly, with the 6 photos in a grid by role.
- **Buttons:** "Export PDF" (existing pattern from daily/weekly), "Open standalone" (links to `/reports/project/{report_id}`).

---

## HTML Template — `project_report.html`

Reuses the dark-theme styles from `report.html` (already established). Section order:

1. Header — project name, address, headline, generated date.
2. Executive summary.
3. Conditions found — narrative + photos with `role: conditions` inline.
4. Work performed — narrative + photos with `role: work` inline.
5. Current status — narrative + photos with `role: status` inline.
6. Value statement.
7. Issues summary table (issue, service, status).

---

## Error Handling

| Case | Behavior |
|---|---|
| Project has no `summary` (never analyzed) | HTTP 422: `"Run project analysis first — no summary available."` |
| Fewer than 6 photos at score ≥3 | Fall back to score ≥2; if still <6, continue with whatever exists, set `partial: true`. |
| CompanyCam photo fetch fails (404, timeout) | Log photo ID, drop it from the grid, continue. If a grid loses too many photos, skip that grid. |
| Stage 1 grid call fails (parse error, 5xx) | Retry once with backoff (existing scanner retry pattern). Skip that grid if still failing. |
| Stage 2 finalist call fails | Retry once. If still failing, fall back to score-ranked selection from the stage 1 finalists (top 6 by stage 1 score, role assigned by phase mapping: before→conditions, during→work, after→status; captions default to the catalog `scene` field). |
| Anthropic 429 rate limit | Exponential backoff (existing pattern in `analyze_report_grid`). |
| Concurrent generation requests | Background task lock — HTTP 409 if a project report is already being generated (matches `_report_task_state` pattern). |
| Stage 2 returns fewer than 6 picks | Accept what's returned, set `partial: true`. |

---

## Testing — `tests/test_project_reports.py`

- `test_select_finalists_under_threshold` — fewer than 12 score≥3 photos → pulls all, no error.
- `test_select_finalists_falls_back_to_score_2` — only 3 score≥3 photos → falls back to score ≥2.
- `test_grid_builder_handles_partial_grid` — 5 photos in last batch → builds a 3x3 with 4 empty cells.
- `test_partial_flag_when_few_photos` — total pool <6 → `partial: true` set.
- `test_no_summary_returns_error` — project with `summary=NULL` → raises with clear message.
- `test_save_and_load_project_report` — round-trip the report through `catalog.save_project_report` / `get_project_reports`.
- `test_generate_project_report_e2e` — mocked Anthropic + CompanyCam clients, asserts the four-step pipeline executes in order with the right inputs flowing between stages.

No live API tests (matches existing test patterns in `test_reports.py`).

---

## Non-Goals

- No multi-project rollup reports (one project per report).
- No automatic publishing to public-facing sites (separate "Publish to Web" flow exists for daily/weekly; out of scope here).
- No editing of generated reports in the UI (regenerate to change).
- No automatic regeneration when new photos arrive (manual trigger only).
- No re-analysis of photos as part of project report generation — relies on already-analyzed catalog data.

---

## Usage Flow (Milwaukie Presbyterian)

```
# CLI:
python -m photo_scanner.report_project 102316944 --output milwaukie-report.html

# Or UI:
1. Open the photo-scanner web app.
2. Click the "Project Reports" tab.
3. Search and select "David Devore / Milwaukie Presbyterian Church - Paint 04-06-2026".
4. Click "Generate Project Report".
5. Watch the four pipeline steps tick through (~2-3 minutes wall time).
6. Review the rendered report inline; export PDF or open standalone link as needed.
```

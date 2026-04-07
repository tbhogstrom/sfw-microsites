# Weekly Homeowner Reports — Design Spec

## Overview

Generate weekly project reports for homeowners from analyzed CompanyCam photos. Each report summarizes the full week's work — a higher-level narrative arc plus day-by-day timeline. Generated for projects with 3+ business days of photo activity in a Mon–Fri window.

Builds on the daily reports system: same catalog, same risk→value matrix, same report card styling, same cumulative issue tracking.

## Report Content

Each weekly report card contains (in order):

1. **Header** — project name, address, week range (e.g., "Week of March 31 – April 4, 2026")
2. **Weekly narrative** — 3-4 sentences covering the arc: where the project stood at start of week, what was accomplished, where it stands now. Risk-focused, friendly tone, concise.
3. **Risk Before → After** — same format as daily but for the full week. Start-of-week risk vs end-of-week status. 1-2 sentences each.
4. **Best photos of the week** — 4 photos selected across the whole week, preferring a before→during→after narrative arc
5. **Value statement** — what this week's work means for the homeowner. 1-2 sentences.
6. **Issues tracker** — full issue list with status and which ones changed this week
7. **Day-by-day timeline** — condensed per-day entries: date, 1-sentence summary, 1-2 thumbnail photos. Uses existing daily report data if available, otherwise generates from photo analysis.
8. **Footer** — SFW Construction branding

**Tone:** Same as daily — friendly, concise, leads with risk and value. Short sentences, no filler.

**Threshold:** 3+ business days with analyzed photos in the Mon–Fri window.

## Architecture

### Data Flow

1. **Determine eligible projects** — query catalog for projects with analyzed photos on 3+ distinct business days in the target week.
2. **Gather week's data** — all analyzed photos for the week, grouped by day. Pull cumulative project summary (issues list). Pull existing daily reports if available.
3. **Select best photos** — top 4 across the full week, preferring narrative arc (before early in week → during mid-week → after late in week).
4. **Generate report via Claude** — text-only prompt with: week's photo analysis data, cumulative issues, daily summaries, relevant risk→value matrix entries. Claude returns structured JSON.
5. **Store** — save in `weekly_reports` table.
6. **Render** — Weekly Reports tab displays styled HTML cards.

### Modules

- **`reports.py`** — add `generate_weekly_report()` and `select_best_photos_weekly()` alongside existing daily functions
- **`catalog.py`** — add `weekly_reports` table, `save_weekly_report()`, `get_weekly_reports()`, `get_photos_for_week()`, `get_eligible_weekly_projects()`
- **`server.py`** — add `POST /api/reports/generate-weekly` and `GET /api/reports/weekly` routes
- **`index.html`** — add new "Weekly Reports" tab in the main nav with week picker and report card rendering
- **`report_config.json`** — no changes. Same matrix and defaults.

## Data Model

### `weekly_reports` table (new)

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-increment |
| `project_id` | TEXT | CompanyCam project ID |
| `week_start` | TEXT | Monday date YYYY-MM-DD |
| `report_data` | TEXT | Generated report as JSON |
| `generated_at` | TEXT | ISO timestamp |

Unique constraint on `(project_id, week_start)`.

### Report JSON structure (`report_data`)

```json
{
  "headline": "A Week of Structural Restoration",
  "weekly_narrative": "3-4 sentence arc of the week's work",
  "risk_before": "risk status at start of week",
  "risk_after": "risk status at end of week",
  "what_we_did": "summary of the week's work",
  "value_statement": "why this week matters",
  "photos": [
    {"photo_id": "abc", "caption": "...", "phase": "before", "day": "2026-03-31"}
  ],
  "issues_status": [
    {"issue": "name", "status": "resolved", "changed_this_week": true}
  ],
  "daily_timeline": [
    {"date": "2026-03-31", "summary": "one sentence", "photo_ids": ["abc", "def"]}
  ]
}
```

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/reports/generate-weekly` | Generate weekly reports. Body: `{"week_start": "2026-03-31", "project_id": "optional"}`. Generates for all eligible projects if no project_id. |
| GET | `/api/reports/weekly?week_start=2026-03-31` | Fetch saved weekly reports for a week |

## Web UI

### Weekly Reports Tab

Separate tab in the main nav bar (alongside Dashboard, Projects, Catalog, Scanner, Map, Reports). Contains:

- **Week picker** — date input for the Monday of the week, defaults to last Monday
- **Generate Weekly Reports** button
- **Load Saved** button
- **Progress/status indicator**
- **Report cards** — same light-theme styling as daily reports, with the day-by-day timeline section added at the bottom

Report card styling reuses the same CSS classes (`.report-card`, `.report-header`, `.report-section`, `.risk-boxes`, etc.) with a new `.day-timeline` section for the day-by-day entries.

## Weekly Report Prompt

Sends to Claude:
- Project name and address
- All analyzed photos for the week (scenes, phases, damage_details, service_types) grouped by day
- Cumulative project issues with current status
- Existing daily report summaries if available (so Claude doesn't contradict them)
- Relevant risk→value matrix entries
- Instructions: friendly tone, concise, cover the week's arc, 1-sentence per day in timeline

## Scope Boundaries

- HTML only — no PDF, no email
- Separate "Weekly Reports" tab (not merged with daily)
- 3+ business days threshold for eligibility
- No "next week" predictions — stick to what photos prove
- Reuses existing daily report data in the timeline when available
- Same risk→value matrix config, no changes needed
- One report per project per week

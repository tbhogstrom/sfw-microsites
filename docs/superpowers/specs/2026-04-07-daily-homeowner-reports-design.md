# Daily Homeowner Reports — Design Spec

## Overview

Generate daily project reports for homeowners from analyzed CompanyCam photos. Each report summarizes the day's work at a job site in friendly, concise language — leading with risk mitigation and value, backed by the best photos from that day.

Reports are built on the cumulative project state: all previously analyzed photos feed the project's issue tracker, and each day's photos advance the story. The report tells the homeowner where the project stands *as of today*.

## Use Case

Boss wants to test delivering daily updates to homeowners. For now: generate HTML reports viewable in the browser, one card per project per day. No email delivery, no PDF, no portal — just clean, shareable HTML.

## Report Content

Each report card contains (in order):

1. **Header** — risk-focused headline, project name, date, address
2. **Risk Before → After** — 1-2 sentences each. What was at risk, how today's work addressed it.
3. **What We Did Today** — 2-3 sentences, plain language
4. **Photos** — 3-4 best photos from that day with homeowner-friendly captions
5. **Value Statement** — 1-2 sentences on why this matters to the homeowner
6. **Issues Tracker** — mini status list showing all project issues with resolution status
7. **Footer** — SFW Construction branding

**Tone:** Friendly, concise, clearly points out risks. Leads with value and risk mitigation. Short sentences, no filler.

## Architecture

### Data Flow

1. **Query catalog** — pull all analyzed photos where `taken_at` falls on the target date, grouped by project. Also pull the full project summary (cumulative issues list).
2. **Select best photos** — top 3-4 by `marketing_score`, preferring a mix of phases.
3. **Generate report via Claude** — send photo analysis data + project summary + relevant risk→value matrix entries to Claude. Claude returns structured JSON with the report content. Text-only prompt (no images), cheap.
4. **Store** — save generated report in `daily_reports` table.
5. **Render** — Reports tab in UI displays styled HTML cards.

### Key Design Decision: Cumulative Issue State

The daily report doesn't just look at that day's photos. The project's issues table (from `project_summary`) tracks every construction issue across all analyzed photos to date. Today's photos update that picture — documenting new issues, showing progress, or confirming resolutions. The report reflects the full project state through the lens of what changed today.

### Risk → Value Matrix

Configurable JSON file at `tools/photo-scanner/report_config.json`. Maps service types to homeowner-friendly risk/value language. Defaults provided for all 14 service types. The report prompt feeds relevant entries (based on services present in that day's photos) to Claude as framing context.

The matrix is designed to be editable — change the language, add service types, adjust urgency levels. Claude uses it as guidance, not a template.

```json
{
  "risk_value_matrix": {
    "dry-rot": {
      "risk": "Dry rot compromises the structural wood in your home...",
      "value": "Removing and replacing rotted wood stops the spread...",
      "urgency": "high"
    }
  },
  "report_defaults": {
    "max_photos": 4,
    "tone": "friendly",
    "company_name": "SFW Construction"
  }
}
```

## Data Model

### `daily_reports` table (new)

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-increment |
| `project_id` | TEXT | CompanyCam project ID |
| `report_date` | TEXT | Date string YYYY-MM-DD |
| `report_data` | TEXT | Generated report as JSON |
| `generated_at` | TEXT | ISO timestamp |

Unique constraint on `(project_id, report_date)`.

### Report JSON structure (`report_data`)

```json
{
  "headline": "Protecting Your Home From Water Damage",
  "risk_before": "Severe dry rot at the roof-wall junction was allowing water behind your siding.",
  "risk_after": "Rotted material removed, new flashing installed. The wall cavity is sealed.",
  "what_we_did": "Removed deteriorated siding and trim, cut back to solid wood, installed new flashing.",
  "value_statement": "Today's work eliminated an active water intrusion path.",
  "photos": [
    {"photo_id": "abc123", "caption": "Dry rot exposed at the junction."},
    {"photo_id": "def456", "caption": "New flashing being installed."}
  ],
  "issues_status": [
    {"issue": "Roof-wall junction dry rot", "status": "resolved", "changed_today": true},
    {"issue": "South wall siding replacement", "status": "in-progress", "changed_today": true},
    {"issue": "Foundation sill plate", "status": "documented-only", "changed_today": false}
  ]
}
```

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/reports/generate` | Generate reports. Body: `{"date": "2026-04-06", "project_id": "optional"}`. Generates for all projects with photos that day if no project_id. |
| GET | `/api/reports/daily?date=2026-04-06` | Fetch saved reports for a date |

## Web UI

### Reports Tab

New tab in the main nav bar. Contains:
- **Date picker** (defaults to yesterday)
- **Generate Reports** button
- **Progress indicator** while generating
- **Report cards** — styled HTML, one per project, scrollable

Report card styling: white background, serif font, warm colors (matches the mockup). Not the dark dashboard theme — this is homeowner-facing.

## Report Generation Prompt

The prompt sends to Claude:
- Project name and address
- Today's analyzed photos (scene, phase, damage_details, service_types, entities)
- Full project issues list with current resolution status
- Which issues had new photo evidence today
- Relevant risk→value matrix entries for the services present
- Instructions: friendly tone, concise (1-2 sentences per section), lead with risk and value

## Scope Boundaries

- HTML only — no PDF, no email delivery
- Reports only for analyzed projects
- One report per project per day
- No homeowner auth/portal
- Matrix is a local JSON file, not a UI editor (edit it in a text editor)
- All reports on one scrollable page per date

# Client Photo Export — Design Spec

**Date:** 2026-04-30
**Location:** `tools/photo-scanner/` (extension)
**Purpose:** Let an SFW operator select a CompanyCam project, automatically remove document/receipt photos and AI-flag photos that may not be appropriate for a customer hand-off, manually exclude any remaining unsuitable photos, then download the rest as a date-organized zip to send the client.

---

## Problem

When a customer requests a copy of the photos from their job, today there is no fast way to:

- Pull all of a project's photos out of CompanyCam.
- Strip the documents (receipts, T&M sheets, screenshots, paperwork).
- Filter out photos that aren't appropriate to share with the customer — faces of workers/homeowners, mess and clutter, blurry/dark accidents, PPE-violation optics, the customer's interior or personal property (mail, license plates), or any unprofessional content.
- Hand someone a clean, reviewable list and let them make the final call.
- Get a single download containing the originals.

Doing this by hand from CompanyCam means scrolling through hundreds of photos in a UI that is not optimized for review-and-bulk-export.

---

## Scope

In scope (v1):

- One project at a time.
- Originals from CompanyCam, organized into date folders inside a single zip.
- Persisted curator selections (close the browser, come back, resume).
- Reused document filter from the existing scanner triage.
- New AI pass dedicated to "client-export safety" with six flag categories.
- Works on both already-scanned and not-yet-scanned projects (on-demand analysis if needed).

Out of scope (v1):

- Multi-project bulk exports.
- Date-range filtering inside a project.
- Cover sheet, project info, scope-of-work, or any metadata sidecar in the zip.
- Customer-facing self-serve download links.
- Multi-curator concurrency control (single operator assumed).
- Editing/cropping/redacting photos before export.

---

## Architecture

The feature lives entirely inside `tools/photo-scanner/`. New code:

```
tools/photo-scanner/
├── photo_scanner/
│   ├── client_export.py        # AI pass + zip builder
│   └── server.py               # + new routes for client-export views/APIs
├── photo_scanner/templates/
│   ├── client_export_index.html       # project picker
│   └── client_export_review.html      # photo review grid + export button
└── catalog.db                  # + 2 new columns on photos, 1 new table
```

Reused:

- `Catalog` (SQLite) — projects, photos, existing `triage_status` and analysis fields.
- `CompanyCamClient` — for fetching photo bytes and project info.
- `anthropic_auth` — for the Anthropic client used by the new AI pass.
- The existing in-process background-task pattern (`_task_state` in `server.py`) — for running the on-demand analysis without blocking the request.

---

## Data Model Changes

### `photos` table — two new columns

```sql
ALTER TABLE photos ADD COLUMN client_export_status TEXT;     -- 'ok' | 'flagged' | NULL (not yet checked)
ALTER TABLE photos ADD COLUMN client_export_flags TEXT;      -- JSON array, e.g. ["face","personal_property"]
```

Both null when the client-export AI pass has not been run for a photo. Migrations follow the same pattern already used in `catalog.py` (try-select-then-alter).

### New table `client_export_selections`

```sql
CREATE TABLE client_export_selections (
    project_id TEXT NOT NULL,
    photo_id TEXT NOT NULL,
    included INTEGER NOT NULL,         -- 0 or 1
    updated_at TEXT NOT NULL,
    PRIMARY KEY (project_id, photo_id)
);
```

Rows only exist when the curator has explicitly toggled a photo. **Default rule** when no row is present:

- `triage_status = 'document'` → not included (hard exclude, no row).
- everything else → included by default.

This keeps the table small and lets us treat "no row" as "default to include for any non-document photo." When a curator toggles a photo, we upsert.

---

## AI Pass: Client-Export Safety

A new fourth pass, parallel in shape to deep-analysis. Per-photo Anthropic call, concurrent with the same `CONCURRENCY=5` semaphore.

**Input scope:** every photo in the project where `triage_status` is `picked` or `skip` (i.e. not a document). If a photo has no `triage_status` yet (project never scanned), the on-demand flow runs the existing prescreen + triage first.

**Prompt** (asks Claude to flag the six categories):

```
Decide whether this construction job-site photo is appropriate to send directly to the
homeowner/customer as part of their job-photo package.

Flag the photo if any of the following are true:
- "face": a person's face or other identifying features are visible
- "mess": clutter, debris, lunch wrappers, truck cab, scattered tools, etc.
- "junk": blurry, very dark, accidental shot, extreme close-up of nothing identifiable
- "ppe": worker without PPE, unsafe ladder placement, or anything that looks unsafe
        whether or not it actually is
- "personal_property": interior of customer's home, their belongings, mail/letters,
        license plate, or anything privacy-sensitive
- "profanity": graffiti, off-color hand-written notes, gestures

Respond in JSON only:
{
  "ok": true | false,
  "flags": [zero or more of: "face", "mess", "junk", "ppe", "personal_property", "profanity"],
  "notes": "one short sentence explaining the flag(s), or empty string if ok"
}

A photo is "ok" only if flags is empty.
```

**Persistence:** writes `client_export_status` (`ok` or `flagged`) and `client_export_flags` (JSON list) to the photo row.

**Image size:** same `max_dim=768` we already use for deep analysis.

**Cost note:** at 5-concurrent and ~1s per photo, a 200-photo project finishes in ~40s. Existing deep-analysis already does this, so capacity is known.

---

## Server Routes

All under `/client-export` on the existing FastAPI server.

| Method | Route | Purpose |
|---|---|---|
| GET | `/client-export` | Project picker page. Lists projects, shows "Scanned" / "Not scanned" / "Client-export check done" status. |
| GET | `/client-export/<project_id>` | Review page. Renders the photo grid. |
| POST | `/client-export/<project_id>/run-check` | Kick off the AI pass (and prescreen+triage if needed). Returns `{task_id}` and runs in the background. Reuses the existing `_task_state` pattern. |
| GET | `/client-export/<project_id>/status` | Poll for background-task progress (phase, current, total). |
| POST | `/client-export/<project_id>/toggle` | Upsert one row in `client_export_selections`. Body: `{photo_id, included}`. |
| GET | `/client-export/<project_id>/zip` | Stream the zip. Response is `application/zip` with `Content-Disposition: attachment`. |

The toggle endpoint is intentionally per-photo, not bulk: it makes the UI simple (one fetch per click), survives reload mid-review, and the volume is fine.

---

## Review UI

Server-rendered Jinja template, vanilla JS for interactions (matches existing pattern in `templates/`).

**Layout:**

- Header bar: project name, address, counter `142 of 178 included`, large `Export ZIP` button (disabled until check is done and at least one photo is included).
- Optional "AI flagged" filter chip group (`face`, `mess`, `junk`, `ppe`, `personal_property`, `profanity`) so the curator can jump straight to the flagged photos.
- Grid of photo thumbnails. Each tile shows:
  - The thumbnail (using the existing `thumb_uri`).
  - A small badge row at the bottom for any AI flags (e.g. `face` `interior`).
  - Excluded photos rendered with reduced opacity + red border + a checkmark/X overlay.
- Click thumbnail → toggle included/excluded → POST to `/toggle` → optimistic UI update, revert on error.

**Initial state:**

- Documents: filtered out entirely (not in the grid).
- Everything else: included by default. AI-flagged photos are still included by default — flags are advisory, not auto-exclusion.

**If the AI pass hasn't run yet:**

- Grid is hidden, replaced by a "Run client-export check" button.
- After click, polls `/status` every second; when done, page reloads.

---

## Export Endpoint

`GET /client-export/<project_id>/zip`

1. Resolve the project's photos: every photo where `triage_status != 'document'` AND no `client_export_selections` row says `included=0`.
2. For each, fetch the original URI bytes via `CompanyCamClient.get_photo_bytes(uri)`.
3. Stream into a zip:
   - Top-level folder: `<sanitized-project-name>_<YYYY-MM-DD>/`.
   - Subfolders: `YYYY-MM-DD/` based on each photo's `taken_at` (Unix timestamp → date).
   - Filename: derive from the URI's last path segment when it has a sane image extension; fall back to `<photo_id>.jpg`. (CompanyCam URIs typically end in `…/<id>.jpg`; the catalog doesn't store an original filename.)
4. Use a `StreamingResponse` so the browser sees progress and we don't have to hold the whole zip in memory.

Errors fetching individual photos are logged and skipped — partial export is better than a failed export.

---

## Workflow Summary

1. Operator opens `/client-export`, searches for the project, clicks it.
2. Project hasn't been scanned: clicks **Run analysis**, sees a progress bar through prescreen → triage → client-export check. (~1 minute for a typical project.)
3. Page reloads with the review grid.
4. Operator scans the grid, clicks the photos they want to exclude.
5. Operator clicks **Export ZIP**. Browser downloads the zip; the operator emails it to the customer.

If they need to redo the export later, their selections are still there — they just hit Export again.

---

## Open Defaults (already decided, listed for reference)

- Photo source: **originals**, not web-quality.
- Zip structure: **date-folder** (no phase folders).
- AI behavior: **flag, don't hide** — every non-document photo is in the grid.
- Default per photo: **included**, curator excludes by clicking.
- No cover sheet, no metadata sidecar, no date filter, no multi-project bulk, single curator at a time.

---

## Testing

- Unit: `client_export.py` — JSON parser handles the AI response shape; selection logic returns the right photo IDs given mixed `triage_status` and `client_export_selections` states.
- Integration: route smoke tests using `httpx.AsyncClient(app=app)` for a project loaded into a temp catalog.
- Manual: run end-to-end on a real project, verify the zip downloads, opens, and contains the expected files in the expected folders.

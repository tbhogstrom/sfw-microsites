# Report Feedback Feature — Design Spec

## Overview

Allow team members viewing daily reports to give feedback on individual project reports. Claude Opus applies the feedback and the revised report replaces the original, with the ability to view the original or revert.

## User Flow

1. Each report card on the daily page has a "Give Feedback" button in a controls bar below the report HTML.
2. Clicking it expands an inline textarea: "What needs to change?"
3. User types feedback (factual corrections, missing info) and clicks "Apply Feedback".
4. A loading state shows while Claude processes.
5. The revised report replaces the original immediately. A green "Revised" status bar appears above the report with the timestamp.
6. Controls bar now shows: "View Original" | "Revert to Original" | "Give Feedback".
7. "View Original" swaps the display to the original HTML (toggle).
8. "Revert to Original" deletes the revision permanently.
9. "Give Feedback" on a revised report sends another round of feedback (iterative).
10. All users see the revision — it's stored server-side in Vercel Blob.

## Data Storage (Vercel Blob)

All files use the existing blob storage pattern with `BLOB_READ_WRITE_TOKEN`.

| File | Path | Purpose |
|------|------|---------|
| Original report | `daily/{date}/{project_id}.html` | Existing, unchanged |
| Revised report | `daily/{date}/{project_id}.revised.html` | Claude's revision |
| Feedback log | `daily/{date}/{project_id}.feedback.json` | Feedback text + metadata |

The feedback JSON structure:

```json
{
  "feedback": "It was 8 joists not 12, and we also installed flashing along the ledger board",
  "applied_at": "2026-04-10T19:30:00.000Z"
}
```

## API Routes

### POST /api/feedback

Applies feedback to a report using Claude.

**Request:**
```json
{
  "date": "2026-04-10",
  "projectId": "abc123",
  "feedback": "It was 8 joists not 12"
}
```

**Logic:**
1. Validate inputs (`date`, `projectId`, `feedback` all required).
2. Fetch the current displayed report from blob: use `.revised.html` if it exists, otherwise `.html`.
3. Call Claude API (model: `claude-opus-4-6`) with the report HTML and feedback text.
4. Store the response as `daily/{date}/{projectId}.revised.html` in blob (private, overwrite).
5. Store `{ feedback, applied_at }` as `daily/{date}/{projectId}.feedback.json` in blob (private, overwrite).
6. Return `{ ok: true, html: "<revised HTML>" }`.

**Claude prompt:**
```
You are editing a construction field report. Apply the following feedback to the report HTML below. Only change what the feedback asks for. Preserve all HTML structure, styling, and formatting. Return only the revised HTML with no other text.

Feedback: {feedback}

Report HTML:
{html}
```

**Error handling:**
- 400 if missing fields
- 404 if original report not found in blob
- 503 if `BLOB_READ_WRITE_TOKEN` or `ANTHROPIC_API_KEY` not configured
- 500 if Claude API call fails

### POST /api/feedback/revert

Reverts a report to its original version.

**Request:**
```json
{
  "date": "2026-04-10",
  "projectId": "abc123"
}
```

**Logic:**
1. Delete `daily/{date}/{projectId}.revised.html` from blob.
2. Delete `daily/{date}/{projectId}.feedback.json` from blob.
3. Return `{ ok: true }`.

**Error handling:**
- 400 if missing fields
- 503 if `BLOB_READ_WRITE_TOKEN` not configured

## Client Component: ReportCard

A `'use client'` component that wraps each report on the daily page.

**Props:**
- `html: string` — the report HTML (original or revised)
- `originalHtml: string` — always the original HTML
- `projectId: string` — blob project ID (extracted from filename)
- `date: string` — the date string
- `isRevised: boolean` — whether a `.revised.html` exists
- `feedbackAppliedAt: string | null` — timestamp from feedback.json

**State:**
- `currentHtml` — what's displayed (original or revised)
- `showingOriginal` — toggle for "View Original"
- `feedbackOpen` — whether the textarea is visible
- `feedbackText` — the textarea value
- `submitting` — loading state during API call

**Behavior:**
- Renders `currentHtml` via `dangerouslySetInnerHTML`
- "Give Feedback" toggles `feedbackOpen`
- "Apply Feedback" calls `POST /api/feedback`, updates `currentHtml` with response HTML, sets `isRevised` state
- "View Original" toggles between `originalHtml` and revised HTML
- "Revert to Original" calls `POST /api/feedback/revert`, resets to `originalHtml`, clears revised state

## Daily Page Changes

The server component `app/daily/[date]/page.tsx` needs to:

1. List all blobs with prefix `daily/{date}/`.
2. For each `.html` file (excluding `.revised.html`), extract the `projectId` from the filename.
3. Check if a corresponding `.revised.html` exists.
4. Check if a corresponding `.feedback.json` exists (fetch its `applied_at`).
5. Fetch both the original and revised HTML (if revision exists).
6. Pass both to `ReportCard` as props.

## Environment Variables

One new variable required in Vercel:

- `ANTHROPIC_API_KEY` — for Claude API calls (already added by user)

## UI Layout

```
+------------------------------------------+
| [Revised]              Applied Apr 10... |  <-- status bar (only if revised)
+------------------------------------------+
|                                          |
|  [Report HTML rendered here]             |  <-- dangerouslySetInnerHTML
|                                          |
+------------------------------------------+
| [View Original] [Revert] [Give Feedback] |  <-- controls bar
+------------------------------------------+
|  What needs to change?                   |  <-- feedback panel (when open)
|  +------------------------------------+  |
|  | textarea                           |  |
|  +------------------------------------+  |
|           [Cancel] [Apply Feedback]      |
+------------------------------------------+
```

## Scope Exclusions

- No revision history (only latest revision stored)
- No user attribution on feedback (no login identity tracked)
- Weekly reports not included in this feature (daily only for now)
- No diff view between original and revised

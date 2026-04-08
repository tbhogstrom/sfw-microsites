# Reports Portal — Design Spec

## Overview

A Next.js app deployed to Vercel that serves published daily and weekly homeowner reports behind a simple team password. Reports are published from the local photo-scanner tool via a "Publish to Web" button.

## How It Works

1. **Locally:** Generate reports in the photo-scanner tool as usual
2. **Publish:** Click "Publish to Web" → the tool renders each report as self-contained HTML (photos embedded as base64), sends it to the portal's API
3. **Portal:** Next.js app on Vercel stores reports in Vercel Blob, serves them behind a password gate
4. **View:** Team members go to the portal URL, enter the shared password, browse reports by date

## Architecture

### Local Side (photo-scanner additions)

- New `/api/reports/publish` endpoint in `server.py`
- On publish: for each report, fetch photo thumbnails from CompanyCam, encode as base64, render a self-contained HTML string, POST it to the portal's ingest API
- "Publish to Web" buttons added to Reports and Weekly Reports tabs

### Portal (new Next.js app: `apps/reports-portal/`)

Minimal Next.js App Router app:

- `middleware.ts` — checks for auth cookie, redirects to `/login` if missing
- `app/login/page.tsx` — simple password form, sets a session cookie on success
- `app/page.tsx` — index page listing published report dates
- `app/daily/[date]/page.tsx` — daily reports for a date, rendered from Blob HTML
- `app/weekly/[weekStart]/page.tsx` — weekly reports for a week
- `app/api/ingest/route.ts` — POST endpoint that accepts report HTML and stores in Vercel Blob

### Storage

Vercel Blob. Each report stored as:
- `daily/{date}/{project_id}.html` — self-contained HTML for one daily report card
- `weekly/{week_start}/{project_id}.html` — self-contained HTML for one weekly report card
- `daily/{date}/index.json` — manifest listing all reports for that date (project names, IDs)
- `weekly/{week_start}/index.json` — same for weekly

### Auth

- Single shared password stored as `PORTAL_PASSWORD` env var on Vercel
- `PORTAL_INGEST_KEY` env var — API key the photo-scanner uses to authenticate publish requests
- Login page sets an HTTP-only cookie (`portal-auth`) with a signed token
- Middleware checks the cookie on every request except `/login` and `/api/ingest`

## API

### Portal Ingest API

`POST /api/ingest`

Headers: `Authorization: Bearer {PORTAL_INGEST_KEY}`

Body:
```json
{
  "type": "daily",
  "date": "2026-04-06",
  "reports": [
    {
      "project_id": "12345",
      "project_name": "Thelma Dobson",
      "project_address": "4523 NE Multnomah St, Portland OR",
      "html": "<div class='report-card'>...self-contained HTML...</div>"
    }
  ]
}
```

Returns: `{"ok": true, "published": 3}`

### Photo-Scanner Publish Endpoint

`POST /api/reports/publish`

Body: `{"date": "2026-04-06", "type": "daily"}` or `{"week_start": "2026-03-31", "type": "weekly"}`

Fetches saved reports from catalog, renders each as self-contained HTML with base64 photos, POSTs to portal ingest API.

## UI Changes (Photo Scanner)

- "Publish to Web" button on Reports tab (next to Export All PDFs)
- "Publish to Web" button on Weekly Reports tab
- Status text showing "Publishing..." → "Published 5 reports"
- Requires `PORTAL_URL` and `PORTAL_INGEST_KEY` in photo-scanner `.env`

## Portal UI

Simple, clean design. Same report card styling as the local tool (light theme, serif font).

- **Login page** — centered card with password input and submit button
- **Index page** — list of dates with published reports, click to view
- **Report page** — renders the stored HTML report cards, one per project

## Environment Variables

### Portal (Vercel)
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob access (auto-provisioned)
- `PORTAL_PASSWORD` — shared team password
- `PORTAL_INGEST_KEY` — API key for publish requests

### Photo Scanner (local .env)
- `PORTAL_URL` — e.g., `https://sfw-reports.vercel.app`
- `PORTAL_INGEST_KEY` — must match the portal's key

## Scope Boundaries

- No per-user accounts — single shared password
- No homeowner access — team only
- No editing reports on the portal — read-only, published from local tool
- No real-time data — reports are static HTML snapshots published manually
- Photos embedded as base64 in the HTML — no external image dependencies

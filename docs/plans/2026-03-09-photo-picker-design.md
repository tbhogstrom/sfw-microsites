# Photo Picker Tool — Design Doc

**Date:** 2026-03-09
**Status:** Approved

## Overview

A local web app for reviewing, editing, and uploading batches of photos to the correct Vercel Blob store for each microsite. Launched from the command line pointing at a local folder of photos.

```bash
node tools/photo-picker/server.js /path/to/photos
# Opens http://localhost:3000 automatically
```

## Architecture

Lives at `tools/photo-picker/` alongside `blob-manager`. Imports `BlobClient` and `config.json` directly from `../blob-manager/` — no duplication.

```
tools/photo-picker/
  server.js          # Express server + API routes
  presets.js         # Resize presets per category
  package.json
  public/
    index.html
    app.js
    style.css
```

### API Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/photos` | Scan target folder, return filenames |
| `GET /api/photos/:file` | Serve raw photo to browser |
| `POST /api/process` | Apply Sharp transforms (resize, compress, WebP) |
| `POST /api/upload` | Send processed image to Vercel Blob |

### Dependencies

- `express` — local server
- `sharp` — server-side image processing (resize, compress, WebP)
- `open` — auto-open browser on launch
- Tui Image Editor (CDN) — browser-side visual editing (crop, rotate, flip, brightness/contrast)
- Existing: `@vercel/blob`, `dotenv`, `mime-types` (from blob-manager)

## UI Layout

Three-panel single-page layout:

```
┌─────────────┬──────────────────────────┬─────────────────┐
│  QUEUE      │   TUI IMAGE EDITOR       │  UPLOAD OPTIONS │
│             │                          │                 │
│ [thumb] ✓   │   [photo canvas]         │ Microsite:      │
│ [thumb] →   │                          │ [dropdown]      │
│ [thumb]     │   crop/rotate/flip/      │                 │
│ [thumb]     │   brightness toolbar     │ Category:       │
│             │   (Tui built-in)         │ [dropdown]      │
│  5/12 done  │                          │                 │
│             │                          │ Resize Preset:  │
│             │                          │ [dropdown]      │
│             │                          │ W: [___] H: [___│
│             │                          │                 │
│             │                          │ Quality: [85%]  │
│             │                          │ Format:         │
│             │                          │ ○ Keep  ● WebP  │
│             │   [← PREV]  [NEXT →]     │ [  SKIP  ]      │
│             │                          │ [ UPLOAD ]      │
└─────────────┴──────────────────────────┴─────────────────┘
```

**Queue panel:** Thumbnails of all photos. Checkmark = uploaded, X = skipped. Click to jump.

**Editor panel:** Tui Image Editor with built-in toolbar. Prev/Next navigation.

**Upload panel:** Microsite, category, resize preset with manual W/H override, quality slider (60–100%, default 85%), format toggle (Keep / WebP), Skip and Upload buttons.

After upload: marks photo done, auto-advances to next.

## Resize Presets

Tied to the 9 image categories. Sharp uses `fit: 'inside'` (scale down without cropping or distorting).

| Category | Dimensions | Notes |
|---|---|---|
| `hero` | 1440 × 810 | 16:9 full-width banner |
| `gallery` | 800 × 600 | 4:3 grid thumbnail |
| `before-after` | 1000 × 667 | Side-by-side comparison |
| `completed` | 1000 × 667 | Project showcase |
| `damage` | 800 × 600 | Documentation |
| `process` | 800 × 600 | Work-in-progress |
| `repair` | 800 × 600 | Repair detail |
| `team` | 600 × 800 | Portrait orientation |
| `equipment` | 800 × 600 | Tool/equipment shot |

Manual W/H override fields available at all times. Hero and gallery are the primary categories in active use.

## Key Behaviors

- Changing category auto-populates the resize preset
- Manual W/H fields override the preset
- Editor edits (crop/rotate) are applied client-side first, then Sharp processes the result server-side
- Upload auto-advances queue to next photo
- Skip marks photo with X and advances without uploading
- `.env` from `blob-manager/` is used for tokens

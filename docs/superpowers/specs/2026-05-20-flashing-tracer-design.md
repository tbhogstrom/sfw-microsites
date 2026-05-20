# Flashing Tracer — MVP Design Spec

**Status:** Draft
**Date:** 2026-05-20
**Owner:** tfalcon@sfwconstruction.com

## 1. Problem & goals

SFW estimators routinely look at construction-drawing details (PDF page screenshots, photos of paper drawings, manufacturer details) and need to fabricate flashing to match. Today they eyeball it. We want a tool that lets an estimator drop an image in, trace the relevant profile with dots, set one known length, and immediately read every other length and interior angle off a table.

This first release is intentionally tiny — image in, traced open polyline, one length to scale, two output tables. Persistence, PDF export, shop-drawing output, and a flashing-detail catalog come later.

**Primary user:** SFW estimators (internal).

**Goals (MVP):**
- Load a JPG/PNG into the browser; never round-trip through a server.
- Trace an open polyline by clicking; reposition any vertex by dragging.
- Pick any segment, type its real-world length (with feet'inches" parsing), and have every other segment and interior angle update instantly.
- Show two tables (segments and angles) and let the user copy each as CSV.
- Print-to-PDF friendly so estimators can ⌘P / Ctrl+P a finished trace.

**Non-goals (MVP):**
- Persistence, share links, project IDs.
- PDF / DXF / DWG export of the trace.
- Closed polygons, multiple traces per image, snap-to-angle.
- A catalog of flashing detail templates (drip edge, kickout, step, etc.).
- 3D / build123d output.
- Mobile use.

## 2. User flow

1. Estimator opens `flashing-tracer.sfwconstruction.com` (or local dev). Empty canvas with an "Upload image" drop zone.
2. Drops or picks a JPG/PNG. Image renders as the canvas background at its natural pixel size; canvas pans/zooms over it.
3. Selects the **Trace** tool (default once an image is loaded). Each left-click drops a vertex and extends the open polyline. `Esc` or the **Finish** button ends the trace.
4. Switches to the **Select** tool to drag any existing vertex; the segments table and angles table update live.
5. Clicks any segment in the canvas → a small inline prompt asks "How long is this?" — accepts decimal inches (`42.5`) or feet-inches (`3'-6 1/2"`). On confirm, `inchesPerPixel` is set for the trace.
6. Reads the two tables on the right. Hits **Copy CSV** to paste into a spreadsheet, or Ctrl+P to print the page.
7. Hits **Clear** to start over. Refreshing the page also resets — there is no autosave in MVP.

## 3. Architecture

**Stack:** Next.js 16 (App Router) + React 19 + Tailwind v4 + TypeScript strict. Mirrors `apps/siding-calculator`.

**Hosting:** standalone Next.js app at `apps/flashing-tracer`, its own Vercel project (e.g., `flashing-tracer.sfwconstruction.com`).

**Canvas rendering:** SVG, not `<canvas>` or Konva. Background `<image>` element + a polyline + draggable vertex circles + invisible thick "hit" lines over each segment for click-to-scale.

**Coordinate system:** image-pixel space. Origin at top-left of the image, y-down (no flip — the image is the reference frame, unlike siding-calc which uses y-up world feet).

**State:** single `useState<TraceProject>` in `app/page.tsx`. Everything is client-side. No `/api`, no Vercel Blob, no autosave.

**External integrations:** none in MVP.

### File layout

```
apps/flashing-tracer/
  app/
    page.tsx                       # single-page tracer (client component)
    layout.tsx
    globals.css
  components/
    ImageDrop.tsx                  # drag-drop + file-picker upload zone
    TraceCanvas.tsx                # SVG with image + polyline + handles + scale-click
    Toolbar.tsx                    # trace | select | finish | clear | new image | zoom
    ScaleDialog.tsx                # inline prompt: "How long is this segment?"
    SegmentsTable.tsx              # # | length (ft-in) | length (decimal in)
    AnglesTable.tsx                # vertex # | interior angle (deg)
    CopyCsvButton.tsx
  lib/
    geometry.ts                    # length, interior angle (pure)
    parse.ts                       # "3'-6 1/2\"" ↔ decimal inches
    types.ts                       # Point, Trace, TraceProject
  tests/
    geometry.test.ts
    parse.test.ts
  README.md
  package.json
  tsconfig.json
  next.config.ts
  postcss.config.mjs
  vitest.config.ts
  .gitignore
  .env.example                     # empty in MVP; placeholder for v2
```

### Data shape (`lib/types.ts`)

```ts
export type Point = { id: string; x: number; y: number }; // image-pixel coords

export type Trace = {
  points: Point[];          // ordered; open polyline
  inchesPerPixel: number | null;
};

export type ToolMode = 'trace' | 'select';

export type ImageRef = {
  src: string;              // data URL
  widthPx: number;
  heightPx: number;
};
```

### Geometry (`lib/geometry.ts`)

Pure, deterministic, no React. All exported functions take pixel coordinates and (where relevant) `inchesPerPixel`.

- `segmentLengthPx(a: Point, b: Point): number` — `Math.hypot(b.x - a.x, b.y - a.y)`.
- `segmentLengthInches(a, b, ipp): number | null` — `null` when `ipp == null`.
- `interiorAngleDeg(prev: Point, vertex: Point, next: Point): number` — `acos(dot/(|v1|·|v2|))` in degrees, clamped to `[0, 180]` for numerical safety.
- `segments(points: Point[]): Array<{ a: Point; b: Point; index: number }>` — `points.length - 1` items.
- `interiorVertices(points: Point[]): Array<{ vertex: Point; prev: Point; next: Point; index: number }>` — endpoints excluded.

### Parse (`lib/parse.ts`)

- `parseLength(input: string): number | null` — returns decimal inches, or `null` if unparseable.
  - Accepts: `42`, `42.5`, `42 1/2`, `3'`, `3' 6"`, `3'-6"`, `3'-6 1/2"`, `42"`, `0.5'`.
- `formatLength(decimalInches: number): { ftIn: string; decimal: string }` — e.g. `42.5` → `{ ftIn: "3'-6 1/2\"", decimal: "42.500\"" }`. Rounds the fractional inch to the nearest 1/16.

## 4. Interaction details

### Pan & zoom
- Ctrl/Cmd + wheel zooms around the cursor (matches `Calculator.tsx:74-85`).
- Space + drag pans. Middle-mouse drag also pans.
- Zoom range `[0.25, 8]`.

### Trace tool
- Left-click anywhere on the SVG drops a new vertex at the *image-pixel* under the cursor and appends to `points`.
- The cursor is a crosshair while in `trace` mode.
- A faint "rubber-band" line follows the cursor from the last vertex.
- `Esc` or **Finish** button exits trace mode → switches to `select`.
- The polyline stays *open*. There is no close-to-polygon affordance in MVP.

### Select tool
- Vertex circles are draggable. Drag updates `points[i].{x,y}`. Tables recompute live.
- Hovering a segment shows its current length (or `?"` if no scale yet) as a small label and highlights it.
- Clicking a segment opens the `ScaleDialog` anchored to the segment midpoint.
- Right-click a vertex deletes it (with a confirmation flash, no modal — vertex pulses red 200ms before deletion).

### Scale dialog
- Pre-fills the current computed length if a scale is already set, otherwise empty.
- Validates with `parseLength`; rejects on invalid.
- Confirm: sets `inchesPerPixel = parsedInches / pxLengthOfThatSegment`. Affects the whole trace.

### Tables
- **Segments** — `#`, `length (ft-in)`, `length (decimal in)`. Empty rows show `—` when no scale set.
- **Angles** — `vertex #`, `interior angle°` (one decimal place). Only interior vertices appear (so `points.length - 2` rows).
- **Copy CSV** button per table writes to clipboard.
- Both tables remain visible during print.

## 5. Error handling

- Image upload over 25 MB → toast "Image is too large; please resize and try again."
- Non-image file → toast "Pick a JPG or PNG."
- Scale segment of zero length (two coincident points) → reject in dialog with "Segment is too short to scale from."
- `parseLength` returns `null` → inline error under the input.
- Removing a vertex that leaves fewer than two points → clear the trace entirely; keep the image and scale unset.

## 6. Testing

- `tests/geometry.test.ts` — unit tests for `segmentLengthPx`, `interiorAngleDeg` (right angle, straight line, acute, obtuse, edge cases at 0° and 180°), `segments`, `interiorVertices`.
- `tests/parse.test.ts` — table-driven cases for `parseLength` accepting the formats above, plus rejection cases; round-trip `formatLength(parseLength(x))` for common values.
- No component tests in MVP — visual feedback during dev is faster than DOM assertions for canvas interaction.
- No Playwright in MVP.

## 7. Out of scope (deliberate)

- Persistence and share links (planned v2 — mirror siding-calc's Vercel Blob + ULID URL).
- PDF / SVG / DXF export of the trace (planned v2).
- Multiple traces per image; closed polygons; angle snapping; arc/curve segments.
- A flashing-detail template catalog ("drop in a standard step-flashing diagram").
- Construction-drawing layer overlays; multi-image projects.
- Authentication, accounts, multi-user.

## 8. Open questions

None blocking MVP. Items deferred:
- Should the scale dialog also let the user lock a segment to a known angle (e.g., force a 90°)? Probably yes in v2 once estimators are using it.
- Do we need a "right angle indicator" visual on the canvas at vertices within 1° of 90°? Easy to add — deferred until first user feedback.

---

## 9. v2 — Detail view, edits, labels, save+URL

Added 2026-05-20 after MVP shipped.

### 9.1 Detail view

Toolbar toggle **Detail view** ↔ **Image view**. In detail view:
- The source `<image>` is hidden.
- Background is plain white.
- Camera auto-fits to the polyline bounding box (with padding).
- Dimension labels render on every segment (ft-in), angle markers render on every interior vertex (small arc + degree text), and custom labels (see 9.4) render alongside.
- The print stylesheet remains the same — Ctrl+P in detail view yields a clean shop-drawing sheet.

Implementation: `view: 'image' | 'detail'` lives on the project. The canvas component reads the mode and chooses background + auto-fit transform.

### 9.2 Edit lengths

Each row in the Segments table has an inline input for length (accepts the same formats as `parseLength`). On submit:
- Compute `newLengthPx = newInches / inchesPerPixel`.
- Compute the segment's current unit vector `u = (b - a) / |b - a|`.
- New endpoint `b' = a + u * newLengthPx`.
- Translate every point downstream of `b` by `delta = b' - b`.

Pure helper: `stretchSegmentLength(points, segmentIndex, newLengthPx): Point[]`. Returns a new points array. No mutation.

Disabled if `inchesPerPixel` is null (set a scale first). Disabled at the last segment if there's no downstream — wait, there's never a downstream beyond the last segment, but the operation still makes sense (just move the last point). So enabled everywhere.

### 9.3 Edit angles

Each interior-vertex row has an inline input for interior angle in degrees. On submit:
- Compute current interior angle `θ_now` and target `θ_target`.
- Determine the rotation direction so that the angle on the *downstream* side becomes the target (the signed angle from `prev→vertex` reversed, rotating downstream point `next` to land at the right place). Use the cross product sign to pick rotation direction.
- Rotate every point from `vertex+1` to the end around `vertex` by `(θ_target - θ_now)` with the chosen sign.

Pure helper: `rotateAroundVertex(points, vertexIndex, newAngleDeg): Point[]`. No mutation.

Validation: target must be in `(0, 180)` exclusive. Reject otherwise with an inline error.

### 9.4 Labels

New **Label** tool in the toolbar. In Label mode:
- Click any segment → inline text input appears at the segment midpoint.
- Type the label (e.g., "Drip leg", "Hem", "Counterflashing"), press Enter to save, Esc to cancel.
- Empty submit removes the label.

Storage: `labels: Record<string, string>` keyed by the **start point ID** of the segment. Rationale: segment indices shift when points are inserted/deleted; point IDs are stable. When a point is deleted, its outgoing label is dropped (the upstream segment's label is preserved).

Rendering: label text near the segment midpoint, slightly above the dimension label. Visible in both views.

### 9.5 Save & share URL

Storage backend: Vercel Blob (same pattern as siding-calculator).
- `projects/<id>.json` — full project state, autosaved 1s after change.
- `images/<id>` — image binary uploaded once on image pick.

Routes:
- `GET /` — landing: "Start a new trace" → POST to `/api/projects` → redirect to `/p/<id>`.
- `GET /p/[id]` — editor; loads project state from blob on the server, hydrates the client editor.
- `POST /api/projects` — creates new empty project, returns `{ id }`.
- `GET /api/projects/[id]` — returns project JSON.
- `PATCH /api/projects/[id]` — replaces project state (whole-document update for simplicity in MVP).
- `PUT /api/projects/[id]/image` — accepts a binary body (`image/jpeg` or `image/png`), uploads to blob, returns `{ blobUrl, widthPx, heightPx }`.

Env: `BLOB_READ_WRITE_TOKEN` (required). Add to `.env.example` and Vercel project settings.

The URL `/p/<id>` is the share link. Bookmark, share with a colleague, reopen later. No auth in this revision.

### 9.6 Data shape changes

```ts
type ImageRef = {
  blobUrl: string;     // was data URL in MVP; now a blob public URL
  widthPx: number;
  heightPx: number;
};

type Trace = {
  points: Point[];
  inchesPerPixel: number | null;
};

type TraceProject = {
  id: string;
  createdAt: string;          // ISO
  updatedAt: string;          // ISO
  image: ImageRef | null;
  trace: Trace;
  labels: Record<string, string>;  // pointId → label
  view: 'image' | 'detail';
};
```

### 9.7 Testing additions

- `tests/geometry.test.ts` — add cases for `stretchSegmentLength` (straight chain, downstream-shape preserved) and `rotateAroundVertex` (right angle → 60°, rotation direction sign).
- API routes are intentionally untested at unit level in this iteration — they're thin Blob wrappers; rely on the build + manual smoke test.

### 9.8 Out of scope for v2

- Auth / per-user project lists.
- Multi-trace projects, closed polygons, arc segments.
- DXF/SVG/PDF export of the detail view (Ctrl+P → PDF covers the immediate need).
- A flashing detail template catalog.
- 3D / build123d output.


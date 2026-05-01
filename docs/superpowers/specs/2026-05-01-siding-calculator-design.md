# Siding Calculator v2 — Design Spec

**Status:** Draft
**Date:** 2026-05-01
**Owner:** tfalcon@sfwconstruction.com
**Replaces:** `sfwconstruction.com/siding-calculator/`

## 1. Problem & goals

The existing siding calculator at `sfwconstruction.com/siding-calculator/` is a popular but limited tool. We're replacing it with a **sketch-canvas web app** that lets a homeowner (or contractor / handyman they're talking to) draw a wall elevation to scale, drop in window/door openings, pick the construction phases and materials they care about, and walk away with a materials list — and a one-page scope-of-work PDF they can share.

**Primary user:** homeowners shopping a siding job. Single-track UX — no separate "pro mode." But the tool is detailed enough that a contractor and homeowner can use it together to communicate about a job.

**Goals:**
- Replace the current calculator with a markedly better tool (canvas-based, real materials list, exportable scope).
- Capture quality leads into HubSpot via a tiered gate.
- Ship a single elevation MVP. Multi-elevation ("+ another wall") is a follow-on.

**Non-goals (MVP):**
- Pricing in dollars (deferred until SFW has a maintained price catalog).
- Multi-elevation rollups.
- Authentication / accounts.
- Mobile-first canvas drawing (desktop primary; mobile gets read-only fallback).
- Free-form polygon walls (rectangle + optional gable triangle covers ~80% of real walls).

## 2. User flow

1. User lands on the calculator (embedded or direct link). Clicks "Start a project."
2. App creates a new `Project`, redirects to `/calc/p/<id>`.
3. **Canvas stage** (always visible):
   - User sets the canvas working area in feet (e.g., 30' × 12') in the floating pill.
   - User selects "Wall" tool, click-and-drags on the engineering-paper SVG grid to draw the elevation rectangle. Live dimension readout follows the cursor.
   - User can add an optional gable triangle on top.
   - User drops openings (window, door, garage door, vent) — each typed with smart-default dimensions, all rectangular.
   - Bottom drawer lists the wall + every opening with their dimensions, click to edit numerically.
4. **Phases & materials stage** (revealed once a wall exists):
   - User picks a preset: *Siding only*, *Re-side with WRB*, *Full envelope rebuild*, or *Custom*.
   - Preset toggles which phases are enabled (insulation, sheathing, vapor barrier, siding, trim).
   - User picks one material per enabled phase from the catalog.
5. **Outputs stage** (revealed once materials are chosen):
   - On-screen materials table: phase | material | required qty | unit | coverage notes.
   - **Tiered exports:**
     - **CSV** — free, no info required.
     - **Excel + 1-page PDF scope** — gated behind name/email/phone/address.
     - **Get a Quote** — separate CTA, posts a flagged high-intent lead to HubSpot.
6. State autosaves to Vercel Blob throughout. The URL is the share link — the user can bookmark it, send it to a contractor, or pick up later.

## 3. Architecture

**Stack:** Next.js 16 (App Router) + React 19 + Tailwind v4 + TypeScript. Matches the existing `apps/reports-portal` pattern.

**Hosting:** standalone Next.js app at `apps/siding-calculator`, deployed to its own Vercel project (e.g., `siding-calc.sfwconstruction.com`). Embedded into `sfwconstruction.com/siding-calculator/` via the existing site's CMS.

**Canvas rendering:** **SVG**, not `<canvas>` or Konva. Walls and openings are React-driven SVG elements. The engineering-paper grid is two `<pattern>` defs (major every foot, minor every inch). SVG is trivial to test, infinitely zoomable, and renders cleanly into the PDF scope.

**Storage:** Vercel Blob.
- `projects/<id>.json` — full project state, autosaved on change (debounced 1s).
- `outputs/<id>/{scope.pdf, materials.xlsx, materials.csv}` — generated on demand, regenerated when project changes.
- `failed-leads/<id>.json` — dead-letter for HubSpot submission failures.

No database in MVP. Project ID (ULID) keys the blob. If listing/search becomes a need, that's the trigger to add Postgres.

**External integrations:**
- HubSpot Forms API for lead capture (`HUBSPOT_PORTAL_ID`, `HUBSPOT_FORM_ID`, optional `HUBSPOT_BEARER` env vars).
- Materials catalog seeded from `field-guys/reference-docs/` (HardiePlank, Tyvek DrainWrap, T1-11, Western Red Cedar, HardieTrim, OSI QUAD MAX sealant, etc.) plus generic types per phase. Paint/finish products in the reference docs (Sherwin-Williams) are out of MVP scope — paint is not one of the five MVP phases.

### File layout

```
apps/siding-calculator/
  app/
    page.tsx                              # landing → "Start a project" CTA
    calc/
      new/page.tsx                        # creates a fresh Project, redirects to /calc/p/<id>
      p/[id]/
        page.tsx                          # the calculator (canvas → materials → outputs)
        scope/page.tsx                    # SSR HTML view of the scope (used to render PDF)
    api/
      projects/route.ts                   # POST = create
      projects/[id]/route.ts              # GET = load, PATCH = autosave
      projects/[id]/exports/route.ts      # POST = generate, GET = signed download URL
      lead/route.ts                       # POST → HubSpot Forms API
  lib/
    types.ts                              # Project, Opening, Material types + Zod schemas
    geometry.ts                           # sq-ft, opening subtraction, trim linear-ft
    catalog.ts                            # materials catalog (seeded from reference-docs)
    materials.ts                          # phase → material → required qty calc
    storage.ts                            # Vercel Blob wrappers (read/write project, outputs, leads)
    pdf/scope-document.tsx                # @react-pdf/renderer doc
    excel/materials-workbook.ts           # exceljs builder
    csv/materials.ts                      # CSV builder
    hubspot.ts                            # HubSpot Forms API client + retry
  components/
    canvas/
      CanvasSurface.tsx                   # SVG root, viewport, zoom/pan, grid <pattern>
      Toolbar.tsx                         # floating pill: canvas size + tool selection
      WallShape.tsx                       # wall rect + optional gable, resize handles
      Opening.tsx                         # one opening, drag-to-move + resize
      DimensionOverlay.tsx                # live "24' × 9'" tooltip during draw/drag
      useDrawingTool.ts                   # click-drag drawing hook
    drawer/
      ElementsDrawer.tsx                  # bottom drawer: list + numeric edit
    materials/
      PresetPicker.tsx                    # preset chips + custom
      PhaseRow.tsx                        # toggle + material <select> per phase
    outputs/
      MaterialsTable.tsx                  # derived qty table
      ExportButtons.tsx                   # CSV (free), Excel/PDF (gated)
      LeadForm.tsx                        # gated lead modal
      QuoteCTA.tsx                        # high-intent "Get a Quote" button
  public/
  package.json
  vercel.json
```

## 4. Data model

Stored as `projects/<id>.json` in Vercel Blob. All geometry in **feet** (single canonical unit; pixel conversion happens only at the rendering layer).

```ts
// lib/types.ts

export type Project = {
  id: string;                    // ULID
  createdAt: string;             // ISO 8601
  updatedAt: string;
  schemaVersion: 1;

  canvas: {
    widthFt: number;             // working area, set in floating pill
    heightFt: number;
    snapInches: 0 | 6 | 12;      // snap-to-grid increment; 0 = off
  };

  wall: {
    // origin = bottom-left of canvas, units = feet
    rect: { x: number; y: number; widthFt: number; heightFt: number };
    gable?: {
      peakHeightFt: number;
      peakOffsetFt: number;      // 0 = centered; +/- shifts horizontally
    };
  };

  openings: Opening[];

  scope: {
    presetId: 'siding-only' | 'reside-with-wrb' | 'full-envelope' | 'custom';
    phases: {
      insulation:    { enabled: boolean; materialId: string | null };
      sheathing:     { enabled: boolean; materialId: string | null };
      vaporBarrier:  { enabled: boolean; materialId: string | null };
      siding:        { enabled: boolean; materialId: string | null };
      trim:          { enabled: boolean; materialId: string | null };
    };
  };

  lead?: {
    name: string;
    email: string;
    phone: string;
    address: string;
    capturedAt: string;
    hubspotSubmittedAt?: string;
  };
};

export type Opening = {
  id: string;
  type: 'window' | 'door' | 'garage-door' | 'vent';
  // position in feet, relative to wall.rect bottom-left
  x: number;
  y: number;
  widthFt: number;
  heightFt: number;
  label?: string;
};
```

**Materials catalog** is static TypeScript, not in the project blob:

```ts
// lib/catalog.ts

export type Material = {
  id: string;                        // 'hardieplank-lap-625'
  phase: 'insulation' | 'sheathing' | 'vaporBarrier' | 'siding' | 'trim';
  brand: string | null;              // null = generic
  name: string;                      // 'HardiePlank Lap Siding (6.25" exposure)'
  unit: 'sqft' | 'linft' | 'sheet' | 'roll' | 'piece';
  coveragePerUnit: number;           // sqft (or linft for trim) covered per unit
  wastePct: number;                  // 0.10 = +10% waste factor
  notes?: string;
  refDocPath?: string;               // relative to field-guys/reference-docs
};
```

**Phase presets** — seed values:

| Preset | insulation | sheathing | vaporBarrier | siding | trim |
|---|---|---|---|---|---|
| `siding-only` | off | off | off | on | on |
| `reside-with-wrb` | off | off | on | on | on |
| `full-envelope` | on | on | on | on | on |
| `custom` | user-set | user-set | user-set | user-set | user-set |

### Why this shape
- **Single canonical unit (feet).** No drift between pixel and dimension space; the canvas only converts at rendering.
- **Wall-relative opening positions.** Moving the wall doesn't break opening placements.
- **All phases always present**, just `enabled: false` on the off ones. Avoids "missing key vs. disabled" ambiguity.
- **Catalog separate from project blob.** Catalog can evolve without rewriting saved projects; saved projects reference materials by id.
- **`schemaVersion`** lets us migrate cleanly when the shape evolves.

## 5. Components & UX

Single-page progressive reveal — no wizard, no route changes between stages. State drives visibility.

### Stage 1: Canvas (always visible)

- Floating pill (top-left): canvas size inputs (W × H in feet) + tool buttons (Wall, Gable, Window, Door, Garage Door, Vent, Pan).
- SVG canvas: engineering-paper grid (major every foot, minor every inch), wall shape, openings.
- Click-drag with the Wall tool draws the elevation rectangle. Live dimension tooltip follows the cursor.
- After release: wall has resize handles + dimensions are editable in the bottom drawer (type "24×9" to snap exact).
- Gable tool adds an optional triangle above the wall — peak height and offset adjustable.
- Opening tools drop a typed rectangle with smart defaults (window 3'×4', door 3'×7', garage door 16'×7', vent 1'×1'). Drag to position, handles to resize, click in drawer to edit numerically.
- Bottom drawer: list of all elements with their current dimensions. Click a row to edit. "Next →" advances to materials.

### Stage 2: Phases & materials (revealed when wall exists)

- Preset chips: *Siding only* / *Re-side with WRB* / *Full envelope rebuild* / *Custom*.
- Five phase rows: each with an enable toggle and a material `<select>` populated with materials filtered to that phase.
- Selecting a preset sets the toggles to its defaults; user can override any toggle to switch to *Custom*.

### Stage 3: Materials list & exports (revealed when materials are chosen)

- **Materials table** — derived from project state every render:
  - Columns: phase | material | required qty | unit | coverage notes.
  - Quantities computed in `lib/materials.ts`:
    ```
    requiredArea = (sqft or linft target for that phase)
    qty = ceil( (requiredArea × (1 + material.wastePct)) / material.coveragePerUnit )
    ```
- **Computed inputs** (in `lib/geometry.ts`, never stored):
  - `wallSqFt = rect.widthFt × rect.heightFt + (gable ? 0.5 × rect.widthFt × gable.peakHeightFt : 0)`
  - `openingsSqFt = Σ (opening.widthFt × opening.heightFt)`
  - `netSidingSqFt = wallSqFt − openingsSqFt`  (target for siding, sheathing, insulation, WRB)
  - `trimLinFt = corner boards (2 × wall heightFt) + top fascia (wall widthFt) + bottom water-table (wall widthFt) + gable rake edges (2 × hypotenuse, if gable) + Σ opening perimeters`. MVP returns a single `trimLinFt` number — per-trim-type breakdown (corner vs. fascia vs. opening trim) is a v2 enhancement.
- **Export buttons:**
  - **CSV** — free, downloadable directly.
  - **Excel** — opens lead form modal; on submit, generates and downloads.
  - **Scope PDF** — same gate as Excel; generates a one-page document with project ID/date, an SVG snapshot of the elevation, the assembly summary (phase → material), the materials table, **scope-of-work bullets**, and a footer with the share link.
- **Scope-of-work bullets** — a fixed bullet template per preset (`siding-only`, `reside-with-wrb`, `full-envelope`, `custom`), with placeholders filled in from the chosen materials. Example for `reside-with-wrb`:
  - "Remove existing siding to sheathing."
  - "Install {vaporBarrier.material.name} per manufacturer guide."
  - "Install {siding.material.name} (~{netSidingSqFt} sq ft) per manufacturer guide."
  - "Install {trim.material.name} at corners, openings, and fascia (~{trimLinFt} lin ft)."
  - "Caulk and seal all penetrations."

  Templates live in `lib/pdf/scope-templates.ts`. `custom` preset uses the union of bullets for whichever phases are enabled. No user editing of bullet text in MVP.
- **"Get a Quote"** — separate CTA, opens lead form with `intent: 'quote'`. HubSpot lead is flagged high-intent.

### Mobile fallback

If `window.innerWidth < 1024`: show a "this works best on a larger screen" banner + read-only project view + the Get-a-Quote CTA. No canvas drawing on mobile.

## 6. Data flow & integrations

**Create:** `POST /api/projects` returns `{ id }` (ULID). Client redirects to `/calc/p/<id>`.

**Autosave:** any state change → debounce 1s → `PATCH /api/projects/<id>` with the full `Project` JSON. Server validates with Zod and writes to Vercel Blob. Stale-write protection via `updatedAt` compare-and-swap (client sends prior `updatedAt`; server rejects if blob has been updated since).

**Load (share link):** `GET /calc/p/<id>` SSR-fetches the blob and hydrates React. Missing/invalid → "project not found" page with a "Start fresh" CTA.

**Exports:** `POST /api/projects/<id>/exports { format: 'csv' | 'xlsx' | 'pdf' }`. Server reads the project, runs the materials calc, builds the artifact, writes to `outputs/<id>/<format>`, returns a signed URL. CSV is unauthenticated; xlsx/pdf require `project.lead` to be set (server-side check).

**Lead capture:** `POST /api/lead { projectId, name, email, phone, address, intent: 'export' | 'quote' }`.
1. Server validates payload, persists `lead` onto the project blob.
2. Forwards to HubSpot Forms API with `intent` flagged in a custom property.
3. On HubSpot failure: retry 3× with exponential backoff. If still failing, write to `failed-leads/<id>.json` and return success to the client (lead is captured locally; the gate has been satisfied). Failed leads are recoverable manually.

## 7. Error handling & edge cases

- **Invalid geometry** — wall extends past canvas, opening outside wall, opening overlaps another: client clamps on edit; server validates and rejects on save with a structured error and a human-readable message.
- **Blob write contention** (two tabs open): `updatedAt` CAS — last write rejected with a "your project changed elsewhere, reload" toast.
- **Material removed from catalog** between save and load: load shows "material no longer available — pick a replacement" placeholder; project still loads.
- **HubSpot down:** local save always succeeds, retries with backoff, dead-letter blob for unrecoverable failures.
- **No openings, no materials:** exports allowed but warn — CSV is empty header row, PDF shows "(no materials selected)".
- **Mobile drawing:** disabled — banner + read-only view + Get-a-Quote CTA.
- **Direct hit on `/calc/p/<unknown-id>`:** "project not found" page with a "Start fresh" CTA. No 500.

## 8. Testing strategy

- **Unit (Vitest):**
  - `lib/geometry.ts` — sq-ft, gable math, trim linear-ft, opening subtraction, edge cases (zero-area, gable larger than wall, etc.).
  - `lib/materials.ts` — qty calc with waste factor, rounding boundaries, missing material id.
  - `lib/catalog.ts` — integrity: no duplicate ids; every phase has at least one material; every entry has either a `refDocPath` pointing at a real file under `field-guys/reference-docs/` or `brand: null` (generic).
- **Component (Vitest + React Testing Library):**
  - drawer numeric dimension editing,
  - preset selection toggling phases correctly,
  - lead-form gate behavior on export buttons (CSV not gated, Excel/PDF gated).
- **E2E (Playwright, one happy path):**
  - load `/calc/new` → set canvas size → draw wall → drop a window + door → pick "Re-side with WRB" preset → fill lead form → download Excel → reload share link → state intact.
- **Catalog seed verification:** test asserts every catalog entry's `refDocPath` (if present) resolves to a real file in `field-guys/reference-docs/`.

## 9. Out of scope (MVP)

- Pricing / dollar amounts.
- Multi-elevation projects (will be added via a "+ another wall" affordance in v2).
- Free-form polygon wall shapes.
- Mobile-first canvas drawing.
- Authentication / accounts / project listings.
- Editable scope doc (current MVP renders the scope server-side from project state; no manual text overrides).
- Round / arched window subtraction (rectangular bounding-box approximation is good enough for <2% of cases).

## 10. Open questions for follow-on

- **Multi-elevation rollups** (v2): how do front/back/left/right share materials and aggregate qty?
- **Per-trim-type breakdown** (v2): split `trimLinFt` into corner boards, fascia, water-table, opening trim, rake.
- **Catalog as a shared package**: at what consumer count does it make sense to extract `packages/sfw-catalog`?
- **Pricing**: when SFW has a maintained price list, where does it live and how is it kept current?
- **HubSpot custom properties**: confirm property names that track `intent` and `projectId` on the lead.
- **Embed mechanics**: iframe vs. server-side include from sfwconstruction.com? — depends on what that site runs on.
- **Paint phase**: add as a 6th phase post-MVP using the Sherwin-Williams reference docs.

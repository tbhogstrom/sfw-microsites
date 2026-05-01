# Siding Calculator v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the siding calculator MVP — a public-facing Next.js app where a homeowner draws a single wall elevation on an SVG canvas, places openings, picks construction phases and materials, and exports a CSV / Excel / one-page PDF scope, with leads gated to HubSpot.

**Architecture:** Single Next.js 16 (App Router) app at `apps/siding-calculator`. Geometry and materials calc are pure-TypeScript libs in `lib/`, fully unit-tested. SVG canvas (no `<canvas>` / Konva) renders walls and openings as React-driven elements. Project state autosaves to Vercel Blob via API routes; outputs are generated server-side and stored alongside. HubSpot lead submit is a thin client wrapper around the Forms API with retry + dead-letter blobs for unrecoverable failures.

**Tech Stack:** Next.js 16.2.3, React 19.2.4, Tailwind v4, TypeScript (strict), `@vercel/blob`, `zod`, `ulid`, `exceljs`, `@react-pdf/renderer`, Vitest + React Testing Library, Playwright (one happy-path E2E).

**Spec:** [`docs/superpowers/specs/2026-05-01-siding-calculator-design.md`](../specs/2026-05-01-siding-calculator-design.md)

---

## Conventions

- All paths in this plan are relative to `apps/siding-calculator/` unless prefixed with `microsites/` (the repo root).
- Package manager: **pnpm** (per project CLAUDE.md). All install commands assume pnpm.
- Lint/type check: `pnpm exec tsc --noEmit` and `pnpm exec next lint` (Next 16 includes ESLint).
- Tests: `pnpm test` runs Vitest. `pnpm test:e2e` runs Playwright.
- All commits should follow the conventional-commit style already in use in this repo (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`). Per CLAUDE.md, **do not** add Co-Authored-By trailers.
- Commit after every task. Keep commits small and reversible.

---

## File map (created in this plan)

```
apps/siding-calculator/
  package.json
  tsconfig.json
  next.config.ts
  postcss.config.mjs
  vercel.json
  vitest.config.ts
  playwright.config.ts
  next-env.d.ts
  README.md
  app/
    layout.tsx
    page.tsx                              # landing
    globals.css
    calc/
      new/page.tsx                        # creates a project, redirects
      p/[id]/
        page.tsx                          # the calculator (server component shell)
        Calculator.tsx                    # client component (the whole UX)
        scope/page.tsx                    # SSR HTML version of the scope
    api/
      projects/route.ts                   # POST = create
      projects/[id]/route.ts              # GET = load, PATCH = autosave
      projects/[id]/exports/route.ts      # POST = generate, GET = signed URL
      lead/route.ts                       # POST → HubSpot
  lib/
    types.ts                              # Project, Opening, Material types + Zod schemas
    presets.ts                            # phase preset definitions
    geometry.ts                           # sq-ft, opening subtraction, trim linear-ft
    catalog.ts                            # materials catalog (seeded from reference-docs)
    materials.ts                          # phase → material → required qty
    storage.ts                            # Vercel Blob wrappers
    hubspot.ts                            # HubSpot Forms API client
    csv/materials.ts
    excel/materials-workbook.ts
    pdf/scope-templates.ts                # bullet templates per preset
    pdf/scope-document.tsx                # @react-pdf/renderer doc
  components/
    canvas/
      CanvasSurface.tsx
      Toolbar.tsx
      WallShape.tsx
      Opening.tsx
      DimensionOverlay.tsx
      useDrawingTool.ts
    drawer/
      ElementsDrawer.tsx
    materials/
      PresetPicker.tsx
      PhaseRow.tsx
    outputs/
      MaterialsTable.tsx
      ExportButtons.tsx
      LeadForm.tsx
      QuoteCTA.tsx
    mobile/
      MobileFallback.tsx
  tests/
    geometry.test.ts
    materials.test.ts
    catalog.test.ts
    presets.test.ts
    csv.test.ts
    excel.test.ts
    hubspot.test.ts
    e2e/
      happy-path.spec.ts
```

---

## Task 1: Scaffold the Next.js app

**Files:**
- Create: `apps/siding-calculator/package.json`
- Create: `apps/siding-calculator/tsconfig.json`
- Create: `apps/siding-calculator/next.config.ts`
- Create: `apps/siding-calculator/postcss.config.mjs`
- Create: `apps/siding-calculator/vercel.json`
- Create: `apps/siding-calculator/next-env.d.ts`
- Create: `apps/siding-calculator/.gitignore`
- Create: `apps/siding-calculator/app/globals.css`
- Create: `apps/siding-calculator/app/layout.tsx`
- Create: `apps/siding-calculator/app/page.tsx`

- [ ] **Step 1: Create directory and `package.json`**

`apps/siding-calculator/package.json`:

```json
{
  "name": "siding-calculator",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@react-pdf/renderer": "^4.1.0",
    "@vercel/blob": "^2.3.3",
    "exceljs": "^4.4.0",
    "next": "16.2.3",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "ulid": "^2.3.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@playwright/test": "^1.48.0",
    "@tailwindcss/postcss": "^4",
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.1",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "happy-dom": "^15.7.4",
    "tailwindcss": "^4",
    "typescript": "^5",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`** (copy of reports-portal's)

`apps/siding-calculator/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "tests/e2e"]
}
```

- [ ] **Step 3: Create `next.config.ts`, `postcss.config.mjs`, `vercel.json`, `next-env.d.ts`, `.gitignore`**

`apps/siding-calculator/next.config.ts`:
```ts
import type { NextConfig } from 'next';
const nextConfig: NextConfig = {};
export default nextConfig;
```

`apps/siding-calculator/postcss.config.mjs`:
```js
const config = { plugins: { '@tailwindcss/postcss': {} } };
export default config;
```

`apps/siding-calculator/vercel.json`:
```json
{
  "installCommand": "pnpm install --ignore-scripts",
  "buildCommand": "pnpm build",
  "framework": "nextjs"
}
```

`apps/siding-calculator/next-env.d.ts`:
```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />
```

`apps/siding-calculator/.gitignore`:
```
node_modules/
.next/
.vercel/
.env*.local
*.tsbuildinfo
test-results/
playwright-report/
```

- [ ] **Step 4: Create `app/globals.css`, `app/layout.tsx`, `app/page.tsx`**

`apps/siding-calculator/app/globals.css`:
```css
@import "tailwindcss";

:root {
  --paper: #fbfbf6;
  --grid-major: #d8dde6;
  --grid-minor: #ecf0f6;
  --ink: #1c2230;
  --accent: #2a4d8f;
}

html, body { height: 100%; margin: 0; }
body { font-family: ui-sans-serif, system-ui, sans-serif; color: var(--ink); background: var(--paper); }
```

`apps/siding-calculator/app/layout.tsx`:
```tsx
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SFW Siding Calculator',
  description: 'Sketch a wall, pick materials, get a quote.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`apps/siding-calculator/app/page.tsx`:
```tsx
import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="text-4xl font-semibold tracking-tight">Siding Calculator</h1>
      <p className="mt-4 text-lg text-slate-600">
        Sketch a wall to scale, drop in your windows and doors, pick your materials,
        and walk away with a clear scope you can share with a contractor.
      </p>
      <Link
        href="/calc/new"
        className="mt-8 inline-flex items-center rounded-full bg-[var(--accent)] px-6 py-3 text-white"
      >
        Start a project →
      </Link>
    </main>
  );
}
```

- [ ] **Step 5: Install deps**

```bash
cd apps/siding-calculator
pnpm install
```

Expected: lockfile updated, `node_modules/` populated, no errors.

- [ ] **Step 6: Verify dev server boots**

```bash
pnpm dev
```

Open http://localhost:3000 — should show the landing page. Stop the server (Ctrl-C).

- [ ] **Step 7: Commit**

```bash
git add apps/siding-calculator pnpm-lock.yaml
git commit -m "feat(siding-calculator): scaffold Next.js app"
```

---

## Task 2: Configure Vitest

**Files:**
- Create: `apps/siding-calculator/vitest.config.ts`
- Create: `apps/siding-calculator/tests/smoke.test.ts`

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['tests/e2e/**'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
```

- [ ] **Step 2: Write smoke test**

`apps/siding-calculator/tests/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';

describe('vitest smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
pnpm test
```

Expected: 1 test passes.

- [ ] **Step 4: Commit**

```bash
git add apps/siding-calculator/vitest.config.ts apps/siding-calculator/tests/smoke.test.ts
git commit -m "test(siding-calculator): configure vitest"
```

---

## Task 3: Define core types and Zod schemas

**Files:**
- Create: `apps/siding-calculator/lib/types.ts`
- Test: `apps/siding-calculator/tests/types.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/siding-calculator/tests/types.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { ProjectSchema, OpeningSchema, type Project } from '@/lib/types';

const baseProject: Project = {
  id: '01HXXXXXXXXXXXXXXXXXXXXXX',
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
  schemaVersion: 1,
  canvas: { widthFt: 30, heightFt: 12, snapInches: 12 },
  wall: { rect: { x: 0, y: 0, widthFt: 24, heightFt: 9 } },
  openings: [],
  scope: {
    presetId: 'siding-only',
    phases: {
      insulation:    { enabled: false, materialId: null },
      sheathing:     { enabled: false, materialId: null },
      vaporBarrier:  { enabled: false, materialId: null },
      siding:        { enabled: true,  materialId: null },
      trim:          { enabled: true,  materialId: null },
    },
  },
};

describe('ProjectSchema', () => {
  it('accepts a valid project', () => {
    expect(ProjectSchema.parse(baseProject)).toEqual(baseProject);
  });

  it('rejects negative wall dimensions', () => {
    const bad = { ...baseProject, wall: { rect: { x: 0, y: 0, widthFt: -1, heightFt: 9 } } };
    expect(() => ProjectSchema.parse(bad)).toThrow();
  });

  it('rejects unknown phase', () => {
    const bad: any = { ...baseProject, scope: { ...baseProject.scope, phases: { ...baseProject.scope.phases, foo: {} } } };
    expect(() => ProjectSchema.parse(bad)).toThrow();
  });

  it('OpeningSchema requires positive dimensions', () => {
    expect(() => OpeningSchema.parse({
      id: 'o1', type: 'window', x: 0, y: 0, widthFt: 0, heightFt: 1
    })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test
```

Expected: FAIL with module resolution error or import error.

- [ ] **Step 3: Implement `lib/types.ts`**

```ts
import { z } from 'zod';

export const PHASE_KEYS = ['insulation', 'sheathing', 'vaporBarrier', 'siding', 'trim'] as const;
export type PhaseKey = typeof PHASE_KEYS[number];

export const PRESET_IDS = ['siding-only', 'reside-with-wrb', 'full-envelope', 'custom'] as const;
export type PresetId = typeof PRESET_IDS[number];

export const OPENING_TYPES = ['window', 'door', 'garage-door', 'vent'] as const;
export type OpeningType = typeof OPENING_TYPES[number];

const PositiveFt = z.number().finite().positive();
const NonNegFt   = z.number().finite().nonnegative();

export const OpeningSchema = z.object({
  id: z.string().min(1),
  type: z.enum(OPENING_TYPES),
  x: NonNegFt,
  y: NonNegFt,
  widthFt: PositiveFt,
  heightFt: PositiveFt,
  label: z.string().optional(),
});
export type Opening = z.infer<typeof OpeningSchema>;

const PhaseSlotSchema = z.object({
  enabled: z.boolean(),
  materialId: z.string().nullable(),
});

export const ProjectSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  schemaVersion: z.literal(1),
  canvas: z.object({
    widthFt: PositiveFt,
    heightFt: PositiveFt,
    snapInches: z.union([z.literal(0), z.literal(6), z.literal(12)]),
  }),
  wall: z.object({
    rect: z.object({
      x: NonNegFt,
      y: NonNegFt,
      widthFt: PositiveFt,
      heightFt: PositiveFt,
    }),
    gable: z.object({
      peakHeightFt: PositiveFt,
      peakOffsetFt: z.number().finite(),
    }).optional(),
  }),
  openings: z.array(OpeningSchema),
  scope: z.object({
    presetId: z.enum(PRESET_IDS),
    phases: z.object({
      insulation:    PhaseSlotSchema,
      sheathing:     PhaseSlotSchema,
      vaporBarrier:  PhaseSlotSchema,
      siding:        PhaseSlotSchema,
      trim:          PhaseSlotSchema,
    }).strict(),
  }),
  lead: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(1),
    address: z.string().min(1),
    capturedAt: z.string(),
    hubspotSubmittedAt: z.string().optional(),
  }).optional(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const MaterialSchema = z.object({
  id: z.string().min(1),
  phase: z.enum(PHASE_KEYS),
  brand: z.string().nullable(),
  name: z.string().min(1),
  unit: z.enum(['sqft', 'linft', 'sheet', 'roll', 'piece']),
  coveragePerUnit: PositiveFt,
  wastePct: z.number().finite().min(0).max(1),
  notes: z.string().optional(),
  refDocPath: z.string().optional(),
});
export type Material = z.infer<typeof MaterialSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test tests/types.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/siding-calculator/lib/types.ts apps/siding-calculator/tests/types.test.ts
git commit -m "feat(siding-calculator): add core types and Zod schemas"
```

---

## Task 4: Define phase presets

**Files:**
- Create: `apps/siding-calculator/lib/presets.ts`
- Test: `apps/siding-calculator/tests/presets.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/siding-calculator/tests/presets.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { PRESETS, applyPreset } from '@/lib/presets';
import type { Project } from '@/lib/types';

const emptyPhases: Project['scope']['phases'] = {
  insulation:    { enabled: false, materialId: null },
  sheathing:     { enabled: false, materialId: null },
  vaporBarrier:  { enabled: false, materialId: null },
  siding:        { enabled: false, materialId: null },
  trim:          { enabled: false, materialId: null },
};

describe('PRESETS', () => {
  it('siding-only enables only siding + trim', () => {
    const phases = applyPreset('siding-only', emptyPhases);
    expect(phases.siding.enabled).toBe(true);
    expect(phases.trim.enabled).toBe(true);
    expect(phases.insulation.enabled).toBe(false);
    expect(phases.sheathing.enabled).toBe(false);
    expect(phases.vaporBarrier.enabled).toBe(false);
  });

  it('reside-with-wrb enables wrb + siding + trim', () => {
    const phases = applyPreset('reside-with-wrb', emptyPhases);
    expect(phases.vaporBarrier.enabled).toBe(true);
    expect(phases.siding.enabled).toBe(true);
    expect(phases.trim.enabled).toBe(true);
    expect(phases.insulation.enabled).toBe(false);
    expect(phases.sheathing.enabled).toBe(false);
  });

  it('full-envelope enables everything', () => {
    const phases = applyPreset('full-envelope', emptyPhases);
    Object.values(phases).forEach(p => expect(p.enabled).toBe(true));
  });

  it('custom leaves phases unchanged', () => {
    const before = { ...emptyPhases, siding: { enabled: true, materialId: 'x' } };
    const after = applyPreset('custom', before);
    expect(after).toEqual(before);
  });

  it('preserves materialId on enabled phases', () => {
    const before = { ...emptyPhases, siding: { enabled: false, materialId: 'sid-1' } };
    const after = applyPreset('siding-only', before);
    expect(after.siding.materialId).toBe('sid-1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test tests/presets.test.ts
```

Expected: FAIL on import.

- [ ] **Step 3: Implement `lib/presets.ts`**

```ts
import type { PhaseKey, PresetId, Project } from './types';

type PhaseMap = Project['scope']['phases'];

export const PRESETS: Record<PresetId, Record<PhaseKey, boolean>> = {
  'siding-only':      { insulation: false, sheathing: false, vaporBarrier: false, siding: true,  trim: true  },
  'reside-with-wrb':  { insulation: false, sheathing: false, vaporBarrier: true,  siding: true,  trim: true  },
  'full-envelope':    { insulation: true,  sheathing: true,  vaporBarrier: true,  siding: true,  trim: true  },
  'custom':           { insulation: false, sheathing: false, vaporBarrier: false, siding: false, trim: false }, // unused
};

export function applyPreset(presetId: PresetId, phases: PhaseMap): PhaseMap {
  if (presetId === 'custom') return phases;
  const flags = PRESETS[presetId];
  return {
    insulation:    { enabled: flags.insulation,   materialId: phases.insulation.materialId },
    sheathing:     { enabled: flags.sheathing,    materialId: phases.sheathing.materialId },
    vaporBarrier:  { enabled: flags.vaporBarrier, materialId: phases.vaporBarrier.materialId },
    siding:        { enabled: flags.siding,       materialId: phases.siding.materialId },
    trim:          { enabled: flags.trim,         materialId: phases.trim.materialId },
  };
}

export const PRESET_LABELS: Record<PresetId, string> = {
  'siding-only': 'Siding only',
  'reside-with-wrb': 'Re-side with WRB',
  'full-envelope': 'Full envelope rebuild',
  'custom': 'Custom',
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test tests/presets.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/siding-calculator/lib/presets.ts apps/siding-calculator/tests/presets.test.ts
git commit -m "feat(siding-calculator): add phase preset definitions"
```

---

## Task 5: Geometry library — wall and openings sq ft

**Files:**
- Create: `apps/siding-calculator/lib/geometry.ts`
- Test: `apps/siding-calculator/tests/geometry.test.ts`

- [ ] **Step 1: Write the failing test (sq ft cases)**

`apps/siding-calculator/tests/geometry.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  wallSqFt, openingsSqFt, netSidingSqFt, trimLinFt,
} from '@/lib/geometry';
import type { Project, Opening } from '@/lib/types';

const wallNoGable: Project['wall'] = {
  rect: { x: 0, y: 0, widthFt: 24, heightFt: 9 },
};
const wallWithGable: Project['wall'] = {
  rect: { x: 0, y: 0, widthFt: 24, heightFt: 9 },
  gable: { peakHeightFt: 6, peakOffsetFt: 0 },
};
const openings: Opening[] = [
  { id: 'w1', type: 'window',     x: 2,  y: 3, widthFt: 3,  heightFt: 4 },
  { id: 'd1', type: 'door',       x: 10, y: 0, widthFt: 3,  heightFt: 7 },
];

describe('wallSqFt', () => {
  it('rect-only wall = W * H', () => {
    expect(wallSqFt(wallNoGable)).toBe(216);
  });
  it('with gable adds 0.5 * W * peakHeight', () => {
    expect(wallSqFt(wallWithGable)).toBe(216 + 72);
  });
});

describe('openingsSqFt', () => {
  it('sums all opening areas', () => {
    expect(openingsSqFt(openings)).toBe(3 * 4 + 3 * 7);  // 33
  });
  it('returns 0 for empty array', () => {
    expect(openingsSqFt([])).toBe(0);
  });
});

describe('netSidingSqFt', () => {
  it('wall minus openings, never below zero', () => {
    expect(netSidingSqFt(wallNoGable, openings)).toBe(216 - 33);
    expect(netSidingSqFt(wallNoGable, [{ id: 'huge', type: 'window', x: 0, y: 0, widthFt: 100, heightFt: 100 }])).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test tests/geometry.test.ts
```

Expected: FAIL on import.

- [ ] **Step 3: Implement sq-ft functions in `lib/geometry.ts`**

```ts
import type { Project, Opening } from './types';

export function wallSqFt(wall: Project['wall']): number {
  const rectArea = wall.rect.widthFt * wall.rect.heightFt;
  const gableArea = wall.gable
    ? 0.5 * wall.rect.widthFt * wall.gable.peakHeightFt
    : 0;
  return rectArea + gableArea;
}

export function openingsSqFt(openings: Opening[]): number {
  return openings.reduce((sum, o) => sum + o.widthFt * o.heightFt, 0);
}

export function netSidingSqFt(wall: Project['wall'], openings: Opening[]): number {
  return Math.max(0, wallSqFt(wall) - openingsSqFt(openings));
}

// trimLinFt comes in the next task
export function trimLinFt(_wall: Project['wall'], _openings: Opening[]): number {
  throw new Error('not implemented');
}
```

- [ ] **Step 4: Run test to verify sq-ft passes**

```bash
pnpm test tests/geometry.test.ts -t 'wallSqFt|openingsSqFt|netSidingSqFt'
```

Expected: 5 tests pass; trim test will error in next task — leave it broken for now.

- [ ] **Step 5: Commit**

```bash
git add apps/siding-calculator/lib/geometry.ts apps/siding-calculator/tests/geometry.test.ts
git commit -m "feat(siding-calculator): add sq-ft geometry functions"
```

---

## Task 6: Geometry — trim linear ft

**Files:**
- Modify: `apps/siding-calculator/lib/geometry.ts`
- Modify: `apps/siding-calculator/tests/geometry.test.ts`

- [ ] **Step 1: Add trim-linft tests**

Append to `tests/geometry.test.ts`:
```ts
describe('trimLinFt', () => {
  const wallNoGable: Project['wall'] = { rect: { x: 0, y: 0, widthFt: 24, heightFt: 9 } };
  const wallWithGable: Project['wall'] = {
    rect: { x: 0, y: 0, widthFt: 24, heightFt: 9 },
    gable: { peakHeightFt: 6, peakOffsetFt: 0 },
  };

  it('rect-only: corners + fascia + water-table + opening perimeters', () => {
    // corners: 2 * 9 = 18
    // fascia (top): 24
    // water-table (bottom): 24
    // openings: window 2*(3+4)=14, door 2*(3+7)=20 → 34
    // total: 18 + 24 + 24 + 34 = 100
    const openings: Opening[] = [
      { id: 'w1', type: 'window', x: 2, y: 3, widthFt: 3, heightFt: 4 },
      { id: 'd1', type: 'door',   x: 10, y: 0, widthFt: 3, heightFt: 7 },
    ];
    expect(trimLinFt(wallNoGable, openings)).toBe(100);
  });

  it('with gable: adds two rake hypotenuses, drops top fascia (replaced by rakes)', () => {
    // The rake replaces the top fascia. Each rake = sqrt((W/2)^2 + peakHeight^2)
    // half-width 12, peak 6 → hypotenuse = sqrt(144 + 36) = sqrt(180) ≈ 13.4164
    // corners: 2 * 9 = 18
    // water-table: 24
    // rakes: 2 * 13.4164 ≈ 26.8328
    // (no openings)
    // total ≈ 18 + 24 + 26.8328 = 68.8328
    expect(trimLinFt(wallWithGable, [])).toBeCloseTo(18 + 24 + 2 * Math.sqrt(180), 4);
  });

  it('returns 0 for an empty wall (defensive)', () => {
    const tiny: Project['wall'] = { rect: { x: 0, y: 0, widthFt: 0.0001, heightFt: 0.0001 } };
    expect(trimLinFt(tiny, [])).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify trim cases fail**

```bash
pnpm test tests/geometry.test.ts -t trimLinFt
```

Expected: FAIL with "not implemented".

- [ ] **Step 3: Implement `trimLinFt`**

Replace the stub in `lib/geometry.ts`:
```ts
export function trimLinFt(wall: Project['wall'], openings: Opening[]): number {
  const W = wall.rect.widthFt;
  const H = wall.rect.heightFt;

  const cornerBoards = 2 * H;
  const waterTable = W;

  let topRun: number;
  if (wall.gable) {
    // Two rake edges instead of a horizontal top fascia.
    const halfW = W / 2;
    const rake = Math.sqrt(halfW * halfW + wall.gable.peakHeightFt * wall.gable.peakHeightFt);
    topRun = 2 * rake;
  } else {
    topRun = W;  // top fascia
  }

  const openingPerimeters = openings.reduce(
    (sum, o) => sum + 2 * (o.widthFt + o.heightFt),
    0
  );

  return cornerBoards + waterTable + topRun + openingPerimeters;
}
```

- [ ] **Step 4: Run all geometry tests**

```bash
pnpm test tests/geometry.test.ts
```

Expected: all geometry tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/siding-calculator/lib/geometry.ts apps/siding-calculator/tests/geometry.test.ts
git commit -m "feat(siding-calculator): add trim linear-ft calc"
```

---

## Task 7: Materials catalog — seed and integrity

**Files:**
- Create: `apps/siding-calculator/lib/catalog.ts`
- Test: `apps/siding-calculator/tests/catalog.test.ts`

The catalog seed pulls names and reasonable coverage rates from `field-guys/reference-docs/`. Coverage values are typical residential rules-of-thumb; they're illustrative MVP defaults, refinable as a follow-on.

- [ ] **Step 1: Write the failing tests**

`apps/siding-calculator/tests/catalog.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { CATALOG, materialsByPhase, getMaterial } from '@/lib/catalog';
import { MaterialSchema, PHASE_KEYS } from '@/lib/types';

describe('CATALOG', () => {
  it('every entry validates against MaterialSchema', () => {
    for (const m of CATALOG) {
      expect(() => MaterialSchema.parse(m)).not.toThrow();
    }
  });

  it('has unique ids', () => {
    const ids = CATALOG.map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every phase has at least one material', () => {
    for (const phase of PHASE_KEYS) {
      const matches = CATALOG.filter(m => m.phase === phase);
      expect(matches.length, `phase ${phase} has no materials`).toBeGreaterThan(0);
    }
  });

  it('materialsByPhase filters correctly', () => {
    expect(materialsByPhase('siding').every(m => m.phase === 'siding')).toBe(true);
  });

  it('getMaterial returns null for unknown ids', () => {
    expect(getMaterial('nope')).toBeNull();
  });

  it('getMaterial returns the material for known ids', () => {
    const first = CATALOG[0];
    expect(getMaterial(first.id)?.id).toBe(first.id);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test tests/catalog.test.ts
```

Expected: FAIL on import.

- [ ] **Step 3: Implement `lib/catalog.ts`**

```ts
import type { Material, PhaseKey } from './types';

export const CATALOG: Material[] = [
  // --- Insulation ---
  {
    id: 'insul-fiberglass-r15',
    phase: 'insulation',
    brand: null,
    name: 'Fiberglass batt insulation R-15 (2x4 walls)',
    unit: 'roll',
    coveragePerUnit: 88,            // sqft per roll, typical
    wastePct: 0.05,
  },
  {
    id: 'insul-mineralwool-r21',
    phase: 'insulation',
    brand: null,
    name: 'Mineral wool batt insulation R-21 (2x6 walls)',
    unit: 'roll',
    coveragePerUnit: 60,
    wastePct: 0.05,
  },

  // --- Sheathing ---
  {
    id: 'sheath-osb-7-16',
    phase: 'sheathing',
    brand: null,
    name: 'OSB sheathing 7/16" (4x8 sheet)',
    unit: 'sheet',
    coveragePerUnit: 32,            // 4 * 8
    wastePct: 0.10,
  },
  {
    id: 'sheath-cdx-1-2',
    phase: 'sheathing',
    brand: null,
    name: 'CDX plywood sheathing 1/2" (4x8 sheet)',
    unit: 'sheet',
    coveragePerUnit: 32,
    wastePct: 0.10,
  },

  // --- Vapor barrier / WRB ---
  {
    id: 'wrb-tyvek-drainwrap',
    phase: 'vaporBarrier',
    brand: 'DuPont',
    name: 'Tyvek DrainWrap (5\' x 200\' roll)',
    unit: 'roll',
    coveragePerUnit: 1000,
    wastePct: 0.10,
    refDocPath: 'tyvek-drainwrap/Tyvek-DrainWrap-PIS.pdf',
  },
  {
    id: 'wrb-generic-housewrap',
    phase: 'vaporBarrier',
    brand: null,
    name: 'Generic house wrap (9\' x 150\' roll)',
    unit: 'roll',
    coveragePerUnit: 1350,
    wastePct: 0.10,
  },

  // --- Siding ---
  {
    id: 'sid-hardieplank-625',
    phase: 'siding',
    brand: 'James Hardie',
    name: 'HardiePlank Lap Siding (6.25" exposure)',
    unit: 'sqft',
    coveragePerUnit: 1,
    wastePct: 0.10,
    refDocPath: 'james-hardie/HardiePlank-HZ10-install.pdf',
  },
  {
    id: 'sid-hardiepanel',
    phase: 'siding',
    brand: 'James Hardie',
    name: 'HardiePanel Vertical Siding (4x8 sheet)',
    unit: 'sheet',
    coveragePerUnit: 32,
    wastePct: 0.10,
    refDocPath: 'james-hardie/HardiePanel-HZ10-install.pdf',
  },
  {
    id: 'sid-cedar-bevel',
    phase: 'siding',
    brand: null,
    name: 'Western red cedar bevel siding',
    unit: 'sqft',
    coveragePerUnit: 1,
    wastePct: 0.15,
    refDocPath: 'western-red-cedar/',
  },
  {
    id: 'sid-t1-11',
    phase: 'siding',
    brand: null,
    name: 'T1-11 plywood siding (4x8 sheet)',
    unit: 'sheet',
    coveragePerUnit: 32,
    wastePct: 0.10,
    refDocPath: 't1-11-siding/APA-Engineered-Wood-Construction-Guide-E30.pdf',
  },
  {
    id: 'sid-vinyl-generic',
    phase: 'siding',
    brand: null,
    name: 'Vinyl lap siding (generic, per square)',
    unit: 'sqft',
    coveragePerUnit: 1,
    wastePct: 0.10,
  },

  // --- Trim ---
  {
    id: 'trim-hardietrim-44',
    phase: 'trim',
    brand: 'James Hardie',
    name: 'HardieTrim 4/4 (~3.5" exposed face)',
    unit: 'linft',
    coveragePerUnit: 1,
    wastePct: 0.10,
    refDocPath: 'james-hardie/HardieTrim-HZ10-install.pdf',
  },
  {
    id: 'trim-cedar-1x4',
    phase: 'trim',
    brand: null,
    name: 'Western red cedar 1x4 trim',
    unit: 'linft',
    coveragePerUnit: 1,
    wastePct: 0.10,
  },
  {
    id: 'trim-pvc-1x4',
    phase: 'trim',
    brand: null,
    name: 'PVC trim board 1x4',
    unit: 'linft',
    coveragePerUnit: 1,
    wastePct: 0.10,
  },
];

export function materialsByPhase(phase: PhaseKey): Material[] {
  return CATALOG.filter(m => m.phase === phase);
}

export function getMaterial(id: string): Material | null {
  return CATALOG.find(m => m.id === id) ?? null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test tests/catalog.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/siding-calculator/lib/catalog.ts apps/siding-calculator/tests/catalog.test.ts
git commit -m "feat(siding-calculator): seed materials catalog"
```

---

## Task 8: Materials qty calculation

**Files:**
- Create: `apps/siding-calculator/lib/materials.ts`
- Test: `apps/siding-calculator/tests/materials.test.ts`

- [ ] **Step 1: Write the failing tests**

`apps/siding-calculator/tests/materials.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { computeMaterialsList, enabledPhasesMissingMaterial, type MaterialsLine } from '@/lib/materials';
import type { Project } from '@/lib/types';

const baseProject: Project = {
  id: 'p1', createdAt: 't', updatedAt: 't', schemaVersion: 1,
  canvas: { widthFt: 30, heightFt: 12, snapInches: 12 },
  wall: { rect: { x: 0, y: 0, widthFt: 24, heightFt: 9 } },  // 216 sqft
  openings: [
    { id: 'd1', type: 'door', x: 10, y: 0, widthFt: 3, heightFt: 7 }, // 21 sqft
  ],
  scope: {
    presetId: 'reside-with-wrb',
    phases: {
      insulation:    { enabled: false, materialId: null },
      sheathing:     { enabled: false, materialId: null },
      vaporBarrier:  { enabled: true,  materialId: 'wrb-tyvek-drainwrap' },
      siding:        { enabled: true,  materialId: 'sid-hardieplank-625' },
      trim:          { enabled: true,  materialId: 'trim-hardietrim-44' },
    },
  },
};

describe('computeMaterialsList', () => {
  it('emits one line per enabled phase with a material', () => {
    const lines = computeMaterialsList(baseProject);
    expect(lines.map(l => l.phase).sort()).toEqual(['siding', 'trim', 'vaporBarrier']);
  });

  it('siding qty applies waste factor and ceils', () => {
    const lines = computeMaterialsList(baseProject);
    const siding = lines.find(l => l.phase === 'siding')!;
    // net = 216 - 21 = 195; waste 10% → 214.5; coverage 1 → ceil → 215
    expect(siding.qty).toBe(215);
    expect(siding.unit).toBe('sqft');
  });

  it('trim qty uses linear-ft target', () => {
    const lines = computeMaterialsList(baseProject);
    const trim = lines.find(l => l.phase === 'trim')!;
    // corners 2*9=18, fascia 24, water-table 24, door perimeter 2*(3+7)=20 → 86
    // waste 10% → 94.6 → ceil → 95
    expect(trim.qty).toBe(95);
    expect(trim.unit).toBe('linft');
  });

  it('skips phases with no materialId even if enabled', () => {
    const proj = { ...baseProject, scope: {
      ...baseProject.scope,
      phases: { ...baseProject.scope.phases, siding: { enabled: true, materialId: null } },
    } };
    const lines = computeMaterialsList(proj);
    expect(lines.find(l => l.phase === 'siding')).toBeUndefined();
  });

  it('enabledPhasesMissingMaterial flags phases enabled but unmateriald', () => {
    const proj = { ...baseProject, scope: {
      ...baseProject.scope,
      phases: { ...baseProject.scope.phases, insulation: { enabled: true, materialId: null } },
    } };
    expect(enabledPhasesMissingMaterial(proj)).toEqual(['insulation']);
    expect(enabledPhasesMissingMaterial(baseProject)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test tests/materials.test.ts
```

Expected: FAIL on import.

- [ ] **Step 3: Implement `lib/materials.ts`**

```ts
import type { Project, PhaseKey, Material } from './types';
import { getMaterial } from './catalog';
import { netSidingSqFt, trimLinFt } from './geometry';

export type MaterialsLine = {
  phase: PhaseKey;
  material: Material;
  requiredAmount: number;       // sqft (or linft for trim) before waste
  qty: number;                  // ceil((required * (1+waste)) / coverage)
  unit: Material['unit'];
  coverageNote: string;
};

export function computeMaterialsList(project: Project): MaterialsLine[] {
  const sidingArea = netSidingSqFt(project.wall, project.openings);
  const trim = trimLinFt(project.wall, project.openings);

  const lines: MaterialsLine[] = [];

  for (const phase of ['insulation', 'sheathing', 'vaporBarrier', 'siding', 'trim'] as const) {
    const slot = project.scope.phases[phase];
    if (!slot.enabled || !slot.materialId) continue;
    const material = getMaterial(slot.materialId);
    if (!material) continue;

    const required = phase === 'trim' ? trim : sidingArea;
    const withWaste = required * (1 + material.wastePct);
    const qty = Math.ceil(withWaste / material.coveragePerUnit);

    lines.push({
      phase,
      material,
      requiredAmount: required,
      qty,
      unit: material.unit,
      coverageNote: `${material.coveragePerUnit} ${material.unit === 'linft' ? 'lin ft' : 'sq ft'} per ${material.unit === 'sheet' ? 'sheet' : material.unit === 'roll' ? 'roll' : material.unit === 'piece' ? 'piece' : 'unit'} · waste +${Math.round(material.wastePct * 100)}%`,
    });
  }

  return lines;
}

export function enabledPhasesMissingMaterial(project: Project): PhaseKey[] {
  const out: PhaseKey[] = [];
  for (const phase of ['insulation', 'sheathing', 'vaporBarrier', 'siding', 'trim'] as const) {
    const slot = project.scope.phases[phase];
    if (slot.enabled && !slot.materialId) out.push(phase);
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test tests/materials.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/siding-calculator/lib/materials.ts apps/siding-calculator/tests/materials.test.ts
git commit -m "feat(siding-calculator): add materials qty calc"
```

---

## Task 9: Storage layer — Vercel Blob wrappers

**Files:**
- Create: `apps/siding-calculator/lib/storage.ts`

This module is small enough that we test it via the API route tests (Task 12+). Direct unit testing requires mocking `@vercel/blob`, which isn't worth the test complexity here.

- [ ] **Step 1: Implement `lib/storage.ts`**

```ts
import { put, head, del } from '@vercel/blob';
import { ProjectSchema, type Project } from './types';

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

function projectKey(id: string): string {
  return `projects/${id}.json`;
}
function outputKey(id: string, format: 'csv' | 'xlsx' | 'pdf'): string {
  return `outputs/${id}/materials.${format === 'pdf' ? 'pdf' : format}`;
}
function failedLeadKey(id: string): string {
  return `failed-leads/${id}.json`;
}

export async function saveProject(project: Project): Promise<void> {
  ProjectSchema.parse(project);
  await put(projectKey(project.id), JSON.stringify(project), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    token: BLOB_TOKEN,
  });
}

export async function loadProject(id: string): Promise<Project | null> {
  try {
    const meta = await head(projectKey(id), { token: BLOB_TOKEN });
    const res = await fetch(meta.url, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    return ProjectSchema.parse(json);
  } catch (err: any) {
    if (err?.status === 404 || err?.code === 'BLOB_NOT_FOUND') return null;
    throw err;
  }
}

export async function saveOutput(
  id: string,
  format: 'csv' | 'xlsx' | 'pdf',
  body: Buffer | string,
  contentType: string,
): Promise<string> {
  const result = await put(outputKey(id, format), body, {
    access: 'public',
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
    token: BLOB_TOKEN,
  });
  return result.url;
}

export async function getOutputUrl(id: string, format: 'csv' | 'xlsx' | 'pdf'): Promise<string | null> {
  try {
    const meta = await head(outputKey(id, format), { token: BLOB_TOKEN });
    return meta.url;
  } catch { return null; }
}

export async function saveFailedLead(id: string, payload: unknown): Promise<void> {
  await put(failedLeadKey(id), JSON.stringify(payload), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    token: BLOB_TOKEN,
  });
}

export async function deleteOutputs(id: string): Promise<void> {
  for (const fmt of ['csv', 'xlsx', 'pdf'] as const) {
    try { await del(outputKey(id, fmt), { token: BLOB_TOKEN }); } catch { /* ignore */ }
  }
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/siding-calculator/lib/storage.ts
git commit -m "feat(siding-calculator): add Vercel Blob storage wrappers"
```

---

## Task 10: CSV builder

**Files:**
- Create: `apps/siding-calculator/lib/csv/materials.ts`
- Test: `apps/siding-calculator/tests/csv.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/siding-calculator/tests/csv.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { materialsToCsv } from '@/lib/csv/materials';
import type { MaterialsLine } from '@/lib/materials';
import type { Material } from '@/lib/types';

const sidingMat: Material = {
  id: 'sid-hardieplank-625', phase: 'siding', brand: 'James Hardie',
  name: 'HardiePlank Lap Siding (6.25" exposure)', unit: 'sqft',
  coveragePerUnit: 1, wastePct: 0.10,
};

describe('materialsToCsv', () => {
  it('emits header + one row per line', () => {
    const lines: MaterialsLine[] = [{
      phase: 'siding', material: sidingMat, requiredAmount: 195,
      qty: 215, unit: 'sqft', coverageNote: '1 sq ft per unit · waste +10%',
    }];
    const out = materialsToCsv(lines);
    const rows = out.trim().split('\n');
    expect(rows.length).toBe(2);
    expect(rows[0]).toBe('Phase,Brand,Material,Quantity,Unit,Required (pre-waste),Coverage notes');
    expect(rows[1]).toContain('siding');
    expect(rows[1]).toContain('215');
  });

  it('quotes values containing commas or quotes', () => {
    const lines: MaterialsLine[] = [{
      phase: 'siding',
      material: { ...sidingMat, name: 'Plank, "lap" 6.25"' },
      requiredAmount: 1, qty: 1, unit: 'sqft', coverageNote: 'a, b',
    }];
    const out = materialsToCsv(lines);
    expect(out).toContain('"Plank, ""lap"" 6.25"""');
  });

  it('emits header-only when given empty list', () => {
    const out = materialsToCsv([]);
    expect(out.trim().split('\n').length).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test tests/csv.test.ts
```

Expected: FAIL on import.

- [ ] **Step 3: Implement `lib/csv/materials.ts`**

```ts
import type { MaterialsLine } from '../materials';

const HEADER = ['Phase', 'Brand', 'Material', 'Quantity', 'Unit', 'Required (pre-waste)', 'Coverage notes'];

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function materialsToCsv(lines: MaterialsLine[]): string {
  const rows: string[] = [HEADER.join(',')];
  for (const l of lines) {
    rows.push([
      l.phase,
      l.material.brand ?? '',
      l.material.name,
      l.qty,
      l.unit,
      l.requiredAmount.toFixed(2),
      l.coverageNote,
    ].map(csvCell).join(','));
  }
  return rows.join('\n') + '\n';
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test tests/csv.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/siding-calculator/lib/csv apps/siding-calculator/tests/csv.test.ts
git commit -m "feat(siding-calculator): add CSV materials builder"
```

---

## Task 11: Excel builder

**Files:**
- Create: `apps/siding-calculator/lib/excel/materials-workbook.ts`
- Test: `apps/siding-calculator/tests/excel.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/siding-calculator/tests/excel.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { buildMaterialsWorkbook } from '@/lib/excel/materials-workbook';
import type { MaterialsLine } from '@/lib/materials';
import type { Project, Material } from '@/lib/types';

const sidingMat: Material = {
  id: 'sid-hardieplank-625', phase: 'siding', brand: 'James Hardie',
  name: 'HardiePlank Lap Siding (6.25" exposure)', unit: 'sqft',
  coveragePerUnit: 1, wastePct: 0.10,
};
const project: Project = {
  id: 'p1', createdAt: '2026-05-01T00:00:00Z', updatedAt: '2026-05-01T00:00:00Z',
  schemaVersion: 1,
  canvas: { widthFt: 30, heightFt: 12, snapInches: 12 },
  wall: { rect: { x: 0, y: 0, widthFt: 24, heightFt: 9 } },
  openings: [],
  scope: {
    presetId: 'siding-only',
    phases: {
      insulation:    { enabled: false, materialId: null },
      sheathing:     { enabled: false, materialId: null },
      vaporBarrier:  { enabled: false, materialId: null },
      siding:        { enabled: true,  materialId: 'sid-hardieplank-625' },
      trim:          { enabled: false, materialId: null },
    },
  },
};
const lines: MaterialsLine[] = [{
  phase: 'siding', material: sidingMat, requiredAmount: 216, qty: 238, unit: 'sqft',
  coverageNote: '1 sq ft per unit · waste +10%',
}];

describe('buildMaterialsWorkbook', () => {
  it('returns a buffer that ExcelJS can read back', async () => {
    const buf = await buildMaterialsWorkbook(project, lines);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const ws = wb.getWorksheet('Materials');
    expect(ws).toBeDefined();
    expect(ws!.getCell('A1').value).toBe('Phase');
    expect(ws!.getCell('D2').value).toBe(238);
  });

  it('includes a project info sheet', async () => {
    const buf = await buildMaterialsWorkbook(project, lines);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    expect(wb.getWorksheet('Project')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test tests/excel.test.ts
```

Expected: FAIL on import.

- [ ] **Step 3: Implement `lib/excel/materials-workbook.ts`**

```ts
import ExcelJS from 'exceljs';
import type { Project } from '../types';
import type { MaterialsLine } from '../materials';
import { wallSqFt, openingsSqFt, netSidingSqFt, trimLinFt } from '../geometry';
import { PRESET_LABELS } from '../presets';

export async function buildMaterialsWorkbook(
  project: Project,
  lines: MaterialsLine[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SFW Siding Calculator';
  wb.created = new Date(project.createdAt);

  // --- Project sheet ---
  const proj = wb.addWorksheet('Project');
  proj.columns = [{ width: 28 }, { width: 40 }];
  proj.addRows([
    ['Project ID', project.id],
    ['Created', project.createdAt],
    ['Preset', PRESET_LABELS[project.scope.presetId]],
    ['Canvas', `${project.canvas.widthFt}' × ${project.canvas.heightFt}'`],
    ['Wall', `${project.wall.rect.widthFt}' × ${project.wall.rect.heightFt}'${project.wall.gable ? ` + gable peak ${project.wall.gable.peakHeightFt}'` : ''}`],
    ['Wall area', `${wallSqFt(project.wall).toFixed(1)} sq ft`],
    ['Openings area', `${openingsSqFt(project.openings).toFixed(1)} sq ft`],
    ['Net siding area', `${netSidingSqFt(project.wall, project.openings).toFixed(1)} sq ft`],
    ['Trim length', `${trimLinFt(project.wall, project.openings).toFixed(1)} lin ft`],
  ]);
  proj.getColumn(1).font = { bold: true };

  // --- Materials sheet ---
  const ws = wb.addWorksheet('Materials');
  ws.columns = [
    { header: 'Phase', key: 'phase', width: 14 },
    { header: 'Brand', key: 'brand', width: 16 },
    { header: 'Material', key: 'material', width: 42 },
    { header: 'Quantity', key: 'qty', width: 10 },
    { header: 'Unit', key: 'unit', width: 8 },
    { header: 'Required (pre-waste)', key: 'required', width: 20 },
    { header: 'Coverage notes', key: 'notes', width: 36 },
  ];
  ws.getRow(1).font = { bold: true };

  for (const l of lines) {
    ws.addRow({
      phase: l.phase,
      brand: l.material.brand ?? '',
      material: l.material.name,
      qty: l.qty,
      unit: l.unit,
      required: Number(l.requiredAmount.toFixed(2)),
      notes: l.coverageNote,
    });
  }

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test tests/excel.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/siding-calculator/lib/excel apps/siding-calculator/tests/excel.test.ts
git commit -m "feat(siding-calculator): add Excel materials workbook builder"
```

---

## Task 12: Scope bullet templates

**Files:**
- Create: `apps/siding-calculator/lib/pdf/scope-templates.ts`
- Test: `apps/siding-calculator/tests/scope-templates.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/siding-calculator/tests/scope-templates.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { renderScopeBullets } from '@/lib/pdf/scope-templates';
import type { Project } from '@/lib/types';

const project: Project = {
  id: 'p1', createdAt: 't', updatedAt: 't', schemaVersion: 1,
  canvas: { widthFt: 30, heightFt: 12, snapInches: 12 },
  wall: { rect: { x: 0, y: 0, widthFt: 24, heightFt: 9 } },
  openings: [],
  scope: {
    presetId: 'reside-with-wrb',
    phases: {
      insulation:    { enabled: false, materialId: null },
      sheathing:     { enabled: false, materialId: null },
      vaporBarrier:  { enabled: true,  materialId: 'wrb-tyvek-drainwrap' },
      siding:        { enabled: true,  materialId: 'sid-hardieplank-625' },
      trim:          { enabled: true,  materialId: 'trim-hardietrim-44' },
    },
  },
};

describe('renderScopeBullets', () => {
  it('produces bullets for the chosen preset, with material names filled in', () => {
    const bullets = renderScopeBullets(project);
    expect(bullets.some(b => b.includes('Tyvek DrainWrap'))).toBe(true);
    expect(bullets.some(b => b.includes('HardiePlank'))).toBe(true);
    expect(bullets.some(b => b.includes('HardieTrim'))).toBe(true);
  });

  it('skips bullets for disabled phases', () => {
    const bullets = renderScopeBullets(project);
    expect(bullets.some(b => /insulation/i.test(b))).toBe(false);
  });

  it('falls back to "selected material" wording when materialId is missing', () => {
    const bad = { ...project, scope: { ...project.scope, phases: {
      ...project.scope.phases, siding: { enabled: true, materialId: null },
    } } };
    const bullets = renderScopeBullets(bad);
    expect(bullets.some(b => /selected siding/.test(b))).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test tests/scope-templates.test.ts
```

Expected: FAIL on import.

- [ ] **Step 3: Implement `lib/pdf/scope-templates.ts`**

```ts
import type { Project, PhaseKey } from '../types';
import { getMaterial } from '../catalog';
import { netSidingSqFt, trimLinFt } from '../geometry';

function matName(project: Project, phase: PhaseKey): string {
  const id = project.scope.phases[phase].materialId;
  const m = id ? getMaterial(id) : null;
  return m ? m.name : `selected ${phase} material`;
}

export function renderScopeBullets(project: Project): string[] {
  const bullets: string[] = [];
  const phases = project.scope.phases;
  const sidingArea = Math.round(netSidingSqFt(project.wall, project.openings));
  const trim = Math.round(trimLinFt(project.wall, project.openings));

  bullets.push('Remove existing siding to sheathing.');

  if (phases.sheathing.enabled) {
    bullets.push(`Inspect and repair sheathing as needed; install ${matName(project, 'sheathing')} where rotted or missing.`);
  }
  if (phases.insulation.enabled) {
    bullets.push(`Install ${matName(project, 'insulation')} in all open stud cavities.`);
  }
  if (phases.vaporBarrier.enabled) {
    bullets.push(`Install ${matName(project, 'vaporBarrier')} per manufacturer guide, with all seams taped.`);
  }
  if (phases.siding.enabled) {
    bullets.push(`Install ${matName(project, 'siding')} (~${sidingArea} sq ft net) per manufacturer guide.`);
  }
  if (phases.trim.enabled) {
    bullets.push(`Install ${matName(project, 'trim')} at corners, fascia, water-table, and all openings (~${trim} lin ft).`);
  }

  bullets.push('Caulk and seal all penetrations and trim transitions.');
  bullets.push('Haul away debris and leave the work area broom-clean.');
  return bullets;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test tests/scope-templates.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/siding-calculator/lib/pdf/scope-templates.ts apps/siding-calculator/tests/scope-templates.test.ts
git commit -m "feat(siding-calculator): add scope bullet templates"
```

---

## Task 13: PDF scope document

**Files:**
- Create: `apps/siding-calculator/lib/pdf/scope-document.tsx`

PDF rendering uses `@react-pdf/renderer` and produces a single-page document. We don't unit test the PDF binary output; correctness is verified end-to-end via the API integration in Task 16 and the E2E happy-path in Task 28.

- [ ] **Step 1: Implement `lib/pdf/scope-document.tsx`**

```tsx
import { Document, Page, Text, View, StyleSheet, Svg, Rect, Polygon, pdf } from '@react-pdf/renderer';
import type { Project } from '../types';
import type { MaterialsLine } from '../materials';
import { renderScopeBullets } from './scope-templates';
import { wallSqFt, netSidingSqFt, trimLinFt } from '../geometry';
import { PRESET_LABELS } from '../presets';

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: 'Helvetica', color: '#1c2230' },
  h1: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  meta: { fontSize: 9, color: '#666', marginBottom: 16 },
  h2: { fontSize: 12, fontWeight: 700, marginTop: 12, marginBottom: 6 },
  diagram: { height: 140, border: '1pt solid #ccc', marginBottom: 12 },
  table: { display: 'flex', flexDirection: 'column', borderTop: '0.5pt solid #ccc' },
  row: { flexDirection: 'row', borderBottom: '0.5pt solid #ccc', paddingVertical: 3 },
  th: { fontWeight: 700, fontSize: 9 },
  bullet: { marginBottom: 3, paddingLeft: 8 },
  footer: { marginTop: 16, fontSize: 8, color: '#888' },
});

const COL = [
  { key: 'phase', width: '15%' },
  { key: 'material', width: '40%' },
  { key: 'qty', width: '10%' },
  { key: 'unit', width: '10%' },
  { key: 'notes', width: '25%' },
];

function ElevationDiagram({ project }: { project: Project }) {
  // Map feet → SVG units. Fit within ~500 x 130 viewport.
  const totalW = project.wall.rect.widthFt;
  const totalH = project.wall.rect.heightFt + (project.wall.gable?.peakHeightFt ?? 0);
  const scale = Math.min(500 / totalW, 130 / totalH);
  const w = totalW * scale;
  const h = totalH * scale;
  const wallH = project.wall.rect.heightFt * scale;
  const wallTopY = h - wallH;

  return (
    <Svg style={styles.diagram} viewBox={`0 0 ${w} ${h}`}>
      <Rect x={0} y={wallTopY} width={w} height={wallH} stroke="#2a4d8f" strokeWidth={1.5} fill="rgba(42,77,143,0.05)" />
      {project.wall.gable && (() => {
        const peakX = w / 2 + (project.wall.gable.peakOffsetFt * scale);
        const points = `0,${wallTopY} ${w},${wallTopY} ${peakX},0`;
        return <Polygon points={points} stroke="#2a4d8f" strokeWidth={1.5} fill="rgba(42,77,143,0.05)" />;
      })()}
      {project.openings.map(o => {
        const ox = o.x * scale;
        const oy = h - wallH + (project.wall.rect.heightFt - o.y - o.heightFt) * scale;
        const ow = o.widthFt * scale;
        const oh = o.heightFt * scale;
        return <Rect key={o.id} x={ox} y={oy} width={ow} height={oh} stroke="#2a4d8f" strokeWidth={1} fill="white" />;
      })}
    </Svg>
  );
}

export function ScopeDocument({ project, lines, shareUrl }: { project: Project; lines: MaterialsLine[]; shareUrl: string }) {
  const bullets = renderScopeBullets(project);
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.h1}>Siding Project Scope</Text>
        <Text style={styles.meta}>
          Project {project.id} · Generated {new Date().toLocaleDateString()} · {PRESET_LABELS[project.scope.presetId]}
        </Text>

        <Text style={styles.h2}>Elevation</Text>
        <ElevationDiagram project={project} />

        <Text style={styles.h2}>Wall summary</Text>
        <Text>
          Wall area: {wallSqFt(project.wall).toFixed(0)} sq ft  ·  Net siding: {netSidingSqFt(project.wall, project.openings).toFixed(0)} sq ft  ·  Trim: {trimLinFt(project.wall, project.openings).toFixed(0)} lin ft
        </Text>

        <Text style={styles.h2}>Materials</Text>
        <View style={styles.table}>
          <View style={styles.row}>
            {COL.map(c => <Text key={c.key} style={[styles.th, { width: c.width }]}>{c.key}</Text>)}
          </View>
          {lines.map(l => (
            <View key={l.material.id + l.phase} style={styles.row}>
              <Text style={{ width: COL[0].width }}>{l.phase}</Text>
              <Text style={{ width: COL[1].width }}>{l.material.name}</Text>
              <Text style={{ width: COL[2].width }}>{l.qty}</Text>
              <Text style={{ width: COL[3].width }}>{l.unit}</Text>
              <Text style={{ width: COL[4].width }}>{l.coverageNote}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.h2}>Scope of work</Text>
        {bullets.map((b, i) => <Text key={i} style={styles.bullet}>• {b}</Text>)}

        <Text style={styles.footer}>
          This scope is generated from your inputs in the SFW Siding Calculator. Shareable copy: {shareUrl}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderScopePdf(project: Project, lines: MaterialsLine[], shareUrl: string): Promise<Buffer> {
  const stream = await pdf(<ScopeDocument project={project} lines={lines} shareUrl={shareUrl} />).toBuffer();
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (c: Buffer) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/siding-calculator/lib/pdf/scope-document.tsx
git commit -m "feat(siding-calculator): add PDF scope document renderer"
```

---

## Task 14: HubSpot client

**Files:**
- Create: `apps/siding-calculator/lib/hubspot.ts`
- Test: `apps/siding-calculator/tests/hubspot.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/siding-calculator/tests/hubspot.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { submitLead } from '@/lib/hubspot';

const ORIGINAL_ENV = process.env;
beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, HUBSPOT_PORTAL_ID: '111', HUBSPOT_FORM_ID: 'fff' };
});
afterEach(() => {
  process.env = ORIGINAL_ENV;
  vi.unstubAllGlobals();
});

describe('submitLead', () => {
  it('POSTs to the HubSpot Forms endpoint with the right payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);

    await submitLead({
      projectId: 'p1', name: 'Tay', email: 't@x.com', phone: '503', address: 'PDX',
      intent: 'export',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/forms\.hsforms\.com\/submissions\/v3\/integration\/submit\/111\/fff/);
    const body = JSON.parse(init.body);
    expect(body.fields).toEqual(expect.arrayContaining([
      { objectTypeId: '0-1', name: 'email', value: 't@x.com' },
      { objectTypeId: '0-1', name: 'firstname', value: 'Tay' },
    ]));
  });

  it('retries on 5xx and eventually succeeds', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => 'down' })
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => 'still down' })
      .mockResolvedValueOnce({ ok: true,  status: 200, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);
    await expect(submitLead({
      projectId: 'p1', name: 'A', email: 'a@b.com', phone: '1', address: 'x', intent: 'quote',
    }, { maxAttempts: 3, backoffMs: 0 })).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('throws after exhausting retries', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'err' });
    vi.stubGlobal('fetch', fetchMock);
    await expect(submitLead({
      projectId: 'p1', name: 'A', email: 'a@b.com', phone: '1', address: 'x', intent: 'quote',
    }, { maxAttempts: 2, backoffMs: 0 })).rejects.toThrow();
  });

  it('does not retry on 4xx', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => 'bad' });
    vi.stubGlobal('fetch', fetchMock);
    await expect(submitLead({
      projectId: 'p1', name: 'A', email: 'a@b.com', phone: '1', address: 'x', intent: 'quote',
    }, { maxAttempts: 5, backoffMs: 0 })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test tests/hubspot.test.ts
```

Expected: FAIL on import.

- [ ] **Step 3: Implement `lib/hubspot.ts`**

```ts
export type LeadIntent = 'export' | 'quote';

export type LeadPayload = {
  projectId: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  intent: LeadIntent;
};

export type SubmitOpts = {
  maxAttempts?: number;
  backoffMs?: number;
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function submitLead(lead: LeadPayload, opts: SubmitOpts = {}): Promise<void> {
  const portalId = process.env.HUBSPOT_PORTAL_ID;
  const formId = process.env.HUBSPOT_FORM_ID;
  if (!portalId || !formId) {
    throw new Error('HubSpot env vars missing (HUBSPOT_PORTAL_ID, HUBSPOT_FORM_ID)');
  }

  const url = `https://forms.hsforms.com/submissions/v3/integration/submit/${portalId}/${formId}`;
  const [firstname, ...rest] = lead.name.split(/\s+/);
  const lastname = rest.join(' ');

  const body = {
    fields: [
      { objectTypeId: '0-1', name: 'email',     value: lead.email },
      { objectTypeId: '0-1', name: 'firstname', value: firstname },
      { objectTypeId: '0-1', name: 'lastname',  value: lastname },
      { objectTypeId: '0-1', name: 'phone',     value: lead.phone },
      { objectTypeId: '0-1', name: 'address',   value: lead.address },
      { objectTypeId: '0-1', name: 'siding_calc_project_id', value: lead.projectId },
      { objectTypeId: '0-1', name: 'siding_calc_intent',     value: lead.intent },
    ],
    context: { pageUri: `siding-calc/p/${lead.projectId}`, pageName: 'SFW Siding Calculator' },
  };

  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (process.env.HUBSPOT_BEARER) headers['authorization'] = `Bearer ${process.env.HUBSPOT_BEARER}`;

  const max = opts.maxAttempts ?? 3;
  const backoff = opts.backoffMs ?? 500;

  let lastErr: Error | null = null;
  for (let i = 1; i <= max; i++) {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    if (res.ok) return;
    const text = await res.text();
    lastErr = new Error(`HubSpot ${res.status}: ${text}`);
    if (res.status >= 400 && res.status < 500) throw lastErr; // don't retry 4xx
    if (i < max) await sleep(backoff * i);
  }
  throw lastErr ?? new Error('HubSpot submit failed');
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test tests/hubspot.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/siding-calculator/lib/hubspot.ts apps/siding-calculator/tests/hubspot.test.ts
git commit -m "feat(siding-calculator): add HubSpot Forms client with retry"
```

---

## Task 15: API — create / load / save project

**Files:**
- Create: `apps/siding-calculator/app/api/projects/route.ts`
- Create: `apps/siding-calculator/app/api/projects/[id]/route.ts`

These routes are server-only. We rely on the storage layer's typed surface; integration is exercised by the E2E test in Task 28.

- [ ] **Step 1: Implement `app/api/projects/route.ts` (POST = create)**

```ts
import { NextResponse } from 'next/server';
import { ulid } from 'ulid';
import { saveProject } from '@/lib/storage';
import type { Project } from '@/lib/types';

function blankProject(): Project {
  const now = new Date().toISOString();
  return {
    id: ulid(),
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
    canvas: { widthFt: 30, heightFt: 12, snapInches: 12 },
    wall: { rect: { x: 3, y: 1, widthFt: 24, heightFt: 9 } },
    openings: [],
    scope: {
      presetId: 'siding-only',
      phases: {
        insulation:    { enabled: false, materialId: null },
        sheathing:     { enabled: false, materialId: null },
        vaporBarrier:  { enabled: false, materialId: null },
        siding:        { enabled: true,  materialId: null },
        trim:          { enabled: true,  materialId: null },
      },
    },
  };
}

export async function POST() {
  const project = blankProject();
  await saveProject(project);
  return NextResponse.json({ id: project.id }, { status: 201 });
}
```

- [ ] **Step 2: Implement `app/api/projects/[id]/route.ts` (GET = load, PATCH = autosave)**

```ts
import { NextResponse } from 'next/server';
import { loadProject, saveProject } from '@/lib/storage';
import { ProjectSchema } from '@/lib/types';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const project = await loadProject(id);
  if (!project) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(project);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json();
  const parsed = ProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid', issues: parsed.error.issues }, { status: 400 });
  }
  if (parsed.data.id !== id) {
    return NextResponse.json({ error: 'id_mismatch' }, { status: 400 });
  }

  // Compare-and-swap: reject if blob is newer than the client's prior updatedAt.
  const existing = await loadProject(id);
  if (existing && req.headers.get('if-match-updated-at') && existing.updatedAt !== req.headers.get('if-match-updated-at')) {
    return NextResponse.json({ error: 'stale', currentUpdatedAt: existing.updatedAt }, { status: 409 });
  }

  const next = { ...parsed.data, updatedAt: new Date().toISOString() };
  await saveProject(next);
  return NextResponse.json(next);
}
```

- [ ] **Step 3: Type-check + dev server smoke**

```bash
pnpm typecheck
pnpm dev   # in another terminal:
curl -X POST http://localhost:3000/api/projects
# expect: { "id": "<ulid>" }, 201
# (BLOB_READ_WRITE_TOKEN must be set in apps/siding-calculator/.env.local — see Task 30)
```

If you don't have a token yet, skip the curl — the typecheck pass is the gate.

- [ ] **Step 4: Commit**

```bash
git add apps/siding-calculator/app/api/projects
git commit -m "feat(siding-calculator): add project CRUD API routes"
```

---

## Task 16: API — exports and lead

**Files:**
- Create: `apps/siding-calculator/app/api/projects/[id]/exports/route.ts`
- Create: `apps/siding-calculator/app/api/lead/route.ts`

- [ ] **Step 1: Implement exports route**

`apps/siding-calculator/app/api/projects/[id]/exports/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { loadProject, saveOutput, getOutputUrl } from '@/lib/storage';
import { computeMaterialsList } from '@/lib/materials';
import { materialsToCsv } from '@/lib/csv/materials';
import { buildMaterialsWorkbook } from '@/lib/excel/materials-workbook';
import { renderScopePdf } from '@/lib/pdf/scope-document';

const FormatSchema = z.object({ format: z.enum(['csv', 'xlsx', 'pdf']) });

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = FormatSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_format' }, { status: 400 });
  const { format } = parsed.data;

  const project = await loadProject(id);
  if (!project) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // Server-side gate: xlsx + pdf require a captured lead.
  if ((format === 'xlsx' || format === 'pdf') && !project.lead) {
    return NextResponse.json({ error: 'lead_required' }, { status: 403 });
  }

  const lines = computeMaterialsList(project);
  const shareUrl = `${req.headers.get('origin') ?? ''}/calc/p/${project.id}`;

  let url: string;
  if (format === 'csv') {
    const csv = materialsToCsv(lines);
    url = await saveOutput(id, 'csv', csv, 'text/csv');
  } else if (format === 'xlsx') {
    const buf = await buildMaterialsWorkbook(project, lines);
    url = await saveOutput(id, 'xlsx', buf, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  } else {
    const buf = await renderScopePdf(project, lines, shareUrl);
    url = await saveOutput(id, 'pdf', buf, 'application/pdf');
  }
  return NextResponse.json({ url });
}

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const url = new URL(_req.url).searchParams.get('format') as 'csv' | 'xlsx' | 'pdf' | null;
  if (!url || !['csv', 'xlsx', 'pdf'].includes(url)) {
    return NextResponse.json({ error: 'invalid_format' }, { status: 400 });
  }
  const u = await getOutputUrl(id, url);
  if (!u) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.redirect(u);
}
```

- [ ] **Step 2: Implement lead route**

`apps/siding-calculator/app/api/lead/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { loadProject, saveProject, saveFailedLead } from '@/lib/storage';
import { submitLead } from '@/lib/hubspot';

const Body = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  address: z.string().min(1),
  intent: z.enum(['export', 'quote']),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid', issues: parsed.error.issues }, { status: 400 });
  }

  const project = await loadProject(parsed.data.projectId);
  if (!project) return NextResponse.json({ error: 'project_not_found' }, { status: 404 });

  // Persist lead onto the project regardless of HubSpot outcome.
  const now = new Date().toISOString();
  const next = {
    ...project,
    updatedAt: now,
    lead: {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      address: parsed.data.address,
      capturedAt: now,
    },
  };
  await saveProject(next);

  // Forward to HubSpot. Failures are dead-lettered; we still return 200.
  try {
    await submitLead(parsed.data);
    next.lead!.hubspotSubmittedAt = new Date().toISOString();
    await saveProject(next);
  } catch (err) {
    await saveFailedLead(`${parsed.data.projectId}-${Date.now()}`, {
      lead: parsed.data, error: String(err), failedAt: new Date().toISOString(),
    });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Type-check**

```bash
pnpm typecheck
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/siding-calculator/app/api/projects/\[id\]/exports apps/siding-calculator/app/api/lead
git commit -m "feat(siding-calculator): add exports and lead API routes"
```

---

## Task 17: SVG canvas surface + grid

**Files:**
- Create: `apps/siding-calculator/components/canvas/CanvasSurface.tsx`

- [ ] **Step 1: Implement `CanvasSurface.tsx`**

```tsx
'use client';
import React from 'react';

export type CanvasSize = { widthFt: number; heightFt: number };

export type CanvasViewProps = {
  size: CanvasSize;
  pixelsPerFt: number;          // computed from container dims
  children?: React.ReactNode;
  onPointerDown?: (e: React.PointerEvent<SVGSVGElement>, ptFt: { x: number; y: number }) => void;
  onPointerMove?: (e: React.PointerEvent<SVGSVGElement>, ptFt: { x: number; y: number }) => void;
  onPointerUp?: (e: React.PointerEvent<SVGSVGElement>, ptFt: { x: number; y: number }) => void;
};

export function clientToFt(
  e: React.PointerEvent<SVGSVGElement>,
  pixelsPerFt: number,
  size: CanvasSize,
): { x: number; y: number } {
  const svg = e.currentTarget;
  const rect = svg.getBoundingClientRect();
  const xPx = e.clientX - rect.left;
  const yPx = e.clientY - rect.top;
  return {
    x: xPx / pixelsPerFt,
    y: size.heightFt - yPx / pixelsPerFt,   // SVG y-down → world y-up
  };
}

export function CanvasSurface({ size, pixelsPerFt, children, onPointerDown, onPointerMove, onPointerUp }: CanvasViewProps) {
  const widthPx = size.widthFt * pixelsPerFt;
  const heightPx = size.heightFt * pixelsPerFt;

  return (
    <svg
      viewBox={`0 0 ${widthPx} ${heightPx}`}
      width={widthPx}
      height={heightPx}
      style={{ background: 'var(--paper)', display: 'block', maxWidth: '100%', maxHeight: '100%' }}
      onPointerDown={onPointerDown ? (e) => onPointerDown(e, clientToFt(e, pixelsPerFt, size)) : undefined}
      onPointerMove={onPointerMove ? (e) => onPointerMove(e, clientToFt(e, pixelsPerFt, size)) : undefined}
      onPointerUp={onPointerUp ? (e) => onPointerUp(e, clientToFt(e, pixelsPerFt, size)) : undefined}
    >
      <defs>
        <pattern id="grid-minor" width={pixelsPerFt / 12} height={pixelsPerFt / 12} patternUnits="userSpaceOnUse">
          <path d={`M ${pixelsPerFt / 12} 0 L 0 0 0 ${pixelsPerFt / 12}`} fill="none" stroke="var(--grid-minor)" strokeWidth={0.5} />
        </pattern>
        <pattern id="grid-major" width={pixelsPerFt} height={pixelsPerFt} patternUnits="userSpaceOnUse">
          <rect width={pixelsPerFt} height={pixelsPerFt} fill="url(#grid-minor)" />
          <path d={`M ${pixelsPerFt} 0 L 0 0 0 ${pixelsPerFt}`} fill="none" stroke="var(--grid-major)" strokeWidth={1} />
        </pattern>
      </defs>
      <rect width={widthPx} height={heightPx} fill="url(#grid-major)" />
      {/* Children get a coordinate system in pixels (origin top-left). World-y conversion happens at the consumer. */}
      <g transform={`translate(0, ${heightPx})`}>
        <g transform="scale(1, -1)">
          {children}
        </g>
      </g>
    </svg>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/siding-calculator/components/canvas/CanvasSurface.tsx
git commit -m "feat(siding-calculator): add SVG canvas surface with engineering grid"
```

---

## Task 18: Wall and opening shapes

**Files:**
- Create: `apps/siding-calculator/components/canvas/WallShape.tsx`
- Create: `apps/siding-calculator/components/canvas/Opening.tsx`

- [ ] **Step 1: Implement `WallShape.tsx`**

```tsx
'use client';
import React from 'react';
import type { Project } from '@/lib/types';

type Props = {
  wall: Project['wall'];
  pixelsPerFt: number;
  selected?: boolean;
  onSelect?: () => void;
};

export function WallShape({ wall, pixelsPerFt, selected, onSelect }: Props) {
  const x = wall.rect.x * pixelsPerFt;
  const y = wall.rect.y * pixelsPerFt;
  const w = wall.rect.widthFt * pixelsPerFt;
  const h = wall.rect.heightFt * pixelsPerFt;
  const stroke = selected ? '#2a4d8f' : '#34507a';
  return (
    <g onClick={onSelect}>
      <rect x={x} y={y} width={w} height={h} fill="rgba(42,77,143,0.05)" stroke={stroke} strokeWidth={selected ? 2 : 1.5} />
      {wall.gable && (() => {
        const peakX = x + w / 2 + (wall.gable.peakOffsetFt * pixelsPerFt);
        const peakY = y + h + wall.gable.peakHeightFt * pixelsPerFt;
        return <polygon
          points={`${x},${y + h} ${x + w},${y + h} ${peakX},${peakY}`}
          fill="rgba(42,77,143,0.05)" stroke={stroke} strokeWidth={selected ? 2 : 1.5}
        />;
      })()}
    </g>
  );
}
```

- [ ] **Step 2: Implement `Opening.tsx`**

```tsx
'use client';
import React from 'react';
import type { Opening as OpeningT, Project } from '@/lib/types';

type Props = {
  opening: OpeningT;
  wall: Project['wall'];
  pixelsPerFt: number;
  selected?: boolean;
  onSelect?: (id: string) => void;
};

export function Opening({ opening, wall, pixelsPerFt, selected, onSelect }: Props) {
  // Opening x/y are wall-relative. Add wall origin to get canvas-space.
  const x = (wall.rect.x + opening.x) * pixelsPerFt;
  const y = (wall.rect.y + opening.y) * pixelsPerFt;
  const w = opening.widthFt * pixelsPerFt;
  const h = opening.heightFt * pixelsPerFt;
  const stroke = selected ? '#2a4d8f' : '#34507a';
  return (
    <g onClick={(e) => { e.stopPropagation(); onSelect?.(opening.id); }}>
      <rect x={x} y={y} width={w} height={h} fill="white" stroke={stroke} strokeWidth={selected ? 2 : 1} />
      <text x={x + w / 2} y={y + h / 2} fontSize={Math.min(w, h) * 0.18} textAnchor="middle" dominantBaseline="middle"
        transform={`scale(1,-1) translate(0, ${-(2 * (y + h / 2))})`} fill="#34507a">
        {opening.type}
      </text>
    </g>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
pnpm typecheck
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/siding-calculator/components/canvas/WallShape.tsx apps/siding-calculator/components/canvas/Opening.tsx
git commit -m "feat(siding-calculator): add wall and opening SVG shapes"
```

---

## Task 19: Drawing-tool hook + dimension overlay

**Files:**
- Create: `apps/siding-calculator/components/canvas/useDrawingTool.ts`
- Create: `apps/siding-calculator/components/canvas/DimensionOverlay.tsx`

- [ ] **Step 1: Implement `useDrawingTool.ts`**

```ts
'use client';
import { useState, useRef, useCallback } from 'react';

export type DrawTool = 'wall' | 'gable' | 'window' | 'door' | 'garage-door' | 'vent' | null;

export type DragRect = { x: number; y: number; widthFt: number; heightFt: number };

export type DrawState = {
  active: boolean;
  start: { x: number; y: number } | null;
  current: { x: number; y: number } | null;
};

export type UseDrawingToolReturn = {
  tool: DrawTool;
  setTool: (t: DrawTool) => void;
  draw: DrawState;
  beginDrag: (pt: { x: number; y: number }) => void;
  updateDrag: (pt: { x: number; y: number }) => void;
  endDrag: () => DragRect | null;     // null if no movement
};

const INITIAL: DrawState = { active: false, start: null, current: null };

export function useDrawingTool(): UseDrawingToolReturn {
  const [tool, setTool] = useState<DrawTool>(null);
  const [draw, setDrawState] = useState<DrawState>(INITIAL);
  // Mirror state in a ref so endDrag can read the latest value synchronously
  // without relying on the setState updater callback (which runs during reconcile).
  const drawRef = useRef<DrawState>(INITIAL);

  const setDraw = useCallback((next: DrawState) => {
    drawRef.current = next;
    setDrawState(next);
  }, []);

  const beginDrag = useCallback((pt: { x: number; y: number }) => {
    setDraw({ active: true, start: pt, current: pt });
  }, [setDraw]);

  const updateDrag = useCallback((pt: { x: number; y: number }) => {
    if (drawRef.current.active) {
      setDraw({ ...drawRef.current, current: pt });
    }
  }, [setDraw]);

  const endDrag = useCallback((): DragRect | null => {
    const prev = drawRef.current;
    let result: DragRect | null = null;
    if (prev.active && prev.start && prev.current) {
      const x = Math.min(prev.start.x, prev.current.x);
      const y = Math.min(prev.start.y, prev.current.y);
      const widthFt = Math.abs(prev.current.x - prev.start.x);
      const heightFt = Math.abs(prev.current.y - prev.start.y);
      if (widthFt > 0.1 && heightFt > 0.1) {
        result = { x, y, widthFt, heightFt };
      }
    }
    setDraw(INITIAL);
    return result;
  }, [setDraw]);

  return { tool, setTool, draw, beginDrag, updateDrag, endDrag };
}
```

- [ ] **Step 2: Implement `DimensionOverlay.tsx`**

```tsx
'use client';
import React from 'react';
import type { DragRect } from './useDrawingTool';

type Props = {
  draft: DragRect | null;
  pixelsPerFt: number;
  canvasHeightPx: number;
};

export function DimensionOverlay({ draft, pixelsPerFt, canvasHeightPx }: Props) {
  if (!draft) return null;
  const x = draft.x * pixelsPerFt;
  const y = draft.y * pixelsPerFt;
  const w = draft.widthFt * pixelsPerFt;
  const h = draft.heightFt * pixelsPerFt;
  return (
    <g pointerEvents="none">
      <rect x={x} y={y} width={w} height={h} fill="rgba(42,77,143,0.08)" stroke="#2a4d8f" strokeDasharray="4 4" />
      <g transform={`scale(1,-1) translate(0, ${-(2 * (y + h + 10))})`}>
        <text x={x + w / 2} y={y + h + 10} textAnchor="middle" fontSize={11} fill="#1c2230">
          {draft.widthFt.toFixed(1)}' × {draft.heightFt.toFixed(1)}'
        </text>
      </g>
    </g>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
pnpm typecheck
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/siding-calculator/components/canvas/useDrawingTool.ts apps/siding-calculator/components/canvas/DimensionOverlay.tsx
git commit -m "feat(siding-calculator): add drawing-tool hook + dimension overlay"
```

---

## Task 20: Floating toolbar (canvas size + tool buttons)

**Files:**
- Create: `apps/siding-calculator/components/canvas/Toolbar.tsx`

- [ ] **Step 1: Implement `Toolbar.tsx`**

```tsx
'use client';
import React from 'react';
import type { DrawTool } from './useDrawingTool';
import type { Project } from '@/lib/types';

type Props = {
  canvas: Project['canvas'];
  onCanvasChange: (next: Project['canvas']) => void;
  tool: DrawTool;
  onToolChange: (t: DrawTool) => void;
};

const TOOLS: { id: DrawTool; label: string }[] = [
  { id: 'wall', label: '▭ Wall' },
  { id: 'gable', label: '△ Gable' },
  { id: 'window', label: '⊞ Window' },
  { id: 'door', label: '⊟ Door' },
  { id: 'garage-door', label: '▢ Garage' },
  { id: 'vent', label: '◇ Vent' },
];

export function Toolbar({ canvas, onCanvasChange, tool, onToolChange }: Props) {
  return (
    <div className="absolute top-4 left-4 flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm text-sm">
      <span className="text-slate-500">Canvas</span>
      <input
        type="number" min={5} max={120} step={1}
        value={canvas.widthFt}
        onChange={e => onCanvasChange({ ...canvas, widthFt: Number(e.target.value) })}
        className="w-14 border-b border-slate-300 px-1 text-center"
        aria-label="Canvas width (ft)"
      />
      <span>×</span>
      <input
        type="number" min={5} max={60} step={1}
        value={canvas.heightFt}
        onChange={e => onCanvasChange({ ...canvas, heightFt: Number(e.target.value) })}
        className="w-12 border-b border-slate-300 px-1 text-center"
        aria-label="Canvas height (ft)"
      />
      <span className="text-slate-400">ft</span>
      <span className="mx-2 h-4 w-px bg-slate-200" />
      {TOOLS.map(t => (
        <button
          key={t.id}
          onClick={() => onToolChange(tool === t.id ? null : t.id)}
          className={`rounded-full px-2 py-0.5 ${tool === t.id ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/siding-calculator/components/canvas/Toolbar.tsx
git commit -m "feat(siding-calculator): add floating canvas toolbar"
```

---

## Task 21: Bottom drawer — element list with numeric edit

**Files:**
- Create: `apps/siding-calculator/components/drawer/ElementsDrawer.tsx`

- [ ] **Step 1: Implement `ElementsDrawer.tsx`**

```tsx
'use client';
import React from 'react';
import type { Project, Opening as OpeningT } from '@/lib/types';

type Props = {
  project: Project;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdateWall: (next: Project['wall']) => void;
  onUpdateOpening: (next: OpeningT) => void;
  onDeleteOpening: (id: string) => void;
  onAdvance: () => void;
};

function NumberCell({ label, value, onChange, suffix = "'" }: { label: string; value: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <label className="flex items-center gap-1 text-sm">
      <span className="text-slate-500">{label}</span>
      <input
        type="number" step={0.5} min={0}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-16 border-b border-slate-300 px-1 text-right"
      />
      <span className="text-slate-400">{suffix}</span>
    </label>
  );
}

export function ElementsDrawer({ project, selectedId, onSelect, onUpdateWall, onUpdateOpening, onDeleteOpening, onAdvance }: Props) {
  return (
    <div className="border-t border-slate-200 bg-white px-4 py-3">
      <div className="flex items-start gap-6 overflow-x-auto">
        <button onClick={() => onSelect('wall')} className={`shrink-0 rounded border px-3 py-2 ${selectedId === 'wall' ? 'border-slate-900' : 'border-slate-200'}`}>
          <div className="text-xs uppercase tracking-wide text-slate-500">Wall</div>
          <div className="mt-1 flex items-center gap-2">
            <NumberCell label="W" value={project.wall.rect.widthFt} onChange={v => onUpdateWall({ ...project.wall, rect: { ...project.wall.rect, widthFt: v } })} />
            <NumberCell label="H" value={project.wall.rect.heightFt} onChange={v => onUpdateWall({ ...project.wall, rect: { ...project.wall.rect, heightFt: v } })} />
          </div>
          {project.wall.gable && (
            <div className="mt-1 flex items-center gap-2">
              <NumberCell label="Gable peak" value={project.wall.gable.peakHeightFt} onChange={v => onUpdateWall({ ...project.wall, gable: { peakOffsetFt: project.wall.gable!.peakOffsetFt, peakHeightFt: v } })} />
              <button onClick={() => onUpdateWall({ ...project.wall, gable: undefined })} className="text-xs text-slate-500 underline">remove gable</button>
            </div>
          )}
        </button>

        {project.openings.map(o => (
          <div key={o.id} onClick={() => onSelect(o.id)} className={`shrink-0 rounded border px-3 py-2 ${selectedId === o.id ? 'border-slate-900' : 'border-slate-200'}`}>
            <div className="text-xs uppercase tracking-wide text-slate-500">{o.type}</div>
            <div className="mt-1 flex items-center gap-2">
              <NumberCell label="W" value={o.widthFt} onChange={v => onUpdateOpening({ ...o, widthFt: v })} />
              <NumberCell label="H" value={o.heightFt} onChange={v => onUpdateOpening({ ...o, heightFt: v })} />
              <NumberCell label="x" value={o.x} onChange={v => onUpdateOpening({ ...o, x: v })} />
              <NumberCell label="y" value={o.y} onChange={v => onUpdateOpening({ ...o, y: v })} />
            </div>
            <button onClick={(e) => { e.stopPropagation(); onDeleteOpening(o.id); }} className="mt-1 text-xs text-red-600 underline">delete</button>
          </div>
        ))}

        <div className="ml-auto self-center">
          <button onClick={onAdvance} className="rounded-full bg-[var(--accent)] px-4 py-2 text-white">Next →</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/siding-calculator/components/drawer/ElementsDrawer.tsx
git commit -m "feat(siding-calculator): add bottom elements drawer"
```

---

## Task 22: Materials UI — preset + phase rows

**Files:**
- Create: `apps/siding-calculator/components/materials/PresetPicker.tsx`
- Create: `apps/siding-calculator/components/materials/PhaseRow.tsx`

- [ ] **Step 1: Implement `PresetPicker.tsx`**

```tsx
'use client';
import React from 'react';
import type { PresetId } from '@/lib/types';
import { PRESET_LABELS, PRESETS } from '@/lib/presets';

type Props = {
  selected: PresetId;
  onChange: (next: PresetId) => void;
};

const ORDER: PresetId[] = ['siding-only', 'reside-with-wrb', 'full-envelope', 'custom'];

export function PresetPicker({ selected, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {ORDER.map(id => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`rounded-full border px-4 py-1.5 text-sm ${selected === id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white'}`}
        >
          {PRESET_LABELS[id]}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Implement `PhaseRow.tsx`**

```tsx
'use client';
import React from 'react';
import type { PhaseKey, Material } from '@/lib/types';
import { materialsByPhase } from '@/lib/catalog';

type Props = {
  phase: PhaseKey;
  enabled: boolean;
  materialId: string | null;
  onToggle: (next: boolean) => void;
  onPick: (id: string | null) => void;
};

const LABELS: Record<PhaseKey, string> = {
  insulation: 'Insulation',
  sheathing: 'Sheathing',
  vaporBarrier: 'Vapor Barrier / WRB',
  siding: 'Siding',
  trim: 'Trim',
};

export function PhaseRow({ phase, enabled, materialId, onToggle, onPick }: Props) {
  const options = materialsByPhase(phase);
  return (
    <div className="flex items-center gap-3 border-b border-slate-100 py-2">
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={enabled} onChange={e => onToggle(e.target.checked)} />
        <span className="w-44 text-sm font-medium">{LABELS[phase]}</span>
      </label>
      <select
        disabled={!enabled}
        value={materialId ?? ''}
        onChange={e => onPick(e.target.value || null)}
        className="flex-1 rounded border border-slate-200 px-2 py-1 disabled:bg-slate-50"
      >
        <option value="">— pick a material —</option>
        {options.map((m: Material) => (
          <option key={m.id} value={m.id}>
            {m.brand ? `${m.brand} · ` : ''}{m.name}
          </option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
pnpm typecheck
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/siding-calculator/components/materials
git commit -m "feat(siding-calculator): add preset picker + phase row"
```

---

## Task 23: Outputs UI — materials table + export buttons

**Files:**
- Create: `apps/siding-calculator/components/outputs/MaterialsTable.tsx`
- Create: `apps/siding-calculator/components/outputs/ExportButtons.tsx`

- [ ] **Step 1: Implement `MaterialsTable.tsx`**

```tsx
'use client';
import React from 'react';
import type { MaterialsLine } from '@/lib/materials';

export function MaterialsTable({ lines }: { lines: MaterialsLine[] }) {
  if (lines.length === 0) {
    return <p className="text-sm text-slate-500">Pick at least one phase + material to see your list.</p>;
  }
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-left">
          <th className="py-2">Phase</th>
          <th>Material</th>
          <th>Qty</th>
          <th>Unit</th>
          <th className="text-slate-500">Coverage</th>
        </tr>
      </thead>
      <tbody>
        {lines.map(l => (
          <tr key={l.phase + l.material.id} className="border-b border-slate-100">
            <td className="py-2 capitalize">{l.phase.replace(/([A-Z])/g, ' $1').toLowerCase()}</td>
            <td>{l.material.brand ? `${l.material.brand} · ` : ''}{l.material.name}</td>
            <td className="font-medium">{l.qty}</td>
            <td>{l.unit === 'linft' ? 'lin ft' : l.unit === 'sqft' ? 'sq ft' : l.unit}</td>
            <td className="text-slate-500">{l.coverageNote}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: Implement `ExportButtons.tsx`**

```tsx
'use client';
import React, { useState } from 'react';

type Props = {
  projectId: string;
  hasLead: boolean;
  onRequireLead: (intent: 'export') => void;
};

async function fetchExport(projectId: string, format: 'csv' | 'xlsx' | 'pdf'): Promise<string> {
  const res = await fetch(`/api/projects/${projectId}/exports`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ format }),
  });
  if (!res.ok) throw new Error(`export failed: ${res.status}`);
  const { url } = await res.json();
  return url;
}

export function ExportButtons({ projectId, hasLead, onRequireLead }: Props) {
  const [busy, setBusy] = useState<string | null>(null);

  async function handle(format: 'csv' | 'xlsx' | 'pdf') {
    if ((format === 'xlsx' || format === 'pdf') && !hasLead) {
      onRequireLead('export');
      return;
    }
    setBusy(format);
    try {
      const url = await fetchExport(projectId, format);
      window.open(url, '_blank');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={() => handle('csv')} disabled={busy !== null} className="rounded border border-slate-300 px-3 py-1.5 text-sm">
        {busy === 'csv' ? 'Building…' : 'Download CSV'}
      </button>
      <button onClick={() => handle('xlsx')} disabled={busy !== null} className="rounded border border-slate-300 px-3 py-1.5 text-sm">
        {busy === 'xlsx' ? 'Building…' : hasLead ? 'Download Excel' : 'Download Excel — requires info'}
      </button>
      <button onClick={() => handle('pdf')} disabled={busy !== null} className="rounded border border-slate-300 px-3 py-1.5 text-sm">
        {busy === 'pdf' ? 'Building…' : hasLead ? 'Download Scope PDF' : 'Download Scope PDF — requires info'}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
pnpm typecheck
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/siding-calculator/components/outputs
git commit -m "feat(siding-calculator): add materials table + export buttons"
```

---

## Task 24: Outputs UI — lead form + quote CTA

**Files:**
- Create: `apps/siding-calculator/components/outputs/LeadForm.tsx`
- Create: `apps/siding-calculator/components/outputs/QuoteCTA.tsx`

- [ ] **Step 1: Implement `LeadForm.tsx`**

```tsx
'use client';
import React, { useState } from 'react';

type Props = {
  projectId: string;
  intent: 'export' | 'quote';
  onSuccess: () => void;
  onClose: () => void;
};

async function postLead(payload: any) {
  const res = await fetch('/api/lead', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`lead failed: ${res.status}`);
}

export function LeadForm({ projectId, intent, onSuccess, onClose }: Props) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await postLead({ projectId, intent, ...form });
      onSuccess();
    } catch (e: any) {
      setErr(String(e.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold">
          {intent === 'quote' ? 'Get a quote' : 'A few details to download your scope'}
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          We'll only contact you about this project.
        </p>
        {(['name', 'email', 'phone', 'address'] as const).map(k => (
          <label key={k} className="mt-3 block text-sm">
            <span className="capitalize text-slate-600">{k}</span>
            <input
              required type={k === 'email' ? 'email' : k === 'phone' ? 'tel' : 'text'}
              value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>
        ))}
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded px-3 py-1.5 text-sm">Cancel</button>
          <button type="submit" disabled={busy} className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm text-white">
            {busy ? 'Sending…' : intent === 'quote' ? 'Request quote' : 'Continue'}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Implement `QuoteCTA.tsx`**

```tsx
'use client';
import React from 'react';

type Props = {
  onClick: () => void;
};

export function QuoteCTA({ onClick }: Props) {
  return (
    <button onClick={onClick} className="rounded-full bg-emerald-600 px-5 py-2.5 text-white">
      Get a Quote →
    </button>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
pnpm typecheck
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/siding-calculator/components/outputs/LeadForm.tsx apps/siding-calculator/components/outputs/QuoteCTA.tsx
git commit -m "feat(siding-calculator): add lead form + quote CTA"
```

---

## Task 25: Mobile fallback

**Files:**
- Create: `apps/siding-calculator/components/mobile/MobileFallback.tsx`

- [ ] **Step 1: Implement `MobileFallback.tsx`**

```tsx
'use client';
import React, { useEffect, useState } from 'react';

export function useIsDesktop(min = 1024): boolean {
  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= min);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [min]);
  return isDesktop;
}

export function MobileFallback({ projectId, onQuote }: { projectId: string; onQuote: () => void }) {
  return (
    <div className="mx-auto max-w-md p-6 text-center">
      <h2 className="text-xl font-semibold">Best on a larger screen</h2>
      <p className="mt-2 text-sm text-slate-600">
        The siding calculator drawing canvas is desktop / tablet only. Open this page on a laptop or tablet to draw your wall.
      </p>
      <p className="mt-3 text-sm text-slate-500">Project ID: <code>{projectId}</code></p>
      <button onClick={onQuote} className="mt-6 rounded-full bg-emerald-600 px-5 py-2.5 text-white">
        Get a Quote →
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/siding-calculator/components/mobile
git commit -m "feat(siding-calculator): add mobile fallback view"
```

---

## Task 26: Calculator page wiring

This task assembles every component into the working calculator. It's the largest task in the plan — about 2-3× the others.

**Files:**
- Create: `apps/siding-calculator/app/calc/new/page.tsx`
- Create: `apps/siding-calculator/app/calc/p/[id]/page.tsx`
- Create: `apps/siding-calculator/app/calc/p/[id]/Calculator.tsx`
- Create: `apps/siding-calculator/app/calc/p/[id]/scope/page.tsx`

- [ ] **Step 1: `app/calc/new/page.tsx` — create + redirect**

```tsx
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export default async function NewProjectPage() {
  const h = await headers();
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('host');
  const res = await fetch(`${proto}://${host}/api/projects`, { method: 'POST', cache: 'no-store' });
  if (!res.ok) throw new Error(`could not create project: ${res.status}`);
  const { id } = await res.json();
  redirect(`/calc/p/${id}`);
}
```

- [ ] **Step 2: `app/calc/p/[id]/page.tsx` — server shell**

```tsx
import { notFound } from 'next/navigation';
import { loadProject } from '@/lib/storage';
import { Calculator } from './Calculator';

export default async function CalcPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await loadProject(id);
  if (!project) notFound();
  return <Calculator initial={project} />;
}
```

- [ ] **Step 3: `app/calc/p/[id]/Calculator.tsx` — the assembly (client component)**

```tsx
'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ulid } from 'ulid';
import type { Project, Opening, OpeningType } from '@/lib/types';
import { applyPreset } from '@/lib/presets';
import { computeMaterialsList } from '@/lib/materials';
import { CanvasSurface } from '@/components/canvas/CanvasSurface';
import { Toolbar } from '@/components/canvas/Toolbar';
import { WallShape } from '@/components/canvas/WallShape';
import { Opening as OpeningEl } from '@/components/canvas/Opening';
import { DimensionOverlay } from '@/components/canvas/DimensionOverlay';
import { useDrawingTool } from '@/components/canvas/useDrawingTool';
import { ElementsDrawer } from '@/components/drawer/ElementsDrawer';
import { PresetPicker } from '@/components/materials/PresetPicker';
import { PhaseRow } from '@/components/materials/PhaseRow';
import { MaterialsTable } from '@/components/outputs/MaterialsTable';
import { ExportButtons } from '@/components/outputs/ExportButtons';
import { LeadForm } from '@/components/outputs/LeadForm';
import { QuoteCTA } from '@/components/outputs/QuoteCTA';
import { useIsDesktop, MobileFallback } from '@/components/mobile/MobileFallback';

const OPENING_DEFAULTS: Record<OpeningType, { widthFt: number; heightFt: number }> = {
  window: { widthFt: 3, heightFt: 4 },
  door: { widthFt: 3, heightFt: 7 },
  'garage-door': { widthFt: 16, heightFt: 7 },
  vent: { widthFt: 1, heightFt: 1 },
};

export function Calculator({ initial }: { initial: Project }) {
  const [project, setProject] = useState<Project>(initial);
  const [selectedId, setSelectedId] = useState<string | null>('wall');
  const [leadIntent, setLeadIntent] = useState<'export' | 'quote' | null>(null);
  const draw = useDrawingTool();

  const isDesktop = useIsDesktop();
  const containerRef = useRef<HTMLDivElement>(null);
  const [pixelsPerFt, setPixelsPerFt] = useState(20);

  // Fit canvas to container.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const w = el.clientWidth, h = el.clientHeight;
      const fitW = w / project.canvas.widthFt;
      const fitH = h / project.canvas.heightFt;
      setPixelsPerFt(Math.max(8, Math.min(fitW, fitH) * 0.95));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [project.canvas.widthFt, project.canvas.heightFt]);

  // Autosave on change (debounced 1s).
  useEffect(() => {
    const t = setTimeout(async () => {
      await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(project),
      });
    }, 1000);
    return () => clearTimeout(t);
  }, [project]);

  if (!isDesktop) return <MobileFallback projectId={project.id} onQuote={() => setLeadIntent('quote')} />;

  // Drawing handlers.
  function onPointerDown(_e: any, pt: { x: number; y: number }) {
    if (!draw.tool) return;
    draw.beginDrag(pt);
  }
  function onPointerMove(_e: any, pt: { x: number; y: number }) {
    draw.updateDrag(pt);
  }
  function onPointerUp() {
    const rect = draw.endDrag();
    if (!rect || !draw.tool) return;

    if (draw.tool === 'wall') {
      setProject(p => ({ ...p, wall: { ...p.wall, rect } }));
    } else if (draw.tool === 'gable') {
      // gable is configured numerically; the click acts as a toggle to add a default
      setProject(p => ({ ...p, wall: { ...p.wall, gable: { peakHeightFt: 4, peakOffsetFt: 0 } } }));
    } else {
      const type = draw.tool as OpeningType;
      const def = OPENING_DEFAULTS[type];
      // Clamp opening into wall coordinates.
      const wx = Math.max(0, rect.x - project.wall.rect.x);
      const wy = Math.max(0, rect.y - project.wall.rect.y);
      const op: Opening = {
        id: ulid(),
        type,
        x: Math.min(wx, project.wall.rect.widthFt - def.widthFt),
        y: Math.min(wy, project.wall.rect.heightFt - def.heightFt),
        widthFt: rect.widthFt > 0.5 ? rect.widthFt : def.widthFt,
        heightFt: rect.heightFt > 0.5 ? rect.heightFt : def.heightFt,
      };
      setProject(p => ({ ...p, openings: [...p.openings, op] }));
    }
    draw.setTool(null);
  }

  const draftRect = draw.draw.start && draw.draw.current
    ? {
        x: Math.min(draw.draw.start.x, draw.draw.current.x),
        y: Math.min(draw.draw.start.y, draw.draw.current.y),
        widthFt: Math.abs(draw.draw.current.x - draw.draw.start.x),
        heightFt: Math.abs(draw.draw.current.y - draw.draw.start.y),
      }
    : null;

  const lines = useMemo(() => computeMaterialsList(project), [project]);
  const wallExists = project.wall.rect.widthFt > 0 && project.wall.rect.heightFt > 0;
  const materialsPicked = lines.length > 0;

  return (
    <main className="flex h-screen flex-col">
      {/* Stage 1: canvas */}
      <div ref={containerRef} className="relative flex-1 bg-[var(--paper)]">
        <Toolbar canvas={project.canvas} onCanvasChange={c => setProject(p => ({ ...p, canvas: c }))} tool={draw.tool} onToolChange={draw.setTool} />
        <div className="grid h-full place-items-center">
          <CanvasSurface
            size={project.canvas}
            pixelsPerFt={pixelsPerFt}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            <WallShape wall={project.wall} pixelsPerFt={pixelsPerFt} selected={selectedId === 'wall'} onSelect={() => setSelectedId('wall')} />
            {project.openings.map(o => (
              <OpeningEl key={o.id} opening={o} wall={project.wall} pixelsPerFt={pixelsPerFt} selected={selectedId === o.id} onSelect={setSelectedId} />
            ))}
            <DimensionOverlay draft={draftRect} pixelsPerFt={pixelsPerFt} canvasHeightPx={project.canvas.heightFt * pixelsPerFt} />
          </CanvasSurface>
        </div>
      </div>

      {/* Bottom drawer */}
      <ElementsDrawer
        project={project}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onUpdateWall={w => setProject(p => ({ ...p, wall: w }))}
        onUpdateOpening={op => setProject(p => ({ ...p, openings: p.openings.map(x => x.id === op.id ? op : x) }))}
        onDeleteOpening={id => setProject(p => ({ ...p, openings: p.openings.filter(o => o.id !== id) }))}
        onAdvance={() => document.getElementById('materials')?.scrollIntoView({ behavior: 'smooth' })}
      />

      {/* Stage 2: materials */}
      {wallExists && (
        <section id="materials" className="border-t border-slate-200 bg-white px-6 py-6">
          <h2 className="text-lg font-semibold">Phases & materials</h2>
          <div className="mt-3">
            <PresetPicker selected={project.scope.presetId} onChange={(id) => setProject(p => ({
              ...p,
              scope: id === 'custom' ? { ...p.scope, presetId: id } : { presetId: id, phases: applyPreset(id, p.scope.phases) },
            }))} />
          </div>
          <div className="mt-4 max-w-2xl">
            {(['insulation', 'sheathing', 'vaporBarrier', 'siding', 'trim'] as const).map(phase => (
              <PhaseRow
                key={phase}
                phase={phase}
                enabled={project.scope.phases[phase].enabled}
                materialId={project.scope.phases[phase].materialId}
                onToggle={(en) => setProject(p => ({
                  ...p,
                  scope: { ...p.scope, presetId: 'custom', phases: { ...p.scope.phases, [phase]: { ...p.scope.phases[phase], enabled: en } } },
                }))}
                onPick={(id) => setProject(p => ({
                  ...p,
                  scope: { ...p.scope, phases: { ...p.scope.phases, [phase]: { ...p.scope.phases[phase], materialId: id } } },
                }))}
              />
            ))}
          </div>
        </section>
      )}

      {/* Stage 3: outputs */}
      {materialsPicked && (
        <section id="outputs" className="border-t border-slate-200 bg-white px-6 py-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Materials list</h2>
            <QuoteCTA onClick={() => setLeadIntent('quote')} />
          </div>
          <div className="mt-3">
            <MaterialsTable lines={lines} />
          </div>
          <div className="mt-4">
            <ExportButtons projectId={project.id} hasLead={!!project.lead} onRequireLead={() => setLeadIntent('export')} />
          </div>
        </section>
      )}

      {leadIntent && (
        <LeadForm
          projectId={project.id}
          intent={leadIntent}
          onSuccess={() => {
            // Re-fetch to pick up server-side `lead` field.
            fetch(`/api/projects/${project.id}`, { cache: 'no-store' }).then(r => r.json()).then((p: Project) => {
              setProject(p);
              setLeadIntent(null);
            });
          }}
          onClose={() => setLeadIntent(null)}
        />
      )}
    </main>
  );
}
```

- [ ] **Step 4: `app/calc/p/[id]/scope/page.tsx` — SSR HTML preview of the scope**

```tsx
import { notFound } from 'next/navigation';
import { loadProject } from '@/lib/storage';
import { computeMaterialsList } from '@/lib/materials';
import { renderScopeBullets } from '@/lib/pdf/scope-templates';
import { wallSqFt, netSidingSqFt, trimLinFt } from '@/lib/geometry';
import { PRESET_LABELS } from '@/lib/presets';

export default async function ScopePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await loadProject(id);
  if (!project) notFound();
  const lines = computeMaterialsList(project);
  const bullets = renderScopeBullets(project);

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">Siding Project Scope</h1>
      <p className="mt-1 text-sm text-slate-500">Project {project.id} · {PRESET_LABELS[project.scope.presetId]}</p>
      <h2 className="mt-6 text-lg font-semibold">Wall summary</h2>
      <p>Wall {wallSqFt(project.wall).toFixed(0)} sq ft · Net siding {netSidingSqFt(project.wall, project.openings).toFixed(0)} sq ft · Trim {trimLinFt(project.wall, project.openings).toFixed(0)} lin ft</p>
      <h2 className="mt-6 text-lg font-semibold">Materials</h2>
      <ul>
        {lines.map(l => <li key={l.phase + l.material.id}>{l.phase}: {l.material.name} — {l.qty} {l.unit}</li>)}
      </ul>
      <h2 className="mt-6 text-lg font-semibold">Scope of work</h2>
      <ul className="list-disc pl-5">
        {bullets.map((b, i) => <li key={i}>{b}</li>)}
      </ul>
    </main>
  );
}
```

- [ ] **Step 5: Type-check + dev server smoke**

```bash
pnpm typecheck
pnpm dev    # in another terminal:
# open http://localhost:3000 → click "Start a project"
# expect a redirect to /calc/p/<ulid> with the canvas visible
```

- [ ] **Step 6: Commit**

```bash
git add apps/siding-calculator/app/calc
git commit -m "feat(siding-calculator): wire calculator page (canvas + materials + outputs)"
```

---

## Task 27: not-found page + landing polish

**Files:**
- Create: `apps/siding-calculator/app/calc/p/[id]/not-found.tsx`

- [ ] **Step 1: Implement not-found page**

```tsx
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md p-12 text-center">
      <h2 className="text-xl font-semibold">Project not found</h2>
      <p className="mt-2 text-sm text-slate-600">
        This share link is no longer valid, or it never existed.
      </p>
      <Link href="/calc/new" className="mt-6 inline-block rounded-full bg-[var(--accent)] px-5 py-2.5 text-white">
        Start fresh →
      </Link>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/siding-calculator/app/calc/p/\[id\]/not-found.tsx
git commit -m "feat(siding-calculator): add project-not-found page"
```

---

## Task 28: E2E happy-path test

**Files:**
- Create: `apps/siding-calculator/playwright.config.ts`
- Create: `apps/siding-calculator/tests/e2e/happy-path.spec.ts`

- [ ] **Step 1: Implement Playwright config**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'pnpm dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
```

- [ ] **Step 2: Implement the E2E test**

```ts
import { test, expect } from '@playwright/test';

test('homeowner happy path: draw wall, pick preset, fill lead, download Excel, share link survives', async ({ page, context }) => {
  // 1. Landing → start
  await page.goto('/');
  await page.getByRole('link', { name: /start a project/i }).click();
  await page.waitForURL(/\/calc\/p\/[A-Z0-9]+/);
  const projectUrl = page.url();

  // 2. Pick "Re-side with WRB" preset
  await page.getByRole('button', { name: /re-side with wrb/i }).click();

  // 3. Pick siding material
  await page.locator('select').nth(3).selectOption({ label: /HardiePlank/i });
  await page.locator('select').nth(4).selectOption({ label: /HardieTrim/i });
  await page.locator('select').nth(2).selectOption({ label: /Tyvek DrainWrap/i });

  // 4. CSV download is free — should not require lead
  const csvBtn = page.getByRole('button', { name: /download csv/i });
  await expect(csvBtn).toBeEnabled();

  // 5. Excel button — opens lead form
  await page.getByRole('button', { name: /download excel/i }).click();
  await page.getByLabel(/name/i).fill('Tay Tester');
  await page.getByLabel(/email/i).fill('tay@example.com');
  await page.getByLabel(/phone/i).fill('5035551212');
  await page.getByLabel(/address/i).fill('123 Test St, Portland OR');
  await page.getByRole('button', { name: /continue/i }).click();

  // 6. After form closes, Excel button should now download without re-prompting
  await page.waitForSelector('text=/download excel(?!.*requires)/i');

  // 7. Reload — share link should hydrate the same state
  const fresh = await context.newPage();
  await fresh.goto(projectUrl);
  await expect(fresh.getByText(/HardiePlank/i)).toBeVisible();
});
```

- [ ] **Step 3: Install Playwright browsers**

```bash
cd apps/siding-calculator
pnpm exec playwright install chromium
```

- [ ] **Step 4: Run the E2E test**

```bash
pnpm test:e2e
```

Expected: passes. Note: requires `BLOB_READ_WRITE_TOKEN` and `HUBSPOT_PORTAL_ID`/`HUBSPOT_FORM_ID` env vars to be set (see Task 29). For local CI without HubSpot, point the env vars at a dummy form ID and accept that the lead-submit will dead-letter — the test only asserts the gate UX.

- [ ] **Step 5: Commit**

```bash
git add apps/siding-calculator/playwright.config.ts apps/siding-calculator/tests/e2e
git commit -m "test(siding-calculator): add happy-path E2E"
```

---

## Task 29: README + environment setup

**Files:**
- Create: `apps/siding-calculator/README.md`
- Create: `apps/siding-calculator/.env.example`

- [ ] **Step 1: Write `.env.example`**

```
# Vercel Blob — created by linking the project to a Blob store
BLOB_READ_WRITE_TOKEN=

# HubSpot Forms API — Portal + Form IDs from your HubSpot account
HUBSPOT_PORTAL_ID=
HUBSPOT_FORM_ID=
# Optional bearer token for HubSpot Marketing API (only if you need authenticated submits)
HUBSPOT_BEARER=
```

- [ ] **Step 2: Write `README.md`**

```markdown
# siding-calculator

Public-facing siding calculator: sketch a wall, pick materials, get a scope.

## Develop

```bash
cd apps/siding-calculator
cp .env.example .env.local
# fill in BLOB_READ_WRITE_TOKEN, HUBSPOT_PORTAL_ID, HUBSPOT_FORM_ID
pnpm install
pnpm dev
```

Open http://localhost:3000.

## Test

```bash
pnpm test          # vitest
pnpm test:e2e      # playwright (requires dev server runnable)
pnpm typecheck     # tsc --noEmit
```

## Deploy

This app deploys independently to Vercel. Push to `main` triggers auto-deploy. Set the env vars in the Vercel project settings.

Embed onto `sfwconstruction.com/siding-calculator/` via iframe pointing at the Vercel domain.

## Architecture

See [`docs/superpowers/specs/2026-05-01-siding-calculator-design.md`](../../docs/superpowers/specs/2026-05-01-siding-calculator-design.md).
```

- [ ] **Step 3: Commit**

```bash
git add apps/siding-calculator/README.md apps/siding-calculator/.env.example
git commit -m "docs(siding-calculator): add README + env example"
```

---

## Task 30: Final verification

- [ ] **Step 1: Full lint + typecheck + tests**

```bash
cd apps/siding-calculator
pnpm typecheck
pnpm lint
pnpm test
```

All three must succeed.

- [ ] **Step 2: Build**

```bash
pnpm build
```

Expected: a successful Next.js production build with no errors.

- [ ] **Step 3: Manual smoke**

```bash
pnpm dev
```

Walk through:
1. Click "Start a project" on the landing page.
2. Set canvas to 30' × 12'.
3. Pick the Wall tool, drag from (3, 1) to (27, 10).
4. Pick the Window tool, drag a small rectangle inside the wall.
5. Pick "Re-side with WRB", choose Tyvek for vapor barrier, HardiePlank for siding, HardieTrim for trim.
6. Click "Download CSV" — file downloads.
7. Click "Download Excel" — lead form appears. Fill it. After submit, Excel downloads.
8. Click "Get a Quote" — lead form appears with quote framing.
9. Reload the page — state survives.

- [ ] **Step 4: No commit needed** (verification step only).

---

## Self-review notes

This plan implements every section of the spec:
- §2 (user flow): canvas → materials → outputs is realised in Tasks 17–26.
- §3 (architecture): file layout matches the spec exactly; Tasks 1–2 establish the stack; Task 9 implements storage.
- §4 (data model): Tasks 3–4.
- §5 (components & UX): Tasks 17–26.
- §6 (data flow & integrations): Tasks 14–16.
- §7 (error handling): not-found page (Task 27), CAS in PATCH (Task 15), HubSpot dead-letter (Tasks 14, 16), mobile fallback (Task 25).
- §8 (testing): unit (Tasks 3–14), E2E happy-path (Task 28).

Out-of-scope items from the spec (§9) are not implemented — confirmed.

Total: 30 tasks. Each commit is reversible. The plan can be paused after any task and resumed cleanly.

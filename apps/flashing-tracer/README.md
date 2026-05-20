# flashing-tracer

Internal estimator tool. Load a construction-drawing JPG/PNG, trace the
detail with click-drop dots, set one segment's real-world length, and read
every other length and interior angle off live tables.

MVP: client-only, no persistence, single open polyline per image.

## Develop

```bash
cd apps/flashing-tracer
pnpm --ignore-workspace install
pnpm --ignore-workspace dev
```

Open <http://localhost:3000>.

> Heads-up: the repo root declares `packageManager: npm@10.9.2`, so all `pnpm`
> commands in this app must use `--ignore-workspace`.

## Test

```bash
pnpm --ignore-workspace test          # vitest — pure geometry + parser
pnpm --ignore-workspace run typecheck # tsc --noEmit
```

## Deploy

Push to `main` triggers a Vercel deploy. First-time setup:

1. Create a new Vercel project pointing at `apps/flashing-tracer/`.
2. No env vars needed for MVP.
3. Map a domain (e.g. `flashing-tracer.sfwconstruction.com`).

## Architecture

See `microsites/docs/superpowers/specs/2026-05-20-flashing-tracer-design.md`.

Stack: Next.js 16 + React 19 + Tailwind v4 + TypeScript strict. SVG canvas
(no `<canvas>`/Konva). No backend in MVP.

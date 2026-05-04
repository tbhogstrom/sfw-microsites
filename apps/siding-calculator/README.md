# siding-calculator

Public-facing siding calculator: sketch a wall on an engineering canvas, drop in
windows/doors, pick construction phases and materials, and walk away with a CSV,
Excel, or one-page scope PDF. Replaces the legacy tool at
`sfwconstruction.com/siding-calculator/`.

## Develop

```bash
cd apps/siding-calculator
cp .env.example .env.local
# fill in BLOB_READ_WRITE_TOKEN at minimum (copy from apps/reports-portal/.env.local)
pnpm --ignore-workspace install
pnpm --ignore-workspace dev
```

Open <http://localhost:3000>.

> Heads-up: the repo root declares `packageManager: npm@10.9.2`, so all `pnpm`
> commands in this app must use `--ignore-workspace`.

## Test

```bash
pnpm --ignore-workspace test          # vitest — pure logic + components
pnpm --ignore-workspace run typecheck # tsc --noEmit
```

## Deploy

Pushed to `main` triggers a fresh Vercel deploy. First-time setup:

1. Create a new Vercel project pointing at `apps/siding-calculator/`.
2. Configure env vars in the project settings: `BLOB_READ_WRITE_TOKEN`,
   `HUBSPOT_PORTAL_ID`, `HUBSPOT_FORM_ID`.
3. Map a domain (e.g. `siding-calc.sfwconstruction.com`).
4. Embed into `sfwconstruction.com/siding-calculator/` via iframe pointing at the
   Vercel domain.

## Architecture

See `docs/superpowers/specs/2026-05-01-siding-calculator-design.md` and
`docs/superpowers/plans/2026-05-01-siding-calculator.md`.

Stack: Next.js 16 + React 19 + Tailwind v4 + TypeScript strict. SVG canvas
(no `<canvas>`/Konva). Vercel Blob for project state and stored outputs.
HubSpot Forms API for lead capture with retry + dead-letter on failure.

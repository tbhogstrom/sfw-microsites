# Claude Code Instructions

## Project Overview
Turborepo monorepo with 11 Astro microsites for SFW Construction. Uses pnpm workspaces.

## Commands

```bash
# Install dependencies
pnpm install

# Run all sites in dev mode
pnpm dev

# Run a specific site
cd apps/deck-repair && pnpm dev

# Build all sites
pnpm build

# Build a specific site
cd apps/mold-testing && pnpm build
```

## Architecture

```
apps/          # 11 standalone Astro sites (beam-repair, chimney-repair, crawlspace-rot,
               #   deck-repair, dry-rot, flashing-repair, lead-paint, leak-repair,
               #   mold-testing, restoration, siding-repair, trim-repair)
packages/
  config/      # @sfw/config  — shared Tailwind + TS config
  content/     # @sfw/content — types, service configs, company data
  ui/          # @sfw/ui      — 27+ shared Astro components
  utils/       # @sfw/utils   — shared utilities
public/shared/ # Logos, images, fonts shared across all sites
tools/         # blob-manager, content-generator, interlinking scripts
```

## Key Patterns

- All apps import shared packages via `@sfw/*` namespace
- Components: `import { HeroSection, ContactForm } from '@sfw/ui'`
- Deployment: each app deploys to Vercel independently via `vercel.json` domain mapping
- Package manager: **pnpm** (use `pnpm`, not `npm`, for all commands)

## Git Workflow

Push to both `origin` (tfalcon_SFW/microsites) and `upstream` (tbhogstrom/sfw-microsites) in one command:

```bash
git pushall
```

This uses a local git alias (`push.default = current`), so it pushes the current branch to both remotes. No PRs needed — push directly to `main`.

```bash
git add <files>
git commit -m "message"
git pushall
```

## Git Commit Guidelines

- **Never include Co-Authored-By credits for Claude in commit messages**
- Keep commit messages concise and descriptive
- Focus on what was changed and why

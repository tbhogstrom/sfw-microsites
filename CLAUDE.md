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

## Linting

Each app uses `astro check` as its lint/typecheck step. Run it from the app directory:

```bash
cd apps/siding-repair && pnpm lint
# equivalent to: astro check
```

Always lint before committing. Fix all errors. Warnings are acceptable if pre-existing.

## Deployment

- **No manual build or deploy step needed.** Just commit and push to `main`.
- Each app deploys independently to Vercel. Pushing to `main` triggers auto-deploy.
- **Vercel auto-rolls back** if the production build fails.
- Use `pnpm lint` as the pre-push check — not `pnpm build`.

## Git Workflow

Push to both `origin` (tfalcon_SFW/microsites) and `upstream` (tbhogstrom/sfw-microsites) using the included script:

```powershell
./pushall.ps1
```

No PRs needed — commit directly to `main` and push both remotes.

```bash
git add <files>
git commit -m "message"
./pushall.ps1
```

## Editorial Crew (Content QA)

Run the editorial crew tool to lint and improve markdown content files:

```bash
# Install (one-time setup)
pip install -e tools/editorial-crew

# Run on any markdown file
python -m editorial_crew path/to/file.md

# Run on multiple files with a glob
python -m editorial_crew "apps/siding-repair/src/data/generated_content/*.md"

# Run specific agents only
python -m editorial_crew file.md --agents grammar,structure
```

## Git Commit Guidelines

- **Never include Co-Authored-By credits for Claude in commit messages**
- Keep commit messages concise and descriptive
- Focus on what was changed and why

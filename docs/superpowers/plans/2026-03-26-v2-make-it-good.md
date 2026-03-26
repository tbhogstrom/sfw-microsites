# V2: "Make It Good" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the sites from functional SEO microsites into professional, trust-building service websites with a modern design system, editorial-quality content, and proper dev guardrails.

**Architecture:** Four sequential sub-phases: V2a (DX Foundation) enables safe refactoring, V2b (Design System Rebuild) rethinks `@sfw/ui` and `@sfw/config`, V2c (Content Quality Pass) runs editorial improvements, V2d (Site-by-Site Rollout) applies everything across all 12 sites.

**Tech Stack:** Astro 5.1.3, TypeScript, Tailwind CSS 3.4, ESLint, Prettier, Husky, GitHub Actions, Python 3.11+ (editorial crew)

**Spec:** `docs/superpowers/specs/2026-03-26-microsites-roadmap-v1-v3-design.md` (V2 section)

**Prerequisite:** V1 must be complete — all sites have service pages, galleries, logos, and GA4 tracking.

---

# Phase V2a: DX Foundation

**Goal:** Add linting, formatting, pre-commit hooks, CI, and integrate the editorial crew tool. This enables confident refactoring for V2b-V2d.

## File Map (V2a)

### Files to Create

| File | Purpose |
|---|---|
| `eslint.config.mjs` | Flat config ESLint for Astro + TypeScript |
| `.prettierrc` | Prettier configuration |
| `.prettierignore` | Files Prettier should skip |
| `.husky/pre-commit` | Pre-commit hook running lint-staged |
| `.github/workflows/ci.yml` | GitHub Actions CI pipeline |
| `tools/editorial-crew/` | Migrated editorial crew (from external project) |

### Files to Modify

| File | Change |
|---|---|
| `package.json` (root) | Add ESLint, Prettier, Husky, lint-staged devDeps + scripts |
| `turbo.json` | Add `format` task |
| `CLAUDE.md` | Document editorial crew usage |

---

## Task 1: Add ESLint with Astro + TypeScript Support

**Files:**
- Create: `eslint.config.mjs`
- Modify: `package.json` (root)

- [ ] **Step 1: Install ESLint dependencies**

```bash
pnpm add -Dw eslint @eslint/js eslint-plugin-astro @typescript-eslint/parser @typescript-eslint/eslint-plugin typescript-eslint
```

These are:
- `eslint` — core linter
- `@eslint/js` — ESLint recommended rules
- `eslint-plugin-astro` — Astro file support (includes parser)
- `typescript-eslint` — TypeScript ESLint support (v8+ flat config)

- [ ] **Step 2: Create `eslint.config.mjs`**

Use ESLint flat config (the current standard — `.eslintrc` is deprecated):

```javascript
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';

export default [
  // Global ignores
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.astro/**',
      '**/.turbo/**',
      '**/.vercel/**',
      'tools/**',
    ],
  },

  // Base JS/TS rules
  eslint.configs.recommended,

  // TypeScript rules
  ...tseslint.configs.recommended,

  // Astro rules
  ...astro.configs.recommended,

  // Project overrides
  {
    rules: {
      // Relax rules that conflict with Astro patterns
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      // Allow any in component props for flexibility during migration
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];
```

- [ ] **Step 3: Add lint:eslint script to root package.json**

Add to the `"scripts"` section:

```json
"lint:eslint": "eslint .",
```

- [ ] **Step 4: Run ESLint and assess the damage**

```bash
pnpm lint:eslint
```

Expected: Many warnings/errors on first run. Count them but don't fix yet — we need to understand the scope before deciding what to fix vs. disable.

- [ ] **Step 5: Adjust rules for existing codebase**

Based on the first run, add rule overrides in `eslint.config.mjs` to suppress pre-existing issues that aren't worth fixing now. Only suppress rules that produce many false positives across the codebase. Do NOT suppress rules that catch real bugs.

Common ones to expect:
- `@typescript-eslint/no-explicit-any` — likely many in component props → keep as `warn`
- `no-unused-vars` — Astro frontmatter variables used in templates → already handled by ignore pattern

- [ ] **Step 6: Fix any real issues found**

Fix actual bugs or problems ESLint surfaces. Don't fix style issues — Prettier handles that in the next task.

- [ ] **Step 7: Verify ESLint passes clean**

```bash
pnpm lint:eslint
```

Expected: 0 errors, warnings acceptable.

- [ ] **Step 8: Commit**

```bash
git add eslint.config.mjs package.json pnpm-lock.yaml
git add -u  # Any files fixed
git commit -m "feat: add ESLint with Astro + TypeScript support"
```

---

## Task 2: Add Prettier with Astro Support

**Files:**
- Create: `.prettierrc`
- Create: `.prettierignore`
- Modify: `package.json` (root)

- [ ] **Step 1: Install Prettier**

```bash
pnpm add -Dw prettier prettier-plugin-astro
```

- [ ] **Step 2: Create `.prettierrc`**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "plugins": ["prettier-plugin-astro"],
  "overrides": [
    {
      "files": "*.astro",
      "options": {
        "parser": "astro"
      }
    }
  ]
}
```

- [ ] **Step 3: Create `.prettierignore`**

```
dist/
node_modules/
.astro/
.turbo/
.vercel/
pnpm-lock.yaml
package-lock.json
tools/
*.md
```

Note: `*.md` is ignored because content markdown files have intentional formatting that Prettier would mangle. Docs can be formatted manually if desired.

- [ ] **Step 4: Add format script to root package.json**

```json
"format": "prettier --write .",
"format:check": "prettier --check ."
```

- [ ] **Step 5: Run Prettier in check mode to see scope**

```bash
pnpm format:check
```

Expected: Many files need formatting. This is normal for a first-time Prettier adoption.

- [ ] **Step 6: Run Prettier to format the entire codebase**

```bash
pnpm format
```

This is a one-time bulk format. All files in the monorepo will be reformatted to the Prettier config.

- [ ] **Step 7: Verify ESLint still passes after formatting**

```bash
pnpm lint:eslint
```

Expected: PASS — Prettier and ESLint should not conflict with the chosen config.

- [ ] **Step 8: Commit the bulk format as a single commit**

```bash
git add -A
git commit -m "style: apply Prettier formatting across entire codebase"
```

This should be a standalone commit with ONLY formatting changes — no logic changes. This makes `git blame` cleaner (you can use `git blame --ignore-rev` later).

---

## Task 3: Integrate ESLint + Astro Check into Unified Lint Command

**Files:**
- Modify: `package.json` (root)
- Modify: `turbo.json`

Currently `pnpm lint` runs `turbo lint` which runs `astro check` per app. We want `pnpm lint` to run both ESLint (monorepo-wide) and Astro check (per app).

- [ ] **Step 1: Update root package.json scripts**

Replace the current lint script:

```json
"scripts": {
  "dev": "turbo dev",
  "build": "turbo build",
  "lint": "eslint . && turbo lint",
  "lint:eslint": "eslint .",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "clean": "turbo clean",
  "typecheck": "turbo typecheck"
}
```

Note: Removed the `set APPDATA` Windows workaround from the lint script. If this was needed for Astro check, it can be added back to the turbo lint task definition.

- [ ] **Step 2: Add format task to turbo.json**

Add to the `"tasks"` section:

```json
"format": {
  "cache": false
}
```

- [ ] **Step 3: Verify the unified lint command works**

```bash
pnpm lint
```

Expected: ESLint runs first (monorepo-wide), then Turbo runs `astro check` per app. Both pass.

- [ ] **Step 4: Commit**

```bash
git add package.json turbo.json
git commit -m "feat: integrate ESLint into unified lint command"
```

---

## Task 4: Add Husky + lint-staged for Pre-commit Hooks

**Files:**
- Create: `.husky/pre-commit`
- Modify: `package.json` (root)

- [ ] **Step 1: Install Husky and lint-staged**

```bash
pnpm add -Dw husky lint-staged
```

- [ ] **Step 2: Initialize Husky**

```bash
npx husky init
```

This creates `.husky/` directory and adds a `prepare` script to package.json.

- [ ] **Step 3: Create the pre-commit hook**

Write `.husky/pre-commit`:

```bash
npx lint-staged
```

- [ ] **Step 4: Configure lint-staged in package.json**

Add to root `package.json`:

```json
"lint-staged": {
  "*.{js,mjs,ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.astro": ["eslint --fix", "prettier --write --plugin=prettier-plugin-astro"],
  "*.{json,css}": ["prettier --write"]
}
```

This runs ESLint fix + Prettier on staged files before each commit. Only touches files you're changing — fast.

- [ ] **Step 5: Test the hook**

Make a trivial change to any file, stage it, and commit:

```bash
echo "// test" >> packages/utils/src/index.ts
git add packages/utils/src/index.ts
git commit -m "test: verify pre-commit hook"
```

Expected: lint-staged runs ESLint + Prettier on the staged file. Commit succeeds if clean.

- [ ] **Step 6: Revert the test commit**

```bash
git reset HEAD~1
git checkout packages/utils/src/index.ts
```

- [ ] **Step 7: Commit the hook setup**

```bash
git add .husky/ package.json pnpm-lock.yaml
git commit -m "feat: add Husky pre-commit hooks with lint-staged"
```

---

## Task 5: Add GitHub Actions CI Pipeline

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create the workflow file**

```bash
mkdir -p .github/workflows
```

- [ ] **Step 2: Write `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-and-typecheck:
    name: Lint & Typecheck
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: ESLint
        run: pnpm lint:eslint

      - name: Prettier check
        run: pnpm format:check

      - name: Astro check + Typecheck
        run: pnpm typecheck
```

Note: This runs ESLint, Prettier check, and Astro check / TypeScript type checking. It does NOT build — Vercel handles builds on deploy. This keeps CI fast.

- [ ] **Step 3: Verify the workflow file is valid YAML**

```bash
cat .github/workflows/ci.yml | python3 -c "import sys, yaml; yaml.safe_load(sys.stdin)" 2>/dev/null && echo "Valid YAML" || echo "Invalid YAML"
```

If python3 or pyyaml isn't available, just visually verify indentation.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "feat: add GitHub Actions CI for lint, format, and typecheck"
```

- [ ] **Step 5: Push and verify CI runs**

```bash
git push origin main
```

Check GitHub → Actions tab → verify the workflow runs and passes. If it fails, read the logs and fix the issue.

---

## Task 6: Integrate Editorial Crew into Monorepo

**Files:**
- Create: `tools/editorial-crew/` (migrated from external project)
- Modify: `CLAUDE.md`
- Modify: `.gitignore` (root)

The editorial crew lives at `C:\Users\tfalcon\googld-adk-scratcj`. It's a Python project using Claude Agent SDK with this structure:
```
editorial_crew/
  __init__.py, __main__.py, runner.py, config.py, config.toml
  agents/ (registry.py, specialists/)
  auth.py, diff.py, models.py
pyproject.toml
tests/
.env.example
```

- [ ] **Step 1: Copy the editorial crew into tools/**

```bash
cp -r /c/Users/tfalcon/googld-adk-scratcj/editorial_crew tools/editorial-crew/editorial_crew
cp /c/Users/tfalcon/googld-adk-scratcj/pyproject.toml tools/editorial-crew/
cp /c/Users/tfalcon/googld-adk-scratcj/.env.example tools/editorial-crew/
cp -r /c/Users/tfalcon/googld-adk-scratcj/tests tools/editorial-crew/
```

- [ ] **Step 2: Verify the package structure**

```bash
ls -la tools/editorial-crew/
ls -la tools/editorial-crew/editorial_crew/
```

Expected structure:
```
tools/editorial-crew/
  editorial_crew/
    __init__.py
    __main__.py
    agents/
    auth.py
    config.py
    config.toml
    diff.py
    models.py
    runner.py
  tests/
  pyproject.toml
  .env.example
```

- [ ] **Step 3: Update .gitignore to allow editorial-crew**

The current `.gitignore` has `tools/*` with only `!tools/visual-qa/` allowed. Add:

```
!tools/editorial-crew/
```

- [ ] **Step 4: Create a README for the editorial crew**

Create `tools/editorial-crew/README.md`:

```markdown
# Editorial Crew

Agentic editorial workflow for improving markdown content files. Uses Claude Agent SDK to run specialist agents (grammar, structure, readability, etc.) against markdown files.

## Setup

```bash
cd tools/editorial-crew
pip install -e .
```

Requires Python 3.11+ and a valid Claude API key in `.env` (copy from `.env.example`).

## Usage

```bash
# Run on a single file
python -m editorial_crew path/to/file.md

# Run on multiple files with glob
python -m editorial_crew "apps/siding-repair/src/data/generated_content/*.md"

# Run specific agents only
python -m editorial_crew file.md --agents grammar,structure
```

## Available Agents

See `editorial_crew/agents/registry.py` for the full list of specialist agents.

## Integration with Monorepo

This tool lives in the microsites monorepo at `tools/editorial-crew/`. It's a Python project (not a Node.js package) and is not part of the pnpm workspace.
```

- [ ] **Step 5: Verify the editorial crew runs**

```bash
cd tools/editorial-crew
pip install -e .
python -m editorial_crew --help
```

Expected: Help text prints. If there are missing dependencies, install them.

- [ ] **Step 6: Update CLAUDE.md with editorial crew docs**

The CLAUDE.md already has an "Editorial Crew (Content QA)" section referencing the external path. Update it to point to the monorepo location:

Replace the current editorial crew section with:

```markdown
## Editorial Crew (Content QA)

Run the editorial crew tool to lint and improve markdown content files:

\```bash
# Install (one-time setup)
pip install -e tools/editorial-crew

# Run on any markdown file
python -m editorial_crew path/to/file.md

# Run on multiple files with a glob
python -m editorial_crew "apps/siding-repair/src/data/generated_content/*.md"

# Run specific agents only
python -m editorial_crew file.md --agents grammar,structure
\```
```

- [ ] **Step 7: Commit**

```bash
git add tools/editorial-crew/ .gitignore CLAUDE.md
git commit -m "feat: integrate editorial crew into monorepo tools"
```

---

## Task 7: V2a Verification

- [ ] **Step 1: Verify full lint pipeline**

```bash
pnpm lint
```

Expected: ESLint + Astro check passes across all packages and apps.

- [ ] **Step 2: Verify format check**

```bash
pnpm format:check
```

Expected: All files formatted correctly.

- [ ] **Step 3: Test pre-commit hook**

Make a trivial whitespace change, stage, commit — verify lint-staged fires.

- [ ] **Step 4: Verify CI status**

Check GitHub Actions — the most recent push should show a passing CI run.

- [ ] **Step 5: Verify editorial crew**

```bash
python -m editorial_crew --help
```

Expected: Help text prints from the monorepo-local install.

- [ ] **Step 6: Run visual QA on a site to confirm nothing broke**

```bash
node tools/visual-qa/run.js chimney-repair
```

Expected: PASS — DX changes should not affect site rendering.

---

# Phase V2b: Design System Rebuild

> **Note:** This phase should be planned in detail after V2a is complete. The exact design tokens, accent colors, and typography choices need visual exploration (mockups, browser testing) that can't be fully specified in advance. The tasks below provide the architectural structure.

## Task 8: Add `cn()` Utility to @sfw/utils

**Files:**
- Modify: `packages/utils/src/index.ts`
- Create: `packages/utils/src/cn.ts`

- [ ] **Step 1: Create the cn utility**

```typescript
// packages/utils/src/cn.ts

/**
 * Compose class names — filters falsy values, joins with space.
 * Lightweight alternative to clsx + tailwind-merge for Astro components.
 */
export function cn(...inputs: (string | undefined | null | false)[]): string {
  return inputs.filter(Boolean).join(' ');
}
```

- [ ] **Step 2: Export from index.ts**

Add to `packages/utils/src/index.ts`:

```typescript
export { cn } from './cn';
```

- [ ] **Step 3: Verify typecheck**

```bash
cd packages/utils && pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add packages/utils/src/cn.ts packages/utils/src/index.ts
git commit -m "feat(utils): add cn() class name composition utility"
```

---

## Task 9: Define Design Token System in Tailwind Config

**Files:**
- Modify: `packages/config/tailwind.config.js`

This task replaces the current minimal color/font config with a full design token system.

- [ ] **Step 1: Define the shared neutral palette**

Replace the current `colors` section with a modern neutral palette plus a CSS-custom-property-based accent system:

```javascript
module.exports = {
  content: [],
  theme: {
    extend: {
      colors: {
        // Shared neutrals (used by all sites)
        neutral: {
          50: '#fafaf9',
          100: '#f5f5f4',
          200: '#e7e5e4',
          300: '#d6d3d1',
          400: '#a8a29e',
          500: '#78716c',
          600: '#57534e',
          700: '#44403c',
          800: '#292524',
          900: '#1c1917',
          950: '#0c0a09',
        },
        // Accent color via CSS custom property (per-site)
        accent: {
          DEFAULT: 'var(--color-accent, #a1b770)',
          light: 'var(--color-accent-light, #c5d4a0)',
          dark: 'var(--color-accent-dark, #7a8f52)',
        },
        // Keep legacy colors during migration
        primary: '#a1b770',
        secondary: '#900',
        dark: '#000',
        light: '#fff',
        gray: {
          light: '#f3f1ee',
          border: '#726855',
        },
      },
      fontFamily: {
        heading: ['Inter', 'Helvetica Neue', 'Arial', 'sans-serif'],
        body: ['Inter', 'Poppins', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        base: '18px',
      },
      borderRadius: {
        sm: '0.25rem',
        DEFAULT: '0.5rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07)',
        'elevated': '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.08)',
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 2: Define per-site accent colors**

Create `packages/config/site-themes.js`:

```javascript
/**
 * Per-site accent colors. Each site sets CSS custom properties
 * in its BaseLayout to activate its theme.
 */
export const siteThemes = {
  'beam-repair':     { accent: '#8B6914', accentLight: '#B8941F', accentDark: '#6B4F0E' },
  'chimney-repair':  { accent: '#4A5568', accentLight: '#718096', accentDark: '#2D3748' },
  'crawlspace-rot':  { accent: '#5B7553', accentLight: '#7FA074', accentDark: '#3E5438' },
  'deck-repair':     { accent: '#A0704A', accentLight: '#C49474', accentDark: '#7A5233' },
  'dry-rot':         { accent: '#8B7355', accentLight: '#B09878', accentDark: '#6B5540' },
  'flashing-repair': { accent: '#4A7C8B', accentLight: '#6DA3B3', accentDark: '#345A66' },
  'lead-paint':      { accent: '#B85C3C', accentLight: '#D4825E', accentDark: '#8E422A' },
  'leak-repair':     { accent: '#3B82A0', accentLight: '#5CA8C4', accentDark: '#2A6178' },
  'mold-testing':    { accent: '#6B8E5B', accentLight: '#8FB87C', accentDark: '#4E6B42' },
  'restoration':     { accent: '#8B6B5B', accentLight: '#B09080', accentDark: '#6B4E42' },
  'siding-repair':   { accent: '#5B7B8B', accentLight: '#7FA0B0', accentDark: '#3E5A68' },
  'trim-repair':     { accent: '#7B6B5B', accentLight: '#A09080', accentDark: '#5E4E42' },
};
```

**Note:** These are starting colors. They should be reviewed visually in the browser and adjusted during the pilot rollout (Task 18). The exact hues matter less than having the per-site system in place.

- [ ] **Step 3: Verify Tailwind config loads**

```bash
cd apps/chimney-repair && pnpm build
```

Expected: Build succeeds. The new tokens are available but not yet used by components.

- [ ] **Step 4: Commit**

```bash
git add packages/config/tailwind.config.js packages/config/site-themes.js
git commit -m "feat(config): add design token system with per-site accent colors"
```

---

## Task 10: Self-host Inter Font

**Files:**
- Create: `public/shared/fonts/inter/` (font files)
- Modify: `packages/config/tailwind.config.js` (already done in Task 9)
- Create: `packages/ui/src/styles/fonts.css`

- [ ] **Step 1: Download Inter font files**

Download Inter variable font from Google Fonts or the official repo. You need:
- `Inter-roman.var.woff2` (variable weight, roman)
- `Inter-italic.var.woff2` (variable weight, italic)

Place in `public/shared/fonts/inter/`.

- [ ] **Step 2: Create font-face CSS**

Create `packages/ui/src/styles/fonts.css`:

```css
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url('/shared/fonts/inter/Inter-roman.var.woff2') format('woff2');
}

@font-face {
  font-family: 'Inter';
  font-style: italic;
  font-weight: 100 900;
  font-display: swap;
  src: url('/shared/fonts/inter/Inter-italic.var.woff2') format('woff2');
}
```

- [ ] **Step 3: Import fonts.css in BaseLayout**

Add to `packages/ui/src/layouts/BaseLayout.astro` in the `<head>`:

```html
<link rel="preload" href="/shared/fonts/inter/Inter-roman.var.woff2" as="font" type="font/woff2" crossorigin />
<style>
  @import '../styles/fonts.css';
</style>
```

- [ ] **Step 4: Verify font loads**

```bash
cd apps/chimney-repair && pnpm dev
```

Open browser, inspect computed font — should show Inter.

- [ ] **Step 5: Commit**

```bash
git add public/shared/fonts/ packages/ui/src/styles/ packages/ui/src/layouts/BaseLayout.astro
git commit -m "feat(ui): self-host Inter font with font-display swap"
```

---

## Task 11: Consolidate Button and FormButton

**Files:**
- Modify: `packages/ui/src/components/ui/Button.astro`
- Delete: `packages/ui/src/components/forms/FormButton.astro`
- Modify: `packages/ui/src/index.ts` (or wherever components are exported)
- Modify: Any files importing `FormButton`

- [ ] **Step 1: Read both Button.astro and FormButton.astro**

Understand the differences. The research showed they share identical `baseClasses`, `variantClasses`, `sizeClasses` logic.

- [ ] **Step 2: Merge FormButton features into Button**

Add `type` prop (default `"button"`, supports `"submit"`), `loading` prop, and `formId` prop to Button. The loading spinner from FormButton becomes a conditional render in Button.

- [ ] **Step 3: Update Button to use `cn()` utility**

Replace the manual `filter(Boolean).join(' ')` pattern:

```astro
import { cn } from '@sfw/utils';
const classes = cn(baseClasses, variantClasses[variant], sizeClasses[size], className);
```

- [ ] **Step 4: Find all FormButton imports and replace with Button**

```bash
grep -rn "FormButton" apps/ packages/
```

Replace each import of `FormButton` with `Button` and add `type="submit"` where needed.

- [ ] **Step 5: Delete FormButton.astro**

Remove `packages/ui/src/components/forms/FormButton.astro` and update the package exports.

- [ ] **Step 6: Verify build**

```bash
pnpm build
```

- [ ] **Step 7: Run visual QA on chimney-repair**

```bash
node tools/visual-qa/run.js chimney-repair
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(ui): consolidate Button and FormButton into single component"
```

---

## Task 12: Refactor HeroSection into Composable Sub-components

**Files:**
- Modify: `packages/ui/src/components/hero/HeroSection.astro`
- Create: `packages/ui/src/components/hero/HeroLayout.astro`
- Create: `packages/ui/src/components/hero/HeroContent.astro`
- Create: `packages/ui/src/components/hero/HeroForm.astro`
- Create: `packages/ui/src/scripts/hubspot-form.ts`

This is the largest refactor — the current HeroSection is 295 lines mixing layout, content, form integration, and business hours logic.

- [ ] **Step 1: Read HeroSection.astro completely**

Understand all props, rendering paths, and the inline script.

- [ ] **Step 2: Extract HeroLayout.astro**

Handles the background image, overlay gradient, responsive container, and height variants. Uses `<slot />` for content.

- [ ] **Step 3: Extract HeroContent.astro**

Handles headline, subheadline, CTA buttons. Pure presentational.

- [ ] **Step 4: Extract HeroForm.astro**

Handles HubSpot form embed, business hours messaging. Contains the `hubspotForm` prop logic.

- [ ] **Step 5: Extract inline script to `hubspot-form.ts`**

Move the 95 lines of inline HubSpot form JavaScript to a separate TypeScript file. Import via Astro's `<script>` tag.

- [ ] **Step 6: Rewrite HeroSection as composition**

HeroSection becomes a thin wrapper that composes the sub-components:

```astro
<HeroLayout backgroundImage={backgroundImage} height={height}>
  <HeroContent headline={headline} subheadline={subheadline} primaryCTA={primaryCTA} />
  {hubspotForm && <HeroForm {...hubspotForm} />}
</HeroLayout>
```

- [ ] **Step 7: Ensure backward compatibility**

HeroSection's public API (props) must not change. All existing usages should work without modification.

- [ ] **Step 8: Verify with visual QA**

```bash
node tools/visual-qa/run.js chimney-repair
node tools/visual-qa/run.js siding-repair
```

- [ ] **Step 9: Commit**

```bash
git add packages/ui/src/components/hero/ packages/ui/src/scripts/
git commit -m "refactor(ui): split HeroSection into composable sub-components"
```

---

## Task 13: Extract Inline Scripts to Modules

**Files:**
- Create: `packages/ui/src/scripts/testimonial-slider.ts`
- Create: `packages/ui/src/scripts/mobile-nav.ts`
- Modify: `packages/ui/src/components/content/TestimonialSlider.astro`
- Modify: `packages/ui/src/components/layout/MobileNav.astro`
- Modify: `packages/ui/src/components/layout/Header.astro`

- [ ] **Step 1: Extract TestimonialSlider script** (40 lines of dynamic Swiper import)
- [ ] **Step 2: Extract MobileNav script** (24 lines of menu toggle)
- [ ] **Step 3: Consolidate Header + MobileNav toggle** (they share toggle logic — make one shared module)
- [ ] **Step 4: Use Astro `client:visible` for TestimonialSlider** (lazy-load Swiper only when visible)
- [ ] **Step 5: Verify visual QA**
- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/scripts/ packages/ui/src/components/
git commit -m "refactor(ui): extract inline scripts to TypeScript modules"
```

---

## Task 14: Add Transitions and Polish to Existing Components

**Files:**
- Modify: `packages/ui/src/components/ui/Button.astro`
- Modify: `packages/ui/src/components/content/FAQAccordion.astro`
- Modify: `packages/ui/src/components/content/ServiceCard.astro`
- Modify: Various other components

- [ ] **Step 1: Add hover/focus transitions to Button**

```css
transition: all 150ms ease;
```

- [ ] **Step 2: Animate FAQAccordion open/close**

Replace instant `<details>` with CSS `grid-template-rows` animation:

```css
details[open] .accordion-content {
  grid-template-rows: 1fr;
}
.accordion-content {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 200ms ease;
}
```

- [ ] **Step 3: Add card hover effects** — subtle shadow elevation on hover for ServiceCard, BlogCard, LinkCard
- [ ] **Step 4: Add scroll-triggered fade-in** — lightweight IntersectionObserver for page sections
- [ ] **Step 5: Verify visual QA across 3 sites**
- [ ] **Step 6: Commit**

```bash
git add packages/ui/
git commit -m "feat(ui): add transitions, animations, and hover polish"
```

---

## Tasks 15-17: Build New Components

### Task 15: TrustBadges + StickyMobileCTA + BeforeAfter (High Priority)

- [ ] **Step 1: Build TrustBadges.astro** — horizontal bar showing CCB license, insurance, years in business, project count. Props: `badges: { icon, label, value }[]`. Uses data from `@sfw/content` company info.
- [ ] **Step 2: Build StickyMobileCTA.astro** — fixed bottom bar (mobile only) with phone button + "Free Estimate" CTA. Hidden when hero is in viewport. Uses IntersectionObserver.
- [ ] **Step 3: Build BeforeAfter.astro** — image comparison slider. Props: `before: string, after: string, alt: string`. Uses CSS `clip-path` + pointer events for the slider handle.
- [ ] **Step 4: Export all three from @sfw/ui**
- [ ] **Step 5: Verify with visual QA (add to test-components page)**
- [ ] **Step 6: Commit each component separately**

### Task 16: ComparisonTable + Tabs + VideoEmbed (Medium Priority)

- [ ] **Step 1: Build ComparisonTable.astro** — responsive table for service tier comparison. Props: `headers: string[], rows: { label, values }[]`.
- [ ] **Step 2: Build Tabs.astro** — accessible tabbed content. Props: `tabs: { label, content }[]`. Uses ARIA roles and keyboard navigation.
- [ ] **Step 3: Build VideoEmbed.astro** — lazy-loaded responsive YouTube/Vimeo embed. Props: `url: string, title: string`. Uses `loading="lazy"` iframe with facade pattern.
- [ ] **Step 4: Export all three**
- [ ] **Step 5: Verify and commit**

### Task 17: PricingCard + ImageLightbox (Medium Priority)

- [ ] **Step 1: Build PricingCard.astro** — estimate range display with CTA. Props: `title, priceRange, features[], ctaText, ctaHref`.
- [ ] **Step 2: Build ImageLightbox.astro** — modal gallery viewer. Clicking a gallery image opens full-size with prev/next navigation. Uses `<dialog>` element for accessibility.
- [ ] **Step 3: Export, verify, commit**

---

# Phase V2c: Content Quality Pass

> **Note:** This phase runs the editorial crew against all content. It's mostly an execution task, not a coding task. The editorial crew should be integrated (Task 6) and new components should be available (Tasks 15-17) before starting.

## Task 18: Run Editorial Crew on All Service Pages

- [ ] **Step 1: Run editorial crew on Tier 1 sites first**

```bash
python -m editorial_crew "apps/siding-repair/src/data/generated_content/*.md"
python -m editorial_crew "apps/chimney-repair/src/data/generated_content/*.md"
python -m editorial_crew "apps/deck-repair/src/data/generated_content/*.md"
python -m editorial_crew "apps/crawlspace-rot/src/data/generated_content/*.md"
```

- [ ] **Step 2: Review diffs, accept or adjust**
- [ ] **Step 3: Run on remaining 8 sites**
- [ ] **Step 4: Commit per-site**

## Task 19: Run Editorial Crew on All Blog Posts

- [ ] **Step 1: Run on Tier 1 blog posts** — `apps/{site}/src/data/blog-posts.ts`
- [ ] **Step 2: Review and accept**
- [ ] **Step 3: Run on remaining sites**
- [ ] **Step 4: Commit per-site**

## Task 20: Enrich Content with New Components

- [ ] **Step 1: Add TrustBadges to all service page templates**
- [ ] **Step 2: Add BeforeAfter to service pages where photo pairs exist**
- [ ] **Step 3: Add inline CTAs to blog posts** (contextual, per-topic)
- [ ] **Step 4: Commit**

## Task 21: Improve Testimonials

- [ ] **Step 1: Source real testimonials** for Tier 1 sites where available
- [ ] **Step 2: Improve base testimonials** — make them more specific and believable
- [ ] **Step 3: Update sfw-data.ts with improved testimonials**
- [ ] **Step 4: Commit**

---

# Phase V2d: Site-by-Site Rollout

> **Note:** This phase applies the new design system, accent colors, and enriched content to all 12 sites. Plan each site as a discrete task.

## Task 22: Pilot — Siding-repair Full V2 Treatment

The pilot site gets everything:
- [ ] **Step 1: Set accent color CSS custom properties** in siding-repair's BaseLayout or a wrapper
- [ ] **Step 2: Replace `primary` color usages with `accent`** in siding-repair's pages
- [ ] **Step 3: Add TrustBadges to homepage**
- [ ] **Step 4: Add StickyMobileCTA**
- [ ] **Step 5: Add BeforeAfter where photo pairs exist**
- [ ] **Step 6: Integrate enriched content from V2c**
- [ ] **Step 7: Build and run visual QA**
- [ ] **Step 8: Review in browser — manually check visual quality**
- [ ] **Step 9: Commit**

## Task 23: Extract Pilot Patterns into Shared Components

- [ ] **Step 1: Identify siding-repair-specific code that should be shared**
- [ ] **Step 2: Move patterns into `@sfw/ui` and `@sfw/config`**
- [ ] **Step 3: Verify siding-repair still works after extraction**
- [ ] **Step 4: Commit**

## Task 24: Roll Out to Tier 1 (chimney, deck, crawlspace)

- [ ] **Step 1: Apply accent colors per site**
- [ ] **Step 2: Add new components to each site's pages**
- [ ] **Step 3: Verify with visual QA per site**
- [ ] **Step 4: Commit per site**

## Task 25: Roll Out to Tier 2 (leak, lead-paint, flashing, dry-rot)

Same pattern as Task 24, applied to 4 sites.

## Task 26: Roll Out to Tier 3 (trim, restoration, beam, mold-testing)

Same pattern as Task 24, applied to 4 sites.

## Task 27: Add Component Catalog to All Sites

- [ ] **Step 1: Create or update `test-components.astro`** with all V2 components
- [ ] **Step 2: Deploy to all 12 sites**
- [ ] **Step 3: Commit**

## Task 28: V2 Final Verification

- [ ] **Step 1: Run visual QA on all 12 sites**

```bash
for site in beam-repair chimney-repair crawlspace-rot deck-repair dry-rot flashing-repair lead-paint leak-repair mold-testing restoration siding-repair trim-repair; do
  node tools/visual-qa/run.js "$site"
done
```

- [ ] **Step 2: Run full lint + typecheck + build**

```bash
pnpm lint && pnpm format:check && pnpm build
```

- [ ] **Step 3: Verify CI is green on GitHub Actions**

- [ ] **Step 4: Review V2 exit criteria**

- [ ] All checks from spec V2 Exit Criteria:
  - [ ] ESLint + Prettier + pre-commit hooks configured and passing
  - [ ] GitHub Actions CI running on push to `main`
  - [ ] Editorial crew integrated into `tools/editorial-crew/`
  - [ ] New design token system (colors, typography, spacing) in `@sfw/config`
  - [ ] Per-site accent colors defined for all 12 sites
  - [ ] HeroSection refactored into composable sub-components
  - [ ] Button/FormButton consolidated
  - [ ] Inline scripts extracted to modules
  - [ ] At least 6 new component types shipped in `@sfw/ui`
  - [ ] `cn()` utility in `@sfw/utils`
  - [ ] Content editorial pass complete on all service pages
  - [ ] Content editorial pass complete on all blog posts
  - [ ] All 12 sites on the new design system
  - [ ] Component catalog page on each site
  - [ ] Real or improved testimonials on all sites

---

## Task Dependency Graph

```
V2a: DX Foundation
  Task 1 (ESLint)              — first
  Task 2 (Prettier)            — after Task 1
  Task 3 (Unified lint)        — after Tasks 1-2
  Task 4 (Husky)               — after Task 3
  Task 5 (CI)                  — after Task 3
  Task 6 (Editorial crew)      — independent of 1-5
  Task 7 (V2a verification)    — after all above

V2b: Design System
  Task 8 (cn utility)          — first in V2b
  Task 9 (Design tokens)       — after Task 8
  Task 10 (Inter font)         — after Task 9
  Task 11 (Button consolidate) — after Task 8
  Task 12 (Hero refactor)      — after Task 8
  Task 13 (Script extraction)  — after Task 12
  Task 14 (Transitions)        — after Tasks 11-13
  Tasks 15-17 (New components) — after Task 9

V2c: Content Quality
  Task 18 (Service pages)      — after Task 6 (editorial crew)
  Task 19 (Blog posts)         — after Task 18
  Task 20 (Enrich content)     — after Tasks 15-17 (new components)
  Task 21 (Testimonials)       — independent

V2d: Rollout
  Task 22 (Pilot: siding)      — after V2b + V2c
  Task 23 (Extract patterns)   — after Task 22
  Tasks 24-26 (Remaining)      — after Task 23
  Task 27 (Component catalog)  — after Tasks 24-26
  Task 28 (Verification)       — after all
```

## Notes

- **V2b design decisions need visual exploration.** The accent colors in Task 9 are starting points. Plan to iterate during the pilot (Task 22) — view in browser, adjust, re-deploy.
- **Typography choice (Inter) can be changed.** The spec listed candidates. Inter is the recommendation but DM Sans or another face could be substituted at Task 10.
- **V2c can start before V2b is complete.** The editorial crew (Task 6) is in V2a, and editorial execution (Tasks 18-19) doesn't depend on the design system. Content enrichment (Task 20) does depend on new components.
- **The pilot (Task 22) is the most important task.** It validates the entire design system end-to-end. Budget extra time here for iteration.
- **Low-priority components (SocialProofTicker, InteractiveMap) are intentionally deferred.** They can be added in V3 or as stretch goals after V2d.

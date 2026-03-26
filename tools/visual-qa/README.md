# Visual QA Tool

Playwright-based visual QA for SFW microsites. Spins up a dev server, checks key pages, and reports results with screenshots.

## Setup

```bash
cd tools/visual-qa
npm install
```

This installs Playwright and downloads Chromium automatically.

## Usage

```bash
# Check all key pages on a site
node tools/visual-qa/run.js siding-repair

# Check only the homepage
node tools/visual-qa/run.js beam-repair --page=/

# Check a specific path
node tools/visual-qa/run.js chimney-repair --page=/blog
```

## What It Checks

Per page:
- **HTTP status** — page returns 2xx/3xx
- **Console errors** — no `console.error` output
- **Uncaught exceptions** — no `pageerror` events
- **Broken images** — all `<img>` elements load successfully
- **Key components** — `<header>`, `<main#main-content>`, `<footer>` are present
- **Content** — main content area has visible text (>50 chars)
- **Hero section** — first `<section>` present on homepage

## Output

- **Exit code:** 0 = all pass, 1 = failures found, 2 = tool error
- **Stdout:** Human-readable summary with PASS/FAIL per page and per check
- **JSON report:** `tools/visual-qa/reports/{site}/{timestamp}/report.json`
- **Screenshots:** Full-page PNG per checked page in the same directory

## Agent Integration

Agents should run this after making changes and check the exit code:
- Exit 0: changes are safe
- Exit 1: read stdout for which checks failed and fix

The JSON report at `report.json` has this structure:
```json
{
  "site": "siding-repair",
  "passed": true,
  "summary": { "pages": { "total": 4, "passed": 4, "failed": 0 }, "checks": { "..." } },
  "results": [
    { "page": "homepage", "passed": true, "checks": ["..."], "screenshot": "..." }
  ]
}
```

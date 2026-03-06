# Service Page Clusters — Design

**Date:** 2026-03-06
**Status:** Approved

## Overview

Reorganize service pages across 10 microsites from granular per-service pages into SEO-focused "cluster" pages. Each cluster is a main service page (H1) with subtopics as H2 sections. New cluster pages are built for both Portland and Seattle. Existing service pages are redirected to the appropriate cluster page.

Sites covered: beam-repair, chimney-repair, crawlspace-rot, deck-repair, dry-rot, flashing-repair, lead-paint, leak-repair, siding-repair, trim-repair.
Sites not covered (untouched): mold-testing, restoration.

---

## File Structure

New stub markdown files use a `cluster_` prefix to distinguish them from legacy service pages:

```
apps/<site>/src/data/generated_content/
  # Legacy files (kept until content migration is complete, then removed)
  service_page_<slug>_portland.md
  service_page_<slug>_seattle.md

  # New cluster stubs
  service_page_cluster_<cluster-slug>_portland.md
  service_page_cluster_<cluster-slug>_seattle.md
```

The `cluster_` prefix tells the data loader to use the new cluster loader rather than the legacy service loader.

---

## Stub Markdown Format

```markdown
# Deck Board Repair & Replacement - Portland, Oregon

<!-- CLUSTER_META
service: deck-repair
cluster_id: 1
cluster_slug: deck-board-repair-replacement
location: portland
status: stub
subtopics:
  - Deck Board Removal & Refastening
  - Rotten Deck Board Replacement
  - Deck Surface Repair & Refinishing
  - Touch-Up Sanding & Staining
  - Deck Fascia Board Repair
  - Deck Rim Joist Repair
-->

## Hero Section

### [STUB] Deck Board Repair & Replacement in Portland, Oregon
*Content to be generated.*

## Deck Board Removal & Refastening
*Content to be generated.*

## Rotten Deck Board Replacement
*Content to be generated.*

...

## FAQ Section
*Content to be generated.*

## Page Metadata

**Service:** Deck Board Repair & Replacement
**Location:** Portland, Oregon
**Status:** STUB
**Cluster ID:** 1
**Target Keywords:** [to be filled]
```

The `CLUSTER_META` HTML comment block is machine-readable for the content generator. Each subtopic becomes an H2 section — this is the authoritative data structure for future content generation.

---

## Redirect Implementation

Each app's `astro.config.mjs` gets a `redirects` block. Old slugs map to new cluster slugs for both locations. Multiple old slugs can map to the same cluster (many-to-one). Astro uses 301 permanent redirects for static output.

```js
// apps/deck-repair/astro.config.mjs
export default defineConfig({
  redirects: {
    '/services/portland/deck-board-replacement': '/services/portland/deck-board-repair-replacement',
    '/services/seattle/deck-board-replacement':  '/services/seattle/deck-board-repair-replacement',
    '/services/portland/deck-surface-refinishing': '/services/portland/deck-board-repair-replacement',
    '/services/seattle/deck-surface-refinishing':  '/services/seattle/deck-board-repair-replacement',
    // ... all old slugs for this app
  }
})
```

Legacy markdown files are **not deleted** during this phase — they remain as content reference until cluster stubs are populated with generated content.

---

## Migration Documentation & Validation

**Redirect map:** `docs/migration/service-page-redirects.md`

One table per site, every old URL mapped to its new cluster URL:

```markdown
## deck-repair
| Old URL | New URL | Status |
|---------|---------|--------|
| /services/portland/deck-board-replacement | /services/portland/deck-board-repair-replacement | ✅ |
```

**Validation script:** `tools/migration/validate-redirects.js`

1. Reads each app's `astro.config.mjs` redirects block
2. Reads every non-cluster `service_page_*.md` to enumerate all old slugs
3. Confirms every old slug has a redirect entry
4. Reports gaps as errors

```bash
node tools/migration/validate-redirects.js
```

Pass/fail per site with a summary count. All sites must pass before legacy files are removed.

---

## Content Generator Changes

**`tools/content-generator/config/clusters.json`** — authoritative cluster definitions extracted from `service_page_clusters.xlsx`:

```json
{
  "deck-repair": [
    {
      "id": 1,
      "name": "Deck Board Repair & Replacement",
      "slug": "deck-board-repair-replacement",
      "subtopics": [
        "Deck Board Removal & Refastening",
        "Rotten Deck Board Replacement",
        "Deck Surface Repair & Refinishing",
        "Touch-Up Sanding & Staining",
        "Deck Fascia Board Repair",
        "Deck Rim Joist Repair"
      ]
    }
  ]
}
```

**`tools/content-generator/generate-stubs.js`** — reads `clusters.json`, writes stub markdown files to each app for both Portland and Seattle. Safe to re-run (skips existing files unless `--force`).

```bash
node tools/content-generator/generate-stubs.js
node tools/content-generator/generate-stubs.js --force
```

This makes `clusters.json` the single source of truth for cluster definitions, stub generation, and future AI content generation.

---

## URL Structure

No change to the dynamic route. New cluster pages are served by the existing `[location]/[service].astro` route once the cluster loader is wired up.

```
/services/portland/deck-board-repair-replacement   # new cluster page
/services/seattle/deck-board-repair-replacement    # new cluster page
/services/portland/deck-board-replacement          # 301 → above
```

---

## Cluster Counts by Site

| Site | Clusters |
|------|----------|
| deck-repair | 7 |
| dry-rot | 7 |
| leak-repair | 7 |
| siding-repair | 7 |
| beam-repair | 6 |
| crawlspace-rot | 6 |
| lead-paint | 6 |
| flashing-repair | 6 |
| trim-repair | 6 |
| chimney-repair | 5 |
| **Total** | **63 clusters × 2 locations = 126 stub files** |

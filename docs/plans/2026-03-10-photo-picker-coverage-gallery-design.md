# Photo Picker — Coverage & Gallery Views Design Doc

**Date:** 2026-03-10
**Status:** Approved

## Overview

Add two new tab views to the existing photo-picker web app: a **Coverage dashboard** showing image instrumentation across all microsites, and a **Gallery by service** view for browsing uploaded images per site.

## Navigation

Shared tab bar across all three pages:

```
[ Upload ]  [ Coverage ]  [ Gallery ]
```

Each tab is a separate static HTML page served by the existing Express server.

## New Files

```
tools/photo-picker/public/coverage.html
tools/photo-picker/public/gallery.html
```

## New API Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/coverage` | All sites: cluster count + how many have ≥1 servicePageImage |
| `GET /api/coverage/:microsite` | Single site: per-cluster breakdown |
| `GET /api/gallery/:microsite` | Images grouped by clusterSlug with titles |

All endpoints read from existing `apps/{microsite}/src/data/images.json` files and reuse the cluster-slug parsing already in `server.js` (`/api/service-topics`).

### `GET /api/coverage` response shape

```json
[
  {
    "key": "deck-repair",
    "name": "Deck Repair Experts",
    "domain": "deckrepairexpert.com",
    "totalClusters": 7,
    "coveredClusters": 4
  }
]
```

### `GET /api/coverage/:microsite` response shape

```json
{
  "microsite": "deck-repair",
  "clusters": [
    {
      "clusterSlug": "deck-stairs-railings",
      "title": "Deck Stairs & Railings",
      "imageCount": 4,
      "hasHero": true,
      "hasHeaderTexture": false
    }
  ]
}
```

### `GET /api/gallery/:microsite` response shape

```json
{
  "microsite": "deck-repair",
  "clusters": [
    {
      "clusterSlug": "deck-stairs-railings",
      "title": "Deck Stairs & Railings",
      "images": [
        {
          "url": "https://...blob.vercel-storage.com/...",
          "title": "Deck Guardrail Repair",
          "isHero": false,
          "isHeaderTexture": false
        }
      ]
    }
  ]
}
```

## Coverage Page

### Site cards grid

- One card per microsite
- Shows: site name, domain, progress bar, `X / Y clusters covered` badge
- Badge color: green (100%), amber (1–99%), gray (0%)
- Click a card → inline cluster breakdown table appears below the grid

### Cluster breakdown table (inline, replaces previous selection)

Columns:

| Service cluster | Images | Hero | Header texture | Status |
|---|---|---|---|---|
| Deck Stairs & Railings | ● ● ● ● | ● | ○ | No texture |

- **Images:** one dot per servicePageImage entry for that cluster slug
- **Hero:** blue dot if `heroImages[clusterSlug]` is set in images.json
- **Header texture:** blue dot if `backgroundImages[clusterSlug]` is set in images.json
- **Status chip logic:**
  - `Done` (green) — ≥1 image + hero + header texture all set
  - `No texture` (amber) — images + hero but no backgroundImage
  - `No hero` (amber) — images present but heroImage missing
  - `Missing` (gray) — no servicePageImages at all

Link in the detail header: "View gallery →" navigates to gallery.html with that site pre-selected.

## Gallery Page

### Site picker

Dropdown at top of page. Changing selection reloads the cluster grid.

### Cluster sections

- One section per cluster slug, sorted alphabetically by title
- Section header: cluster title + image count + href path
- Clusters with no images show a single dashed empty-slot card

### Image cards

Each card shows:
- Thumbnail (`<img src="[blob url]">`)
- Filename (from URL pathname)
- **Subtitle** (from `servicePageImages[].title`, e.g. "Deck Guardrail Repair")
- File size (not available from images.json — omit or show "—")
- `HERO` tag (blue) if image URL matches `heroImages[clusterSlug]`
- `TEXTURE` tag if image URL matches `backgroundImages[clusterSlug]`

## Data Sources

- Cluster slugs + titles: parsed from `apps/{microsite}/src/data/generated_content/service_page_cluster_*_portland.md` (same logic as existing `/api/service-topics`)
- Image coverage: `apps/{microsite}/src/data/images.json`
  - `servicePageImages[].href` contains the clusterSlug (e.g. `/services/portland/deck-stairs-railings`)
  - `heroImages` keyed by clusterSlug
  - `backgroundImages` keyed by clusterSlug

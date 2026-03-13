# Service Gallery Photo Logic Design

**Date:** 2026-03-13
**Ticket:** SFW-9
**Status:** Approved

## Problem

When a service page has 10+ configured photos, the current logic only displays 4 and loses the rest. The current implementation pads galleries with photos from other services in the same location, even when the current service has plenty of photos.

## Solution

Redesign the gallery selection logic to:
1. Prioritize showing photos from the current service
2. Randomly select 4 photos for variety across page loads
3. Fill remaining slots with a random service from the same location only when the current service has fewer than 4 photos
4. Keep the existing 4-column grid layout

## Design Details

### Service Page Logic (`apps/*/src/pages/services/[location]/[service].astro`)

The photo selection process happens when building `galleryServices`:

```
1. Filter servicePageImages for the current service (by href)

2. Branch by photo count:

   a) 4 or more photos exist:
      - Shuffle randomly
      - Take first 4
      - Return

   b) 1-3 photos exist:
      - Keep all of them
      - Calculate needed slots: 4 - photoCount
      - Randomly select one other service from the same location
      - Take enough photos from that service to fill remaining slots
      - Return combined result

   c) 0 photos exist:
      - Randomly select one other service from the same location
      - Take 4 photos from that service
      - Return

3. If location has only one service (no fallback available):
      - Return whatever photos exist for the current service
      - Gallery may render with fewer than 4 items
```

### Component Changes (`packages/ui/src/components/content/ServicesGallery.astro`)

**Remove strict validation:**
- Current: Requires exactly 4 services with images, hides entire gallery otherwise
- New: Accept 0-4+ services, render what's provided

**Update rendering:**
- Remove `.slice(0, 4)` limit to allow flexible counts
- Grid layout remains 4-column (CSS handles variable item count)
- Dev warning only when `services.length === 0` (no photos at all)

### Data Structures

Photos in `services/*/src/data/images.json`:
```json
{
  "servicePageImages": [
    {
      "title": "Photo description",
      "description": "",
      "image": "https://...",
      "href": "/services/portland/siding-rot-repair"
    }
  ]
}
```

Selection preserves the `GalleryService` interface:
```typescript
interface GalleryService {
  title: string;
  description: string;
  image: string;
  href: string;
}
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Service has 0 photos, location has only that service | Gallery hidden, dev warning shown |
| Service has 1-3 photos, no other services in location | Display available photos only |
| Service has 4+ photos | Randomly select 4 from that service |
| Service has 10+ photos | Randomly select 4 from that service |
| Fallback service has fewer than needed photos | Use all available photos from fallback |

## Randomization

- Shuffle using native `Array.sort()` with `Math.random()`
- Shuffle occurs on every page load (no seeding)
- Each visit shows different 4 photos from services with 4+ photos

## Impact

**Affected Files:**
- `apps/*/src/pages/services/[location]/[service].astro` (all 11 apps)
- `packages/ui/src/components/content/ServicesGallery.astro`

**Unaffected:**
- Photo data structure (servicePageImages)
- Grid styling (4-column layout)
- Component props/interface

## Success Criteria

- [ ] Services with 10+ photos display 4 random photos from that service
- [ ] Services with 1-3 photos show their photos + random fallback service
- [ ] Services with 0 photos show 4 from a random same-location service
- [ ] Gallery never pads with other-location services
- [ ] Linting passes on all affected apps
- [ ] No visual regressions in gallery appearance

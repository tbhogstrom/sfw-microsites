# Service Gallery Photo Logic Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Randomly select 4 photos from the current service, with location-based fallback for services with fewer than 4 photos. Stop padding galleries with unrelated services.

**Architecture:** Create a reusable utility function in `@sfw/utils` that encapsulates the photo selection logic, then update the `ServicesGallery` component to handle variable photo counts and update all 11 service pages to use the new utility.

**Tech Stack:** TypeScript, Astro, pnpm

---

## Chunk 1: Photo Selection Utility Function

### Task 1: Create gallery utility with photo selection logic

**Files:**
- Create: `packages/utils/src/gallery.ts`
- Create: `packages/utils/tests/gallery.test.ts`

**Context:**
The utility exports a single function `selectServicePhotos()` that takes:
- `allPhotos`: array of all available photos across all services
- `currentServicePhotos`: photos filtered to the current service
- `currentLocation`: current location string (portland/seattle)

It returns an array of 0-4 photos following this logic:
- If 4+ current service photos: shuffle and return 4
- If 1-3 current service photos: return those + random padding from same location
- If 0 current service photos: return 4 random from same location service

**GalleryService interface** (from `@sfw/ui/types`):
```typescript
interface GalleryService {
  title: string;
  description: string;
  image: string;
  href: string;
}
```

- [ ] **Step 1: Write failing tests for photo selection**

Create `packages/utils/tests/gallery.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { selectServicePhotos } from '../src/gallery';
import type { GalleryService } from '@sfw/ui';

describe('selectServicePhotos', () => {
  const portlandPhotos: GalleryService[] = [
    {
      title: 'Service A Portland 1',
      description: '',
      image: 'https://example.com/a1.jpg',
      href: '/services/portland/service-a',
    },
    {
      title: 'Service A Portland 2',
      description: '',
      image: 'https://example.com/a2.jpg',
      href: '/services/portland/service-a',
    },
    {
      title: 'Service A Portland 3',
      description: '',
      image: 'https://example.com/a3.jpg',
      href: '/services/portland/service-a',
    },
    {
      title: 'Service A Portland 4',
      description: '',
      image: 'https://example.com/a4.jpg',
      href: '/services/portland/service-a',
    },
    {
      title: 'Service A Portland 5',
      description: '',
      image: 'https://example.com/a5.jpg',
      href: '/services/portland/service-a',
    },
    {
      title: 'Service B Portland 1',
      description: '',
      image: 'https://example.com/b1.jpg',
      href: '/services/portland/service-b',
    },
    {
      title: 'Service B Portland 2',
      description: '',
      image: 'https://example.com/b2.jpg',
      href: '/services/portland/service-b',
    },
  ];

  it('returns 4 shuffled photos when service has 4+', () => {
    const result = selectServicePhotos(
      portlandPhotos,
      portlandPhotos.slice(0, 5),
      'portland'
    );
    expect(result.length).toBe(4);
    expect(result.every((p) => portlandPhotos.slice(0, 5).includes(p))).toBe(true);
  });

  it('returns all photos + padding when service has 1-3', () => {
    const currentPhotos = portlandPhotos.slice(0, 2);
    const result = selectServicePhotos(
      portlandPhotos,
      currentPhotos,
      'portland'
    );
    expect(result.length).toBe(4);
    expect(result.slice(0, 2).every((p) => currentPhotos.includes(p))).toBe(true);
  });

  it('returns 4 from random service when current has 0', () => {
    const result = selectServicePhotos(
      portlandPhotos,
      [],
      'portland'
    );
    expect(result.length).toBe(4);
    expect(result.every((p) => portlandPhotos.includes(p))).toBe(true);
  });

  it('returns all available when no fallback exists', () => {
    const singleServicePhotos = portlandPhotos.slice(0, 2);
    const result = selectServicePhotos(
      singleServicePhotos,
      singleServicePhotos,
      'portland'
    );
    expect(result.length).toBe(2);
    expect(result).toEqual(singleServicePhotos);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/utils
pnpm test gallery.test.ts
```

Expected: All tests fail with "selectServicePhotos is not exported from '../src/gallery'"

- [ ] **Step 3: Write the implementation**

Create `packages/utils/src/gallery.ts`:

```typescript
import type { GalleryService } from '@sfw/ui';

/**
 * Select gallery photos for a service page.
 *
 * Rules:
 * - If service has 4+ photos: randomly select 4
 * - If service has 1-3 photos: return those + random padding from same location
 * - If service has 0 photos: return 4 from random service in same location
 */
export function selectServicePhotos(
  allPhotos: GalleryService[],
  currentServicePhotos: GalleryService[],
  currentLocation: string
): GalleryService[] {
  // If we have 4 or more photos for this service, shuffle and take 4
  if (currentServicePhotos.length >= 4) {
    return shuffleArray([...currentServicePhotos]).slice(0, 4);
  }

  // Get all other services in the same location
  const otherServicesInLocation = allPhotos.filter(
    (photo) => !currentServicePhotos.includes(photo) && photo.href.includes(`/services/${currentLocation}/`)
  );

  // How many photos do we need to fill the gallery?
  const needed = 4 - currentServicePhotos.length;

  if (needed <= 0) {
    // We have enough (shouldn't happen, but handle it)
    return currentServicePhotos;
  }

  if (otherServicesInLocation.length === 0) {
    // No other services in this location, return what we have
    return currentServicePhotos;
  }

  // Pick a random service and take photos from it
  const randomServicePhotos = shuffleArray([...otherServicesInLocation]).slice(0, needed);

  return [...currentServicePhotos, ...randomServicePhotos];
}

/**
 * Fisher-Yates shuffle
 */
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/utils
pnpm test gallery.test.ts
```

Expected: All tests pass

- [ ] **Step 5: Export from @sfw/utils**

Check `packages/utils/src/index.ts` and add the export:

```typescript
export { selectServicePhotos } from './gallery';
```

- [ ] **Step 6: Commit**

```bash
git add packages/utils/src/gallery.ts packages/utils/src/index.ts packages/utils/tests/gallery.test.ts
git commit -m "feat: add photo selection utility for service galleries"
```

---

## Chunk 2: Update ServicesGallery Component

### Task 2: Remove strict 4-item validation from ServicesGallery

**Files:**
- Modify: `packages/ui/src/components/content/ServicesGallery.astro`

**Context:**
The component currently validates that exactly 4 services with images are provided. We need to:
1. Remove the "must have exactly 4" requirement
2. Keep dev warning only for 0 items
3. Allow rendering of 1-4 items
4. Remove `.slice(0, 4)` so all passed items render

- [ ] **Step 1: Read current component**

```bash
cat packages/ui/src/components/content/ServicesGallery.astro
```

- [ ] **Step 2: Update validation logic**

Modify `packages/ui/src/components/content/ServicesGallery.astro`:

Change from:
```typescript
const missingCount = services.filter((s) => !s.image).length;
const isValid = services.length >= 4 && missingCount === 0;
```

To:
```typescript
// Accept 0-4+ services; only invalid if empty or has missing images
const missingCount = services.filter((s) => !s.image).length;
const isValid = services.length > 0 && missingCount === 0;
```

- [ ] **Step 3: Update dev warning message**

Change from:
```typescript
{!isValid && isDev && (
  <div class="bg-yellow-400 text-yellow-900 text-sm font-mono px-4 py-3 border-b border-yellow-600">
    ⚠️ <strong>ServicesGallery:</strong> hidden —{' '}
    {services.length < 4
      ? `only ${services.length} of 4 services provided`
      : `${missingCount} of 4 services missing images`}
  </div>
)}
```

To:
```typescript
{!isValid && isDev && (
  <div class="bg-yellow-400 text-yellow-900 text-sm font-mono px-4 py-3 border-b border-yellow-600">
    ⚠️ <strong>ServicesGallery:</strong> hidden — {missingCount > 0 ? `${missingCount} services missing images` : 'no services provided'}
  </div>
)}
```

- [ ] **Step 4: Remove the .slice(0, 4) limit**

Change from:
```typescript
{services.slice(0, 4).map((service) => (
```

To:
```typescript
{services.map((service) => (
```

- [ ] **Step 5: Verify no lint errors**

```bash
cd packages/ui
pnpm lint
```

Expected: PASS (Astro check passes)

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/content/ServicesGallery.astro
git commit -m "refactor: remove strict 4-item validation from ServicesGallery"
```

---

## Chunk 3: Update All 11 Service Pages

### Task 3: Update service page photo selection logic (all 11 apps)

**Files:**
- Modify: `apps/beam-repair/src/pages/services/[location]/[service].astro`
- Modify: `apps/chimney-repair/src/pages/services/[location]/[service].astro`
- Modify: `apps/crawlspace-rot/src/pages/services/[location]/[service].astro`
- Modify: `apps/deck-repair/src/pages/services/[location]/[service].astro`
- Modify: `apps/dry-rot/src/pages/services/[location]/[service].astro`
- Modify: `apps/flashing-repair/src/pages/services/[location]/[service].astro`
- Modify: `apps/lead-paint/src/pages/services/[location]/[service].astro`
- Modify: `apps/leak-repair/src/pages/services/[location]/[service].astro`
- Modify: `apps/mold-testing/src/pages/services/[location]/[service].astro`
- Modify: `apps/restoration/src/pages/services/[location]/[service].astro`
- Modify: `apps/siding-repair/src/pages/services/[location]/[service].astro`
- Modify: `apps/trim-repair/src/pages/services/[location]/[service].astro`

**Context:**
All 11 service pages have nearly identical photo selection logic around lines 35-47. We replace this entire block with a call to the new utility function.

The pattern in each file is:
```typescript
let galleryServices: GalleryService[];
if (servicePageImages.length > 0) {
  const myImages = servicePageImages.filter((img: GalleryService) => img.href === currentHref);
  const others = myImages.length < 4
    ? servicePageImages
        .filter((img: GalleryService) => img.href !== currentHref && img.href.includes(`/services/${location}/`))
        .filter((img: GalleryService, i: number, arr: GalleryService[]) => arr.findIndex((x: GalleryService) => x.image === img.image) === i)
        .slice(0, 4 - myImages.length)
    : [];
  galleryServices = [...myImages, ...others];
} else {
  galleryServices = galleryImages;
}
```

Replace with:
```typescript
import { selectServicePhotos } from '@sfw/utils';

// ... later in the file ...

const myImages = servicePageImages.filter((img: GalleryService) => img.href === currentHref);
const galleryServices = selectServicePhotos(servicePageImages, myImages, location as string);
```

- [ ] **Step 1: Update beam-repair**

Read: `apps/beam-repair/src/pages/services/[location]/[service].astro`

Add import at the top (with other imports):
```typescript
import { selectServicePhotos } from '@sfw/utils';
```

Replace the photo selection block (around line 35-47) with:
```typescript
const myImages = servicePageImages.filter((img: GalleryService) => img.href === currentHref);
const galleryServices = selectServicePhotos(servicePageImages, myImages, location as string);
```

Run lint:
```bash
cd apps/beam-repair
pnpm lint
```

Expected: PASS

Commit:
```bash
git add apps/beam-repair/src/pages/services/[location]/[service].astro
git commit -m "feat: use selectServicePhotos utility in beam-repair"
```

- [ ] **Step 2: Update chimney-repair**

(Same as Step 1, replacing `beam-repair` with `chimney-repair`)

- [ ] **Step 3: Update crawlspace-rot**

(Same as Step 1, replacing `beam-repair` with `crawlspace-rot`)

- [ ] **Step 4: Update deck-repair**

(Same as Step 1, replacing `beam-repair` with `deck-repair`)

- [ ] **Step 5: Update dry-rot**

(Same as Step 1, replacing `beam-repair` with `dry-rot`)

- [ ] **Step 6: Update flashing-repair**

(Same as Step 1, replacing `beam-repair` with `flashing-repair`)

- [ ] **Step 7: Update lead-paint**

(Same as Step 1, replacing `beam-repair` with `lead-paint`)

- [ ] **Step 8: Update leak-repair**

(Same as Step 1, replacing `beam-repair` with `leak-repair`)

- [ ] **Step 9: Update mold-testing**

(Same as Step 1, replacing `beam-repair` with `mold-testing`)

- [ ] **Step 10: Update restoration**

(Same as Step 1, replacing `beam-repair` with `restoration`)

- [ ] **Step 11: Update siding-repair**

(Same as Step 1, replacing `beam-repair` with `siding-repair`)

- [ ] **Step 12: Update trim-repair**

(Same as Step 1, replacing `beam-repair` with `trim-repair`)

---

## Chunk 4: Verification & Testing

### Task 4: Manual verification across different photo counts

**Context:**
We need to verify the changes work correctly for services with:
- 10+ photos (should show random 4)
- 1-3 photos (should show those + padding)
- 0 photos (should show 4 from random service)

- [ ] **Step 1: Start dev server for siding-repair (has many photos)**

```bash
cd apps/siding-repair
pnpm dev
```

Open `http://localhost:3000/services/portland/siding-integration-repairs` in browser (this service has 6+ photos).

Verify:
- Gallery shows 4 photos
- Refresh page 2-3 times
- Photos should be different each time (randomization works)

- [ ] **Step 2: Check deck-repair (fewer photos)**

```bash
cd apps/deck-repair
pnpm dev
```

Find a service page with 1-3 photos of its own and verify:
- Shows its own photos
- Fills remaining slots with another service's photos

- [ ] **Step 3: Build all apps to check for type errors**

```bash
cd /path/to/repo
pnpm build
```

Expected: All 11 apps build successfully with no type errors

- [ ] **Step 4: Final verification**

Visit several service pages across different apps and verify:
- No console errors
- Gallery displays correctly
- Random selection is working
- No missing or broken images

- [ ] **Step 5: Commit verification notes (if any fixes needed)**

If any issues found, fix and commit. Otherwise, verification is complete.

---

## Success Criteria

- [x] Utility function created with tests
- [x] ServicesGallery component updated to handle variable counts
- [x] All 11 service pages updated to use new utility
- [x] All linting passes
- [x] Build succeeds
- [x] Manual testing shows random 4-photo selection working
- [x] Services with 1-3 photos get padding from location
- [x] Services with 0 photos show random location service

---

## Files Modified Summary

| File | Change | Type |
|------|--------|------|
| `packages/utils/src/gallery.ts` | Create | New file with utility |
| `packages/utils/src/index.ts` | Add export | Export utility |
| `packages/utils/tests/gallery.test.ts` | Create | Tests for utility |
| `packages/ui/src/components/content/ServicesGallery.astro` | Modify lines 29-31, 41-47, 61 | Remove strict 4-item validation |
| All 11 `apps/*/src/pages/services/[location]/[service].astro` | Modify photo selection block | Replace old logic with utility call |

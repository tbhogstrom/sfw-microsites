# Services Gallery Component Design

**Date:** 2026-03-04
**Status:** Approved

## Overview

A 4-card "Our Services" picture gallery section for use on microsite homepages. Each card displays a sub-service specific to that site (not links to other microsites). The section is self-hiding: if any of the 4 cards is missing an image, the entire section renders nothing in production.

## Component

**File:** `packages/ui/src/components/content/ServicesGallery.astro`

### Props

```ts
interface GalleryService {
  title: string;
  description: string;
  image: string;   // Vercel Blob URL
  href: string;    // Internal page link e.g. /services/dry-rot-inspection
}

interface Props {
  heading?: string;           // Optional section heading, e.g. "Our Services"
  services: GalleryService[]; // Exactly 4 items expected
  variant?: 'light' | 'dark'; // Background color of section wrapper
}
```

### Render Logic

- If `services.length < 4` OR any item has an empty/falsy `image`, render nothing.
- In `import.meta.env.DEV` mode, render a visible yellow warning banner instead:
  `"ServicesGallery: hidden — X of 4 services missing images"`
- Otherwise render the full section.

### Layout

- Section: `py-16`, `bg-white` (light) or `bg-gray-50` (dark)
- Optional centered heading above grid
- Grid: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`
- Card min-height: `h-72`
- Each card: full-bleed background image, dark gradient overlay (`from-dark via-dark/70 to-transparent`), title + description + "Learn More" arrow link pinned to bottom
- Hover: subtle image scale (`group-hover:scale-105`) for interactivity

### Exports

- Added to `packages/ui/src/components/content/index.ts`
- Re-exported from `packages/ui/src/index.ts` via the content barrel

## Usage

```astro
---
import { ServicesGallery } from '@sfw/ui';
---

<ServicesGallery
  heading="Our Rot Repair Services"
  services={[
    {
      title: 'Dry Rot Inspection',
      description: 'Thorough moisture assessment to identify all affected areas.',
      image: 'https://blob.url/services/inspection.png',
      href: '/services/inspection',
    },
    {
      title: 'Wood Replacement',
      description: 'Full replacement of compromised structural lumber.',
      image: 'https://blob.url/services/wood-replacement.png',
      href: '/services/wood-replacement',
    },
    {
      title: 'Moisture Control',
      description: 'Vapor barriers and drainage to prevent recurrence.',
      image: 'https://blob.url/services/moisture-control.png',
      href: '/services/moisture-control',
    },
    {
      title: 'Structural Repair',
      description: 'Restore compromised beams, joists, and framing.',
      image: 'https://blob.url/services/structural-repair.png',
      href: '/services/structural-repair',
    },
  ]}
/>
```

## Testing

- Verify section renders with all 4 valid images
- Verify section is invisible in production with any missing image
- Verify yellow dev warning appears in DEV mode with missing images
- Verify responsive layout: 1-col mobile, 2-col tablet, 4-col desktop
- Test in at least one app (dry-rot recommended as first implementation)

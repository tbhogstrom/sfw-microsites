# ServicesGallery Component Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a `ServicesGallery` shared Astro component that renders a responsive 4-card picture gallery of sub-services, and wire it into the dry-rot app as a reference implementation.

**Architecture:** New component in `packages/ui/src/components/content/`, exported via the content barrel and main UI index. Each app passes its own 4-service data array with Vercel Blob image URLs. The component self-hides in production if any card is missing an image; shows a dev warning in DEV mode.

**Tech Stack:** Astro, Tailwind CSS, TypeScript, Vercel Blob URLs (plain `<img>` tags — not `astro:assets` since these are remote URLs with no local dimensions), pnpm workspaces

---

### Task 1: Create `ServicesGallery.astro` in the UI package

**Files:**
- Create: `packages/ui/src/components/content/ServicesGallery.astro`

**Step 1: Create the component file**

```astro
---
/**
 * ServicesGallery.astro - 4-card responsive services picture gallery
 * Renders nothing (production) or a dev warning if any card lacks an image.
 */
import type { BaseProps } from '@sfw/ui/types';

export interface GalleryService {
  title: string;
  description: string;
  image: string;   // Vercel Blob URL
  href: string;    // Internal page path e.g. /services/dry-rot-inspection
}

export interface Props extends BaseProps {
  heading?: string;
  services: GalleryService[];
  variant?: 'light' | 'dark';
}

const {
  heading,
  services,
  variant = 'light',
  class: className = '',
  ...rest
} = Astro.props;

// Validate: need exactly 4 services, all with images
const missingCount = services.filter((s) => !s.image).length;
const isValid = services.length >= 4 && missingCount === 0;
const isDev = import.meta.env.DEV;

const sectionClasses = [
  'py-16 md:py-20',
  variant === 'light' ? 'bg-white' : 'bg-gray-50',
  className,
].filter(Boolean).join(' ');
---

{!isValid && isDev && (
  <div class="bg-yellow-400 text-yellow-900 text-sm font-mono px-4 py-3 border-b border-yellow-600">
    ⚠️ <strong>ServicesGallery:</strong> hidden —{' '}
    {services.length < 4
      ? `only ${services.length} of 4 services provided`
      : `${missingCount} of 4 services missing images`}
  </div>
)}

{isValid && (
  <section class={sectionClasses} {...rest}>
    <div class="container mx-auto px-4 lg:px-6">

      {heading && (
        <h2 class="text-3xl md:text-4xl font-heading font-bold text-dark text-center mb-10">
          {heading}
        </h2>
      )}

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {services.slice(0, 4).map((service) => (
          <a
            href={service.href}
            class="group relative overflow-hidden rounded-lg block h-72 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <!-- Background image -->
            <img
              src={service.image}
              alt={service.title}
              loading="lazy"
              class="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />

            <!-- Dark gradient overlay -->
            <div class="absolute inset-0 bg-gradient-to-t from-dark via-dark/70 to-dark/20"></div>

            <!-- Card content -->
            <div class="absolute inset-0 flex flex-col justify-end p-5">
              <h3 class="text-lg font-heading font-bold text-white mb-1 leading-snug">
                {service.title}
              </h3>
              <p class="text-white/80 text-sm line-clamp-2 mb-3 leading-relaxed">
                {service.description}
              </p>
              <span class="inline-flex items-center text-primary text-sm font-semibold group-hover:underline">
                Learn More
                <svg class="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                </svg>
              </span>
            </div>
          </a>
        ))}
      </div>

    </div>
  </section>
)}
```

**Step 2: Verify the file was created correctly**

```bash
cat packages/ui/src/components/content/ServicesGallery.astro
```

Expected: file contents printed with no errors.

---

### Task 2: Export `ServicesGallery` from the UI package

**Files:**
- Modify: `packages/ui/src/components/content/index.ts`

**Step 1: Add the export lines**

Open `packages/ui/src/components/content/index.ts` and add these two lines after the existing `ServicesOffered` exports:

```ts
export { default as ServicesGallery } from './ServicesGallery.astro';
export type { GalleryService, Props as ServicesGalleryProps } from './ServicesGallery.astro';
```

**Step 2: Verify the file**

```bash
grep "ServicesGallery" packages/ui/src/components/content/index.ts
```

Expected output:
```
export { default as ServicesGallery } from './ServicesGallery.astro';
export type { GalleryService, Props as ServicesGalleryProps } from './ServicesGallery.astro';
```

**Step 3: Commit**

```bash
git add packages/ui/src/components/content/ServicesGallery.astro packages/ui/src/components/content/index.ts
git commit -m "Add ServicesGallery component to @sfw/ui"
```

---

### Task 3: Wire ServicesGallery into the dry-rot app

This is the reference implementation. The dry-rot app (`apps/dry-rot`) is the first site to use the gallery.

**Files:**
- Modify: `apps/dry-rot/src/pages/index.astro`

**Step 1: Add the import**

In `apps/dry-rot/src/pages/index.astro`, find the existing import line:

```astro
import { HeroSection, StatsBar, CTASection, FAQAccordion, BlogCarousel, ServicesOffered } from '@sfw/ui';
```

Replace it with:

```astro
import { HeroSection, StatsBar, CTASection, FAQAccordion, BlogCarousel, ServicesOffered, ServicesGallery } from '@sfw/ui';
import type { GalleryService } from '@sfw/ui';
```

**Step 2: Add the gallery data array**

After the existing `const config = serviceConfigs['dry-rot'];` line, add:

```ts
const galleryServices: GalleryService[] = [
  {
    title: 'Dry Rot Inspection',
    description: 'Moisture meter assessment to locate all active and hidden fungal decay.',
    image: 'https://jybwgio0zt7azf1v.public.blob.vercel-storage.com/hero/Rot_repair_experts_portland__rotrepairportlandcoma_delpmaspu.png',
    href: '/services/dry-rot-inspection',
  },
  {
    title: 'Wood Replacement',
    description: 'Full replacement of compromised beams, joists, and framing with treated lumber.',
    image: 'https://jybwgio0zt7azf1v.public.blob.vercel-storage.com/hero/Rot_repair_experts_portland__rotrepairportlandcoma_delpmaspu.png',
    href: '/services/wood-replacement',
  },
  {
    title: 'Moisture Control',
    description: 'Vapor barriers, ventilation, and drainage solutions to stop rot from returning.',
    image: 'https://jybwgio0zt7azf1v.public.blob.vercel-storage.com/hero/Rot_repair_experts_portland__rotrepairportlandcoma_delpmaspu.png',
    href: '/services/moisture-control',
  },
  {
    title: 'Structural Repair',
    description: 'Restore load-bearing integrity with code-compliant structural repairs.',
    image: 'https://jybwgio0zt7azf1v.public.blob.vercel-storage.com/hero/Rot_repair_experts_portland__rotrepairportlandcoma_delpmaspu.png',
    href: '/services/structural-repair',
  },
];
```

> **Note:** All 4 cards temporarily share the hero image URL. This lets you verify the gallery renders correctly before uploading dedicated per-service images to Blob storage. Swap the URLs when the real images are ready.

**Step 3: Place the component in the page**

In the `<BaseLayout>` JSX body, insert `<ServicesGallery>` between `<StatsBar>` and `<ServicesOffered>`:

```astro
<!-- Stats Bar -->
<StatsBar stats={stats} variant="primary" />

<!-- Services Gallery -->
<ServicesGallery
  heading="Our Rot Repair Services"
  services={galleryServices}
  variant="light"
/>

<!-- Services Offered Section -->
<ServicesOffered
  ...
```

**Step 4: Run the dev server and visually verify**

```bash
cd apps/dry-rot && pnpm dev
```

Open http://localhost:4321 and confirm:
- 4 image cards appear between StatsBar and ServicesOffered
- Cards are 4-across on desktop, 2-across on tablet, 1-across on mobile
- Hover causes subtle image scale
- "Learn More" arrow link is visible on each card
- No console errors

**Step 5: Commit**

```bash
git add apps/dry-rot/src/pages/index.astro
git commit -m "Add ServicesGallery to dry-rot homepage (reference implementation)"
```

---

### Task 4: Build verification

**Step 1: Build the dry-rot app**

```bash
cd apps/dry-rot && pnpm build
```

Expected: build completes with no TypeScript errors and no Astro compilation errors. Output in `apps/dry-rot/dist/`.

**Step 2: Run workspace typecheck**

From the repo root:

```bash
pnpm typecheck
```

Expected: exits with code 0, no type errors reported.

**Step 3: Commit if clean**

If both pass with no errors:

```bash
git add -A
git commit -m "Verify ServicesGallery build and typecheck pass"
```

If there are errors, fix them before committing. Common issues:
- Missing type export in `index.ts` → add the `export type` line
- `import.meta.env.DEV` type error → ensure `astro/client` is in `tsconfig.json` `types` array

---

### Task 5: Test the dev warning banner

**Step 1: Temporarily break the config**

In `apps/dry-rot/src/pages/index.astro`, temporarily set one card's image to an empty string:

```ts
{
  title: 'Dry Rot Inspection',
  description: '...',
  image: '',   // <-- intentionally empty
  href: '/services/dry-rot-inspection',
},
```

**Step 2: Run dev and verify warning shows**

```bash
cd apps/dry-rot && pnpm dev
```

Open http://localhost:4321. Confirm:
- Yellow banner appears at the top of where the gallery would be: `⚠️ ServicesGallery: hidden — 1 of 4 services missing images`
- No gallery cards are rendered

**Step 3: Restore the correct image URL**

Revert the empty image back to the real URL.

**Step 4: Confirm banner is gone**

Reload the page — the yellow banner should be gone and the 4 cards should render again.

---

### Task 6: Push to origin

```bash
git push origin develop
```

---

## Notes for Future Sites

To add the gallery to any other app:

1. Add `ServicesGallery` to the import line in that app's `index.astro`
2. Define a `galleryServices` array with 4 items, each with a unique Vercel Blob image URL
3. Place `<ServicesGallery heading="..." services={galleryServices} />` in the page
4. Upload 4 dedicated service images to that app's Blob store (use the blob-manager tool in `tools/`)

The gallery silently hides itself if any image URL is missing — so partial configs are safe to deploy.

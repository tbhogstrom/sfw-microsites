# Google Maps Embed — Location Pages Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Embed per-location Google Maps iframes on location pages, referencing each GMB listing directly, with two placements: compact above the neighborhood grid, full-size replacing the Service Area block in the contact section.

**Architecture:** Add an optional `mapEmbedSrc` field to the shared `Location` type, create a `GoogleMapEmbed` shared Astro component with `compact`/`full` variants, then wire both placements into `apps/siding-repair`'s location page template. All other apps follow the same pattern when their embed URLs are ready.

**Tech Stack:** Astro, TypeScript, pnpm workspaces, `@sfw/ui`, `@sfw/content`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `packages/content/src/locations.ts` | Add `mapEmbedSrc?: string` to `Location` interface |
| Create | `packages/ui/src/components/content/GoogleMapEmbed.astro` | Renders the GMB iframe in compact or full variant |
| Modify | `packages/ui/src/components/content/index.ts` | Export `GoogleMapEmbed` and its `Props` type |
| Modify | `apps/siding-repair/src/data/locations.ts` | Add `mapEmbedSrc` to the Portland location entry |
| Modify | `apps/siding-repair/src/pages/locations/[slug].astro` | Add map to Neighborhoods section and Contact section |

---

## Chunk 1: Data type + shared component + siding-repair wiring

### Task 1: Add `mapEmbedSrc` to the `Location` interface

**Files:**
- Modify: `packages/content/src/locations.ts`

- [ ] **Step 1: Open the file and locate the `Location` interface**

  File: `packages/content/src/locations.ts`
  The interface already has a `coordinates?` block near the bottom. Add `mapEmbedSrc` in the same optional fields area.

- [ ] **Step 2: Add the field**

  After the `coordinates?` block (around line 55), add:

  ```ts
  // GMB embed
  mapEmbedSrc?: string;
  // Full iframe src URL from Google Maps → Share → Embed a map.
  // References the GMB listing CID directly. No API key needed.
  ```

- [ ] **Step 3: Verify with lint**

  ```bash
  cd apps/siding-repair && pnpm lint
  ```
  Expected: no new errors (field is optional, nothing consumes it yet).

- [ ] **Step 4: Commit**

  ```bash
  git add packages/content/src/locations.ts
  git commit -m "Add mapEmbedSrc field to Location type"
  ```

---

### Task 2: Create `GoogleMapEmbed` component

**Files:**
- Create: `packages/ui/src/components/content/GoogleMapEmbed.astro`

- [ ] **Step 1: Create the file**

  `packages/ui/src/components/content/GoogleMapEmbed.astro`:

  ```astro
  ---
  /**
   * GoogleMapEmbed.astro — embeds a Google Maps GMB listing iframe
   * src: full embed src URL from Google Maps Share → Embed
   * variant: 'compact' (200px, neighborhoods) | 'full' (450px, contact)
   */

  export interface Props {
    src: string;
    variant: 'compact' | 'full';
    title: string;
    class?: string;
  }

  const { src, variant, title, class: className = '' } = Astro.props;

  const height = variant === 'compact' ? '200' : '450';
  ---

  <div class:list={['w-full overflow-hidden rounded-lg', className]}>
    <iframe
      src={src}
      width="100%"
      height={height}
      style="border:0;display:block;"
      allowfullscreen=""
      loading="lazy"
      referrerpolicy="no-referrer-when-downgrade"
      title={title}
    ></iframe>
  </div>
  ```

- [ ] **Step 2: Export from `content/index.ts`**

  `packages/ui/src/components/content/index.ts` — append at the end:

  ```ts
  export { default as GoogleMapEmbed } from './GoogleMapEmbed.astro';
  export type { Props as GoogleMapEmbedProps } from './GoogleMapEmbed.astro';
  ```

  `packages/ui/src/index.ts` already does `export * from './components/content'`, so no changes needed there.

- [ ] **Step 3: Verify component is importable**

  ```bash
  cd apps/siding-repair && pnpm lint
  ```
  Expected: no errors (component not yet used — that's fine).

- [ ] **Step 4: Commit**

  ```bash
  git add packages/ui/src/components/content/GoogleMapEmbed.astro packages/ui/src/components/content/index.ts
  git commit -m "Add GoogleMapEmbed shared component with compact/full variants"
  ```

---

### Task 3: Add embed URL to the Portland location

**Files:**
- Modify: `apps/siding-repair/src/data/locations.ts`

- [ ] **Step 1: Locate the portland entry**

  Open `apps/siding-repair/src/data/locations.ts`. The `portland` entry is the first key in `sidingLocations`.

- [ ] **Step 2: Add `mapEmbedSrc`**

  In the `portland` object, after the `phone` field, add:

  ```ts
  mapEmbedSrc: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d719303.6326424527!2d-122.71848044999999!3d45.23202155!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x44cadef93ff257b1%3A0x3e1d5266b25851b6!2sSiding%20Repair%20Experts!5e0!3m2!1sen!2sus!4v1773167464475!5m2!1sen!2sus',
  ```

- [ ] **Step 3: Verify type-checks**

  ```bash
  cd apps/siding-repair && pnpm lint
  ```
  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add apps/siding-repair/src/data/locations.ts
  git commit -m "Add GMB map embed URL for siding-repair Portland"
  ```

---

### Task 4: Wire both map placements into the location page template

**Files:**
- Modify: `apps/siding-repair/src/pages/locations/[slug].astro`

- [ ] **Step 1: Import `GoogleMapEmbed`**

  In the frontmatter imports block (around line 7), add `GoogleMapEmbed` to the existing `@sfw/ui` import:

  ```ts
  import {
    HeroSection,
    StatsBar,
    ProcessSteps,
    TestimonialSlider,
    FAQAccordion,
    ContactForm,
    CTASection,
    GoogleMapEmbed,
  } from '@sfw/ui';
  ```

- [ ] **Step 2: Add compact map to the Neighborhoods section**

  Find the Neighborhoods section (around line 143). It currently opens with:

  ```astro
  <section class="py-16 bg-gray-light">
    <div class="container mx-auto px-4">
      <h2 ...>Neighborhoods We Serve in {location.name}</h2>
      <p ...>Providing expert services ...</p>

      <div class="grid grid-cols-2 ...">
  ```

  After the `<p>` tag and **before** the neighborhood grid `<div>`, add:

  ```astro
  {location.mapEmbedSrc && (
    <div class="max-w-6xl mx-auto mb-8">
      <GoogleMapEmbed
        src={location.mapEmbedSrc}
        variant="compact"
        title={`${config.name} ${location.name} service area on Google Maps`}
      />
    </div>
  )}
  ```

- [ ] **Step 3: Add full map to the Contact section (replaces Service Area block)**

  Find the Contact section's contact info column (around line 210). It has a grid of icon+text blocks. The "Service Area" block looks like:

  ```astro
  <div class="flex items-start">
    <svg ...location pin svg.../>
    <div>
      <div class="font-semibold">Service Area</div>
      <div class="text-gray-600">{location.fullName} Metro</div>
    </div>
  </div>
  ```

  The contact grid is `md:grid-cols-2`. The **right column** currently renders `<ContactForm>`. Replace that right column's content conditionally:

  Find the right column wrapper (around line 264):
  ```astro
  <!-- Contact Form -->
  <div>
    <ContactForm
      config={config}
      title=""
      description=""
      submitText="Get Free Quote"
    />
  </div>
  ```

  **This is the contact form — do not replace it.** Instead, find the **left column** (`bg-gray-light p-8 rounded-lg`) and locate the Service Area `flex items-start` block within it. Replace that block with a conditional map:

  ```astro
  {location.mapEmbedSrc ? (
    <div class="mt-4">
      <GoogleMapEmbed
        src={location.mapEmbedSrc}
        variant="full"
        title={`${config.name} ${location.name} on Google Maps`}
      />
    </div>
  ) : (
    <div class="flex items-start">
      <svg class="w-6 h-6 text-primary mr-3 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      <div>
        <div class="font-semibold">Service Area</div>
        <div class="text-gray-600">{location.fullName} Metro</div>
      </div>
    </div>
  )}
  ```

  **Note:** The design spec places the full map in the contact section right column alongside contact info. Re-read the contact section layout carefully before editing — the grid has `left: contact info` and `right: contact form`. The map replaces the Service Area text *within the left contact info column*, growing that column. The contact form stays untouched on the right.

- [ ] **Step 4: Lint**

  ```bash
  cd apps/siding-repair && pnpm lint
  ```
  Expected: no errors.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/siding-repair/src/pages/locations/[slug].astro
  git commit -m "Add Google Maps embed to location pages (neighborhoods + contact)"
  ```

---

### Task 5: Smoke-test in dev

- [ ] **Step 1: Start the dev server**

  ```bash
  cd apps/siding-repair && pnpm dev
  ```

- [ ] **Step 2: Visit the Portland location page**

  Open: `http://localhost:4321/locations/portland`

  Verify:
  - Compact map renders above the neighborhood grid (approx 200px tall, full width)
  - Full map renders inside the contact section left column, below phone/hours info (approx 450px tall)
  - Both iframes show the "Siding Repair Experts" GMB card (may need to allow map to load)
  - Clicking "View larger map" on either iframe opens the correct GMB listing in a new tab
  - No map renders for locations without `mapEmbedSrc` (if any exist)

- [ ] **Step 3: Push**

  ```bash
  ./pushall.ps1
  ```

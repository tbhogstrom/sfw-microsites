# SEO Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute the 5-phase Astro SEO roadmap across 12 microsites — quick wins, linked JSON-LD graph, indexing/discovery, content/social polish, and future-proofing — using a hand-roll-first / cherry-pick approach rather than wholesale-adopting `@jdevalk/astro-seo-graph`.

**Architecture:**
- Centralize all new SEO primitives in `@sfw/ui` and `@sfw/content` so one change propagates to all 12 apps.
- Per-app changes (vercel.json, robots.txt, llms.txt) are templated — identical content modulo the domain string.
- Verification is build-output-based (`pnpm build` + inspect `dist/`), not a new test framework. Astro's built-in `astro check` runs via `pnpm lint`.
- JSON-LD migration keeps existing entity schemas (LocalBusiness, FAQ, Breadcrumb, BlogPosting) but links them in a `@graph` with `@id` references.

**Tech Stack:**
- Astro 5.1+ (static output)
- `@astrojs/sitemap`, `@astrojs/rss`
- `satori` + `sharp` (Phase 4, OG cards)
- `lychee` (Phase 5, GitHub Action)
- TypeScript, pnpm workspaces, Turborepo

**Scope Decisions (locked before execution):**
- Apply to all 12 Astro apps: beam-repair, chimney-repair, crawlspace-rot, deck-repair, dry-rot, flashing-repair, lead-paint, leak-repair, mold-testing, restoration, siding-repair, trim-repair. Per project memory, mold-testing and restoration are excluded from **V1 content work** — but SEO infrastructure (cache headers, 404, schema endpoints) deploys to all 12 since it's purely technical and harmless on unreleased sites.
- `apps/reports-portal` (Next.js) is **excluded** — it's internal tooling.
- No new test framework. Verification steps use `pnpm build`, `pnpm lint`, `curl` against `pnpm preview`, and `grep` against `dist/` HTML.
- `@jdevalk/astro-seo-graph` is **not adopted wholesale**. Phase 5 re-evaluates its FuzzyRedirect component as a buy-vs-build decision.

**App list constant (used throughout plan):**
```
APPS=(beam-repair chimney-repair crawlspace-rot deck-repair dry-rot flashing-repair lead-paint leak-repair mold-testing restoration siding-repair trim-repair)
```

**Commit cadence:** One commit per task minimum. Per CLAUDE.md: push with `./pushall.ps1` after each task. Commit messages follow repo style — no Co-Authored-By.

---

## Pre-flight: Verify Baseline

**Files:** none

- [ ] **Step 1: Verify all 12 apps build clean before starting**

```bash
pnpm install
pnpm build
```

Expected: All 12 Astro apps build successfully. If any app is already broken, stop and report — don't layer SEO changes on top of a broken baseline.

- [ ] **Step 2: Capture current sitemap URL counts as baseline**

```bash
for app in beam-repair chimney-repair crawlspace-rot deck-repair dry-rot flashing-repair lead-paint leak-repair mold-testing restoration siding-repair trim-repair; do
  count=$(grep -c '<loc>' "apps/$app/dist/sitemap-0.xml" 2>/dev/null || echo 0)
  echo "$app: $count URLs"
done
```

Expected: Non-zero counts for each app. Save this output somewhere (terminal scrollback is fine) — Phase 3 per-collection sitemap work should not reduce total URL count.

- [ ] **Step 3: No commit — this is just verification**

---

## Phase 1 — Quick Wins

### Task 1.1: Vercel cache headers for all apps

**Files:**
- Modify: `apps/beam-repair/vercel.json` (and all 11 others, same pattern)

- [ ] **Step 1: Update `apps/beam-repair/vercel.json`**

```json
{
  "buildCommand": "cd ../.. && npx turbo build --filter=beam-repair",
  "installCommand": "cd ../.. && npm install",
  "framework": "astro",
  "outputDirectory": "dist",
  "headers": [
    {
      "source": "/_astro/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/shared/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/(.*)",
      "headers": [
        { "key": "No-Vary-Search", "value": "params=(\"utm_source\" \"utm_medium\" \"utm_campaign\" \"utm_term\" \"utm_content\" \"gclid\" \"fbclid\")" }
      ]
    }
  ]
}
```

- [ ] **Step 2: Replicate to remaining 11 apps**

For each remaining app, apply the same three `headers` entries. The `buildCommand` and other fields differ per app — **only add the `headers` key**; do not overwrite anything else.

Apps to update (11 remaining):
chimney-repair, crawlspace-rot, deck-repair, dry-rot, flashing-repair, lead-paint, leak-repair, mold-testing, restoration, siding-repair, trim-repair

- [ ] **Step 3: Verify each vercel.json still parses as valid JSON**

```bash
for app in beam-repair chimney-repair crawlspace-rot deck-repair dry-rot flashing-repair lead-paint leak-repair mold-testing restoration siding-repair trim-repair; do
  node -e "JSON.parse(require('fs').readFileSync('apps/$app/vercel.json','utf8')); console.log('$app OK')"
done
```

Expected: `<appname> OK` for all 12.

- [ ] **Step 4: Commit**

```bash
git add apps/*/vercel.json
git commit -m "feat(seo): add immutable cache + No-Vary-Search headers to all apps"
./pushall.ps1
```

---

### Task 1.2: Shared 404 page component in @sfw/ui

**Files:**
- Create: `packages/ui/src/pages/NotFoundPage.astro`
- Modify: `packages/ui/src/components/ui/index.ts` (add export)

- [ ] **Step 1: Create the shared 404 component**

Create `packages/ui/src/pages/NotFoundPage.astro`:

```astro
---
/**
 * NotFoundPage.astro — Branded 404 page body.
 * Each app's src/pages/404.astro imports this inside BaseLayout.
 * Phase 5 Task 5.3 enhances this with fuzzy redirect matching.
 */
import type { SiteConfig } from '@sfw/ui/types';
import Button from '../components/ui/Button.astro';

export interface Props {
  config: SiteConfig;
  /** Canonical paths for the "Popular pages" links. Pass app-specific routes. */
  suggestedLinks?: Array<{ label: string; href: string }>;
}

const { config, suggestedLinks = [] } = Astro.props;

const defaultLinks = [
  { label: 'Home', href: '/' },
  { label: 'Services', href: '/services' },
  { label: 'Service Areas', href: '/service-areas' },
  { label: 'Contact', href: '/contact' },
  { label: 'Blog', href: '/blog' },
];

const links = suggestedLinks.length > 0 ? suggestedLinks : defaultLinks;
---

<section class="flex min-h-[60vh] items-center justify-center px-4 py-16">
  <div class="max-w-2xl text-center">
    <p class="mb-2 font-mono text-sm uppercase tracking-widest text-primary">
      404
    </p>
    <h1 class="mb-4 font-heading text-4xl sm:text-5xl">
      Page not found
    </h1>
    <p class="mb-8 text-lg text-gray-600">
      We couldn't find the page you're looking for. It may have moved, or the link may be out of date.
    </p>

    <div class="mb-10 flex flex-wrap justify-center gap-3">
      <Button href="/" variant="primary">Back to Home</Button>
      <Button href={`tel:${config.phone}`} variant="outline">
        Call {config.phone}
      </Button>
    </div>

    <div class="border-t border-gray-200 pt-8">
      <p class="mb-4 font-mono text-xs uppercase tracking-wider text-gray-500">
        Popular pages
      </p>
      <ul class="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
        {links.map((link) => (
          <li>
            <a href={link.href} class="text-primary underline underline-offset-4 hover:no-underline">
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Export from `@sfw/ui`**

Modify `packages/ui/src/components/ui/index.ts` — verify current content first (Read the file), then add the NotFoundPage export.

Add this line (placing alphabetically):
```ts
export { default as NotFoundPage } from '../../pages/NotFoundPage.astro';
```

If there's no clean home for "pages", create `packages/ui/src/pages/index.ts` with:
```ts
export { default as NotFoundPage } from './NotFoundPage.astro';
```

…and add `export * from './pages';` to `packages/ui/src/index.ts`.

- [ ] **Step 3: Commit the shared component**

```bash
git add packages/ui/src/pages/NotFoundPage.astro packages/ui/src/pages/index.ts packages/ui/src/index.ts
git commit -m "feat(ui): add shared NotFoundPage component for branded 404s"
```

Do NOT push yet — wiring it into apps is the next step and should land together.

---

### Task 1.3: Wire 404 pages into all 12 apps

**Files:**
- Create: `apps/beam-repair/src/pages/404.astro` (and 11 others)

- [ ] **Step 1: Create the first app's 404 page**

Create `apps/beam-repair/src/pages/404.astro`:

```astro
---
import { BaseLayout, NotFoundPage } from '@sfw/ui';
import { serviceConfigs } from '@sfw/content';
import { navigation } from '@sfw/content';

const config = serviceConfigs['beam-repair'];
const appNav = navigation['beam-repair'] ?? [];
---

<BaseLayout
  title="Page not found"
  description={`The page you're looking for doesn't exist on ${config.name}.`}
  config={config}
  navigation={appNav}
  noindex={true}
>
  <NotFoundPage config={config} />
</BaseLayout>
```

**Note:** Verify the exact import shape of `navigation` from `@sfw/content/navigation.ts` before copying — the accessor may be `siteNavigation` or similar. If the navigation export is keyed differently, adapt the lookup (e.g. `siteNavigation['beam-repair']`).

- [ ] **Step 2: Replicate to 11 remaining apps**

For each remaining app, create `apps/<app-name>/src/pages/404.astro` with the same content, replacing `beam-repair` with the app name on lines 4 and 5.

- [ ] **Step 3: Build one app and verify 404 output exists**

```bash
cd apps/beam-repair && pnpm build && cd ../..
ls apps/beam-repair/dist/404.html
```

Expected: `apps/beam-repair/dist/404.html` exists.

- [ ] **Step 4: Verify 404 HTML has expected content**

```bash
grep -l 'Page not found' apps/beam-repair/dist/404.html
grep -l 'noindex' apps/beam-repair/dist/404.html
```

Expected: both return the file path (matches found).

- [ ] **Step 5: Lint all apps**

```bash
pnpm -w lint
```

Expected: no errors. Warnings OK.

- [ ] **Step 6: Commit**

```bash
git add apps/*/src/pages/404.astro
git commit -m "feat(seo): add branded 404 page to all 12 apps"
./pushall.ps1
```

---

### Task 1.4: Consolidate raw `<img>` tags to use shared Image component

**Context:** The audit found raw `<img>` in 6 components. Two paths exist:

- **Components with `src` as an imported `ImageMetadata` or known width/height** — swap to `<Image>` for optimization.
- **Components where `src` is a runtime string to a `/public/` or `/shared/` path** — Astro's `<Image>` can't optimize these without dimensions. For these, keep native `<img>` but ensure `loading="lazy"`, `decoding="async"`, and `width`/`height` attributes to prevent CLS.

**Files:**
- Modify: `packages/ui/src/components/content/BeforeAfter.astro`
- Modify: `packages/ui/src/components/content/ImageLightbox.astro`
- Modify: `packages/ui/src/components/content/OurWorkPage.astro`
- Modify: `packages/ui/src/components/content/TestimonialCard.astro`
- Modify: `packages/ui/src/components/layout/Header.astro`
- Modify: `packages/ui/src/components/layout/MobileNav.astro`

- [ ] **Step 1: Audit each component's `src` source**

```bash
grep -n '<img' packages/ui/src/components/content/BeforeAfter.astro \
  packages/ui/src/components/content/ImageLightbox.astro \
  packages/ui/src/components/content/OurWorkPage.astro \
  packages/ui/src/components/content/TestimonialCard.astro \
  packages/ui/src/components/layout/Header.astro \
  packages/ui/src/components/layout/MobileNav.astro
```

For each occurrence, determine if `src` is a string prop (from JSON data) or an imported asset.

- [ ] **Step 2: Create an `<OptimizedImg>` helper for runtime string sources**

Create `packages/ui/src/components/ui/OptimizedImg.astro`:

```astro
---
/**
 * OptimizedImg.astro — Drop-in <img> replacement for runtime string src values
 * that can't use Astro's <Image> (because they reference /public paths with
 * no build-time dimensions). Enforces lazy loading, async decoding, and
 * explicit width/height to prevent CLS.
 */
export interface Props {
  src: string;
  alt: string;
  width: number;
  height: number;
  loading?: 'lazy' | 'eager';
  decoding?: 'async' | 'sync' | 'auto';
  class?: string;
  sizes?: string;
}

const {
  src,
  alt,
  width,
  height,
  loading = 'lazy',
  decoding = 'async',
  class: className,
  sizes,
} = Astro.props;
---

<img
  src={src}
  alt={alt}
  width={width}
  height={height}
  loading={loading}
  decoding={decoding}
  sizes={sizes}
  class={className}
/>
```

- [ ] **Step 3: Export OptimizedImg from @sfw/ui**

Add to `packages/ui/src/components/ui/index.ts`:
```ts
export { default as OptimizedImg } from './OptimizedImg.astro';
```

- [ ] **Step 4: Update `TestimonialCard.astro`**

Read current file first to preserve everything else. Then on line 49 replace the raw `<img>` with `<OptimizedImg>`:

```astro
import OptimizedImg from '../ui/OptimizedImg.astro';

<!-- existing logic -->
{showImage && image && (
  <OptimizedImg
    src={image}
    alt={name ?? 'Customer'}
    width={48}
    height={48}
    class="w-12 h-12 rounded-full"
  />
)}
```

- [ ] **Step 5: Update `Header.astro`**

Replace the logo `<img>`:

```astro
import OptimizedImg from '../ui/OptimizedImg.astro';

<!-- logo slot -->
{logo && (
  <OptimizedImg
    src={logo}
    alt={config.name}
    width={160}
    height={48}
    loading="eager"
    class="h-12 w-auto"
  />
)}
```

**Note:** Eager-load the logo — it's above-the-fold LCP content.

- [ ] **Step 6: Update `MobileNav.astro`**

Same pattern as Header but `width={140}` `height={40}` and keep `loading="lazy"` (mobile nav is initially hidden).

- [ ] **Step 7: Update `BeforeAfter.astro`**

The two images need explicit dimensions. If the component doesn't currently accept them, add `beforeWidth`, `beforeHeight`, `afterWidth`, `afterHeight` props with sensible defaults (e.g., 1200×800). Use `<OptimizedImg>` instead of raw `<img>`.

- [ ] **Step 8: Update `ImageLightbox.astro` and `OurWorkPage.astro`**

Same pattern. For gallery thumbs use smaller dimensions (e.g. 400×300); for the lightbox display use larger (e.g. 1600×1200). If dimensions aren't available on the data shape, add them to the component props with documented defaults.

- [ ] **Step 9: Run `pnpm lint` from root**

```bash
pnpm -w lint
```

Expected: no new errors. If a width/height prop change breaks a caller, fix the caller or make the prop optional.

- [ ] **Step 10: Visually verify a build**

```bash
cd apps/beam-repair && pnpm build && pnpm preview &
sleep 3
curl -s http://localhost:4321/ | grep -o '<img[^>]*' | head -20
kill %1 2>/dev/null || true
cd ../..
```

Expected: all `<img>` tags have `loading`, `decoding`, `width`, `height` attributes.

- [ ] **Step 11: Commit**

```bash
git add packages/ui/src/components/
git commit -m "feat(ui): replace raw <img> tags with OptimizedImg helper"
./pushall.ps1
```

---

## Phase 2 — Structured Data Upgrade

### Task 2.1: Fix SiteConfig type and extend with SEO fields

**Context:** The current `SEO.astro` references `config.url`, `config.email`, `config.city`, `config.state`, `config.zip`, `config.address`, `config.geo`, `config.serviceAreas` — **none of which exist on `SiteConfig`**. The emitted LocalBusiness JSON-LD is partially undefined. This must be fixed before the @graph refactor.

**Files:**
- Modify: `packages/content/src/types.ts`
- Modify: `packages/content/src/service-configs.ts`

- [ ] **Step 1: Read current type + service-configs**

```bash
cat packages/content/src/types.ts
cat packages/content/src/service-configs.ts | head -80
```

Understand the existing shape before changing it.

- [ ] **Step 2: Extend SiteConfig in `packages/content/src/types.ts`**

Add these fields to `SiteConfig`:

```ts
export interface SiteConfig {
  // ... existing fields ...

  /** Canonical URL (no trailing slash), e.g. "https://beamrepairexpert.com" */
  url: string;

  /** Public contact email for LocalBusiness schema */
  email: string;

  /** Physical address for LocalBusiness */
  address: {
    streetAddress: string;
    addressLocality: string;   // city
    addressRegion: string;     // state (2-letter)
    postalCode: string;
    addressCountry: string;    // "US"
  };

  /** Geo coordinates of the business */
  geo?: {
    latitude: number;
    longitude: number;
  };

  /** Service areas (cities) used in LocalBusiness.areaServed */
  serviceAreas?: Array<{ name: string; slug: string }>;
}
```

- [ ] **Step 3: Populate the new fields in `service-configs.ts`**

Update each entry in `serviceConfigs` to include the new fields, using the shared `companyInfo` from `sfw-data.ts` as the source of truth for address and email:

```ts
import { companyInfo, serviceAreas } from './sfw-data';

export const serviceConfigs: Record<string, SiteConfig> = {
  'beam-repair': {
    // ... existing fields ...
    url: 'https://beamrepairexpert.com',
    email: companyInfo.email,
    address: {
      streetAddress: companyInfo.address.street,
      addressLocality: companyInfo.address.city,
      addressRegion: companyInfo.address.state,
      postalCode: companyInfo.address.zip,
      addressCountry: 'US',
    },
    serviceAreas,
    // geo is optional; add if the SFW office coords are known
  },
  // ... repeat for all 12 apps, changing `url` per app.
};
```

The 12 domains (matches `astro.config.mjs` `site` field on each):
```
beam-repair        → https://beamrepairexpert.com
chimney-repair     → https://woodchimneyrepair.com
crawlspace-rot     → https://crawlspacerot.com
deck-repair        → https://deckrepairexpert.com
dry-rot            → https://rotrepairportland.com
flashing-repair    → https://flashingrepairs.com
lead-paint         → https://leadpaintprofessionals.com
leak-repair        → https://leakingwindow.com
mold-testing       → https://moldtestingexperts.com
restoration        → https://historicrenovationsnw.com
siding-repair      → https://sidingrepairexperts.com
trim-repair        → https://exteriortrimrepairs.com
```

- [ ] **Step 4: Run lint at root**

```bash
pnpm -w lint
```

Expected: zero errors. If any consumer of `SiteConfig` breaks (e.g. other components reference deprecated field shapes), fix inline.

- [ ] **Step 5: Commit**

```bash
git add packages/content/src/types.ts packages/content/src/service-configs.ts
git commit -m "fix(content): populate LocalBusiness fields on SiteConfig"
```

---

### Task 2.2: Build linked JSON-LD @graph helper

**Files:**
- Create: `packages/ui/src/lib/schema.ts`
- Modify: `packages/ui/src/components/ui/SEO.astro`

- [ ] **Step 1: Create the graph builder**

Create `packages/ui/src/lib/schema.ts`:

```ts
/**
 * Linked JSON-LD @graph builder.
 *
 * Emits a single @graph with entities connected via @id references:
 *   LocalBusiness — the business
 *   WebSite       — the site (sameAs LocalBusiness)
 *   WebPage       — this page
 *   BreadcrumbList (optional)
 *   FAQPage (optional)
 *   BlogPosting (optional)
 *
 * Every page calls buildPageGraph(); add-on helpers append specific entity
 * types that lift off the current page (breadcrumbs, FAQ, blog post).
 */
import type { SiteConfig } from '../types';

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export interface FAQEntry {
  question: string;
  answer: string;
}

export interface BlogPostingData {
  headline: string;
  description: string;
  image?: string;
  datePublished: string;
  dateModified?: string;
  author?: string;
  articleBody?: string;
}

export interface PageGraphInput {
  config: SiteConfig;
  pageUrl: string;          // canonical URL for this page
  pageTitle: string;
  pageDescription: string;
  pageType?: 'WebPage' | 'AboutPage' | 'ContactPage' | 'CollectionPage' | 'ItemPage';
  breadcrumbs?: BreadcrumbItem[];
  faq?: FAQEntry[];
  blogPost?: BlogPostingData;
}

type JsonLdNode = Record<string, unknown>;

const idBusiness = (siteUrl: string) => `${siteUrl}#business`;
const idWebsite = (siteUrl: string) => `${siteUrl}#website`;
const idWebpage = (pageUrl: string) => `${pageUrl}#webpage`;
const idBreadcrumb = (pageUrl: string) => `${pageUrl}#breadcrumb`;
const idFaq = (pageUrl: string) => `${pageUrl}#faq`;
const idBlogPosting = (pageUrl: string) => `${pageUrl}#blogposting`;

function localBusinessNode(config: SiteConfig): JsonLdNode {
  return {
    '@type': 'LocalBusiness',
    '@id': idBusiness(config.url),
    name: config.name,
    description: config.description,
    url: config.url,
    telephone: config.phone,
    email: config.email,
    address: {
      '@type': 'PostalAddress',
      ...config.address,
    },
    ...(config.geo && {
      geo: {
        '@type': 'GeoCoordinates',
        latitude: config.geo.latitude,
        longitude: config.geo.longitude,
      },
    }),
    ...(config.serviceAreas && config.serviceAreas.length > 0 && {
      areaServed: config.serviceAreas.map((area) => ({
        '@type': 'City',
        name: area.name,
      })),
    }),
  };
}

function websiteNode(config: SiteConfig): JsonLdNode {
  return {
    '@type': 'WebSite',
    '@id': idWebsite(config.url),
    url: config.url,
    name: config.name,
    publisher: { '@id': idBusiness(config.url) },
  };
}

function webpageNode(input: PageGraphInput): JsonLdNode {
  const pageType = input.pageType ?? 'WebPage';
  return {
    '@type': pageType,
    '@id': idWebpage(input.pageUrl),
    url: input.pageUrl,
    name: input.pageTitle,
    description: input.pageDescription,
    isPartOf: { '@id': idWebsite(input.config.url) },
    about: { '@id': idBusiness(input.config.url) },
    ...(input.breadcrumbs && input.breadcrumbs.length > 0 && {
      breadcrumb: { '@id': idBreadcrumb(input.pageUrl) },
    }),
  };
}

function breadcrumbNode(pageUrl: string, items: BreadcrumbItem[]): JsonLdNode {
  return {
    '@type': 'BreadcrumbList',
    '@id': idBreadcrumb(pageUrl),
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

function faqNode(pageUrl: string, entries: FAQEntry[]): JsonLdNode {
  return {
    '@type': 'FAQPage',
    '@id': idFaq(pageUrl),
    mainEntity: entries.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: entry.answer,
      },
    })),
  };
}

function blogPostingNode(
  pageUrl: string,
  config: SiteConfig,
  post: BlogPostingData
): JsonLdNode {
  return {
    '@type': 'BlogPosting',
    '@id': idBlogPosting(pageUrl),
    headline: post.headline,
    description: post.description,
    ...(post.image && { image: post.image }),
    datePublished: post.datePublished,
    dateModified: post.dateModified ?? post.datePublished,
    author: { '@type': 'Person', name: post.author ?? config.name },
    publisher: { '@id': idBusiness(config.url) },
    mainEntityOfPage: { '@id': idWebpage(pageUrl) },
  };
}

/**
 * Build the top-level @graph for a page. Includes LocalBusiness + WebSite + WebPage
 * unconditionally, plus optional BreadcrumbList, FAQPage, BlogPosting nodes.
 */
export function buildPageGraph(input: PageGraphInput): JsonLdNode {
  const nodes: JsonLdNode[] = [
    localBusinessNode(input.config),
    websiteNode(input.config),
    webpageNode(input),
  ];

  if (input.breadcrumbs && input.breadcrumbs.length > 0) {
    nodes.push(breadcrumbNode(input.pageUrl, input.breadcrumbs));
  }
  if (input.faq && input.faq.length > 0) {
    nodes.push(faqNode(input.pageUrl, input.faq));
  }
  if (input.blogPost) {
    nodes.push(blogPostingNode(input.pageUrl, input.config, input.blogPost));
  }

  return {
    '@context': 'https://schema.org',
    '@graph': nodes,
  };
}
```

- [ ] **Step 2: Export schema helpers from `@sfw/ui`**

Create `packages/ui/src/lib/index.ts`:

```ts
export * from './schema';
```

Add to `packages/ui/src/index.ts`:

```ts
export * from './lib';
```

- [ ] **Step 3: Update `SEO.astro` to use the graph builder**

Rewrite `packages/ui/src/components/ui/SEO.astro`:

```astro
---
/**
 * SEO.astro — head meta + linked JSON-LD graph.
 * Replaces the previous isolated LocalBusiness schema with a connected @graph
 * that other components (Breadcrumbs, FAQAccordion, BlogPost) can contribute to.
 */
import type { SiteConfig } from '@sfw/ui/types';
import {
  buildPageGraph,
  type BreadcrumbItem,
  type FAQEntry,
  type BlogPostingData,
} from '../../lib/schema';

export interface Props {
  title: string;
  description: string;
  config: SiteConfig;
  canonical?: string;
  ogImage?: string;
  ogType?: 'website' | 'article';
  noindex?: boolean;
  breadcrumbs?: BreadcrumbItem[];
  faq?: FAQEntry[];
  blogPost?: BlogPostingData;
  pageType?: 'WebPage' | 'AboutPage' | 'ContactPage' | 'CollectionPage' | 'ItemPage';
}

const {
  title,
  description,
  config,
  canonical,
  ogImage = '/og-image.jpg',
  ogType = 'website',
  noindex = false,
  breadcrumbs,
  faq,
  blogPost,
  pageType,
} = Astro.props;

const fullTitle = title === config.name ? title : `${title} | ${config.name}`;
const canonicalUrl = canonical ?? Astro.url.href;

const graph = buildPageGraph({
  config,
  pageUrl: canonicalUrl,
  pageTitle: fullTitle,
  pageDescription: description,
  pageType,
  breadcrumbs,
  faq,
  blogPost,
});
---

<title>{fullTitle}</title>
<meta name="title" content={fullTitle} />
<meta name="description" content={description} />
{noindex && <meta name="robots" content="noindex, nofollow" />}

<link rel="canonical" href={canonicalUrl} />

<meta property="og:type" content={ogType} />
<meta property="og:url" content={canonicalUrl} />
<meta property="og:title" content={fullTitle} />
<meta property="og:description" content={description} />
<meta property="og:image" content={ogImage} />

<meta property="twitter:card" content="summary_large_image" />
<meta property="twitter:url" content={canonicalUrl} />
<meta property="twitter:title" content={fullTitle} />
<meta property="twitter:description" content={description} />
<meta property="twitter:image" content={ogImage} />

<script type="application/ld+json" set:html={JSON.stringify(graph)} />
```

- [ ] **Step 4: Plumb props through BaseLayout**

Modify `packages/ui/src/layouts/BaseLayout.astro` to accept and pass `breadcrumbs`, `faq`, `blogPost`, `pageType`:

Add to the `Props` interface:
```ts
import type { BreadcrumbItem, FAQEntry, BlogPostingData } from '../lib/schema';

export interface Props {
  // ... existing fields ...
  breadcrumbs?: BreadcrumbItem[];
  faq?: FAQEntry[];
  blogPost?: BlogPostingData;
  pageType?: 'WebPage' | 'AboutPage' | 'ContactPage' | 'CollectionPage' | 'ItemPage';
}
```

Destructure them and pass to the `<SEO>` component.

- [ ] **Step 5: Remove standalone JSON-LD from now-duplicated components**

`Breadcrumbs.astro`, `FAQAccordion.astro`, `BlogPost.astro` each emit their own JSON-LD today. Once callers start passing `breadcrumbs` / `faq` / `blogPost` to BaseLayout, the duplicate blocks become redundant. **Do not delete the duplicate JSON-LD yet** — first make sure all pages that use these components are updated to pass data through BaseLayout. Removal happens in Task 2.3.

- [ ] **Step 6: Build + verify JSON-LD is a graph now**

```bash
cd apps/beam-repair && pnpm build && cd ../..
grep -o '"@graph"' apps/beam-repair/dist/index.html | head -1
```

Expected: `"@graph"` appears. Check the emitted JSON-LD is valid:

```bash
node -e "const html=require('fs').readFileSync('apps/beam-repair/dist/index.html','utf8'); const m=html.match(/<script type=\"application\/ld\+json\">([\s\S]*?)<\/script>/); JSON.parse(m[1]); console.log('JSON-LD parses OK');"
```

Expected: `JSON-LD parses OK`.

- [ ] **Step 7: Validate via schema.org validator (manual)**

Copy the JSON-LD block from `apps/beam-repair/dist/index.html` and paste into https://validator.schema.org/. Expected: 0 errors, 0 warnings (or only warnings about optional recommended fields).

- [ ] **Step 8: Commit**

```bash
git add packages/ui/
git commit -m "feat(seo): unified JSON-LD @graph builder replacing scattered schemas"
```

---

### Task 2.3: Migrate callers to graph-aware BaseLayout

**Files:** Many — every page that uses `Breadcrumbs`, `FAQAccordion`, or `BlogPost`.

- [ ] **Step 1: Find all pages using breadcrumbs**

```bash
grep -rn "Breadcrumbs" apps/*/src --include="*.astro" --include="*.ts" | head -50
```

- [ ] **Step 2: Migrate each page to pass `breadcrumbs` prop through BaseLayout**

Pattern to apply (example: a service page):

Before:
```astro
<BaseLayout title="..." description="..." config={config}>
  <Breadcrumbs items={breadcrumbs} />
  <!-- page content -->
</BaseLayout>
```

After:
```astro
<BaseLayout
  title="..."
  description="..."
  config={config}
  breadcrumbs={breadcrumbs}
>
  <Breadcrumbs items={breadcrumbs} />
  <!-- page content -->
</BaseLayout>
```

(The visible `<Breadcrumbs>` component still renders the UI; it just stops emitting its own JSON-LD.)

- [ ] **Step 3: Do the same for FAQ and BlogPost usage**

Find all pages that render `<FAQAccordion faqs={...}>` and pass the same array as `faq={faqs}` to BaseLayout. Same for `<BlogPost post={post}>` → pass the blog-posting data to BaseLayout.

**Audit check:** `grep -rn "FAQAccordion" apps/*/src --include="*.astro"` and `grep -rn "BlogPost" apps/*/src/pages --include="*.astro"`.

- [ ] **Step 4: Remove the duplicate JSON-LD blocks**

In each of the three components, remove the `<script type="application/ld+json">` block. Keep the visible UI rendering intact.

- [ ] **Step 5: Build all apps; verify no duplicate `@id` collisions**

```bash
pnpm build
# pick a representative page from one app
node -e "
const fs=require('fs');
const html=fs.readFileSync('apps/beam-repair/dist/blog/index.html','utf8');
const matches=[...html.matchAll(/<script type=\"application\/ld\+json\">([\s\S]*?)<\/script>/g)];
console.log('JSON-LD blocks:', matches.length);
matches.forEach((m,i)=>{try{JSON.parse(m[1]);console.log('block',i,'OK')}catch(e){console.error('block',i,'BAD',e.message)}});
"
```

Expected: only **one** JSON-LD block per page (the one from SEO.astro). All blocks parse.

- [ ] **Step 6: Lint + commit**

```bash
pnpm -w lint
git add apps/ packages/ui/
git commit -m "refactor(seo): route breadcrumbs/FAQ/blog JSON-LD through unified graph"
./pushall.ps1
```

---

### Task 2.4: Schema endpoints `/schema/*.json` and schemamap.xml

**Files:**
- Create: `packages/ui/src/lib/schema-endpoints.ts`
- Create per-app: `apps/*/src/pages/schema/page.json.ts`
- Create per-app: `apps/*/src/pages/schema/service.json.ts`
- Create per-app: `apps/*/src/pages/schemamap.xml.ts`
- Modify per-app: `apps/*/public/robots.txt` — add `Schemamap:` directive

- [ ] **Step 1: Create the endpoint helper**

Create `packages/ui/src/lib/schema-endpoints.ts`:

```ts
import type { SiteConfig } from '../types';
import { buildPageGraph } from './schema';

export interface SchemaEndpointEntry {
  url: string;         // absolute URL of the HTML page
  pageTitle: string;
  pageDescription: string;
  pageType?: 'WebPage' | 'AboutPage' | 'ContactPage' | 'CollectionPage' | 'ItemPage';
}

/**
 * Build a combined JSON-LD document for a set of page entries.
 * Used by /schema/page.json and /schema/service.json routes.
 */
export function buildCombinedSchema(
  config: SiteConfig,
  entries: SchemaEndpointEntry[]
): unknown {
  return {
    '@context': 'https://schema.org',
    '@graph': entries.flatMap((entry) => {
      const graph = buildPageGraph({
        config,
        pageUrl: entry.url,
        pageTitle: entry.pageTitle,
        pageDescription: entry.pageDescription,
        pageType: entry.pageType,
      });
      return (graph as { '@graph': unknown[] })['@graph'];
    }),
  };
}

export function buildSchemamapXml(config: SiteConfig, endpoints: string[]): string {
  const urls = endpoints
    .map((path) => `  <url><loc>${config.url}${path}</loc></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.w3.org/1999/xhtml/schemamap/0.1">
${urls}
</urlset>
`;
}
```

- [ ] **Step 2: Create the page schema route for beam-repair**

Create `apps/beam-repair/src/pages/schema/page.json.ts`:

```ts
import type { APIRoute } from 'astro';
import { buildCombinedSchema, type SchemaEndpointEntry } from '@sfw/ui';
import { serviceConfigs } from '@sfw/content';

export const GET: APIRoute = () => {
  const config = serviceConfigs['beam-repair'];

  // Enumerate top-level pages. Additional routes can be appended as the app grows.
  const entries: SchemaEndpointEntry[] = [
    { url: `${config.url}/`,              pageTitle: config.title,       pageDescription: config.description },
    { url: `${config.url}/services`,      pageTitle: 'Services',         pageDescription: `Services offered by ${config.name}.`, pageType: 'CollectionPage' },
    { url: `${config.url}/service-areas`, pageTitle: 'Service Areas',    pageDescription: `Areas served by ${config.name}.`,     pageType: 'CollectionPage' },
    { url: `${config.url}/contact`,       pageTitle: 'Contact',          pageDescription: `Contact ${config.name}.`,             pageType: 'ContactPage' },
    { url: `${config.url}/blog`,          pageTitle: 'Blog',             pageDescription: `Articles and guides from ${config.name}.`, pageType: 'CollectionPage' },
  ];

  return new Response(JSON.stringify(buildCombinedSchema(config, entries), null, 2), {
    headers: { 'Content-Type': 'application/ld+json; charset=utf-8' },
  });
};
```

- [ ] **Step 3: Create the service schema route for beam-repair**

Create `apps/beam-repair/src/pages/schema/service.json.ts`:

```ts
import type { APIRoute } from 'astro';
import { buildCombinedSchema, type SchemaEndpointEntry } from '@sfw/ui';
import { serviceConfigs, serviceAreas } from '@sfw/content';

export const GET: APIRoute = () => {
  const config = serviceConfigs['beam-repair'];

  // One entry per service-area page.
  const entries: SchemaEndpointEntry[] = serviceAreas.map((area) => ({
    url: `${config.url}/service-areas/${area.slug}`,
    pageTitle: `${config.primaryService} in ${area.name}`,
    pageDescription: `${config.description} Serving ${area.name}.`,
    pageType: 'ItemPage',
  }));

  return new Response(JSON.stringify(buildCombinedSchema(config, entries), null, 2), {
    headers: { 'Content-Type': 'application/ld+json; charset=utf-8' },
  });
};
```

**Note:** if the actual URL shape is `/services/<slug>` instead of `/service-areas/<slug>`, adjust to match the app's routing.

- [ ] **Step 4: Create the schemamap.xml route**

Create `apps/beam-repair/src/pages/schemamap.xml.ts`:

```ts
import type { APIRoute } from 'astro';
import { buildSchemamapXml } from '@sfw/ui';
import { serviceConfigs } from '@sfw/content';

export const GET: APIRoute = () => {
  const config = serviceConfigs['beam-repair'];
  const xml = buildSchemamapXml(config, ['/schema/page.json', '/schema/service.json']);
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
```

- [ ] **Step 5: Build beam-repair; verify routes produce valid output**

```bash
cd apps/beam-repair && pnpm build && cd ../..
ls apps/beam-repair/dist/schema/
ls apps/beam-repair/dist/schemamap.xml
node -e "JSON.parse(require('fs').readFileSync('apps/beam-repair/dist/schema/page.json','utf8'))" && echo "page.json parses"
node -e "JSON.parse(require('fs').readFileSync('apps/beam-repair/dist/schema/service.json','utf8'))" && echo "service.json parses"
```

Expected: all three outputs exist; JSON files parse.

- [ ] **Step 6: Replicate to 11 remaining apps**

For each remaining app, copy the three files and change the app key (`'beam-repair'` → `'chimney-repair'` etc.).

**Shortcut:** a small shell loop works, but hand-verify at least two other apps after the first to catch app-specific routing differences (e.g., some apps may not have a `/blog` route — if so, drop that entry).

- [ ] **Step 7: Add Schemamap directive to robots.txt (all 12 apps)**

For each `apps/<app>/public/robots.txt`, add a line above the existing `Sitemap:` entries:

```
Schemamap: https://<domain>/schemamap.xml
```

Using `apps/beam-repair/public/robots.txt` as the example:

```
# Robots.txt for beamrepairexpert.com
User-agent: *
Allow: /
Disallow: /api/
Disallow: /_astro/

Sitemap: https://beamrepairexpert.com/sitemap-index.xml
Sitemap: https://beamrepairexpert.com/llms.txt
Schemamap: https://beamrepairexpert.com/schemamap.xml
```

- [ ] **Step 8: Commit**

```bash
pnpm -w lint
git add apps/ packages/ui/
git commit -m "feat(seo): add /schema/*.json endpoints and Schemamap directive"
./pushall.ps1
```

---

## Phase 3 — Indexing & Discovery

### Task 3.1: IndexNow integration

**Files:**
- Create: `packages/ui/src/lib/indexnow.ts` (shared key file content + submit helper)
- Modify per-app: `apps/*/src/pages/<indexnow-key>.txt.ts` (verification route)
- Create: `tools/indexnow-submit/submit.ts` (post-build URL push script)
- Modify: `turbo.json` + root `package.json` — add a `seo:indexnow` task hooked to build

**Context:** IndexNow needs (1) a key file publicly accessible, (2) a POST to each engine's endpoint with the URL list after deploy. We key it once and register one key with Bing/Yandex — same key across all 12 sites.

- [ ] **Step 1: Generate an IndexNow key**

Generate a 32-hex key (any random hex string, 8–128 chars):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Save the output. We'll use this single key for all 12 apps. Example: `7d3b9e1c4f6a28d05e83c1b4a9d70f6e2b4c8a1f3d5e7b9c0f2a4d6e8b1c3d5f`.

- [ ] **Step 2: Store the key in @sfw/content**

Add to `packages/content/src/index.ts`:

```ts
export const indexNowKey = process.env.INDEXNOW_KEY ?? '<paste-the-generated-key-here>';
```

**Better approach:** put it in a new `packages/content/src/indexnow.ts`:

```ts
/**
 * Shared IndexNow key for all SFW microsites. Registered with Bing and Yandex.
 * Override via INDEXNOW_KEY env var if rotating.
 */
export const indexNowKey =
  process.env.INDEXNOW_KEY ?? '<paste-the-generated-key-here>';
```

…and re-export from `index.ts`: `export * from './indexnow';`.

- [ ] **Step 3: Create the key verification route for beam-repair**

IndexNow requires the key file at `https://<domain>/<key>.txt` containing the key as text. We build this dynamically so rotations only need the constant to change:

Create `apps/beam-repair/src/pages/[key].txt.ts`:

```ts
import type { APIRoute } from 'astro';
import { indexNowKey } from '@sfw/content';

export function getStaticPaths() {
  return [{ params: { key: indexNowKey } }];
}

export const GET: APIRoute = () => {
  return new Response(indexNowKey, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
```

- [ ] **Step 4: Replicate the key route to 11 remaining apps**

Same file content across all 12 apps.

- [ ] **Step 5: Build beam-repair; verify key file exists**

```bash
cd apps/beam-repair && pnpm build && cd ../..
ls apps/beam-repair/dist/*.txt
cat apps/beam-repair/dist/<KEY>.txt
```

Expected: file exists at `dist/<KEY>.txt` with the key as body.

- [ ] **Step 6: Create the submit script**

Create `tools/indexnow-submit/package.json`:

```json
{
  "name": "@sfw/indexnow-submit",
  "private": true,
  "type": "module",
  "bin": "./submit.mjs"
}
```

Create `tools/indexnow-submit/submit.mjs`:

```js
#!/usr/bin/env node
/**
 * Post-build IndexNow submitter.
 * Reads a built Astro site's sitemap-0.xml and submits all URLs to IndexNow.
 *
 * Usage:
 *   node submit.mjs <app-name>
 *
 * Env:
 *   INDEXNOW_KEY — if unset, skips submission (no-op).
 *   INDEXNOW_SKIP — set to "1" to skip (e.g., in PR previews).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ENGINE = 'https://api.indexnow.org/IndexNow';

const app = process.argv[2];
if (!app) {
  console.error('Usage: submit.mjs <app-name>');
  process.exit(2);
}

const key = process.env.INDEXNOW_KEY;
if (!key || process.env.INDEXNOW_SKIP === '1') {
  console.log(`[indexnow] skipping ${app} (no key or SKIP=1)`);
  process.exit(0);
}

const sitemapPath = resolve(`apps/${app}/dist/sitemap-0.xml`);
let xml;
try {
  xml = readFileSync(sitemapPath, 'utf8');
} catch (e) {
  console.error(`[indexnow] sitemap not found: ${sitemapPath}`);
  process.exit(1);
}

const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (urls.length === 0) {
  console.log(`[indexnow] no URLs in sitemap for ${app}`);
  process.exit(0);
}

const host = new URL(urls[0]).host;
const payload = {
  host,
  key,
  keyLocation: `https://${host}/${key}.txt`,
  urlList: urls,
};

const res = await fetch(ENGINE, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(payload),
});

if (res.status === 200 || res.status === 202) {
  console.log(`[indexnow] ${app}: submitted ${urls.length} URLs (${res.status})`);
} else {
  const text = await res.text().catch(() => '');
  console.warn(`[indexnow] ${app}: unexpected status ${res.status}: ${text}`);
}
```

- [ ] **Step 7: Wire the submit script into Vercel's deploy flow**

Vercel runs `buildCommand` from `vercel.json`. We want submission to happen **after** build success. Two options; pick (A):

**(A) Add a postbuild script per app:**

For each `apps/<app>/package.json`, add:

```json
{
  "scripts": {
    "build": "astro build",
    "postbuild": "node ../../tools/indexnow-submit/submit.mjs <app-name>"
  }
}
```

**(B) Only on production deploys:** gate with `VERCEL_ENV === 'production'` inside the submit script.

Apply gate to the submit script:

```js
if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
  console.log(`[indexnow] skipping ${app} (VERCEL_ENV=${process.env.VERCEL_ENV})`);
  process.exit(0);
}
```

- [ ] **Step 8: Configure INDEXNOW_KEY in Vercel**

This is a one-time, out-of-band setup: in each of the 12 Vercel projects, add environment variable `INDEXNOW_KEY=<the-generated-key>` for the Production environment only.

**Log this as a manual step in the commit message** so it's visible in the PR trail:
> "NOTE: Set INDEXNOW_KEY env var in all 12 Vercel projects (Production env only)."

- [ ] **Step 9: Dry-run locally**

```bash
cd apps/beam-repair && pnpm build && cd ../..
INDEXNOW_KEY=test-key INDEXNOW_SKIP=0 node tools/indexnow-submit/submit.mjs beam-repair
```

Expected: prints `[indexnow] beam-repair: submitted <N> URLs` or a graceful 403/422 (since `test-key` isn't registered — that proves the flow works).

- [ ] **Step 10: Commit**

```bash
git add tools/indexnow-submit/ packages/content/src/indexnow.ts packages/content/src/index.ts apps/*/src/pages/\[key\].txt.ts apps/*/package.json
git commit -m "feat(seo): IndexNow key route + post-build submitter"
./pushall.ps1
```

---

### Task 3.2: Per-collection sitemaps

**Files:**
- Modify: each `apps/<app>/astro.config.mjs`

**Context:** `@astrojs/sitemap`'s `serialize` and `filter` options let us bucket URLs by type. Since we don't use Astro content collections, we bucket by URL prefix.

- [ ] **Step 1: Decide the buckets**

Three buckets per app:
- `pages` — `/`, `/services`, `/contact`, `/about`, etc.
- `blog` — `/blog/**`
- `locations` — `/service-areas/**` or `/services/**`

- [ ] **Step 2: Update `apps/beam-repair/astro.config.mjs`**

Replace the existing sitemap integration block:

```js
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import { siteRedirects } from '../../packages/content/src/redirects';

const redirects = siteRedirects['beam-repair'] ?? {};
const redirectSources = new Set(Object.keys(redirects));

function bucketFor(pathname) {
  if (pathname.startsWith('/blog')) return 'blog';
  if (pathname.startsWith('/service-areas') || pathname.startsWith('/services/')) return 'locations';
  return 'pages';
}

export default defineConfig({
  site: 'https://beamrepairexpert.com',
  integrations: [
    tailwind(),
    sitemap({
      filter: (page) => {
        const path = new URL(page).pathname.replace(/\/$/, '');
        return !redirectSources.has(path);
      },
      // Per-collection chunking: emits sitemap-pages.xml, sitemap-blog.xml, sitemap-locations.xml
      // and references them from sitemap-index.xml.
      serialize(item) {
        const path = new URL(item.url).pathname;
        // @ts-ignore — allow custom field used downstream
        item._bucket = bucketFor(path);
        return item;
      },
      customPages: [],
    }),
  ],
  output: 'static',
  redirects,
  vite: {
    ssr: {
      noExternal: ['@sfw/content', '@sfw/ui', '@sfw/utils', '@sfw/config'],
    },
  },
});
```

**Note:** `@astrojs/sitemap` doesn't natively split by arbitrary buckets via `serialize`. Verify the plugin version. If it supports `entryLimit`, we can split by count (e.g., 500) instead. If clean bucketing isn't possible with the current plugin, fall back to a post-build script that reads `dist/sitemap-0.xml`, splits it into bucketed files, and rewrites `sitemap-index.xml`.

- [ ] **Step 3: If the plugin can't bucket natively, use post-build script**

Create `tools/sitemap-split/split.mjs`:

```js
#!/usr/bin/env node
/**
 * Post-build: split dist/sitemap-0.xml into per-bucket sitemaps.
 * Updates dist/sitemap-index.xml to reference the new sitemaps.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const app = process.argv[2];
if (!app) { console.error('Usage: split.mjs <app-name>'); process.exit(2); }

const distDir = resolve(`apps/${app}/dist`);
const inputPath = `${distDir}/sitemap-0.xml`;
const indexPath = `${distDir}/sitemap-index.xml`;

if (!existsSync(inputPath)) { console.log(`[sitemap-split] ${app}: no sitemap-0.xml`); process.exit(0); }

const xml = readFileSync(inputPath, 'utf8');
const items = [...xml.matchAll(/<url>[\s\S]*?<\/url>/g)].map((m) => m[0]);
if (items.length === 0) { console.log(`[sitemap-split] ${app}: empty sitemap`); process.exit(0); }

function bucketFor(urlXml) {
  const loc = urlXml.match(/<loc>([^<]+)<\/loc>/)?.[1] ?? '';
  const path = new URL(loc).pathname;
  if (path.startsWith('/blog')) return 'blog';
  if (path.startsWith('/service-areas') || /^\/services\//.test(path)) return 'locations';
  return 'pages';
}

const buckets = { pages: [], blog: [], locations: [] };
for (const item of items) buckets[bucketFor(item)].push(item);

const origin = new URL(
  items[0].match(/<loc>([^<]+)<\/loc>/)?.[1] ?? 'https://example.com'
).origin;

const bucketPaths = [];
for (const [name, list] of Object.entries(buckets)) {
  if (list.length === 0) continue;
  const out = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${list.join('\n')}
</urlset>`;
  const file = `sitemap-${name}.xml`;
  writeFileSync(`${distDir}/${file}`, out, 'utf8');
  bucketPaths.push(`${origin}/${file}`);
}

const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${bucketPaths.map((u) => `  <sitemap><loc>${u}</loc></sitemap>`).join('\n')}
</sitemapindex>`;
writeFileSync(indexPath, indexXml, 'utf8');

console.log(`[sitemap-split] ${app}: wrote ${bucketPaths.length} bucket sitemaps`);
```

Wire into each app's postbuild script (alongside the IndexNow submitter):

```json
"scripts": {
  "build": "astro build",
  "postbuild": "node ../../tools/sitemap-split/split.mjs <app-name> && node ../../tools/indexnow-submit/submit.mjs <app-name>"
}
```

- [ ] **Step 4: Build + verify**

```bash
cd apps/beam-repair && pnpm build && cd ../..
ls apps/beam-repair/dist/sitemap-*.xml
cat apps/beam-repair/dist/sitemap-index.xml
```

Expected: `sitemap-index.xml` references `sitemap-pages.xml`, `sitemap-blog.xml`, `sitemap-locations.xml` (skipping empty buckets). Baseline URL count from pre-flight matches the sum across buckets.

- [ ] **Step 5: Sanity-check URL preservation**

```bash
node -e "
const fs=require('fs');
const before=fs.readFileSync('apps/beam-repair/dist/sitemap-0.xml','utf8').match(/<loc>/g)?.length||0;
const parts=['sitemap-pages.xml','sitemap-blog.xml','sitemap-locations.xml']
  .map(f=>'apps/beam-repair/dist/'+f)
  .filter(f=>fs.existsSync(f))
  .map(f=>fs.readFileSync(f,'utf8').match(/<loc>/g)?.length||0);
console.log('orig:',before,'split-total:',parts.reduce((a,b)=>a+b,0));
"
```

Expected: `orig:` == `split-total:`.

- [ ] **Step 6: Commit**

```bash
git add tools/sitemap-split/ apps/*/package.json apps/*/astro.config.mjs
git commit -m "feat(seo): split sitemaps into pages/blog/locations buckets"
./pushall.ps1
```

---

### Task 3.3: Git-based lastmod dates in sitemaps

**Files:**
- Modify: `tools/sitemap-split/split.mjs` (add git-lastmod lookup)

**Context:** We already own the post-build sitemap-split script. Adding a git timestamp lookup per URL is one shell-out per file.

- [ ] **Step 1: Map URL → source file**

For each URL, derive the source file. Heuristics:
- `/blog` → `src/pages/blog/index.astro` OR `src/data/blog-posts.ts` (the latter is where content lives; prefer it)
- `/blog/<slug>` → `src/data/blog-posts.ts` (edits to any post update the file mtime; acceptable trade-off)
- `/services/<slug>` / `/service-areas/<slug>` → `src/pages/services/[slug].astro` or similar (find via file exists check)
- `/` → `src/pages/index.astro`
- Generic: `src/pages/<path>.astro` or `src/pages/<path>/index.astro`

Encapsulate in the split script:

```js
import { execFileSync } from 'node:child_process';

function gitLastModIso(sourceFile) {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', sourceFile], { encoding: 'utf8' });
    return out.trim() || null;
  } catch {
    return null;
  }
}

function sourceFileForUrl(app, urlPath) {
  const base = `apps/${app}/src/pages`;
  const p = urlPath.replace(/\/$/, '');
  const candidates = [
    p === '' ? `${base}/index.astro` : null,
    `${base}${p}.astro`,
    `${base}${p}/index.astro`,
  ].filter(Boolean);
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  // Blog fallback: any /blog/* URL → blog-posts.ts
  if (p.startsWith('/blog')) {
    const f = `apps/${app}/src/data/blog-posts.ts`;
    if (existsSync(f)) return f;
  }
  return null;
}
```

- [ ] **Step 2: Attach lastmod to each URL entry**

Update the URL-building loop:

```js
for (const item of items) {
  const loc = item.match(/<loc>([^<]+)<\/loc>/)?.[1] ?? '';
  const urlPath = new URL(loc).pathname;
  const source = sourceFileForUrl(app, urlPath);
  const lastmod = source ? gitLastModIso(source) : null;
  const itemWithLastmod = lastmod
    ? item.replace(/<\/url>/, `  <lastmod>${lastmod}</lastmod>\n</url>`)
    : item;
  buckets[bucketFor(item)].push(itemWithLastmod);
}
```

- [ ] **Step 3: Verify on beam-repair**

```bash
cd apps/beam-repair && pnpm build && cd ../..
grep '<lastmod>' apps/beam-repair/dist/sitemap-pages.xml | head -5
```

Expected: lastmod entries are ISO 8601 dates from git log.

- [ ] **Step 4: Handle CI shallow clones**

Vercel does shallow clones. Add a fallback for missing git history — use the file's mtime:

```js
function lastModIso(sourceFile) {
  const gitTime = gitLastModIso(sourceFile);
  if (gitTime) return gitTime;
  try {
    const mtime = statSync(sourceFile).mtime;
    return mtime.toISOString();
  } catch {
    return null;
  }
}
```

Add `statSync` to the node:fs imports.

**Vercel-specific:** add `VERCEL_FORCE_NO_BUILD_CACHE=1` or configure the project's "Ignored Build Step" carefully. Better approach — document that Vercel must fetch git history:

In `vercel.json`, add `"git": { "deploymentEnabled": true }` and set in Vercel UI: Project Settings → Git → "Automatically expose System Environment Variables". The `VERCEL_GIT_COMMIT_SHA` lets us infer depth. **If the fallback to mtime is acceptable, skip the UI config change.**

- [ ] **Step 5: Commit**

```bash
git add tools/sitemap-split/split.mjs
git commit -m "feat(seo): add git-based lastmod dates to sitemaps"
./pushall.ps1
```

---

## Phase 4 — Content & Social

### Task 4.1: Dynamic OG image generation

**Files:**
- Create: `packages/ui/src/lib/og-image.ts` (satori+sharp render function)
- Create per-app: `apps/*/src/pages/og/[...slug].png.ts` (dynamic route)
- Modify: `packages/ui/src/components/ui/SEO.astro` (default `ogImage` to dynamic route)
- Add deps: `satori`, `@resvg/resvg-js` (or `sharp`) to `packages/ui`

**Context:** Generate 1200×630 PNG OG cards at build time with service name + location.

- [ ] **Step 1: Add dependencies**

```bash
cd packages/ui
pnpm add satori @resvg/resvg-js
cd ../..
```

**Why resvg over sharp:** resvg is WASM-based, no native build step, works cleanly on Vercel. Sharp has native bindings that sometimes trip up CI.

- [ ] **Step 1b: Provision a TTF font for satori**

`public/shared/fonts/inter/` currently contains only `Inter-roman.var.woff2`. Satori needs TTF or OTF.

Download `Inter-Bold.ttf` from https://github.com/rsms/inter/releases (latest stable release, the "Inter Desktop" zip contains `Inter-Bold.ttf`) and place it at `public/shared/fonts/inter/Inter-Bold.ttf`.

```bash
ls public/shared/fonts/inter/Inter-Bold.ttf
```

Expected: file exists. If downloading isn't practical here, swap to Google Fonts' Inter and bundle via npm: `pnpm add -w @fontsource/inter` and read from `node_modules/@fontsource/inter/files/inter-latin-700-normal.ttf`.

- [ ] **Step 2: Create the OG renderer**

Create `packages/ui/src/lib/og-image.ts`:

```ts
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SiteConfig } from '../types';

const FONT_PATH = resolve(
  process.cwd(),
  '../../public/shared/fonts/inter/Inter-Bold.ttf'
);

// Cache the font read across requests in the same build.
let fontData: Buffer | null = null;
function loadFont(): Buffer {
  if (!fontData) fontData = readFileSync(FONT_PATH);
  return fontData;
}

export interface OgCardInput {
  config: SiteConfig;
  title: string;
  subtitle?: string;
}

export async function renderOgCard(input: OgCardInput): Promise<Uint8Array> {
  const { config, title, subtitle } = input;

  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: 1200,
          height: 630,
          padding: 80,
          backgroundColor: '#0f1419',
          color: '#f4f1eb',
          fontFamily: 'Inter',
        },
        children: [
          {
            type: 'div',
            props: {
              style: { fontSize: 28, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 4 },
              children: config.name,
            },
          },
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column', gap: 16 },
              children: [
                {
                  type: 'div',
                  props: {
                    style: { fontSize: 72, lineHeight: 1.1, fontWeight: 700 },
                    children: title,
                  },
                },
                subtitle
                  ? {
                      type: 'div',
                      props: {
                        style: { fontSize: 32, opacity: 0.8 },
                        children: subtitle,
                      },
                    }
                  : null,
              ].filter(Boolean),
            },
          },
          {
            type: 'div',
            props: {
              style: { fontSize: 24, opacity: 0.6 },
              children: config.url.replace(/^https?:\/\//, ''),
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      fonts: [{ name: 'Inter', data: loadFont(), weight: 700, style: 'normal' }],
    }
  );

  const png = new Resvg(svg).render().asPng();
  return png;
}
```

**Note:** Font path assumes Inter-Bold.ttf exists at `public/shared/fonts/inter/`. Verify with `ls public/shared/fonts/inter/`; if only `.woff2` exists, either add the TTF or swap to a different satori-compatible font that's already bundled.

- [ ] **Step 3: Create a dynamic OG route for beam-repair**

Create `apps/beam-repair/src/pages/og/[...slug].png.ts`:

```ts
import type { APIRoute } from 'astro';
import { renderOgCard } from '@sfw/ui';
import { serviceConfigs } from '@sfw/content';

export function getStaticPaths() {
  // Static list for now: root + common pages. Expand as needed.
  return [
    { params: { slug: undefined }, props: { title: 'Beam Repair Experts', subtitle: 'Portland • Seattle' } },
    { params: { slug: 'services' }, props: { title: 'Services', subtitle: 'Beam repair and replacement' } },
    { params: { slug: 'contact' }, props: { title: 'Contact', subtitle: 'Get a free assessment' } },
  ];
}

export const GET: APIRoute = async ({ props }) => {
  const config = serviceConfigs['beam-repair'];
  const png = await renderOgCard({
    config,
    title: props.title as string,
    subtitle: props.subtitle as string | undefined,
  });
  return new Response(png, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
};
```

**Note on dynamic title/subtitle:** for arbitrary pages (every blog post, every service area), use a second route that takes known path patterns. Keep the initial scope to the handful of top-level pages and expand iteratively.

- [ ] **Step 4: Update SEO.astro to use the dynamic OG URL**

In `packages/ui/src/components/ui/SEO.astro`, change the `ogImage` default behavior: if no explicit `ogImage` is passed, derive one from the current URL.

```ts
const computedOgImage =
  ogImage ??
  (() => {
    const path = Astro.url.pathname.replace(/^\//, '').replace(/\/$/, '');
    return `${config.url}/og/${path}.png`;
  })();
```

Then use `computedOgImage` in all `og:image` and `twitter:image` tags.

- [ ] **Step 5: Build + verify**

```bash
cd apps/beam-repair && pnpm build && cd ../..
ls apps/beam-repair/dist/og/
file apps/beam-repair/dist/og/services.png
```

Expected: `og/services.png` exists and is a valid PNG, 1200×630.

- [ ] **Step 6: Replicate to 11 remaining apps**

Same file, change `'beam-repair'` → `<app-name>` and tune the `getStaticPaths()` entries per app.

- [ ] **Step 7: Commit**

```bash
git add packages/ui/ apps/*/src/pages/og/
git commit -m "feat(seo): dynamic OG image generation with satori"
./pushall.ps1
```

---

### Task 4.2: RSS feeds

**Files:**
- Create per-app: `apps/*/src/pages/rss.xml.ts`
- Modify: `packages/ui/src/layouts/BaseLayout.astro` (add `<link rel="alternate">`)
- Add dep: `@astrojs/rss` per-app

- [ ] **Step 1: Add the dep**

```bash
cd apps/beam-repair && pnpm add @astrojs/rss && cd ../..
```

Replicate to the other 11 apps (or set it as a root devDep — but @astrojs/rss is a per-app integration, so per-app install is cleaner).

- [ ] **Step 2: Create the RSS route**

Create `apps/beam-repair/src/pages/rss.xml.ts`:

```ts
import type { APIRoute } from 'astro';
import rss from '@astrojs/rss';
import { serviceConfigs } from '@sfw/content';
import { blogPosts } from '../data/blog-posts';

export const GET: APIRoute = (context) => {
  const config = serviceConfigs['beam-repair'];
  return rss({
    title: `${config.name} — Blog`,
    description: config.description,
    site: context.site!,
    items: blogPosts.map((post) => ({
      title: post.title,
      pubDate: new Date(post.publishDate),
      description: post.excerpt,
      link: `/blog/${post.slug}/`,
      content: post.content, // full body, per roadmap
    })),
    customData: `<language>en-us</language>`,
  });
};
```

- [ ] **Step 3: Wire the alternate link**

In `BaseLayout.astro`, after the font preload line, add:

```astro
<link rel="alternate" type="application/rss+xml" title={`${config.name} Blog`} href="/rss.xml" />
```

- [ ] **Step 4: Build + verify**

```bash
cd apps/beam-repair && pnpm build && cd ../..
head -30 apps/beam-repair/dist/rss.xml
```

Expected: valid `<rss>` XML with `<channel>` and `<item>` entries.

- [ ] **Step 5: Validate with a feed linter (manual)**

Copy feed URL after deploy (or serve locally with `pnpm preview`) and paste into https://validator.w3.org/feed/. Expected: valid RSS 2.0.

- [ ] **Step 6: Replicate to 11 remaining apps**

- [ ] **Step 7: Commit**

```bash
git add apps/*/src/pages/rss.xml.ts apps/*/package.json pnpm-lock.yaml packages/ui/src/layouts/BaseLayout.astro
git commit -m "feat(seo): add RSS feeds and alternate link tags"
./pushall.ps1
```

---

### Task 4.3: Build-time content validation

**Files:**
- Create: `tools/seo-validate/validate.mjs`
- Wire into each app's prebuild step

**Context:** Fail the build if title/description lengths are out of bounds, if there's more than one H1, or if any two pages share a title.

- [ ] **Step 1: Create the validator**

Create `tools/seo-validate/validate.mjs`:

```js
#!/usr/bin/env node
/**
 * Post-build SEO validator. Scans dist/ for:
 *   - <title>: 5–120 chars
 *   - <meta name="description">: 15–160 chars
 *   - single <h1> per page
 *   - no duplicate titles across pages
 *   - no duplicate descriptions across pages
 * Exits non-zero on violation.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const app = process.argv[2];
if (!app) { console.error('Usage: validate.mjs <app-name>'); process.exit(2); }

const distDir = `apps/${app}/dist`;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (entry.endsWith('.html')) out.push(full);
  }
  return out;
}

const files = walk(distDir);
const titles = new Map();      // title → file
const descriptions = new Map(); // desc → file
const errors = [];

for (const file of files) {
  const html = readFileSync(file, 'utf8');
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1]?.trim();
  const desc = html.match(/<meta\s+name="description"\s+content="([^"]+)"/)?.[1]?.trim();
  const h1Count = (html.match(/<h1\b/g) ?? []).length;

  if (!title) errors.push(`${file}: missing <title>`);
  else if (title.length < 5 || title.length > 120) {
    errors.push(`${file}: title length ${title.length} out of [5,120]: "${title}"`);
  } else {
    if (titles.has(title)) errors.push(`${file}: duplicate title "${title}" (also in ${titles.get(title)})`);
    else titles.set(title, file);
  }

  if (!desc) errors.push(`${file}: missing meta description`);
  else if (desc.length < 15 || desc.length > 160) {
    errors.push(`${file}: description length ${desc.length} out of [15,160]`);
  } else {
    if (descriptions.has(desc)) errors.push(`${file}: duplicate description (also in ${descriptions.get(desc)})`);
    else descriptions.set(desc, file);
  }

  // Skip H1 check on 404 and offline pages (intentionally exempt).
  if (!file.endsWith('404.html') && h1Count !== 1) {
    errors.push(`${file}: expected 1 <h1>, found ${h1Count}`);
  }
}

if (errors.length > 0) {
  console.error(`[seo-validate] ${app}: ${errors.length} violation(s):`);
  errors.forEach((e) => console.error('  ' + e));
  process.exit(1);
}
console.log(`[seo-validate] ${app}: ${files.length} pages OK`);
```

- [ ] **Step 2: Wire into each app's postbuild**

Add to each `apps/<app>/package.json`'s postbuild script (chain before sitemap-split):

```json
"postbuild": "node ../../tools/seo-validate/validate.mjs <app-name> && node ../../tools/sitemap-split/split.mjs <app-name> && node ../../tools/indexnow-submit/submit.mjs <app-name>"
```

- [ ] **Step 3: Run the validator against beam-repair**

```bash
cd apps/beam-repair && pnpm build && cd ../..
```

Expected: either succeeds (all pages clean) or prints specific violations. **If it fails, fix the content issues before committing.**

Common initial failures to expect:
- Titles too long (our default is `<page> | <site-name>` which can exceed 120 chars). Tighten per-page titles.
- Duplicate service-area descriptions (likely — same template text). Vary description per location.

- [ ] **Step 4: Commit**

```bash
git add tools/seo-validate/ apps/*/package.json
git commit -m "feat(seo): build-time title/description/H1 validation"
./pushall.ps1
```

---

## Phase 5 — Future-Proofing

### Task 5.1: NLWeb protocol tag

**Files:**
- Modify: `packages/ui/src/layouts/BaseLayout.astro`

**Context:** Ship the tag even if the conversational endpoint doesn't exist yet. It's a discovery marker — pointing at a `/nlweb/` stub is fine.

- [ ] **Step 1: Add the tag**

In `BaseLayout.astro`, after the alternate RSS link:

```astro
<link rel="nlweb" href="/nlweb/" />
```

- [ ] **Step 2: Stub the endpoint (so it returns 200, not 404)**

Create `packages/ui/src/pages/nlweb-stub.astro` — actually, since each app needs its own `/nlweb/` route, better to create per-app.

Create `apps/beam-repair/src/pages/nlweb/index.json.ts`:

```ts
import type { APIRoute } from 'astro';
import { serviceConfigs } from '@sfw/content';

export const GET: APIRoute = () => {
  const config = serviceConfigs['beam-repair'];
  return new Response(JSON.stringify({
    '@context': 'https://nlweb.ai/context',
    name: config.name,
    description: config.description,
    url: config.url,
    telephone: config.phone,
    status: 'stub — conversational endpoint not yet implemented',
  }, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
```

Replicate to 11 remaining apps.

- [ ] **Step 3: Build + verify**

```bash
cd apps/beam-repair && pnpm build && cd ../..
cat apps/beam-repair/dist/nlweb/index.json
grep 'rel="nlweb"' apps/beam-repair/dist/index.html
```

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/layouts/BaseLayout.astro apps/*/src/pages/nlweb/
git commit -m "feat(seo): add NLWeb protocol tag and stub endpoint"
./pushall.ps1
```

---

### Task 5.2: Viewport prefetching

**Files:**
- Modify: `packages/ui/src/layouts/BaseLayout.astro`

**Context:** Astro's `<ClientRouter />` enables SPA-style navigation. Viewport prefetching is a native `<link rel="prefetch">` strategy — lighter-weight.

- [ ] **Step 1: Pick the approach**

**Native prefetch (recommended — no JS, no view transitions complexity):** Use `astro:prefetch` config with `defaultStrategy: 'viewport'`. No ClientRouter needed.

In each app's `astro.config.mjs`, add:

```js
export default defineConfig({
  // ... existing config ...
  prefetch: {
    defaultStrategy: 'viewport',
    prefetchAll: false,
  },
});
```

Also add the `data-astro-prefetch` default to links. Per Astro docs, `prefetchAll: true` adds the prefetch to all links; `prefetchAll: false` requires opting in per-link. For this site, `prefetchAll: true` is reasonable — small HTML, and most users land → scroll → click.

**Revised:** use `prefetchAll: true`:

```js
prefetch: {
  defaultStrategy: 'viewport',
  prefetchAll: true,
},
```

- [ ] **Step 2: Apply to all 12 astro.config.mjs files**

- [ ] **Step 3: Build and inspect network**

```bash
cd apps/beam-repair && pnpm build && pnpm preview &
sleep 3
curl -sI http://localhost:4321/ | head
# Open in a browser: scroll around, open devtools Network tab, filter by "Initiator: prefetch"
kill %1 2>/dev/null
cd ../..
```

- [ ] **Step 4: Commit**

```bash
git add apps/*/astro.config.mjs
git commit -m "feat(seo): enable viewport-based link prefetching"
./pushall.ps1
```

---

### Task 5.3: Fuzzy 404 redirects

**Decision point:** Use `@jdevalk/astro-seo-graph`'s `FuzzyRedirect` component vs. building our own.

**Recommendation:** Build our own — our 404 is already custom (from Phase 1), the Levenshtein logic is ~30 lines, and we avoid the package dependency.

**Files:**
- Create: `packages/ui/src/scripts/fuzzy-404.ts`
- Modify: `packages/ui/src/pages/NotFoundPage.astro` (add script + suggestion UI)

- [ ] **Step 1: Create the client script**

Create `packages/ui/src/scripts/fuzzy-404.ts`:

```ts
/**
 * Fuzzy 404 redirect. Fetches /sitemap-index.xml, walks to child sitemaps,
 * collects all URLs, finds the best Levenshtein match to the current pathname.
 * If similarity ≥ 0.85 → auto-redirect. Else → show "Did you mean:" suggestion.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[j - 1], dp[j]);
      prev = tmp;
    }
  }
  return dp[n];
}

function similarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 1;
  return (longest - levenshtein(a, b)) / longest;
}

async function fetchAllUrls(): Promise<string[]> {
  const idxRes = await fetch('/sitemap-index.xml');
  if (!idxRes.ok) return [];
  const idx = await idxRes.text();
  const childLocs = [...idx.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

  const urls: string[] = [];
  await Promise.all(
    childLocs.map(async (loc) => {
      try {
        const res = await fetch(loc);
        const xml = await res.text();
        urls.push(...[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
      } catch {}
    })
  );
  return urls;
}

export async function runFuzzy404() {
  const current = window.location.pathname;
  const urls = await fetchAllUrls();
  const paths = urls.map((u) => new URL(u).pathname);

  let best = { path: '', score: 0 };
  for (const p of paths) {
    const s = similarity(current, p);
    if (s > best.score) best = { path: p, score: s };
  }

  if (best.score >= 0.85 && best.path !== current) {
    window.location.replace(best.path);
    return;
  }

  if (best.score >= 0.5) {
    const target = document.getElementById('fuzzy-404-suggestion');
    if (target) {
      target.innerHTML = `Did you mean <a href="${best.path}" class="text-primary underline">${best.path}</a>?`;
      target.hidden = false;
    }
  }
}
```

- [ ] **Step 2: Update NotFoundPage.astro to run the script**

Modify `packages/ui/src/pages/NotFoundPage.astro` — add an empty suggestion container and inline the script:

```astro
<p id="fuzzy-404-suggestion" hidden class="mb-6 text-base text-gray-700"></p>

<script>
  import { runFuzzy404 } from '../scripts/fuzzy-404';
  runFuzzy404();
</script>
```

Place the `<p>` above the "Back to Home" buttons.

- [ ] **Step 3: Build + test**

```bash
cd apps/beam-repair && pnpm build && pnpm preview &
sleep 3
# A real 404 page: hit a bogus URL close to a real one.
# If the real URL is /services/portland, try /servces/portland
curl -sL http://localhost:4321/servces/portland/ | grep fuzzy-404-suggestion
kill %1 2>/dev/null
cd ../..
```

Expected: the suggestion container is in the HTML. Full behavior (auto-redirect + visible suggestion) requires a real browser — verify manually.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/
git commit -m "feat(seo): fuzzy 404 with Levenshtein matching against sitemap"
./pushall.ps1
```

---

### Task 5.4: Broken-link CI with lychee

**Files:**
- Create: `.github/workflows/link-check.yml`
- Create: `lychee.toml`

- [ ] **Step 1: Create lychee config**

Create `lychee.toml` at the repo root:

```toml
# lychee config — https://lychee.cli.rs/usage/config/
verbose = "info"
no_progress = true
cache = true
max_cache_age = "7d"
accept = [200, 204, 301, 302, 303, 307, 308]
# Skip anchor-only and mailto/tel.
exclude = [
  "^mailto:",
  "^tel:",
  "^#",
]
timeout = 20
retry_wait_time = 2
max_retries = 3
# Astro generates absolute URLs in sitemaps; check them too.
remap = []
```

- [ ] **Step 2: Create the GitHub Action**

Create `.github/workflows/link-check.yml`:

```yaml
name: Link check

on:
  # Run on every push touching content-bearing files.
  push:
    branches: [main]
    paths:
      - 'apps/**/src/**'
      - 'packages/content/**'
      - 'packages/ui/**'
  # Weekly scheduled rot check.
  schedule:
    - cron: '0 14 * * 1' # Mondays 14:00 UTC
  workflow_dispatch:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Build all apps
        run: pnpm build

      - name: Run lychee
        uses: lycheeverse/lychee-action@v2
        with:
          args: >-
            --config lychee.toml
            'apps/**/dist/**/*.html'
          fail: true
```

- [ ] **Step 3: Verify locally (optional — lychee is installable)**

```bash
# On a machine with lychee installed:
lychee --config lychee.toml 'apps/beam-repair/dist/**/*.html'
```

Expected: reports broken links in output; clean exits with 0 if none.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/link-check.yml lychee.toml
git commit -m "feat(seo): broken link CI with lychee (push + weekly)"
./pushall.ps1
```

- [ ] **Step 5: Monitor the first workflow run**

After push, check https://github.com/tbhogstrom/sfw-microsites/actions (or the tfalcon_SFW fork, whichever the Action is scoped to). Expect either a green run or a list of flagged URLs to fix.

---

## Final Verification

**Files:** none (post-roadmap sanity check)

- [ ] **Step 1: Full pipeline build**

```bash
pnpm install
pnpm -w lint
pnpm build
```

Expected: all 12 apps build, all validate-SEO hooks pass, lychee workflow queued.

- [ ] **Step 2: Schema validation on one page per app**

For each of the 12 apps, copy the JSON-LD from the homepage build output and validate at https://validator.schema.org/. Expect 0 errors each.

- [ ] **Step 3: Rich Results test**

For a sample of pages, run the Google Rich Results test: https://search.google.com/test/rich-results. Expect LocalBusiness + WebPage + WebSite detected.

- [ ] **Step 4: Submit sitemaps in Google Search Console**

For each of the 12 sites in GSC, add the new per-collection sitemap URLs (sitemap-pages.xml, sitemap-blog.xml, sitemap-locations.xml). This is a manual, one-time-per-site step.

- [ ] **Step 5: Register IndexNow key with Bing Webmaster Tools**

Sign in to Bing Webmaster Tools, go to IndexNow settings, and verify ownership of each of the 12 domains. The key route at `/<key>.txt` handles this.

- [ ] **Step 6: Celebrate and document**

Update `docs/seo-roadmap.html` to mark all phases complete, or archive it. Consider writing a short post-mortem in `docs/seo-roadmap-complete.md` summarizing what landed and any deviations from the plan.

---

## Notes and Caveats

- **mold-testing and restoration** are infrastructure-included but excluded from V1 content — per project memory. If the team decides to fully exclude, delete their `apps/mold-testing` and `apps/restoration` changes before the final commit in each task. Easier: leave them. The SEO infrastructure is harmless on unreleased sites.
- **Font path** in the OG card generator assumes `Inter-Bold.ttf` exists at `public/shared/fonts/inter/`. Verify before Phase 4 Task 4.1.
- **Vercel shallow clones** mean the git-based lastmod may default to "build time" for all files on first deploy. The script falls back to mtime gracefully; subsequent deploys will get real git timestamps once enough history is fetched.
- **The existing duplicate JSON-LD in `Breadcrumbs.astro`, `FAQAccordion.astro`, `BlogPost.astro`** is deleted in Phase 2 Task 2.3 *after* all callers migrate. Don't delete before that — the `@graph` only includes those entities if the page passes them through BaseLayout.
- **Route naming:** paths like `/service-areas/[slug]` vs. `/services/[slug]` vary across apps. Phase 2 Task 2.4 (service schema) and Phase 3 Task 3.2 (sitemap buckets) must be audited per-app to use the right prefix.
- **IndexNow key rotation:** if the key ever leaks, regenerate, update `INDEXNOW_KEY` in all 12 Vercel projects, rebuild. The verification route reads from the constant, so no other code changes needed.

# SFW Microsites Roadmap: V1 through V3

**Date:** 2026-03-26
**Author:** tfalcon + Claude
**Status:** Draft

## Context

SFW Construction operates 12 Astro microsites in a Turborepo monorepo, each targeting a specific home repair service (deck repair, chimney repair, siding repair, etc.) across Portland and Seattle markets. The sites share a component library (`@sfw/ui`), centralized content package (`@sfw/content`), and deployment pipeline (Vercel auto-deploy per site).

### Current State

- **Traffic:** Early-stage SEO. Sites are indexing and starting to rank. SEMRush and Search Console data available.
- **Leads:** One conversion to date (siding-repair, Seattle, HubSpot form submission).
- **Content:** 300+ blog posts, ~200 service pages generated via RAG pipeline. Quality varies — needs editorial pass.
- **UI:** 31 shared Astro components. Functional but generic. Olive green/dark red palette. No per-site differentiation.
- **Images:** Hosted on Vercel Blob. Coverage uneven (2 images on mold-testing, 15+ on others).
- **Logos:** 6 of 12 sites have logos (chimney-repair, dry-rot, flashing-repair, leak-repair, mold-testing, siding-repair). 6 still need them (beam-repair, crawlspace-rot, deck-repair, lead-paint, restoration, trim-repair).
- **Tooling:** No ESLint, no Prettier, no pre-commit hooks, no CI beyond Vercel auto-deploy. Editorial crew tool exists externally (`C:\Users\tfalcon\googld-adk-scratcj`).
- **Measurement:** SEMRush, Search Console, GA4 (mostly), HubSpot form tracking, CallRail (some sites).

### Strategic Context

The sites are in **SEO ranking mode** — building authority, indexing content, climbing SERPs. In parallel, the sites need to be built out to **convert traffic to leads** as rankings improve. This roadmap covers both tracks.

### Approach

Sequential versioned releases. Each version bundles four tracks (Features, UI/UX, Content, DX/Tooling) so every release delivers cross-cutting value. Solo developer + Claude — so phases are sequential, each building on the last.

---

## V1: "Ship It" — Complete the Baseline

**Goal:** Every site has its full service page content, image galleries, and logo deployed. No gaps, no placeholder states. The foundation is complete.

### Features

#### Service Page Content Deployment
- All 12 sites render service pages for both Portland and Seattle via `[location]/[service].astro` dynamic routes
- Generated markdown files in `src/data/generated_content/` are wired up and rendering
- Audit each site for missing service pages; generate any that don't exist

#### Service Image Galleries
- Every site has a minimum of 8 properly tagged images in Vercel Blob
- `images.json` populated with CDN URLs, alt text, and category tags
- `ServicesGallery` component deployed on all sites (currently only chimney-repair has it)
- Use `tools/photo-picker` and `tools/blob-manager` to source and upload

#### Logos
- Deploy the 6 existing logos (chimney-repair, dry-rot, flashing-repair, leak-repair, mold-testing, siding-repair)
- Remaining 6 sites (beam-repair, crawlspace-rot, deck-repair, lead-paint, restoration, trim-repair) use a clean fallback (SFW Construction parent logo or service-name wordmark)
- Header and Footer components updated to handle both logo states gracefully

### UI/UX — Consistency Pass

- **GA4 tracking:** Add missing IDs for mold-testing and dry-rot in `service-configs.ts`
- **CallRail:** Verify tracking is configured on all sites that have phone numbers
- **Testimonials:** Populate empty testimonial arrays with shared base testimonials from `sfw-data.ts`
- **ServicesGallery:** Ensure component renders correctly on all 12 sites with their respective images

### Content

- Service pages that exist as markdown but aren't routed get wired up
- Prioritize photo sourcing for thin-coverage sites (mold-testing, trim-repair, flashing-repair)
- No editorial quality pass yet — that's V2

### DX/Tooling

Minimal — just enough to ship confidently:
- `pnpm lint` passes clean across all 12 sites and 4 packages
- Fix any existing type errors or Astro check warnings
- Document V1 completion state in a checklist

### V1 Exit Criteria

- [ ] All 12 sites have service pages rendering for both Portland and Seattle
- [ ] All 12 sites have at least 8 gallery images uploaded and rendering
- [ ] 6 logos deployed to their sites; 6 sites have clean fallback logo
- [ ] GA4 tracking configured on all 12 sites
- [ ] CallRail tracking verified where applicable
- [ ] Testimonials populated on all sites (real or shared base)
- [ ] ServicesGallery component deployed on all 12 sites
- [ ] `pnpm lint` clean across the monorepo

---

## V2: "Make It Good" — Visual Rebrand + Quality + Tooling

**Goal:** The sites go from "functional SEO microsites" to "professional, trust-building service websites" with a modern design system, editorial-quality content, and proper dev guardrails.

V2 has four sub-phases, executed in order:

### V2a: DX Foundation

Do this first — it enables confident refactoring for everything that follows.

#### Linting & Formatting
- **ESLint:** Add to monorepo root with Astro + TypeScript plugin. Configure rules for code quality and consistency.
- **Prettier:** Add with Astro plugin. Configure for consistent formatting across all files.
- **Integration:** `pnpm lint` runs both ESLint and Astro check. `pnpm format` runs Prettier.

#### Pre-commit Hooks
- **husky + lint-staged:** Run ESLint + Prettier on staged files before every commit.
- Prevents broken code from reaching `main`.

#### CI Pipeline
- **GitHub Actions workflow:** On push to `main`:
  - `pnpm install`
  - `pnpm lint` (ESLint + Astro check across all packages)
  - `pnpm typecheck`
  - Fail the workflow if any check fails
- Complements Vercel auto-deploy (Vercel handles build; CI handles quality gates).

#### Editorial Crew Integration
- Migrate from `C:\Users\tfalcon\googld-adk-scratcj` into `tools/editorial-crew/`
- Add proper `package.json` (or Python equivalent) with documented dependencies
- Wire into monorepo: `pnpm editorial` or `python -m editorial_crew` from root
- Document usage in CLAUDE.md and a README in the tool directory

### V2b: Design System Rebuild

The heart of V2. Rethink `@sfw/ui` for visual quality and composability.

#### Design Tokens & Theming

**Color system:**
- Shared neutral base (modern gray palette replacing current gray-light/gray-border)
- Per-site accent color (each service gets a distinctive color — e.g., deck-repair warm wood tones, chimney-repair deep charcoal, siding-repair slate blue)
- Accent colors defined in `@sfw/config` Tailwind config, selected per-site via a site theme prop or CSS custom properties
- Secondary color revised (current #900 dark red is underutilized — either lean into it or replace)

**Typography:**
- Upgrade from Helvetica/Poppins to a more distinctive pairing
- Candidates: Inter or DM Sans (clean, modern, excellent readability) for body; a display face for headings
- Implement via `next/font`-style self-hosting (or Astro equivalent) for performance
- Define a clear type scale: display, h1-h4, body, caption, overline

**Spacing & Surface:**
- Define consistent border-radius tokens (sm, md, lg, full)
- Shadow system (subtle elevation for cards, modals, dropdowns)
- Consistent spacing scale extending Tailwind defaults where needed

#### Component Improvements (Polish Existing)

**HeroSection refactor:**
- Split 295-line monolith into composable pieces:
  - `HeroLayout.astro` — handles background, overlay, responsive container
  - `HeroContent.astro` — headline, subheadline, CTA buttons
  - `HeroForm.astro` — HubSpot form integration (extracted from inline script)
  - `HeroMedia.astro` — background image/video handling
- Composed via slots for flexibility

**Button consolidation:**
- Merge `Button.astro` and `FormButton.astro` into one component
- Extract shared class-building logic into a `cn()` utility in `@sfw/utils`
- Support: variants (primary, secondary, outline, ghost), sizes (sm, md, lg), loading state, icon slots, link mode

**Script extraction:**
- Move all inline `<script>` blocks to separate `.ts` files
- Use Astro's `client:load` / `client:visible` directives for interactive components
- Affects: HeroSection (95 lines), TestimonialSlider (40 lines), MobileNav (24 lines), Header (15 lines)

**Mobile menu consolidation:**
- Header and MobileNav both handle toggle logic independently
- Consolidate into a single shared state module

**Transitions & polish:**
- Add subtle hover/focus transitions on buttons, cards, links
- Smooth accordion open/close (FAQAccordion currently uses instant `<details>`)
- Page section fade-in on scroll (intersection observer, lightweight)

#### New Components (Expand the Toolkit)

| Component | Purpose | Priority |
|---|---|---|
| `BeforeAfter` | Slider showing project transformation | High — construction sites live and die by visual proof |
| `TrustBadges` | Horizontal bar: CCB license, insurance, years, review count | High — instant credibility |
| `ComparisonTable` | Service tiers, material options, side-by-side | Medium |
| `VideoEmbed` | Responsive video (YouTube/Vimeo) with lazy loading | Medium |
| `PricingCard` | Estimate range or "starting at" display with CTA | Medium |
| `ImageLightbox` | Modal gallery viewer for service photos | Medium |
| `StickyMobileCTA` | Fixed bottom bar with phone + form buttons | High — mobile conversion essential |
| `SocialProofTicker` | "Recently completed: Deck repair in SE Portland" | Low |
| `InteractiveMap` | Clickable service area map (upgrade from iframe) | Low |
| `Tabs` | Tabbed content for service details | Medium |

#### Component Catalog
- Expand `test-components.astro` to exist on every site as a living component reference
- Shows all components with real data from that site's config

### V2c: Content Quality Pass

#### Editorial Crew Execution
- Run editorial crew against all service pages (highest priority — these are the SEO landing pages)
- Run against blog posts (second priority — these drive organic traffic)
- Focus areas:
  - Remove AI-sounding language ("In the realm of...", "It's worth noting that...")
  - Add local Portland/Seattle flavor and specificity
  - Improve readability scores
  - Ensure technical accuracy for construction content

#### Content Enrichment
- Service pages updated to use new V2 components:
  - Before/After images where project photos exist
  - Trust badges on every service page
  - Comparison tables for service options where relevant
- Blog posts get relevant inline CTAs (not just footer banners)

#### Testimonials & Social Proof
- Source real testimonials per service where available
- Improve base testimonials for services without real ones
- Add review counts or ratings where available

#### Image Quality
- Replace any stock-looking images with real project photos
- Ensure all hero images are high-quality and service-relevant
- Add before/after photo pairs for BeforeAfter component

### V2d: Site-by-Site Rollout

**Order:**
1. **Siding-repair** (pilot) — full V2 treatment, validate the design system works end-to-end
2. **Extract & refine** — patterns that work get baked into `@sfw/ui` and `@sfw/config`
3. **Tier 1** (chimney-repair, deck-repair, crawlspace-rot) — highest traffic sites
4. **Remaining 8 sites** — apply template, customize accent colors and content per service

Each site rollout includes:
- Per-site accent color applied
- Logo (real or wordmark fallback)
- All new components integrated into page templates
- Content editorial pass complete
- Gallery images reviewed and upgraded

### V2 Exit Criteria

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

## V3: "Make It Convert" — Turn Traffic Into Leads

**Goal:** Optimize every touchpoint for conversion. This is where SEO investment starts paying back in lead volume. Traffic that V1 and V2 built now converts.

### V3a: Conversion Optimization

#### Form Redesign
- **Multi-step contact form:** Replace single-page form with a guided flow:
  1. Service type selection (visual cards)
  2. Location / project details
  3. Contact information
  4. Submit → Thank-you page with next steps
- **Inline validation:** Real-time field validation with helpful messages
- **Form analytics:** Track step-by-step completion rates (which step loses people?)
- **Thank-you page:** Dedicated page with confirmation, expected response time, phone fallback, related services

#### CTA Optimization
- **Sticky mobile CTA bar:** Fixed bottom bar with phone button + "Free Estimate" — always visible on scroll. Hides on homepage hero (where the main CTA is already visible).
- **Contextual CTAs:** Service pages offer service-specific language ("Get Your Deck Repair Estimate" not "Contact Us")
- **Click-to-call tracking:** All phone number taps tracked as conversion events
- **Exit-intent modal (desktop):** Lightweight prompt for visitors navigating away — offers free estimate or guide download

#### Trust & Social Proof
- **Trust badge bar:** On every page — CCB license #, insurance status, years in business, project count, review rating
- **Review integration:** Display Google/Yelp star ratings if available (or aggregate review count)
- **Case studies:** 2-3 detailed project stories on each Tier 1 site:
  - Before/after photos
  - Scope of work
  - Timeline
  - Outcome / customer quote
- **"Recently completed" social proof:** Dynamic or static ticker showing recent project types and locations

### V3b: Performance & Core Web Vitals

#### Image Optimization Audit
- Add proper `sizes` attributes to all `<img>` tags for responsive srcset
- Hero images: `fetchpriority="high"` + `loading="eager"` (some already have this; verify all)
- Below-fold images: `loading="lazy"` (verify consistent)
- Consider Astro Image component with built-in optimization where not already used

#### Font Loading
- `font-display: swap` on all web fonts
- Preload critical fonts used above the fold
- Minimize font file count (subset if using custom faces)

#### Lighthouse CI
- Add Lighthouse CI to GitHub Actions
- Track Core Web Vitals (LCP, FID/INP, CLS) per site per deploy
- Alert on regressions (e.g., LCP > 2.5s)

#### General Performance
- Audit and defer non-critical scripts (analytics, CallRail, HubSpot embed)
- Add skip-to-content link for accessibility
- Verify no render-blocking resources in critical path

### V3c: Analytics & Measurement

#### Cross-Site Dashboard
- Single view showing all 12 sites: traffic, rankings, form submissions, phone calls
- Could be a simple tool in `tools/analytics-dashboard/` that pulls from GA4 + HubSpot + CallRail APIs
- Or a lightweight web dashboard (stretch goal)

#### Event Tracking
- **Form events:** form_start, form_step_complete, form_submit, form_abandon (with step)
- **CTA events:** cta_click (with label and location on page)
- **Phone events:** phone_tap (mobile click-to-call)
- **Engagement:** scroll_depth (25/50/75/100%), time_on_page
- All sent to GA4 as custom events

#### Content Performance
- Which blog posts drive the most traffic?
- Which service pages have the best engagement (low bounce, high scroll depth)?
- Feed insights back into editorial priorities

#### Automated Reporting
- Weekly digest: traffic trends, lead volume, top-performing pages, ranking changes
- Could be a script in `tools/` that runs manually or on a schedule

### V3d: Content for Conversion

#### Service Page Copy Optimization
- Shift from informational SEO tone to benefit-driven, action-oriented copy
- Lead with the customer's problem, then the solution, then the CTA
- Add urgency where appropriate ("Water damage spreads quickly — don't wait")
- Location-specific proof points ("47 projects completed in SE Portland this year")

#### FAQ Rewrite
- Current FAQs answer informational queries (good for SEO)
- Add/rewrite FAQs that address buying objections:
  - "How much does X repair typically cost?"
  - "How long does the repair take?"
  - "Do you offer warranties?"
  - "What if I'm not sure what's wrong?"

#### Blog Post CTAs
- Every blog post gets a contextual, relevant CTA tied to the post's topic
- Not just a generic footer banner — inline CTA at the natural decision point in the content

### V3e: Advanced Features (Stretch Goals)

These are high-value but higher-effort. Implement if V3a-V3d is complete and there's momentum:

| Feature | Description | Value |
|---|---|---|
| **Instant estimate calculator** | Simple form: project type + approximate size → ballpark range | Huge lead qualifier — visitors self-select |
| **Photo upload** | Let visitors upload photos of their damage for faster quoting | Differentiator — shows you're tech-forward |
| **Chat widget** | Lightweight "Questions?" prompt routing to HubSpot or SMS | Captures visitors who won't fill a form |
| **A/B testing** | Test hero headlines, CTA copy, form layouts on high-traffic pages | Data-driven optimization loop |

### V3 Exit Criteria

- [ ] Multi-step contact form deployed on all 12 sites
- [ ] Sticky mobile CTA bar on all sites
- [ ] Trust badges and social proof on every page
- [ ] At least 2 case studies on each Tier 1 site (siding, chimney, deck, crawlspace)
- [ ] Lighthouse scores >90 performance on all sites
- [ ] Lighthouse CI running in GitHub Actions
- [ ] Core Web Vitals within "Good" thresholds on all sites
- [ ] Cross-site analytics dashboard operational
- [ ] GA4 event tracking for forms, CTAs, phone taps, scroll depth
- [ ] Conversion-focused copy on all service pages
- [ ] FAQ rewrite complete (buying objections addressed)
- [ ] Blog post CTAs contextual and relevant
- [ ] At least 1 stretch goal shipped

---

## Appendix A: Architecture Decisions

### Why Astro (not migrating to Next.js)
The sites are static marketing/SEO pages. Astro's zero-JS-by-default is the right choice for:
- Maximum performance (critical for CWV and SEO)
- Simple deployment (static files on CDN)
- No server costs or cold starts
- The sites don't need SSR, authentication, or dynamic data

### Why per-site accent colors (not per-site templates)
All 12 sites share the same layout patterns and component library. Differentiation should come from:
- Color (accent/brand color per site)
- Logo
- Content and imagery
- NOT from divergent templates that become maintenance burdens

### Why editorial crew in the monorepo
- Content quality is a core part of the product, not an external tool
- Running from `tools/` means it has access to the content files directly
- Documented alongside the rest of the project
- Can be wired into CI for automated content checks later

### Why multi-step forms (V3) not earlier
- Forms don't matter until there's traffic to convert
- V1 and V2 build the SEO foundation and visual trust
- By V3, traffic volume should justify form optimization investment
- The current HubSpot form works — it's not broken, just not optimized

## Appendix B: Site Tier Classification

Based on search volume data from service-configs.ts:

| Tier | Sites | Monthly Search Volume | Priority |
|---|---|---|---|
| **Tier 1** | deck-repair, chimney-repair, siding-repair, crawlspace-rot | 18,000 - 34,000 | Highest — pilot + first rollout |
| **Tier 2** | leak-repair, lead-paint, flashing-repair, dry-rot | 2,500 - 7,000 | Second wave |
| **Tier 3** | trim-repair, restoration, beam-repair, mold-testing | 400 - 1,600 | Third wave |

## Appendix C: Current Gap Inventory

| Site | GA4 | CallRail | Logo | Gallery Images | Service Pages | Testimonials |
|---|---|---|---|---|---|---|
| beam-repair | Yes | ? | No | ~18 | Partial | Base only |
| chimney-repair | Yes | ? | Yes (SVG) | 15+ | Complete | Base only |
| crawlspace-rot | Yes | ? | No | ~12 | Partial | Base only |
| deck-repair | Yes | Yes | No | 15+ | Complete | Base only |
| dry-rot | Missing | ? | Yes (PNG) | ~10 | Partial | Base only |
| flashing-repair | Yes | ? | Yes (SVG) | ~12 | Partial | Base only |
| lead-paint | Yes | ? | No | ~10 | Partial | Base only |
| leak-repair | Yes | ? | Yes (SVG) | ~8 | Partial | Base only |
| mold-testing | Missing | ? | Yes (PNG) | 2 | Partial | Base only |
| restoration | Yes | ? | No | ~10 | Partial | Base only |
| siding-repair | Yes | ? | Yes (SVG) | ~15 | Partial | Base only |
| trim-repair | Yes | ? | No | ~8 | Partial | Base only |

**Note:** "?" entries need verification. "Partial" means some service pages exist but coverage is incomplete for both locations. This inventory should be refined during V1 execution.

# Cluster Service Page Redesign

**Date:** 2026-03-09
**Scope:** `apps/siding-repair` cluster service pages (`/services/[location]/[slug]`)
**Status:** Approved — ready for implementation

---

## Goal

Redesign the cluster service page template to serve two audiences:

- **Above the fold:** High-intent homeowners ready to call or book (convert)
- **Below the fold:** Mid-funnel researchers comparing options (educate)

---

## Page Layout

### 1. Split Hero

Two-column layout, full viewport height.

**Left panel (60% width) — image + conversion**
- Full-height background photo with dark gradient overlay from bottom
- Top-left: breadcrumb (`Services > [City] > [Service Name]`)
- Center: service headline (large, bold, 2-line max)
- Below headline: location trust line (`Serving Portland, Oregon since 2003`)
- Bottom: primary phone CTA button + secondary `↓ Learn More` text link

**Right panel (40% width) — subtopic nav**
- White background with left-edge shadow
- Small-caps label: `"What we cover"`
- Each subtopic as a full-width clickable row:
  - Subtopic name (bold)
  - 1-sentence descriptor (first sentence of that section's content)
  - Right chevron icon
  - Hover: left accent bar in primary brand color
- Bottom: trust badge (`4.9★ · 200+ reviews · Licensed & Insured`)

**Mobile:** Stacks vertically — image hero (shorter height) on top, subtopic rows as a list below before page content.

**HubSpot form removed from hero.**

---

### 2. Trust + Form Section

Immediately below the hero. Neutral gray background.

- **Left column:** "Why SFW?" trust block — 3 icon+text bullets:
  - Licensed & Bonded
  - Free Estimates
  - Local Family Business
- **Right column:** HubSpot form

---

### 3. Subtopic Content Sections

One section per subtopic, alternating white / light-gray backgrounds.

- Left-aligned `##` heading with thin primary-color left border accent
- Body prose (~200 words, generated content)
- **Inline CTA bar** at bottom of each section:
  - Subtle bordered box
  - Text: `"Dealing with [subtopic]? Call us for a free assessment"`
  - Phone number link
  - Keeps CTA specific to the subtopic, not generic

---

### 4. Collapsible References

- Collapsed by default: `"View sources (N)"` toggle
- When open: clean table with zebra-stripe rows
- Positioned after all subtopic sections, before footer CTA

---

### 5. Footer CTA

Existing dark `CTASection` component — no changes needed.

---

## Full Page Order

1. Split hero (image + CTA left / subtopic nav right)
2. Trust + Form section
3. Subtopic sections (with per-section inline CTAs)
4. Collapsible references
5. Dark footer CTA

---

## Implementation Scope

### Files to modify
- `apps/siding-repair/src/pages/services/[location]/[service].astro` — restructure page, remove form from hero
- `apps/siding-repair/src/components/ServiceContent.astro` — new subtopic section layout + inline CTAs + collapsible references
- `packages/ui/src/components/hero/HeroSection.astro` — assess whether split layout is a new variant or built inline in the page

### New components (built inline in ServiceContent or as local components)
- `ClusterHero.astro` — split hero layout (local to siding-repair, can be promoted to shared later)
- Inline CTA bar within each subtopic section
- Collapsible references toggle (CSS + minimal JS or `<details>` element)

### Data changes
- `cluster-services.ts` — extract first sentence of each subtopic for the right-panel descriptor
- No changes to MD files or `ServicePageData` type needed beyond what already exists

---

## Out of Scope

- FAQ section (not generated yet for cluster pages — no change)
- Non-cluster service pages (unaffected)
- Other microsites (siding-repair only for now; pattern can be ported later)

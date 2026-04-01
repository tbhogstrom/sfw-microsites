# Gallery Component Comparison — Design Spec

**Date:** 2026-04-01
**File:** `apps/siding-repair/src/pages/test-gallery.astro`
**Data source:** `lightboxGalleries` from `apps/siding-repair/src/data/images.ts` (structural-rot-cedar-shake gallery, 6 images)

## Goal

Create a single test page with 8 gallery layout proposals side-by-side, all rendering the same 6-image before/during/after construction photo set. The page helps evaluate which layout(s) best serve project photo galleries across the microsites.

## Shared Conventions

- All 8 sections use the same `images` array from the structural-rot-cedar-shake gallery
- Each section has a numbered heading, short description, and the rendered gallery
- All images use `object-cover` for consistent fill
- All interactivity is vanilla JS in a single `<script>` block at the bottom
- Aspect ratios: large images use `aspect-[3/2]`, thumbnails use `aspect-[4/3]` or `aspect-square`
- Phase labels: first image = "Before" (red), last image = "After" (green), middle = "During/Step N" (amber)
- Page uses `BaseLayout` from `@sfw/ui` with the siding-repair config

## Layout Specifications

### 1. Carousel
Single large image (`aspect-[3/2]`, `max-w-3xl`) with prev/next arrow buttons overlaid, a counter badge (top-right), caption below, and dot indicators. Crossfade transition between slides via opacity toggle.

### 2. Featured + Side Thumbnails
Flex row: vertical thumbnail strip (w-20 / md:w-24) on the left, large main image (`aspect-[4/3]`) on the right. Clicking a thumbnail swaps the main image and updates the active border highlight. Caption below the main image.

### 3. Grid Lightbox (Current Component)
Uses the existing `ImageLightbox` component from `@sfw/ui` with `columns={3}`. No custom code — just renders the shared component as-is.

### 4. Process Timeline
Horizontal filmstrip layout. Top: Before → During → After label row with chevron arrows. Below: progress track with color-coded dots (red/amber/green). Below that: horizontally scrollable strip of `w-64 md:w-72` cards, each with `aspect-[4/3]` image, phase badge (top-left), and caption. Uses `snap-x snap-mandatory` for scroll snapping.

### 5. Stacked Reveal
Before photo large (`aspect-[3/2]`) at top with red "Before" badge. Collapsible button "View N process photos" that toggles a `grid-cols-2` grid of process photos with amber step badges. After photo large (`aspect-[3/2]`) at bottom with green "After" badge. Chevron rotates on toggle.

### 6. Hero Cascade (NEW)
Large "after" photo as hero (`aspect-[3/2]`, full width of `max-w-4xl`) with a green "After" badge — this is the money shot. Below: a row of smaller thumbnails showing the before photo first, then process photos, in a horizontal scrollable strip. Clicking any thumbnail swaps it into the hero position (like Featured, but hero-sized). The key insight: lead with the finished result.

**Structure:**
- Hero container: `aspect-[3/2]`, rounded-xl, with the last image as default
- Thumbnail row below: flex, gap-2, overflow-x-auto, each thumb is `w-20 h-20 md:w-24 md:h-24` square with `object-cover`
- Active thumbnail gets accent border
- Phase badges on thumbnails: red for first (Before), amber for middle, green for last (After)
- Caption below hero updates on selection

### 7. Split Journey (NEW)
Two-section layout. Top section: side-by-side before/after comparison at large size. Bottom section: horizontal process photo strip.

**Top section (the hook):**
- `grid grid-cols-2 gap-2` within `max-w-4xl`
- Left: first image with red "Before" badge, `aspect-[4/3]`
- Right: last image with green "After" badge, `aspect-[4/3]`

**Bottom section (the proof):**
- Label: "The Process" with a subtle divider
- Horizontal scrollable row of process photos (images[1] through images[-2])
- Each card: `w-48 md:w-56`, `aspect-[4/3]`, amber "Step N" badge
- `snap-x` scroll behavior

### 8. Masonry Narrative (NEW)
Pinterest-style grid where before/after photos are visually dominant. Uses CSS grid with explicit placement.

**Structure:** `grid` with 3 columns, `max-w-4xl`
- First image (Before): spans 2 columns, `aspect-[3/2]`, red badge
- Process photos (middle): each occupies 1 column, `aspect-[4/3]`, amber step badges
- Last image (After): spans 2 columns, `aspect-[3/2]`, green badge
- Gap: `gap-2`
- All images are clickable — open the existing ImageLightbox full-screen overlay (reuse the lightbox script pattern from the shared component)

**Grid layout for 6 images:**
```
[  Before (col-span-2)  ] [ Process 1 ]
[ Process 2 ] [ Process 3 ] [ Process 4 ]
[  After (col-span-2)   ]
```

Responsive: on mobile (`< md`), collapse to 2 columns with before/after spanning full width.

## Interactivity Summary

| # | Component | JS needed |
|---|-----------|-----------|
| 1 | Carousel | Slide show/hide, dot toggle, counter, caption |
| 2 | Featured + Thumbs | Thumbnail click → swap main image, highlight active |
| 3 | Grid Lightbox | None (handled by `ImageLightbox` component) |
| 4 | Process Timeline | None (CSS scroll snap only) |
| 5 | Stacked Reveal | Toggle button → show/hide process grid, rotate chevron |
| 6 | Hero Cascade | Thumbnail click → swap hero image, highlight active, update caption |
| 7 | Split Journey | None (CSS scroll snap only) |
| 8 | Masonry Narrative | None (static grid; optional: lightbox on click) |

## Implementation Notes

- This is a single-file page (`test-gallery.astro`), not new shared components
- All gallery HTML is inline in the page — only #3 uses the shared `ImageLightbox` component
- The JS block at the bottom handles carousel, featured, hero-cascade, and stacked-reveal interactivity
- No new dependencies needed

# Google Maps Embed — Location Pages Design

**Date:** 2026-03-10
**Status:** Approved

## Overview

Embed Google Maps on location pages to create GMB trust signals. Each embed references the specific Google Business Profile listing for that service+city combination via the iframe src URL from Google Maps Share → Embed. No API key required.

## Context

- One GMB profile per service per city (e.g., Siding Repair Experts Portland, Rot Repair Portland, Siding Repair Experts Seattle)
- Location pages are dynamic Astro routes: `apps/<service>/src/pages/locations/[slug].astro`
- Location data lives per-app in `apps/<service>/src/data/locations.ts`, typed against `Location` from `packages/content`
- The `Location` type already has an unused `coordinates` field — `mapEmbedSrc` will be the new addition

## Data Model

Add an optional field to the `Location` interface in `packages/content/src/locations.ts`:

```ts
mapEmbedSrc?: string;
// Full iframe src URL copied from Google Maps → Share → Embed a map
// Example: "https://www.google.com/maps/embed?pb=!1m18!..."
// If absent, map sections are omitted gracefully
```

Each app's `locations.ts` stores the embed src per location entry.

## Component

New shared component: `packages/ui/src/components/GoogleMapEmbed.astro`

**Props:**
```ts
src: string        // the embed src URL
variant: 'compact' | 'full'
title: string      // a11y label, e.g. "Siding Repair Experts Portland on Google Maps"
```

**Rendered output:**
```html
<iframe
  src={src}
  width="100%"
  height={variant === 'compact' ? '200' : '450'}
  style="border:0;"
  allowfullscreen=""
  loading="lazy"
  referrerpolicy="no-referrer-when-downgrade"
  title={title}
></iframe>
```

- `compact`: 200px tall, full width — used in Neighborhoods section
- `full`: 450px tall, full width — used in Contact section
- Exported from `packages/ui/src/index.ts`

## Page Layout — Two Placements

### 1. Neighborhoods Section (compact)

Map rendered **above** the neighborhood grid at full width, ~200px tall. Visually answers "do you serve my area?" before the user reads the list.

```astro
{location.mapEmbedSrc && (
  <GoogleMapEmbed
    src={location.mapEmbedSrc}
    variant="compact"
    title={`${config.name} ${location.name} service area on Google Maps`}
  />
)}
<!-- existing neighborhood grid below -->
```

### 2. Contact Section (full)

Map replaces the "Service Area" text block on the right side of the contact grid. Contact info remains on the left. Map is 450px tall.

```astro
<!-- existing contact info left column -->
{location.mapEmbedSrc ? (
  <GoogleMapEmbed
    src={location.mapEmbedSrc}
    variant="full"
    title={`${config.name} ${location.name} on Google Maps`}
  />
) : (
  <!-- existing Service Area text block fallback -->
)}
```

## Graceful Degradation

`mapEmbedSrc` is optional. If not set for a location:
- Neighborhoods section: map is omitted, grid renders as before
- Contact section: existing "Service Area" text block renders as before

This means the template can be deployed across all apps immediately; embed URLs are added per-location as they become available.

## Scope

**Initial rollout:** `apps/siding-repair` (Portland location)
**Full rollout:** All apps that have location pages, as GMB embed URLs are collected

## Instrumentation Note

The iframe src URL from Google Maps Share → Embed encodes the GMB listing's CID in the `pb=` parameter (e.g., `!1s0x44cadef93ff257b1%3A0x3e1d5266b25851b6`). This is the same identifier used in the GMB listing URL, establishing a direct reference between the website page and the Google Business Profile.

# How To Implement Google Maps Embeds

Use this pattern when adding Google Maps to a microsite so the next change does not require re-reading the codebase.

## Components and data

- Use the shared `GoogleMapEmbed` component from `@sfw/ui`.
- Store the raw Google embed URL in `mapEmbedSrc` on the location record in `packages/content/src/locations.ts`.
- Prefer data-driven rendering over hardcoding iframe markup directly in page files.

## Required data shape

Each location can define:

```ts
mapEmbedSrc?: string;
```

Example:

```ts
mapEmbedSrc: 'https://www.google.com/maps/embed?pb=...'
```

Get the URL from Google Maps using `Share -> Embed a map`, then copy only the `src` value from the iframe.

## Location index page pattern

File example: `apps/dry-rot/src/pages/locations/index.astro`

1. Import `GoogleMapEmbed`.
2. Build `const locationsWithMaps = locations.filter(l => l.mapEmbedSrc);`
3. Render a conditional "Find Us on Google Maps" section.
4. Use `variant="compact"` for the index page.

Reference shape:

```astro
import { HeroSection, CTASection, GoogleMapEmbed } from '@sfw/ui';

const locationsWithMaps = locations.filter(l => l.mapEmbedSrc);

{locationsWithMaps.length > 0 && (
  <section class="py-16 bg-gray-light">
    <div class="container mx-auto px-4">
      <h2 class="text-4xl font-heading font-bold text-center mb-12">
        Find Us on Google Maps
      </h2>
      <div class={locationsWithMaps.length > 1 ? 'grid md:grid-cols-2 gap-8 max-w-5xl mx-auto' : 'max-w-2xl mx-auto'}>
        {locationsWithMaps.map((location) => (
          <div>
            <h3 class="text-xl font-heading font-bold mb-3">{location.fullName}</h3>
            <GoogleMapEmbed
              src={location.mapEmbedSrc!}
              variant="compact"
              title={`${config.name} ${location.name} on Google Maps`}
            />
          </div>
        ))}
      </div>
    </div>
  </section>
)}
```

## Location detail page pattern

File example: `apps/dry-rot/src/pages/locations/[slug].astro`

Implement maps in two places:

1. Neighborhoods section:
   Render a `compact` map above the neighborhood grid when `location.mapEmbedSrc` exists.
2. Contact section:
   Replace the plain "Service Area" block with a `full` map when `location.mapEmbedSrc` exists.
   Keep the text fallback for locations without an embed.

Reference shape:

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

```astro
{location.mapEmbedSrc ? (
  <div class="mt-4">
    <GoogleMapEmbed
      src={location.mapEmbedSrc}
      variant="full"
      title={`${config.name} ${location.name} contact location on Google Maps`}
    />
  </div>
) : (
  <div class="flex items-start">
    ...
  </div>
)}
```

## Current rot-repair implementation

- Shared map data: `packages/content/src/locations.ts`
- Homepage map: `apps/dry-rot/src/pages/index.astro`
- Locations index map section: `apps/dry-rot/src/pages/locations/index.astro`
- Location detail map sections: `apps/dry-rot/src/pages/locations/[slug].astro`

## Verification

Run:

```bash
cd apps/dry-rot
npm.cmd run lint
```

Expected result: Astro check completes with no errors. Existing hints may still appear.

# SFW Microsites Monorepo

Turborepo monorepo containing 11 service-specific microsites for SFW Construction.

## Structure

- `apps/*` - 11 individual Astro sites
- `packages/ui` - Shared Astro components
- `packages/config` - Shared configuration (Tailwind, TypeScript)
- `packages/content` - Shared content, types, and data
- `packages/utils` - Shared utilities
- `public/shared` - Shared assets (logos, images, fonts)

## Getting Started

```bash
# Install dependencies
pnpm install

# Run all sites in development
pnpm dev

# Build all sites
pnpm build

# Run specific site
cd apps/deck-repair
pnpm dev
```

## Sites (Ordered by Traffic Priority)

1. **deck-repair** - 24.1% traffic (33,840 searches/mo)
2. **chimney-repair** - 23.7% traffic (33,330 searches/mo)
3. **siding-repair** - 23.1% traffic (32,380 searches/mo)
4. **crawlspace-rot** - 13.4% traffic (18,820 searches/mo)
5. **leak-repair** - 4.8% traffic (6,780 searches/mo)
6. **lead-paint** - 4.3% traffic (6,070 searches/mo)
7. **flashing-repair** - 2.3% traffic (3,250 searches/mo)
8. **dry-rot** - 1.8% traffic (2,570 searches/mo)
9. **trim-repair** - 1.2% traffic (1,630 searches/mo)
10. **restoration** - 0.9% traffic (1,330 searches/mo)
11. **beam-repair** - 0.3% traffic (440 searches/mo)

## Development

Each site is a standalone Astro project that shares components from `packages/ui`.

To add a new shared component:
1. Create in `packages/ui/src/components/`
2. Import in site: `import Component from '@sfw/ui/components/Component.astro'`

## Deployment

Configured for Vercel with domain mapping in `vercel.json`.

## Package Structure

### @sfw/ui
Shared Astro components used across all sites:
- Layout components (Header, Footer, Navigation)
- Hero components (service-specific heroes)
- Form components (Contact, Estimate)
- Content components (Testimonials, Service Cards, FAQs)
- Blog components (Post List, Post Card)

### @sfw/config
Shared configuration files:
- Tailwind config with SFW brand colors
- TypeScript configuration
- PostCSS/Autoprefixer setup

### @sfw/content
Shared content and data structures:
- TypeScript types for all content
- Company information
- Service configurations (all 11 services)
- Navigation data
- Service areas
- Base testimonials

### @sfw/utils
Shared utility functions:
- Date formatting
- String manipulation
- SEO helpers
- Analytics helpers

## Tech Stack

- **Astro** - Static site generator
- **Turborepo** - Monorepo build system
- **pnpm** - Package manager
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling

## Brand Colors

- Primary: `#a1b770` (Olive green)
- Secondary: `#900` (Dark red)
- Gray Light: `#f3f1ee`
- Gray Border: `#726855`

## Next Steps

1. Create shared components in `packages/ui/src/components/`
2. Build out the first site (deck-repair) as the template
3. Copy template structure to other 10 sites with service-specific content
4. Configure domains when purchased
5. Deploy to Vercel

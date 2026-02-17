# Service Pages System

This document describes the service pages system for the deck-repair site.

## Overview

The service pages system automatically generates individual service pages from markdown files in the `src/data/generated_content/` directory. Each service has dedicated pages for both Portland and Seattle locations.

## File Structure

```
apps/deck-repair/
├── src/
│   ├── data/
│   │   ├── services.ts                    # Main data file - parses markdown and exports service data
│   │   └── generated_content/
│   │       ├── service_page_*.md          # Generated service content files
│   │       └── .ipynb_checkpoints/        # Automatically skipped
│   ├── components/
│   │   └── ServiceContent.astro           # Component that renders service sections
│   └── pages/
│       └── services/
│           ├── index.astro                # Services listing page
│           └── [location]/
│               └── [service].astro        # Dynamic service page template
```

## URL Structure

Service pages are accessible at:
- `/services/portland/deck-repair-services`
- `/services/seattle/deck-joist-repair-and-replacement`
- `/services/portland/epoxy-wood-repair`
- etc.

## How It Works

### 1. Data Layer (`src/data/services.ts`)

This file:
- Reads all `service_page_*.md` files from `generated_content/`
- Parses markdown content and extracts structured data
- Converts markdown to HTML using the `marked` library
- Exports service data organized by location
- Provides helper functions for Astro pages

**Key exports:**
- `allServices` - Array of all services
- `servicesByLocation` - Services organized by Portland/Seattle
- `getService(location, slug)` - Get a specific service
- `getServicePaths()` - Generate static paths for Astro

### 2. Dynamic Route (`src/pages/services/[location]/[service].astro`)

This Astro page:
- Uses `getStaticPaths()` to generate routes for all services
- Fetches service data based on URL parameters
- Renders the service page with:
  - Hero section with HubSpot form
  - Key benefits callouts
  - Service content sections
  - FAQ accordion
  - CTA section

### 3. Content Component (`src/components/ServiceContent.astro`)

This component:
- Displays all service sections (Overview, Process, Why Choose Us, etc.)
- Converts markdown to HTML for each section
- Provides custom styling for prose content
- Extracts and formats process steps with numbered indicators
- Includes a free estimate CTA in the pricing section

### 4. Services Index (`src/pages/services/index.astro`)

Lists all services organized by location with:
- Service cards for Portland services
- Service cards for Seattle services
- Links to location pages
- "Why Choose Us" benefits section

## Service Page Sections

Each service page can include these sections:

1. **Hero Section** - Headline, subheadline, key benefits, and HubSpot form
2. **Key Benefits** - Highlighted benefits in a grid layout
3. **Service Overview** - What the service is and why it's important
4. **Our Process** - Step-by-step breakdown with numbered indicators
5. **Why Choose Us** - Professional expertise and differentiators
6. **Service Areas** - Neighborhoods and specialties
7. **Pricing & Estimates** - Pricing information with free estimate CTA
8. **Local Considerations** - Climate, building codes, seasonal factors
9. **Technical Details** - Materials, tools, and best practices
10. **FAQ Section** - Common questions and answers
11. **CTA Section** - Final call-to-action

## Markdown File Format

Service markdown files should follow this structure:

```markdown
# Service Name - Location

## Hero Section
### Headline
Description and key benefits...

## Service Overview
What is the service and why it's important...

## Our Process
1. **Step Name**
   Description...

## Why Choose Us
Why choose this service...

## Service Areas & Specialties
Areas covered...

## Pricing & Estimates
Pricing information...

## FAQ Section
1. **Question?**
   Answer...

## Local Considerations for Location
Climate and local factors...

## Technical Details
Materials and technical information...
```

## Adding New Service Pages

To add a new service page:

1. Create a markdown file in `src/data/generated_content/` following the naming pattern:
   - `service_page_[service-name]_portland.md`
   - `service_page_[service-name]_seattle.md`

2. Follow the markdown structure outlined above

3. Rebuild the site - the new service will be automatically:
   - Parsed and added to the data layer
   - Generated as a static page
   - Listed on the services index page

## SEO Optimization

Each service page includes:
- Dynamic meta title: `{Service Name} in {Location} | Expert Deck Services`
- Meta description from hero subheadline (max 155 chars)
- Target keywords extracted from markdown metadata
- Semantic HTML structure with proper headings
- Internal linking to location pages

## HubSpot Integration

The hero section includes a HubSpot form with these parameters:
- Portal ID: `8210108`
- Form ID: `e69a4d7a-ee7b-4081-9ed6-3fd729af6bd1`
- Region: `na1`

This is the same form used on the homepage for consistency.

## Customization

To customize service pages:

1. **Modify the template:** Edit `src/pages/services/[location]/[service].astro`
2. **Change section rendering:** Edit `src/components/ServiceContent.astro`
3. **Update data parsing:** Edit `src/data/services.ts`
4. **Adjust styling:** Modify the Tailwind classes in the components

## Dependencies

- `marked` - Markdown parsing library
- `@types/marked` - TypeScript types for marked

Install with:
```bash
npm install marked
npm install --save-dev @types/marked
```

## Build Process

The service pages are statically generated at build time:

1. `services.ts` reads and parses all markdown files
2. `getStaticPaths()` creates routes for each service
3. Astro generates static HTML for each route
4. All pages are output to `dist/services/[location]/[service]/`

## Testing

To test the service pages:

```bash
# Development server
npm run dev

# Navigate to:
# - http://localhost:4321/services
# - http://localhost:4321/services/portland/deck-repair-services
# - http://localhost:4321/services/seattle/deck-joist-repair-and-replacement

# Production build
npm run build
npm run preview
```

## Notes

- Checkpoint files (`.ipynb_checkpoints/`) are automatically skipped
- Service slugs are auto-generated from filenames (lowercase, hyphenated)
- The `&` character in filenames is converted to `-and-` in URLs
- All markdown is converted to HTML with proper styling
- Phone numbers can be customized per location in the page template

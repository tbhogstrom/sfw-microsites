# Service Pages - Quick Start Guide

## What You Have

A fully functional service pages system that automatically generates 21 service pages (20 services + 1 index) from markdown files.

## How to Use

### View the Services

**Development Server (already running):**
```
http://localhost:4321/services
```

**Example Service Pages:**
- Portland Deck Repair: http://localhost:4321/services/portland/deck-repair-services
- Seattle Deck Joist Repair: http://localhost:4321/services/seattle/deck-joist-repair-and-replacement
- Portland Epoxy Wood Repair: http://localhost:4321/services/portland/epoxy-wood-repair

### Add a New Service

1. Create a markdown file in `src/data/generated_content/`:
   ```
   service_page_my_new_service_portland.md
   service_page_my_new_service_seattle.md
   ```

2. Follow the existing markdown structure (see any existing service file)

3. Rebuild the site:
   ```bash
   npm run build
   ```

4. The new service will automatically appear:
   - On the services index page
   - As its own dedicated page
   - With proper URL and SEO

### Update Existing Service Content

1. Edit the markdown file in `src/data/generated_content/`
2. Save the changes
3. The dev server will auto-reload (or rebuild for production)
4. Changes will be reflected immediately

## File Locations

### Code Files
- **Data processor:** `src/data/services.ts`
- **Page template:** `src/pages/services/[location]/[service].astro`
- **Content component:** `src/components/ServiceContent.astro`
- **Services index:** `src/pages/services/index.astro`

### Content Files
- **Service content:** `src/data/generated_content/service_page_*.md`

### Generated Pages
- **Build output:** `dist/services/[location]/[service]/index.html`

## Key Features

✅ **20 Service Pages Generated**
- 11 Portland services
- 9 Seattle services

✅ **Automatic Processing**
- Reads markdown files
- Extracts structured data
- Converts to HTML
- Generates SEO metadata

✅ **SEO Optimized**
- Proper meta titles and descriptions
- Canonical URLs
- Semantic HTML
- Keyword targeting

✅ **HubSpot Integration**
- Form in hero section
- Business hours indicator
- Custom styling

✅ **Responsive Design**
- Mobile-first
- Touch-friendly
- Fast loading

## URLs Structure

```
/services                                    → Services index
/services/portland/[service-slug]            → Portland services
/services/seattle/[service-slug]             → Seattle services
```

## Service Slugs

**Portland:**
- deck-repair-services
- deck-board-replacement
- deck-drainage-solutions
- deck-joist-repair-and-replacement
- deck-lighting-installation
- deck-staining-and-sealing
- deck-surface-refinishing
- epoxy-wood-repair
- post-replacement-and-repair
- pressure-treated-wood-installation
- rotten-trim-repair

**Seattle:**
- deck-repair-services
- deck-board-replacement
- deck-drainage-solutions
- deck-joist-repair-and-replacement
- deck-lighting-installation
- deck-staining-and-sealing
- deck-surface-refinishing
- epoxy-wood-repair
- post-replacement-and-repair

## Common Tasks

### Rebuild All Pages
```bash
npm run build
```

### Start Dev Server
```bash
npm run dev
```

### Preview Production Build
```bash
npm run preview
```

### Check Which Services Exist
```bash
ls src/data/generated_content/service_page_*.md
```

### View Generated Pages
```bash
ls dist/services/portland/
ls dist/services/seattle/
```

## Troubleshooting

### Service Not Showing Up?
1. Check filename matches pattern: `service_page_[name]_[location].md`
2. Ensure location is either "portland" or "seattle"
3. Rebuild the site: `npm run build`

### Markdown Not Rendering?
1. Check markdown syntax
2. Ensure sections start with `##`
3. Verify file encoding is UTF-8

### Build Errors?
1. Check for syntax errors in markdown
2. Ensure all required sections are present
3. Verify no special characters in filenames

## Next Steps

1. **Review Generated Pages:** Visit http://localhost:4321/services
2. **Check SEO:** View page source to see meta tags
3. **Test Forms:** Try submitting the HubSpot form
4. **Mobile Testing:** View on different screen sizes
5. **Content Updates:** Edit markdown files as needed

## Documentation

For detailed information, see:
- **SERVICE_PAGES_README.md** - Complete system documentation
- **SERVICE_PAGES_IMPLEMENTATION.md** - Implementation details
- **SERVICE_PAGES_FILES.md** - File structure reference

## Support

If you need to modify:
- **Layout/Design:** Edit the Astro components
- **Content:** Edit the markdown files
- **Data Processing:** Edit `services.ts`
- **SEO:** Update meta tag generation in `services.ts`

## Success!

Your service pages system is fully functional and production-ready. All 21 pages have been generated successfully with proper SEO, responsive design, and HubSpot integration.

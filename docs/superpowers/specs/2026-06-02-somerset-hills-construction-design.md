# Somerset Hills Construction LLC — One-Page Site Design

**Date:** 2026-06-02
**Status:** Approved

## Summary

A standalone one-page marketing website for **Somerset Hills Construction LLC**, a
licensed and bonded general contractor in Oregon. It lives in the `microsites`
monorepo as a new Astro app (`apps/somerset-hills`) and deploys independently to
Vercel like the other apps — but it shares **no content** with the SFW "experts"
sites and imports **none** of the `@sfw/*` shared packages.

## Hard Constraints

- **Fully isolated content.** No copy, data, components, or assets pulled from the
  experts microsites. The app does not depend on `@sfw/ui`, `@sfw/content`,
  `@sfw/utils`, or `@sfw/config`.
- **Self-contained tooling.** Its own `package.json`, `astro.config.mjs`,
  `tailwind.config.*`, `tsconfig.json` (extends repo base for TS only), and
  `vercel.json`.
- Deploys to Vercel as its own project; pushing to `main` auto-deploys.

## Brand

Derived from the provided logo (`Somerset Hills Construction LLC.png`):

- Forest green (~`#2f5233`), gold/tan (~`#b8924a`), charcoal (~`#1f2421`),
  off-white background (~`#f7f5f0`).
- Serif display font for headings (echoes the logo wordmark); clean sans-serif
  for body text. Fonts loaded via Fontsource or Google Fonts (self-hostable);
  no dependency on shared font assets.

## Page Structure (single scroll)

1. **Header / nav** — logo left; anchor links Services · About · Contact; "Call
   Now" button. Sticky with subtle shadow on scroll.
2. **Hero** — logo + name, invented tagline, "Licensed & Bonded · Oregon CCB"
   trust line, primary CTA (Call) + secondary CTA (Get a Quote → scrolls to
   Contact).
3. **Services** — responsive grid of 6 cards (icon + title + blurb). Invented
   residential-GC services: New Home Construction; Additions & Remodels; Kitchens
   & Baths; Decks & Outdoor Living; Framing & Structural; Repairs & Maintenance.
4. **About / Why Us** — short invented copy about a local Oregon builder, plus a
   credentials strip: Licensed · Bonded · Insured · CCB #[PLACEHOLDER].
5. **Contact** — phone, email, service-area text, business hours; large
   click-to-call and `mailto:` buttons. No form.
6. **Footer** — logo mark, copyright, license line.

## Content Handling

All business data lives in **one file** (`src/data/site.ts`) so values are trivial
to swap.

- **Placeholders (clearly marked, user replaces later):**
  - Phone: `(503) 555-0100`
  - Email: `info@somersethillsconstruction.com`
  - CCB license number: `CCB #000000`
- **Invented (acceptable as-is):** tagline, service titles/descriptions, about
  copy, service-area region (a plausible Oregon area), business hours.

## Components

Small, focused `.astro` components under `src/components/`:

- `Header.astro`, `Hero.astro`, `Services.astro`, `About.astro`, `Contact.astro`,
  `Footer.astro`, and a reusable `ServiceCard.astro`.
- A single layout `src/layouts/Base.astro` holding `<head>` (SEO meta, OG tags,
  fonts) and slots for the page body.
- One page: `src/pages/index.astro` composing the sections.

## Assets

- Copy logo PNG into `public/` (e.g. `public/logo.png`).
- Generate favicon set from the logo.
- `public/robots.txt` allowing all; basic.

## SEO

- Title, meta description, canonical, Open Graph + Twitter tags set in
  `Base.astro` from `site.ts` values.

## Build / Deploy

- `vercel.json` mirrors sibling apps:
  - `buildCommand`: `cd ../.. && npx turbo build --filter=somerset-hills`
  - `installCommand`: `cd ../.. && npm install`
  - `framework`: `astro`, `outputDirectory`: `dist`
  - Long-cache headers for `/_astro/(.*)`.
- `astro.config.mjs`: `output: 'static'`, Tailwind integration, `site` set to the
  eventual production domain (placeholder domain until provided).

## Linting / Verification

- `pnpm lint` (= `astro check`) must pass with no errors before pushing.
- Local `pnpm build` of the app succeeds and produces `dist/`.

## Out of Scope (YAGNI)

- No project gallery, testimonials, blog, or contact form.
- No multi-page routing.
- No shared-package integration.

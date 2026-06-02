# Somerset Hills Construction — One-Page Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone, polished one-page marketing site for Somerset Hills Construction LLC as a new Astro app in the microsites monorepo, deployable independently to Vercel, sharing no content or packages with the SFW experts sites.

**Architecture:** A self-contained Astro 5 + Tailwind app at `apps/somerset-hills`. No `@sfw/*` dependencies. All business content lives in one `src/data/site.ts` file. Sections are small `.astro` components composed by a single `index.astro` page inside a `Base.astro` layout.

**Tech Stack:** Astro ^5.1.3, @astrojs/tailwind ^5.1.4, tailwindcss ^3.4.17, TypeScript. Google Fonts (Playfair Display + Inter) via `<link>`.

**Verification model:** This is a static marketing page with no unit-test surface. Each task is verified by `pnpm lint` (= `astro check`, zero errors) and where noted `pnpm build` (produces `dist/`). Final task includes a visual check via `pnpm dev`.

**Spec:** `docs/superpowers/specs/2026-06-02-somerset-hills-construction-design.md`

**Conventions used throughout:**
- Run all commands from `C:/Users/tfalcon/microsites` unless the step says otherwise.
- Brand colors (Tailwind tokens): `brand-green` `#2E5339`, `brand-gold` `#B8924A`, `brand-charcoal` `#1E2422`, `brand-cream` `#F7F5F0`.
- Commit messages are scoped `feat(somerset-hills): ...`. No Co-Authored-By lines (per repo CLAUDE.md).

---

## Task 1: Scaffold the app and config files

**Files:**
- Create: `apps/somerset-hills/package.json`
- Create: `apps/somerset-hills/tsconfig.json`
- Create: `apps/somerset-hills/astro.config.mjs`
- Create: `apps/somerset-hills/tailwind.config.mjs`
- Create: `apps/somerset-hills/vercel.json`
- Create: `apps/somerset-hills/.gitignore`

- [ ] **Step 1: Create `apps/somerset-hills/package.json`**

```json
{
  "name": "somerset-hills",
  "type": "module",
  "version": "1.0.0",
  "scripts": {
    "dev": "astro dev",
    "start": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "astro": "astro",
    "lint": "astro check",
    "typecheck": "astro check"
  },
  "dependencies": {
    "astro": "^5.1.3"
  },
  "devDependencies": {
    "@astrojs/tailwind": "^5.1.4",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.2"
  }
}
```

- [ ] **Step 2: Create `apps/somerset-hills/tsconfig.json`**

Extends Astro strict directly (NOT the repo base) to avoid pulling in `@sfw/*` path aliases — keeps the app isolated.

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": "."
  }
}
```

- [ ] **Step 3: Create `apps/somerset-hills/astro.config.mjs`**

```js
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  // Replace with the production domain once registered.
  site: 'https://somersethillsconstruction.com',
  integrations: [tailwind()],
  output: 'static',
});
```

- [ ] **Step 4: Create `apps/somerset-hills/tailwind.config.mjs`**

Self-contained theme — no `@sfw/config` import.

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        brand: {
          green: '#2E5339',
          'green-dark': '#1E3A26',
          gold: '#B8924A',
          'gold-light': '#CBA968',
          charcoal: '#1E2422',
          cream: '#F7F5F0',
        },
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 5: Create `apps/somerset-hills/vercel.json`**

Mirrors sibling apps' independent deploy config.

```json
{
  "buildCommand": "cd ../.. && npx turbo build --filter=somerset-hills",
  "installCommand": "cd ../.. && npm install",
  "framework": "astro",
  "outputDirectory": "dist",
  "headers": [
    {
      "source": "/_astro/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    }
  ]
}
```

- [ ] **Step 6: Create `apps/somerset-hills/.gitignore`**

```
dist/
.astro/
node_modules/
.turbo/
.vercel/
```

- [ ] **Step 7: Install dependencies**

Run: `npm install` (from repo root — installs the new workspace).
Expected: completes without errors; `apps/somerset-hills/node_modules` (or hoisted root) resolves `astro`.

- [ ] **Step 8: Commit**

```bash
git add apps/somerset-hills/package.json apps/somerset-hills/tsconfig.json apps/somerset-hills/astro.config.mjs apps/somerset-hills/tailwind.config.mjs apps/somerset-hills/vercel.json apps/somerset-hills/.gitignore package-lock.json
git commit -m "feat(somerset-hills): scaffold standalone astro app"
```

---

## Task 2: Add the logo asset and static files

**Files:**
- Create: `apps/somerset-hills/public/logo.png` (copied from OneDrive source)
- Create: `apps/somerset-hills/public/robots.txt`

- [ ] **Step 1: Copy the logo into `public/`**

Run (PowerShell):
```powershell
New-Item -ItemType Directory -Force "apps/somerset-hills/public" | Out-Null
Copy-Item "C:/Users/tfalcon/OneDrive - SFW Construction/Documents/Somerset Hills Construction LLC.png" "apps/somerset-hills/public/logo.png"
```
Expected: `apps/somerset-hills/public/logo.png` exists.

- [ ] **Step 2: Create `apps/somerset-hills/public/robots.txt`**

```
User-agent: *
Allow: /

Sitemap: https://somersethillsconstruction.com/sitemap-index.xml
```

- [ ] **Step 3: Commit**

```bash
git add apps/somerset-hills/public/logo.png apps/somerset-hills/public/robots.txt
git commit -m "feat(somerset-hills): add logo and robots.txt"
```

---

## Task 3: Create the content data file

**Files:**
- Create: `apps/somerset-hills/src/data/site.ts`

- [ ] **Step 1: Create `apps/somerset-hills/src/data/site.ts`**

All placeholders marked with `// PLACEHOLDER` for easy swap.

```ts
export interface Service {
  title: string;
  description: string;
  /** Inline SVG path data (24x24 viewBox) for the card icon. */
  icon: string;
}

export const site = {
  name: 'Somerset Hills Construction',
  legalName: 'Somerset Hills Construction LLC',
  tagline: 'Building Oregon homes with craftsmanship that lasts.',
  // PLACEHOLDER — replace with the real Oregon CCB license number.
  ccb: 'CCB #000000',
  // PLACEHOLDER — replace with the real phone number.
  phone: '(503) 555-0100',
  // PLACEHOLDER — replace with the real email address.
  email: 'info@somersethillsconstruction.com',
  serviceArea: 'Proudly serving the Willamette Valley and the greater Portland–Salem corridor.',
  hours: [
    { day: 'Monday – Friday', time: '7:00 AM – 5:00 PM' },
    { day: 'Saturday', time: 'By appointment' },
    { day: 'Sunday', time: 'Closed' },
  ],
  about: [
    'Somerset Hills Construction is a locally owned general contractor rooted in the hills and valleys of Oregon. We build and remodel homes the way they should be built — carefully, honestly, and to last for generations.',
    'From the first conversation to the final walkthrough, we treat every project like it’s our own. Our team brings decades of combined experience in residential construction, and we hold ourselves to a simple standard: do excellent work, communicate clearly, and stand behind everything we build.',
  ],
  credentials: ['Licensed', 'Bonded', 'Insured'],
};

export const services: Service[] = [
  {
    title: 'New Home Construction',
    description:
      'Custom homes built from the ground up, designed around how you actually live and finished with care in every detail.',
    icon: 'M3 12l9-9 9 9M5 10v10h14V10',
  },
  {
    title: 'Additions & Remodels',
    description:
      'More room, better flow, modern finishes. We expand and reimagine existing homes without losing their character.',
    icon: 'M4 21V8l8-5 8 5v13M9 21v-6h6v6',
  },
  {
    title: 'Kitchens & Baths',
    description:
      'The rooms you use most, rebuilt for beauty and function — cabinetry, tile, fixtures, and finishes done right.',
    icon: 'M4 4h16v6H4zM4 14h7v6H4zM14 14h6v6h-6z',
  },
  {
    title: 'Decks & Outdoor Living',
    description:
      'Decks, patios, and outdoor spaces engineered for Oregon weather and built to enjoy for decades.',
    icon: 'M3 10h18M5 10v8M19 10v8M3 18h18M8 6h8v4H8z',
  },
  {
    title: 'Framing & Structural',
    description:
      'Solid bones for any project. Precise framing and structural work that meets code and stands the test of time.',
    icon: 'M3 21V5l9-2 9 2v16M3 21h18M8 21V9h8v12',
  },
  {
    title: 'Repairs & Maintenance',
    description:
      'Dry rot, water damage, aging finishes — we diagnose the real problem and fix it properly the first time.',
    icon: 'M14 6l4 4-8 8H6v-4zM3 21h18',
  },
];
```

- [ ] **Step 2: Verify it typechecks (deferred to first component task)**

`astro check` only runs meaningfully once there is a page. No standalone command here; this file is validated in Task 5/6.

- [ ] **Step 3: Commit**

```bash
git add apps/somerset-hills/src/data/site.ts
git commit -m "feat(somerset-hills): add site content data"
```

---

## Task 4: Create the base layout

**Files:**
- Create: `apps/somerset-hills/src/layouts/Base.astro`

- [ ] **Step 1: Create `apps/somerset-hills/src/layouts/Base.astro`**

```astro
---
import { site } from '../data/site';

interface Props {
  title?: string;
  description?: string;
}

const {
  title = `${site.legalName} — Oregon General Contractor`,
  description = `${site.legalName} is a licensed and bonded Oregon general contractor. New home construction, remodels, additions, and more.`,
} = Astro.props;

const canonical = new URL(Astro.url.pathname, Astro.site).href;
const ogImage = new URL('/logo.png', Astro.site).href;
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/png" href="/logo.png" />
    <title>{title}</title>
    <meta name="description" content={description} />
    <link rel="canonical" href={canonical} />

    <meta property="og:type" content="website" />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:url" content={canonical} />
    <meta property="og:image" content={ogImage} />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content={title} />
    <meta name="twitter:description" content={description} />
    <meta name="twitter:image" content={ogImage} />

    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700;800&display=swap"
      rel="stylesheet"
    />
  </head>
  <body class="bg-brand-cream font-sans text-brand-charcoal antialiased">
    <slot />
  </body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add apps/somerset-hills/src/layouts/Base.astro
git commit -m "feat(somerset-hills): add base layout with SEO meta and fonts"
```

---

## Task 5: Create the section components

**Files:**
- Create: `apps/somerset-hills/src/components/Header.astro`
- Create: `apps/somerset-hills/src/components/Hero.astro`
- Create: `apps/somerset-hills/src/components/ServiceCard.astro`
- Create: `apps/somerset-hills/src/components/Services.astro`
- Create: `apps/somerset-hills/src/components/About.astro`
- Create: `apps/somerset-hills/src/components/Contact.astro`
- Create: `apps/somerset-hills/src/components/Footer.astro`

- [ ] **Step 1: Create `apps/somerset-hills/src/components/Header.astro`**

```astro
---
import { site } from '../data/site';
const telHref = `tel:${site.phone.replace(/[^0-9+]/g, '')}`;
---

<header class="sticky top-0 z-50 border-b border-brand-green/10 bg-brand-cream/90 backdrop-blur">
  <div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
    <a href="#top" class="flex items-center gap-3">
      <img src="/logo.png" alt={site.legalName} class="h-12 w-auto" width="120" height="120" />
      <span class="sr-only">{site.legalName}</span>
    </a>
    <nav class="hidden items-center gap-8 md:flex">
      <a href="#services" class="text-sm font-medium text-brand-charcoal transition hover:text-brand-green">Services</a>
      <a href="#about" class="text-sm font-medium text-brand-charcoal transition hover:text-brand-green">About</a>
      <a href="#contact" class="text-sm font-medium text-brand-charcoal transition hover:text-brand-green">Contact</a>
    </nav>
    <a
      href={telHref}
      class="rounded-full bg-brand-green px-5 py-2 text-sm font-semibold text-brand-cream shadow-sm transition hover:bg-brand-green-dark"
    >
      Call Now
    </a>
  </div>
</header>
```

- [ ] **Step 2: Create `apps/somerset-hills/src/components/Hero.astro`**

```astro
---
import { site } from '../data/site';
const telHref = `tel:${site.phone.replace(/[^0-9+]/g, '')}`;
---

<section id="top" class="relative overflow-hidden">
  <div class="absolute inset-0 bg-gradient-to-b from-brand-green/5 via-brand-cream to-brand-cream"></div>
  <div class="relative mx-auto flex max-w-4xl flex-col items-center px-6 py-24 text-center sm:py-32">
    <img src="/logo.png" alt={site.legalName} class="mb-8 w-64 max-w-full sm:w-80" width="320" height="320" />
    <p class="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-gold/40 bg-white/60 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-brand-green">
      Licensed &amp; Bonded &middot; Oregon {site.ccb}
    </p>
    <h1 class="font-serif text-4xl font-bold leading-tight text-brand-green sm:text-5xl">
      {site.tagline}
    </h1>
    <p class="mt-5 max-w-2xl text-lg text-brand-charcoal/80">
      {site.serviceArea}
    </p>
    <div class="mt-9 flex flex-col gap-3 sm:flex-row">
      <a
        href={telHref}
        class="rounded-full bg-brand-green px-7 py-3 font-semibold text-brand-cream shadow-md transition hover:bg-brand-green-dark"
      >
        Call {site.phone}
      </a>
      <a
        href="#contact"
        class="rounded-full border border-brand-green px-7 py-3 font-semibold text-brand-green transition hover:bg-brand-green hover:text-brand-cream"
      >
        Get a Quote
      </a>
    </div>
  </div>
</section>
```

- [ ] **Step 3: Create `apps/somerset-hills/src/components/ServiceCard.astro`**

```astro
---
interface Props {
  title: string;
  description: string;
  icon: string;
}
const { title, description, icon } = Astro.props;
---

<article class="group rounded-2xl border border-brand-green/10 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:border-brand-gold/40 hover:shadow-md">
  <div class="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-green/10 text-brand-green transition group-hover:bg-brand-green group-hover:text-brand-cream">
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d={icon}></path>
    </svg>
  </div>
  <h3 class="mb-2 font-serif text-xl font-bold text-brand-green">{title}</h3>
  <p class="text-sm leading-relaxed text-brand-charcoal/75">{description}</p>
</article>
```

- [ ] **Step 4: Create `apps/somerset-hills/src/components/Services.astro`**

```astro
---
import { services } from '../data/site';
import ServiceCard from './ServiceCard.astro';
---

<section id="services" class="mx-auto max-w-6xl px-6 py-20 sm:py-24">
  <div class="mx-auto mb-14 max-w-2xl text-center">
    <p class="mb-2 text-sm font-semibold uppercase tracking-wider text-brand-gold">What We Do</p>
    <h2 class="font-serif text-3xl font-bold text-brand-green sm:text-4xl">Construction services, done right</h2>
    <p class="mt-4 text-brand-charcoal/75">
      From new builds to careful repairs, we handle every phase with the same commitment to quality.
    </p>
  </div>
  <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
    {services.map((s) => <ServiceCard title={s.title} description={s.description} icon={s.icon} />)}
  </div>
</section>
```

- [ ] **Step 5: Create `apps/somerset-hills/src/components/About.astro`**

```astro
---
import { site } from '../data/site';
---

<section id="about" class="bg-brand-green text-brand-cream">
  <div class="mx-auto grid max-w-6xl gap-12 px-6 py-20 sm:py-24 lg:grid-cols-2 lg:items-center">
    <div>
      <p class="mb-2 text-sm font-semibold uppercase tracking-wider text-brand-gold-light">Why Somerset Hills</p>
      <h2 class="font-serif text-3xl font-bold sm:text-4xl">Local builders you can trust</h2>
      <div class="mt-6 space-y-4 text-brand-cream/85">
        {site.about.map((p) => <p>{p}</p>)}
      </div>
    </div>
    <div class="rounded-2xl border border-brand-cream/15 bg-brand-green-dark/40 p-8">
      <h3 class="font-serif text-xl font-bold text-brand-gold-light">Credentials</h3>
      <ul class="mt-5 space-y-4">
        {
          site.credentials.map((c) => (
            <li class="flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-brand-gold-light">
                <path d="M20 6L9 17l-5-5"></path>
              </svg>
              <span class="font-medium">{c}</span>
            </li>
          ))
        }
        <li class="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-brand-gold-light">
            <path d="M20 6L9 17l-5-5"></path>
          </svg>
          <span class="font-medium">{site.ccb}</span>
        </li>
      </ul>
    </div>
  </div>
</section>
```

- [ ] **Step 6: Create `apps/somerset-hills/src/components/Contact.astro`**

```astro
---
import { site } from '../data/site';
const telHref = `tel:${site.phone.replace(/[^0-9+]/g, '')}`;
const mailHref = `mailto:${site.email}`;
---

<section id="contact" class="mx-auto max-w-6xl px-6 py-20 sm:py-24">
  <div class="grid gap-12 lg:grid-cols-2">
    <div>
      <p class="mb-2 text-sm font-semibold uppercase tracking-wider text-brand-gold">Get In Touch</p>
      <h2 class="font-serif text-3xl font-bold text-brand-green sm:text-4xl">Let&rsquo;s build something</h2>
      <p class="mt-4 max-w-md text-brand-charcoal/75">
        Ready to start your project? Reach out for a free, no-pressure conversation about what you have in mind.
      </p>
      <div class="mt-8 flex flex-col gap-3 sm:flex-row">
        <a
          href={telHref}
          class="rounded-full bg-brand-green px-7 py-3 text-center font-semibold text-brand-cream shadow-md transition hover:bg-brand-green-dark"
        >
          Call {site.phone}
        </a>
        <a
          href={mailHref}
          class="rounded-full border border-brand-green px-7 py-3 text-center font-semibold text-brand-green transition hover:bg-brand-green hover:text-brand-cream"
        >
          Email Us
        </a>
      </div>
    </div>
    <div class="rounded-2xl border border-brand-green/10 bg-white p-8 shadow-sm">
      <dl class="space-y-6">
        <div>
          <dt class="text-xs font-semibold uppercase tracking-wider text-brand-gold">Phone</dt>
          <dd class="mt-1"><a href={telHref} class="text-lg font-medium text-brand-charcoal hover:text-brand-green">{site.phone}</a></dd>
        </div>
        <div>
          <dt class="text-xs font-semibold uppercase tracking-wider text-brand-gold">Email</dt>
          <dd class="mt-1"><a href={mailHref} class="text-lg font-medium text-brand-charcoal hover:text-brand-green">{site.email}</a></dd>
        </div>
        <div>
          <dt class="text-xs font-semibold uppercase tracking-wider text-brand-gold">Service Area</dt>
          <dd class="mt-1 text-brand-charcoal/80">{site.serviceArea}</dd>
        </div>
        <div>
          <dt class="text-xs font-semibold uppercase tracking-wider text-brand-gold">Hours</dt>
          <dd class="mt-2 space-y-1">
            {
              site.hours.map((h) => (
                <div class="flex justify-between gap-4 text-sm text-brand-charcoal/80">
                  <span>{h.day}</span>
                  <span class="font-medium">{h.time}</span>
                </div>
              ))
            }
          </dd>
        </div>
      </dl>
    </div>
  </div>
</section>
```

- [ ] **Step 7: Create `apps/somerset-hills/src/components/Footer.astro`**

```astro
---
import { site } from '../data/site';
const year = new Date().getFullYear();
---

<footer class="border-t border-brand-green/10 bg-brand-cream">
  <div class="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-10 text-center sm:flex-row sm:justify-between sm:text-left">
    <img src="/logo.png" alt={site.legalName} class="h-14 w-auto" width="140" height="140" />
    <div class="text-sm text-brand-charcoal/70">
      <p>&copy; {year} {site.legalName}. All rights reserved.</p>
      <p class="mt-1">Licensed &amp; Bonded in Oregon &middot; {site.ccb}</p>
    </div>
  </div>
</footer>
```

- [ ] **Step 8: Commit**

```bash
git add apps/somerset-hills/src/components/
git commit -m "feat(somerset-hills): add section components"
```

---

## Task 6: Compose the page and verify build

**Files:**
- Create: `apps/somerset-hills/src/pages/index.astro`

- [ ] **Step 1: Create `apps/somerset-hills/src/pages/index.astro`**

```astro
---
import Base from '../layouts/Base.astro';
import Header from '../components/Header.astro';
import Hero from '../components/Hero.astro';
import Services from '../components/Services.astro';
import About from '../components/About.astro';
import Contact from '../components/Contact.astro';
import Footer from '../components/Footer.astro';
---

<Base>
  <Header />
  <main>
    <Hero />
    <Services />
    <About />
    <Contact />
  </main>
  <Footer />
</Base>
```

- [ ] **Step 2: Run lint/typecheck**

Run (from repo root): `cd apps/somerset-hills && pnpm lint`
Expected: `astro check` reports **0 errors** (warnings about unused hints are acceptable if pre-existing). If `pnpm` is unavailable, use `npm run lint` in that directory.

- [ ] **Step 3: Run the build**

Run (from repo root): `npx turbo build --filter=somerset-hills`
Expected: build succeeds; `apps/somerset-hills/dist/index.html` is produced.

- [ ] **Step 4: Commit**

```bash
git add apps/somerset-hills/src/pages/index.astro
git commit -m "feat(somerset-hills): compose one-page index"
```

---

## Task 7: Visual check and final verification

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server**

Run (from repo root): `cd apps/somerset-hills && pnpm dev`
Expected: Astro dev server starts (default `http://localhost:4321`).

- [ ] **Step 2: Visually confirm in the browser**

Open the local URL and confirm:
- Logo renders in header, hero, and footer.
- Hero shows tagline, CCB placeholder line, and both CTAs.
- Services grid shows all 6 cards with icons.
- About section (green band) shows copy + credentials list including CCB placeholder.
- Contact section shows phone, email, service area, hours; Call/Email buttons work (`tel:`/`mailto:`).
- Anchor nav links (Services/About/Contact) scroll to the right sections.
- Layout is responsive at mobile (~375px) and desktop widths.

- [ ] **Step 3: Stop the dev server.**

- [ ] **Step 4: Final lint gate**

Run (from repo root): `cd apps/somerset-hills && pnpm lint`
Expected: 0 errors.

- [ ] **Step 5: Push**

Per repo workflow, push both remotes:
```powershell
./pushall.ps1
```
Then the user adds the app as a new Vercel project and maps its domain (one-time, done in the Vercel dashboard).

---

## Post-implementation notes for the user

- **Replace placeholders** in `apps/somerset-hills/src/data/site.ts`: `phone`, `email`, and `ccb` (CCB license number).
- **Set the real domain** in `apps/somerset-hills/astro.config.mjs` (`site:`) and in `public/robots.txt`.
- **Vercel setup** (one-time, manual): create a new Vercel project pointing at `apps/somerset-hills`, using the included `vercel.json`; map the production domain. Subsequent pushes to `main` auto-deploy.

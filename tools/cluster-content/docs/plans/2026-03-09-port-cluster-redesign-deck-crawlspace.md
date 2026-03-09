# Port Cluster Service Page Redesign to deck-repair and crawlspace-rot

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Port the cluster service page redesign (split hero, inline CTAs, collapsible references) from `apps/siding-repair` to `apps/deck-repair` and `apps/crawlspace-rot`.

**Architecture:** Both target apps are structurally identical to pre-redesign siding-repair. Each requires the same 5 file changes: `services.ts` (add fields), `cluster-services.ts` (add parsing functions), `ClusterHero.astro` (new component, copied verbatim), `ServiceContent.astro` (cluster rendering), and `[service].astro` (split hero + form section). The only per-app substitutions are `SITE_KEY` and the `serviceConfigs['X']` key.

**Tech Stack:** Astro, Tailwind CSS, TypeScript. Lint with `pnpm lint` from the app directory (`astro check`). No build step needed — Vercel auto-deploys on push.

**Reference:** The source of truth for all file content is `apps/siding-repair`. When the plan says "copy from siding-repair", use that file verbatim unless a substitution is specified.

---

## PART A — deck-repair

### Task 1: deck-repair — Update services.ts

**Files:**
- Modify: `apps/deck-repair/src/data/services.ts`

**Step 1: Add three optional fields to `ServicePageData`**

Find:
```ts
  rawMarkdown: string;
  htmlContent: string;
}
```

Replace with:
```ts
  rawMarkdown: string;
  htmlContent: string;
  clusterSections?: Array<{ heading: string; anchor: string; content: string }>;
  clusterReferences?: string;
  subtopicDescriptors?: Array<{ heading: string; anchor: string; descriptor: string }>;
}
```

**Step 2: Lint**
```bash
cd apps/deck-repair && pnpm lint
```
Expected: no errors.

**Step 3: Commit**
```bash
git add apps/deck-repair/src/data/services.ts
git commit -m "deck-repair: add cluster fields to ServicePageData"
```

---

### Task 2: deck-repair — Replace cluster-services.ts

**Files:**
- Modify: `apps/deck-repair/src/data/cluster-services.ts`

**Step 1: Replace the entire file contents** with the following (this is the siding-repair version with `SITE_KEY` changed to `deck-repair`):

```ts
/**
 * Cluster service page loader.
 * Reads service_page_cluster_* markdown files and returns stub ServicePageData objects.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import type { ServicePageData } from './services';

const SITE_KEY = 'deck-repair'; // Set per app

function parseClusterMeta(content: string): Record<string, string> | null {
  const match = content.match(/<!--\s*CLUSTER_META\s*([\s\S]*?)-->/);
  if (!match) return null;
  const meta: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim();
    if (key && val && !key.startsWith('-')) meta[key] = val;
  }
  return meta;
}

function parseSubtopics(content: string): string[] {
  const match = content.match(/<!--\s*CLUSTER_META[\s\S]*?subtopics:\s*([\s\S]*?)-->/);
  if (!match) return [];
  return match[1]
    .split('\n')
    .filter(l => l.trim().startsWith('- '))
    .map(l => l.replace(/^\s*-\s*/, '').trim());
}

function extractFirstSentence(text: string): string {
  const clean = text.replace(/<sup>\d+<\/sup>/g, '').replace(/\*\*/g, '');
  const match = clean.match(/^.+?[.!?](?:\s|$)/);
  return match ? match[0].trim() : clean.slice(0, 120).trim();
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function parseClusterSections(
  content: string,
  subtopics: string[]
): Array<{ heading: string; anchor: string; content: string }> {
  const sections: Array<{ heading: string; anchor: string; content: string }> = [];
  for (const topic of subtopics) {
    const escaped = topic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = content.match(new RegExp(`## ${escaped}\n([\\s\\S]*?)(?=\n## |$)`));
    if (!match) continue;
    const body = match[1].trim();
    if (!body || body === '*Content to be generated.*') continue;
    sections.push({ heading: topic, anchor: slugify(topic), content: body });
  }
  return sections;
}

function parseReferences(content: string): string {
  const match = content.match(/## References\n\n([\s\S]*?)(?=\n## |$)/);
  return match ? match[1].trim() : '';
}

function parseSubtopicDescriptors(
  content: string,
  subtopics: string[]
): Array<{ heading: string; anchor: string; descriptor: string }> {
  return subtopics.map((topic) => {
    const escaped = topic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = content.match(new RegExp(`## ${escaped}\n([\\s\\S]*?)(?=\n## |$)`));
    const body = match ? match[1].trim() : '';
    const descriptor = body && body !== '*Content to be generated.*'
      ? extractFirstSentence(body)
      : '';
    return { heading: topic, anchor: slugify(topic), descriptor };
  });
}

function extractBodyContent(content: string): string {
  let body = content
    .replace(/^#\s+.+\n/m, '')
    .replace(/<!--\s*CLUSTER_META[\s\S]*?-->\n?/, '')
    .replace(/## Hero Section[\s\S]*?(?=\n## |\n$)/, '')
    .replace(/## Page Metadata[\s\S]*$/, '')
    .trim();
  return body;
}

function extractHeroSubheadline(content: string, name: string, locationFull: string): string {
  const heroMatch = content.match(/## Hero Section[\s\S]*?\n\n([^\n#][^\n]+)/);
  if (heroMatch) return heroMatch[1].trim();
  return `Expert ${name.toLowerCase()} services for Portland and Seattle homeowners — backed by local knowledge and quality craftsmanship.`;
}

function loadClusterPages(): ServicePageData[] {
  const contentDir = join(process.cwd(), 'src', 'data', 'generated_content');
  let files: string[];
  try {
    files = readdirSync(contentDir).filter(
      f => f.startsWith('service_page_cluster_') && f.endsWith('.md')
    );
  } catch {
    return [];
  }

  const pages: ServicePageData[] = [];

  for (const file of files) {
    const content = readFileSync(join(contentDir, file), 'utf-8');
    const meta = parseClusterMeta(content);
    if (!meta) continue;

    const location = meta['location'] as 'portland' | 'seattle';
    if (location !== 'portland' && location !== 'seattle') continue;
    const locationFull = location === 'portland' ? 'Portland, Oregon' : 'Seattle, Washington';
    const slug = meta['cluster_slug'];
    if (!slug) continue;
    const subtopics = parseSubtopics(content);

    const nameMatch = content.match(/^#\s+(.+?)\s+-\s+/m);
    const name = nameMatch ? nameMatch[1].trim() : slug;

    const isStub = meta['status'] === 'stub';
    const bodyContent = extractBodyContent(content);
    const clusterSections = parseClusterSections(content, subtopics);
    const clusterReferences = parseReferences(content);

    pages.push({
      name,
      slug,
      location,
      locationFull,
      heroHeadline: isStub ? `[STUB] ${name} in ${locationFull}` : `${name} in ${locationFull}`,
      heroSubheadline: isStub
        ? `Professional ${name.toLowerCase()} services in ${locationFull}. Content coming soon.`
        : extractHeroSubheadline(content, name, locationFull),
      keyBenefits: subtopics.slice(0, 4),
      sections: bodyContent
        ? { overview: { title: name, content: bodyContent } }
        : {},
      faqs: [],
      metaTitle: `${name} in ${locationFull} | SFW Construction`,
      metaDescription: `Professional ${name.toLowerCase()} services in ${locationFull}. Expert craftsmanship and quality materials.`,
      keywords: [slug, location, SITE_KEY],
      rawMarkdown: content,
      htmlContent: bodyContent,
      clusterSections: clusterSections.length ? clusterSections : undefined,
      clusterReferences: clusterReferences || undefined,
      subtopicDescriptors: parseSubtopicDescriptors(content, subtopics),
    });
  }

  return pages;
}

export const allClusterServices = loadClusterPages();

export function getClusterService(location: string, slug: string): ServicePageData | undefined {
  return allClusterServices.find(s => s.location === location && s.slug === slug);
}

export function getClusterPaths() {
  return allClusterServices.map(s => ({
    params: { location: s.location, service: s.slug },
  }));
}
```

**Step 2: Lint**
```bash
cd apps/deck-repair && pnpm lint
```
Expected: no errors.

**Step 3: Commit**
```bash
git add apps/deck-repair/src/data/cluster-services.ts
git commit -m "deck-repair: add cluster page parsing functions"
```

---

### Task 3: deck-repair — Create ClusterHero.astro

**Files:**
- Create: `apps/deck-repair/src/components/ClusterHero.astro`

**Step 1: Copy verbatim from siding-repair**

The file has no site-specific references (phone and config are props). Copy it exactly:

```bash
cp apps/siding-repair/src/components/ClusterHero.astro apps/deck-repair/src/components/ClusterHero.astro
```

**Step 2: Lint**
```bash
cd apps/deck-repair && pnpm lint
```
Expected: no errors.

**Step 3: Commit**
```bash
git add apps/deck-repair/src/components/ClusterHero.astro
git commit -m "deck-repair: add ClusterHero split-layout component"
```

---

### Task 4: deck-repair — Update ServiceContent.astro

**Files:**
- Modify: `apps/deck-repair/src/components/ServiceContent.astro`

**Step 1: Replace the entire file** with the contents of `apps/siding-repair/src/components/ServiceContent.astro`, then change the one site-specific line.

Find:
```ts
const config = serviceConfigs['siding-repair'];
```
Replace with:
```ts
const config = serviceConfigs['deck-repair'];
```

Everything else is identical.

**Step 2: Lint**
```bash
cd apps/deck-repair && pnpm lint
```
Expected: no errors.

**Step 3: Commit**
```bash
git add apps/deck-repair/src/components/ServiceContent.astro
git commit -m "deck-repair: cluster subtopic sections with inline CTAs and collapsible references"
```

---

### Task 5: deck-repair — Update [service].astro

**Files:**
- Modify: `apps/deck-repair/src/pages/services/[location]/[service].astro`

**Step 1: Replace the entire file** with the following (siding-repair version adapted for deck-repair):

```astro
---
/**
 * Dynamic Service Page Route
 * URL: /services/portland/deck-repair-services, /services/seattle/deck-joist-repair-replacement, etc.
 */
import BaseLayout from '@sfw/ui';
import { HeroSection, CTASection, FAQAccordion } from '@sfw/ui';
import { serviceConfigs } from '@sfw/content';
import { getServicePaths, getService } from '../../../data/services';
import { getClusterPaths, getClusterService } from '../../../data/cluster-services';
import ServiceContent from '../../../components/ServiceContent.astro';
import ClusterHero from '../../../components/ClusterHero.astro';

export async function getStaticPaths() {
  return [...getServicePaths(), ...getClusterPaths()];
}

const { location, service } = Astro.params;
const serviceData = getService(location as string, service as string)
  ?? getClusterService(location as string, service as string);

if (!serviceData) {
  return Astro.redirect('/404');
}

const config = serviceConfigs['deck-repair'];
const locationPhone = location === 'portland' ? config.phone : config.phone;
---

<BaseLayout
  title={serviceData.metaTitle}
  description={serviceData.metaDescription}
  config={config}
  navigation={[
    { label: 'Home', url: '/' },
    { label: 'Services', url: '/services' },
    { label: serviceData.locationFull.split(',')[0], url: `/locations/${location}` },
    { label: serviceData.name, url: '#' },
  ]}
>
  {serviceData.clusterSections && serviceData.subtopicDescriptors ? (
    <ClusterHero
      headline={serviceData.name}
      locationLine={`Serving ${serviceData.locationFull}`}
      phone={locationPhone}
      subtopics={serviceData.subtopicDescriptors}
      breadcrumbs={[
        { label: 'Services', url: '/services' },
        { label: serviceData.locationFull.split(',')[0], url: `/locations/${location}` },
        { label: serviceData.name, url: '#' },
      ]}
    />
  ) : (
    <HeroSection
      headline={serviceData.heroHeadline}
      subheadline={serviceData.heroSubheadline}
      primaryCTA={{ text: 'Get Free Quote', href: `tel:${locationPhone}` }}
      secondaryCTA={{ text: 'Learn More', href: '#overview' }}
      height="lg"
      hubspotForm={{
        portalId: "8210108",
        formId: "e69a4d7a-ee7b-4081-9ed6-3fd729af6bd1",
        region: "na1"
      }}
    />
  )}

  {serviceData.clusterSections && (
    <section id="form" class="py-16 bg-gray-light">
      <div class="container mx-auto px-4">
        <div class="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-start">
          <div>
            <h2 class="text-3xl font-heading font-bold text-dark mb-8">
              Why homeowners choose SFW Construction
            </h2>
            <ul class="space-y-6">
              {[
                { icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', label: 'Licensed & Bonded', detail: 'Fully licensed in Oregon and Washington. All work is bonded and insured.' },
                { icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', label: 'Free Estimates', detail: 'No-obligation quotes on every job. We show up, assess, and give you a straight answer.' },
                { icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', label: 'Local Family Business', detail: 'Serving Portland and Seattle homeowners for over 20 years — not a franchise.' },
              ].map(({ icon, label, detail }) => (
                <li class="flex items-start gap-4">
                  <div class="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={icon} />
                    </svg>
                  </div>
                  <div>
                    <p class="font-semibold text-dark">{label}</p>
                    <p class="text-gray-600 text-sm mt-0.5">{detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div class="bg-white rounded-xl shadow-sm p-8">
            <h3 class="text-2xl font-heading font-bold text-dark mb-2">Get your free quote</h3>
            <p class="text-gray-600 mb-6">We'll get back to you within one business day.</p>
            <div class="hs-form-wrapper" data-portal-id="8210108" data-form-id="e69a4d7a-ee7b-4081-9ed6-3fd729af6bd1" />
            <script>
              (function() {
                if (window.hbspt) {
                  window.hbspt.forms.create({ portalId: '8210108', formId: 'e69a4d7a-ee7b-4081-9ed6-3fd729af6bd1', target: '.hs-form-wrapper' });
                } else {
                  const s = document.createElement('script');
                  s.src = 'https://js.hsforms.net/forms/v2.js';
                  s.onload = () => window.hbspt.forms.create({ portalId: '8210108', formId: 'e69a4d7a-ee7b-4081-9ed6-3fd729af6bd1', target: '.hs-form-wrapper' });
                  document.head.appendChild(s);
                }
              })();
            </script>
          </div>
        </div>
      </div>
    </section>
  )}

  {!serviceData.clusterSections && serviceData.keyBenefits.length > 0 && (
    <section class="py-12 bg-gray-light">
      <div class="container mx-auto px-4">
        <div class="max-w-6xl mx-auto">
          <h2 class="text-3xl font-heading font-bold text-center mb-8">
            Why Choose Our {serviceData.name}?
          </h2>
          <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {serviceData.keyBenefits.map((benefit) => (
              <div class="bg-white p-6 rounded-lg shadow-sm">
                <div class="flex items-start">
                  <svg class="w-6 h-6 text-primary mr-3 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <p class="text-gray-700">{benefit}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )}

  <ServiceContent service={serviceData} />

  {serviceData.faqs.length > 0 && (
    <FAQAccordion faqs={serviceData.faqs} title={`${serviceData.name} FAQ`} />
  )}

  <CTASection
    headline={`Ready for Professional ${serviceData.name}?`}
    description={`Get a free consultation and quote today. We're here to help with all your deck needs in ${serviceData.locationFull}.`}
    primaryCTA={{ text: 'Get Free Quote', href: `tel:${locationPhone}` }}
    secondaryCTA={{ text: 'View All Services', href: '/services' }}
    variant="dark"
  />
</BaseLayout>
```

**Step 2: Lint**
```bash
cd apps/deck-repair && pnpm lint
```
Expected: no errors.

**Step 3: Commit**
```bash
git add apps/deck-repair/src/pages/services/[location]/[service].astro
git commit -m "deck-repair: split hero, trust+form section, cluster page layout"
```

---

## PART B — crawlspace-rot

### Task 6: crawlspace-rot — Update services.ts

**Files:**
- Modify: `apps/crawlspace-rot/src/data/services.ts`

**Step 1: Add three optional fields to `ServicePageData`** — identical to Task 1 Step 1.

Find:
```ts
  rawMarkdown: string;
  htmlContent: string;
}
```

Replace with:
```ts
  rawMarkdown: string;
  htmlContent: string;
  clusterSections?: Array<{ heading: string; anchor: string; content: string }>;
  clusterReferences?: string;
  subtopicDescriptors?: Array<{ heading: string; anchor: string; descriptor: string }>;
}
```

**Step 2: Lint**
```bash
cd apps/crawlspace-rot && pnpm lint
```

**Step 3: Commit**
```bash
git add apps/crawlspace-rot/src/data/services.ts
git commit -m "crawlspace-rot: add cluster fields to ServicePageData"
```

---

### Task 7: crawlspace-rot — Replace cluster-services.ts

**Files:**
- Modify: `apps/crawlspace-rot/src/data/cluster-services.ts`

**Step 1: Replace the entire file** with the same content as Task 2 Step 1, but change the one line:

```ts
const SITE_KEY = 'crawlspace-rot'; // Set per app
```

Everything else is identical to the deck-repair version in Task 2.

**Step 2: Lint**
```bash
cd apps/crawlspace-rot && pnpm lint
```

**Step 3: Commit**
```bash
git add apps/crawlspace-rot/src/data/cluster-services.ts
git commit -m "crawlspace-rot: add cluster page parsing functions"
```

---

### Task 8: crawlspace-rot — Create ClusterHero.astro

**Files:**
- Create: `apps/crawlspace-rot/src/components/ClusterHero.astro`

**Step 1: Copy verbatim from siding-repair**
```bash
cp apps/siding-repair/src/components/ClusterHero.astro apps/crawlspace-rot/src/components/ClusterHero.astro
```

**Step 2: Lint**
```bash
cd apps/crawlspace-rot && pnpm lint
```

**Step 3: Commit**
```bash
git add apps/crawlspace-rot/src/components/ClusterHero.astro
git commit -m "crawlspace-rot: add ClusterHero split-layout component"
```

---

### Task 9: crawlspace-rot — Update ServiceContent.astro

**Files:**
- Modify: `apps/crawlspace-rot/src/components/ServiceContent.astro`

**Step 1: Replace entire file** with `apps/siding-repair/src/components/ServiceContent.astro` contents, then change:

```ts
const config = serviceConfigs['siding-repair'];
```
to:
```ts
const config = serviceConfigs['crawlspace-rot'];
```

**Step 2: Lint**
```bash
cd apps/crawlspace-rot && pnpm lint
```

**Step 3: Commit**
```bash
git add apps/crawlspace-rot/src/components/ServiceContent.astro
git commit -m "crawlspace-rot: cluster subtopic sections with inline CTAs and collapsible references"
```

---

### Task 10: crawlspace-rot — Update [service].astro

**Files:**
- Modify: `apps/crawlspace-rot/src/pages/services/[location]/[service].astro`

**Step 1: Replace entire file** with the same content as Task 5 Step 1, making these two substitutions:

1. URL comment line:
```ts
 * URL: /services/portland/crawlspace-services, /services/seattle/crawlspace-insulation, etc.
```

2. Config reference (two occurrences):
```ts
const config = serviceConfigs['crawlspace-rot'];
```

3. CTA description:
```ts
description={`Get a free consultation and quote today. We're here to help with all your crawlspace needs in ${serviceData.locationFull}.`}
```

**Step 2: Lint**
```bash
cd apps/crawlspace-rot && pnpm lint
```

**Step 3: Commit**
```bash
git add apps/crawlspace-rot/src/pages/services/[location]/[service].astro
git commit -m "crawlspace-rot: split hero, trust+form section, cluster page layout"
```

---

### Task 11: Push both remotes

```bash
cd /c/Users/tfalcon/microsites && powershell.exe -File ./pushall.ps1
```

Expected: pushed to both `origin` and `upstream`.

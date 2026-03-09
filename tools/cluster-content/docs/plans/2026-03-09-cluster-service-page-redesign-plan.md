# Cluster Service Page Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign cluster service pages with a split hero (image+CTA left / subtopic nav right), trust+form section below, per-subtopic inline CTAs, and collapsible references.

**Architecture:** New local `ClusterHero.astro` component handles the split layout. `ServiceContent.astro` gets updated subtopic sections with inline CTAs and collapsible references. `cluster-services.ts` extracts first-sentence descriptors per subtopic. Non-cluster pages are unaffected.

**Tech Stack:** Astro, Tailwind CSS, TypeScript. Working directory for build/dev: `apps/siding-repair/`. Verify each task with `pnpm build`.

---

### Task 1: Add subtopic descriptors to data layer

**Files:**
- Modify: `apps/siding-repair/src/data/services.ts`
- Modify: `apps/siding-repair/src/data/cluster-services.ts`

**Step 1: Add `subtopicDescriptors` field to `ServicePageData` in `services.ts`**

Find the existing `clusterSections` line and add the new field below it:

```ts
clusterSections?: Array<{ heading: string; anchor: string; content: string }>;
clusterReferences?: string;
subtopicDescriptors?: Array<{ heading: string; anchor: string; descriptor: string }>;
```

**Step 2: Add `extractFirstSentence` helper to `cluster-services.ts`**

Add this function just above `slugify`:

```ts
function extractFirstSentence(text: string): string {
  // Strip markdown superscripts and inline HTML, then grab first sentence
  const clean = text.replace(/<sup>\d+<\/sup>/g, '').replace(/\*\*/g, '');
  const match = clean.match(/^.+?[.!?](?:\s|$)/);
  return match ? match[0].trim() : clean.slice(0, 120).trim();
}
```

**Step 3: Add `parseSubtopicDescriptors` function to `cluster-services.ts`**

Add after `parseReferences`:

```ts
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
```

**Step 4: Wire into `loadClusterPages` in `cluster-services.ts`**

In the `pages.push({...})` call, add after `clusterReferences`:

```ts
subtopicDescriptors: parseSubtopicDescriptors(content, subtopics),
```

**Step 5: Build to verify no TypeScript errors**

```bash
cd apps/siding-repair && pnpm build
```

Expected: build completes with no type errors.

**Step 6: Commit**

```bash
git add apps/siding-repair/src/data/services.ts apps/siding-repair/src/data/cluster-services.ts
git commit -m "add subtopic descriptor extraction for cluster hero nav"
```

---

### Task 2: Create ClusterHero component

**Files:**
- Create: `apps/siding-repair/src/components/ClusterHero.astro`

**Step 1: Create the file with this exact content**

```astro
---
/**
 * ClusterHero.astro
 * Split-layout hero for cluster service pages.
 * Left: full-bleed image with headline + CTAs
 * Right: subtopic navigation panel
 */

interface Props {
  headline: string;
  locationLine: string;
  phone: string;
  subtopics: Array<{ heading: string; anchor: string; descriptor: string }>;
  backgroundImage?: string;
  breadcrumbs?: Array<{ label: string; url: string }>;
}

const {
  headline,
  locationLine,
  phone,
  subtopics,
  backgroundImage = 'https://cdn-ileeamj.nitrocdn.com/WrsmSvzGThHeWebWzpPigJcevuotdycK/assets/images/optimized/rev-26df6f7/rotrepairseattle.com/wp-content/uploads/2025/10/rot-repair-seattle.webp',
  breadcrumbs = [],
} = Astro.props;

const formattedPhone = phone.replace(/\D/g, '');
---

<section class="flex flex-col md:flex-row md:min-h-screen md:max-h-screen">

  <!-- ── Left: image + conversion (60%) ── -->
  <div
    class="relative flex flex-col justify-between p-8 md:p-12 md:w-3/5 min-h-[420px]"
    style={`background-image:url('${backgroundImage}');background-size:cover;background-position:center;`}
  >
    <!-- Gradient overlay -->
    <div class="absolute inset-0 bg-gradient-to-b from-black/40 via-black/25 to-black/80 pointer-events-none" />

    <!-- Breadcrumbs -->
    {breadcrumbs.length > 0 && (
      <nav class="relative z-10 flex flex-wrap items-center gap-1.5 text-white/70 text-sm" aria-label="Breadcrumb">
        {breadcrumbs.map((crumb, i) => (
          <>
            {i > 0 && <span class="text-white/40">/</span>}
            {i < breadcrumbs.length - 1
              ? <a href={crumb.url} class="hover:text-white transition-colors">{crumb.label}</a>
              : <span class="text-white font-medium">{crumb.label}</span>
            }
          </>
        ))}
      </nav>
    )}

    <!-- Headline + CTAs pinned to bottom -->
    <div class="relative z-10 mt-auto">
      <p class="text-white/75 text-sm font-semibold uppercase tracking-wide mb-3">{locationLine}</p>
      <h1 class="text-4xl md:text-5xl font-heading font-bold text-white leading-tight mb-8 max-w-xl">
        {headline}
      </h1>
      <div class="flex flex-col sm:flex-row gap-3">
        <a
          href={`tel:${formattedPhone}`}
          class="inline-flex items-center justify-center gap-2 px-7 py-4 bg-primary text-white font-bold text-lg rounded-lg hover:bg-primary-dark transition-colors"
        >
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
          </svg>
          {phone}
        </a>
        <a
          href="#form"
          class="inline-flex items-center justify-center gap-2 px-7 py-4 border-2 border-white/80 text-white font-semibold text-lg rounded-lg hover:bg-white hover:text-dark transition-colors"
        >
          Get Free Quote
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"/>
          </svg>
        </a>
      </div>
    </div>
  </div>

  <!-- ── Right: subtopic nav (40%) ── -->
  <div class="md:w-2/5 bg-white flex flex-col shadow-[-4px_0_24px_rgba(0,0,0,0.07)]">

    <div class="flex-1 overflow-y-auto px-8 md:px-10 pt-8 md:pt-10 pb-4">
      <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-5">What we cover</p>
      <nav class="divide-y divide-gray-100" aria-label="Page sections">
        {subtopics.map((topic) => (
          <a
            href={`#${topic.anchor}`}
            class="group flex items-start justify-between gap-4 py-4 pr-1 transition-all duration-150 hover:pl-2"
          >
            <div class="flex items-start gap-3 min-w-0">
              <div class="mt-1.5 w-0.5 h-4 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              <div class="min-w-0">
                <p class="font-semibold text-dark group-hover:text-primary transition-colors leading-snug">
                  {topic.heading}
                </p>
                {topic.descriptor && (
                  <p class="text-sm text-gray-500 mt-0.5 leading-snug line-clamp-2">
                    {topic.descriptor}
                  </p>
                )}
              </div>
            </div>
            <svg class="w-4 h-4 text-gray-300 group-hover:text-primary flex-shrink-0 mt-1 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </a>
        ))}
      </nav>
    </div>

    <!-- Trust badge -->
    <div class="border-t border-gray-100 px-8 md:px-10 py-5 flex items-center gap-3 flex-shrink-0">
      <span class="text-yellow-400 text-lg tracking-tight" aria-hidden="true">★★★★★</span>
      <p class="text-sm text-gray-600">
        <strong class="text-dark font-semibold">4.9</strong>
        <span class="text-gray-400 mx-1">·</span>
        200+ reviews
        <span class="text-gray-400 mx-1">·</span>
        Licensed & Insured
      </p>
    </div>

  </div>
</section>
```

**Step 2: Build to verify**

```bash
cd apps/siding-repair && pnpm build
```

Expected: clean build.

**Step 3: Commit**

```bash
git add apps/siding-repair/src/components/ClusterHero.astro
git commit -m "add ClusterHero split-layout component"
```

---

### Task 3: Update [service].astro to use ClusterHero + add form section

**Files:**
- Modify: `apps/siding-repair/src/pages/services/[location]/[service].astro`

**Step 1: Add ClusterHero import at the top of the frontmatter**

Add after the existing imports:

```ts
import ClusterHero from '../../../components/ClusterHero.astro';
```

**Step 2: Replace the entire template body** with this:

```astro
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
    <!-- Cluster pages: split hero -->
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
    <!-- Non-cluster pages: existing hero with form -->
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

  <!-- Trust + Form (cluster pages only) -->
  {serviceData.clusterSections && (
    <section id="form" class="py-16 bg-gray-light">
      <div class="container mx-auto px-4">
        <div class="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-start">

          <!-- Trust block -->
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

          <!-- HubSpot Form -->
          <div class="bg-white rounded-xl shadow-sm p-8">
            <h3 class="text-2xl font-heading font-bold text-dark mb-2">Get your free quote</h3>
            <p class="text-gray-600 mb-6">We'll get back to you within one business day.</p>
            <div
              class="hs-form-wrapper"
              data-portal-id="8210108"
              data-form-id="e69a4d7a-ee7b-4081-9ed6-3fd729af6bd1"
            />
            <script>
              (function() {
                if (window.hbspt) {
                  window.hbspt.forms.create({
                    portalId: '8210108',
                    formId: 'e69a4d7a-ee7b-4081-9ed6-3fd729af6bd1',
                    target: '.hs-form-wrapper',
                  });
                } else {
                  const s = document.createElement('script');
                  s.src = 'https://js.hsforms.net/forms/v2.js';
                  s.onload = () => window.hbspt.forms.create({
                    portalId: '8210108',
                    formId: 'e69a4d7a-ee7b-4081-9ed6-3fd729af6bd1',
                    target: '.hs-form-wrapper',
                  });
                  document.head.appendChild(s);
                }
              })();
            </script>
          </div>
        </div>
      </div>
    </section>
  )}

  <!-- Key Benefits (non-cluster pages only — cluster pages use the hero nav) -->
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

  <!-- Service Content -->
  <ServiceContent service={serviceData} />

  <!-- FAQ Section -->
  {serviceData.faqs.length > 0 && (
    <FAQAccordion
      faqs={serviceData.faqs}
      title={`${serviceData.name} FAQ`}
    />
  )}

  <!-- CTA Section -->
  <CTASection
    headline={`Ready for Professional ${serviceData.name}?`}
    description={`Get a free consultation and quote today. We're here to help with all your siding needs in ${serviceData.locationFull}.`}
    primaryCTA={{ text: 'Get Free Quote', href: `tel:${locationPhone}` }}
    secondaryCTA={{ text: 'View All Services', href: '/services' }}
    variant="dark"
  />
</BaseLayout>
```

**Step 3: Build to verify**

```bash
cd apps/siding-repair && pnpm build
```

Expected: clean build, no type errors.

**Step 4: Commit**

```bash
git add apps/siding-repair/src/pages/services/[location]/[service].astro
git commit -m "update cluster service page to use split hero and below-fold form"
```

---

### Task 4: Update subtopic sections with left-border accent and inline CTAs

**Files:**
- Modify: `apps/siding-repair/src/components/ServiceContent.astro`

**Step 1: Replace the "Cluster: Individual Subtopic Sections" block**

Find this block:
```astro
<!-- Cluster: Individual Subtopic Sections -->
{service.clusterSections && service.clusterSections.map((sec, i) => (
  <section
    id={sec.anchor}
    class={`py-16 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-light'} scroll-mt-8`}
  >
    <div class="container mx-auto px-4">
      <div class="max-w-4xl mx-auto">
        <h2 class="text-3xl font-heading font-bold mb-6 text-dark">{sec.heading}</h2>
        <div
          class="prose prose-lg max-w-none prose-headings:font-heading prose-headings:text-dark prose-p:text-gray-700 prose-li:text-gray-700 prose-a:text-primary prose-a:no-underline hover:prose-a:underline"
          set:html={markdownToHtml(sec.content)}
        />
      </div>
    </div>
  </section>
))}
```

Replace with:

```astro
<!-- Cluster: Individual Subtopic Sections -->
{service.clusterSections && service.clusterSections.map((sec, i) => (
  <section
    id={sec.anchor}
    class={`py-16 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-light'} scroll-mt-6`}
  >
    <div class="container mx-auto px-4">
      <div class="max-w-4xl mx-auto">

        <!-- Heading with left accent -->
        <div class="flex items-start gap-4 mb-6">
          <div class="w-1 flex-shrink-0 self-stretch bg-primary rounded-full mt-1" />
          <h2 class="text-3xl font-heading font-bold text-dark">{sec.heading}</h2>
        </div>

        <!-- Content -->
        <div
          class="prose prose-lg max-w-none prose-headings:font-heading prose-headings:text-dark prose-p:text-gray-700 prose-li:text-gray-700 prose-a:text-primary prose-a:no-underline hover:prose-a:underline pl-5"
          set:html={markdownToHtml(sec.content)}
        />

        <!-- Inline CTA bar -->
        <div class="mt-8 pl-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-gray-200 rounded-lg px-6 py-4 bg-white shadow-sm">
          <p class="text-gray-700 font-medium">
            Dealing with {sec.heading.toLowerCase()}?
            <span class="text-gray-500 font-normal"> Call us for a free assessment.</span>
          </p>
          <a
            href={`tel:${config.phone.replace(/\D/g, '')}`}
            class="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-semibold rounded-lg hover:bg-primary-dark transition-colors text-sm whitespace-nowrap"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
            </svg>
            {config.phone}
          </a>
        </div>

      </div>
    </div>
  </section>
))}
```

**Step 2: Build to verify**

```bash
cd apps/siding-repair && pnpm build
```

Expected: clean build.

**Step 3: Commit**

```bash
git add apps/siding-repair/src/components/ServiceContent.astro
git commit -m "add left-border accent and inline CTAs to cluster subtopic sections"
```

---

### Task 5: Collapsible references and remove redundant anchor cards section

**Files:**
- Modify: `apps/siding-repair/src/components/ServiceContent.astro`

**Step 1: Replace the "Cluster: Subtopic Anchor Cards" section**

The hero now handles subtopic navigation. Remove the `Jump to a topic` card grid:

Find and delete this entire block:
```astro
<!-- Cluster: Subtopic Anchor Cards -->
{service.clusterSections && service.clusterSections.length > 0 && (
  <section class="py-10 bg-gray-light border-b border-gray-200">
    ...
  </section>
)}
```

**Step 2: Replace the references section with a collapsible version**

Find:
```astro
<!-- Cluster: References Table -->
{service.clusterReferences && (
  <section class="py-12 bg-white border-t border-gray-200">
    <div class="container mx-auto px-4">
      <div class="max-w-4xl mx-auto">
        <h2 class="text-2xl font-heading font-bold mb-6 text-dark">References</h2>
        <div class="overflow-x-auto">
          <div
            class="prose prose-sm max-w-none prose-table:w-full prose-th:text-left prose-th:font-semibold prose-th:bg-gray-light prose-th:py-2 prose-th:px-4 prose-td:py-2 prose-td:px-4 prose-td:text-gray-600 prose-td:border-b prose-td:border-gray-200"
            set:html={markdownToHtml(service.clusterReferences)}
          />
        </div>
      </div>
    </div>
  </section>
)}
```

Replace with:

```astro
<!-- Cluster: Collapsible References -->
{service.clusterReferences && (
  <section class="py-10 bg-gray-light border-t border-gray-200">
    <div class="container mx-auto px-4">
      <div class="max-w-4xl mx-auto">
        <details class="group">
          <summary class="flex items-center gap-2 cursor-pointer list-none select-none w-fit">
            <svg
              class="w-4 h-4 text-gray-400 transition-transform group-open:rotate-90"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
            <span class="text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors">
              View sources ({(service.clusterReferences.match(/^\|/gm) ?? []).length - 1})
            </span>
          </summary>
          <div class="mt-4 overflow-x-auto">
            <div
              class="prose prose-sm max-w-none prose-table:w-full prose-th:text-left prose-th:font-semibold prose-th:bg-white prose-th:py-2 prose-th:px-4 prose-td:py-2 prose-td:px-4 prose-td:text-gray-600 prose-td:border-b prose-td:border-gray-100 [&_table]:border [&_table]:border-gray-200 [&_table]:rounded-lg [&_table]:overflow-hidden [&_tr:nth-child(even)]:bg-white [&_tr:nth-child(odd)]:bg-gray-50"
              set:html={markdownToHtml(service.clusterReferences)}
            />
          </div>
        </details>
      </div>
    </div>
  </section>
)}
```

**Step 3: Build to verify**

```bash
cd apps/siding-repair && pnpm build
```

Expected: clean build.

**Step 4: Commit**

```bash
git add apps/siding-repair/src/components/ServiceContent.astro
git commit -m "collapsible references and remove redundant subtopic anchor card strip"
```

---

### Task 6: Push both remotes

```bash
cd /path/to/microsites && powershell.exe -File ./pushall.ps1
```

Expected: pushed to both `origin` and `upstream`.

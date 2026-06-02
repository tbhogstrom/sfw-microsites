# go Slide Decks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reveal.js-based slide-deck feature to the `go` app so weekly review decks live behind a public short link, editable from a web admin and from the terminal/Jupyter via an HTTP API.

**Architecture:** Decks are JSON documents in Vercel Blob (`decks/{slug}.json`, private, no edge cache), with uploaded images as public blobs (`deck-media/{slug}/{id}.{ext}`). Pure validation/operation helpers live in `lib/decks.ts`; Blob IO in `lib/deck-store.ts`; slide→HTML rendering in `lib/render-slides.ts`. A public `/d/[slug]` page boots reveal.js client-side. API routes under `/api/decks` reuse the app's `isAuthorized` (cookie or bearer token).

**Tech Stack:** Next.js 16 (App Router), React 19, `@vercel/blob`, `reveal.js`, `marked`, `vitest` (unit tests for pure helpers).

All paths below are relative to `apps/go/`. Run all commands from `apps/go/`.

---

### Task 1: Add dependencies and test runner

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `lib/smoke.test.ts` (temporary, deleted in this task's last step)

- [ ] **Step 1: Add runtime + dev dependencies**

Run:
```bash
pnpm add reveal.js marked
pnpm add -D vitest
```
Expected: `package.json` gains `reveal.js`, `marked` under dependencies and `vitest` under devDependencies; pnpm installs without error.

- [ ] **Step 2: Add a `test` script**

In `package.json`, add to the `scripts` object:
```json
"test": "vitest run"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Add a temporary smoke test to verify the runner**

Create `lib/smoke.test.ts`:
```ts
import { test, expect } from 'vitest';

test('vitest runs', () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 5: Run the test suite**

Run: `pnpm test`
Expected: PASS — 1 passed.

- [ ] **Step 6: Delete the smoke test and commit**

```bash
rm lib/smoke.test.ts
git add package.json pnpm-lock.yaml vitest.config.ts
git commit -m "chore(go): add reveal.js, marked, and vitest"
```
(If `pnpm-lock.yaml` lives at the monorepo root, add that path instead — check `git status` before committing.)

---

### Task 2: Deck types and slide validation (`lib/decks.ts`)

**Files:**
- Modify: `lib/links.ts:9-17` (reserved slugs)
- Create: `lib/decks.ts`
- Test: `lib/decks.test.ts`

- [ ] **Step 1: Reserve the deck routes in `lib/links.ts`**

In `lib/links.ts`, add `'d'`, `'decks'`, `'deck-media'` to the `RESERVED_SLUGS` set so a short link can never shadow the deck viewer, admin, or media routes:
```ts
export const RESERVED_SLUGS = new Set([
  '',
  'api',
  'login',
  'd',
  'decks',
  'deck-media',
  '_next',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
]);
```

- [ ] **Step 2: Write the failing test for slide validation**

Create `lib/decks.test.ts`:
```ts
import { test, expect } from 'vitest';
import { normalizeSlideInput, DeckError, SLIDE_TYPES } from './decks';

test('SLIDE_TYPES lists the four supported types', () => {
  expect(SLIDE_TYPES).toEqual(['markdown', 'image', 'embed', 'html']);
});

test('normalizeSlideInput accepts a markdown slide', () => {
  const s = normalizeSlideInput({ type: 'markdown', content: '## Hi', notes: 'say hi' });
  expect(s).toEqual({ type: 'markdown', content: '## Hi', notes: 'say hi' });
});

test('normalizeSlideInput rejects empty markdown', () => {
  expect(() => normalizeSlideInput({ type: 'markdown', content: '   ' })).toThrow(DeckError);
});

test('normalizeSlideInput accepts an image slide and trims caption', () => {
  const s = normalizeSlideInput({ type: 'image', url: 'https://x.test/a.png', caption: '  cap  ' });
  expect(s).toEqual({ type: 'image', url: 'https://x.test/a.png', caption: 'cap', notes: undefined });
});

test('normalizeSlideInput rejects a non-http embed url', () => {
  expect(() => normalizeSlideInput({ type: 'embed', url: 'javascript:alert(1)' })).toThrow(DeckError);
});

test('normalizeSlideInput rejects an unknown type', () => {
  expect(() => normalizeSlideInput({ type: 'video', url: 'https://x.test' })).toThrow(DeckError);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm test`
Expected: FAIL — cannot resolve `./decks`.

- [ ] **Step 4: Implement `lib/decks.ts` (types + `normalizeSlideInput`)**

```ts
import { isValidUrl, generateSlug } from './links';

export type SlideType = 'markdown' | 'image' | 'embed' | 'html';

export interface BaseSlide {
  id: string;
  notes?: string;
}
export interface MarkdownSlide extends BaseSlide { type: 'markdown'; content: string }
export interface ImageSlide extends BaseSlide { type: 'image'; url: string; caption?: string }
export interface EmbedSlide extends BaseSlide { type: 'embed'; url: string }
export interface HtmlSlide extends BaseSlide { type: 'html'; html: string }
export type Slide = MarkdownSlide | ImageSlide | EmbedSlide | HtmlSlide;

export interface Deck {
  slug: string;
  title: string;
  theme?: string;
  createdAt: string;
  updatedAt: string;
  slides: Slide[];
}

export const SLIDE_TYPES: SlideType[] = ['markdown', 'image', 'embed', 'html'];

export const MEDIA_MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};
export const MAX_MEDIA_BYTES = 10 * 1024 * 1024;

/** Thrown for caller-fixable (400-class) problems. */
export class DeckError extends Error {}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** Validate and normalize a slide payload (without an id). Throws DeckError if invalid. */
export function normalizeSlideInput(input: unknown): Omit<Slide, 'id'> {
  const o = (input ?? {}) as Record<string, unknown>;
  const type = o.type as SlideType;
  if (!SLIDE_TYPES.includes(type)) {
    throw new DeckError(`Invalid slide type: ${String(o.type)}`);
  }
  const notes = typeof o.notes === 'string' && o.notes.trim() ? o.notes : undefined;

  switch (type) {
    case 'markdown': {
      const content = str(o.content);
      if (!content.trim()) throw new DeckError('Markdown slide requires content');
      return { type, content, notes };
    }
    case 'html': {
      const html = str(o.html);
      if (!html.trim()) throw new DeckError('HTML slide requires html');
      return { type, html, notes };
    }
    case 'image': {
      const url = str(o.url);
      if (!isValidUrl(url)) throw new DeckError('Image slide requires a valid http(s) url');
      const caption = str(o.caption).trim() || undefined;
      return { type, url, caption, notes };
    }
    case 'embed': {
      const url = str(o.url);
      if (!isValidUrl(url)) throw new DeckError('Embed slide requires a valid http(s) url');
      return { type, url, notes };
    }
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test`
Expected: PASS — all tests in `lib/decks.test.ts` green.

- [ ] **Step 6: Commit**

```bash
git add lib/links.ts lib/decks.ts lib/decks.test.ts
git commit -m "feat(go): add deck types and slide validation"
```

---

### Task 3: Pure deck operations — addSlide and applyDeckOp (`lib/decks.ts`)

**Files:**
- Modify: `lib/decks.ts`
- Test: `lib/decks.test.ts`

- [ ] **Step 1: Write failing tests for the operations**

Append to `lib/decks.test.ts`:
```ts
import { addSlide, applyDeckOp } from './decks';
import type { Deck } from './decks';

function deckFixture(): Deck {
  return {
    slug: 'wk1',
    title: 'Week 1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    slides: [
      { id: 'a', type: 'markdown', content: 'A' },
      { id: 'b', type: 'markdown', content: 'B' },
    ],
  };
}

test('addSlide appends a validated slide with a generated id', () => {
  const next = addSlide(deckFixture(), { type: 'markdown', content: 'C' });
  expect(next.slides).toHaveLength(3);
  const added = next.slides[2];
  expect(added.type).toBe('markdown');
  expect(added.id).toMatch(/^[a-z0-9]{8}$/);
});

test('applyDeckOp reorder reverses the slides', () => {
  const next = applyDeckOp(deckFixture(), { op: 'reorder', order: ['b', 'a'] });
  expect(next.slides.map((s) => s.id)).toEqual(['b', 'a']);
});

test('applyDeckOp reorder rejects a non-permutation', () => {
  expect(() => applyDeckOp(deckFixture(), { op: 'reorder', order: ['b'] })).toThrow();
});

test('applyDeckOp deleteSlide removes by id', () => {
  const next = applyDeckOp(deckFixture(), { op: 'deleteSlide', id: 'a' });
  expect(next.slides.map((s) => s.id)).toEqual(['b']);
});

test('applyDeckOp updateSlide edits content and keeps id/type', () => {
  const next = applyDeckOp(deckFixture(), { op: 'updateSlide', id: 'a', patch: { content: 'A2' } });
  const s = next.slides[0] as { id: string; type: string; content: string };
  expect(s).toMatchObject({ id: 'a', type: 'markdown', content: 'A2' });
});

test('applyDeckOp updateDeck rejects an empty title', () => {
  expect(() => applyDeckOp(deckFixture(), { op: 'updateDeck', title: '   ' })).toThrow();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test`
Expected: FAIL — `addSlide`/`applyDeckOp` not exported.

- [ ] **Step 3: Implement the operations in `lib/decks.ts`**

Append to `lib/decks.ts`:
```ts
/** Build a full slide (with id) from input. Throws DeckError if invalid. */
export function makeSlide(input: unknown): Slide {
  const base = normalizeSlideInput(input);
  return { ...base, id: generateSlug(8) } as Slide;
}

/** Return a copy of the deck with a new validated slide appended. */
export function addSlide(deck: Deck, input: unknown): Deck {
  return { ...deck, slides: [...deck.slides, makeSlide(input)] };
}

export type DeckOp =
  | { op: 'updateDeck'; title?: string; theme?: string }
  | { op: 'reorder'; order: string[] }
  | { op: 'updateSlide'; id: string; patch: Record<string, unknown> }
  | { op: 'deleteSlide'; id: string };

/** Apply a single mutation op and return a new deck. Throws DeckError on bad input. */
export function applyDeckOp(deck: Deck, op: DeckOp): Deck {
  switch (op.op) {
    case 'updateDeck': {
      const title = op.title !== undefined ? op.title.trim() : deck.title;
      if (!title) throw new DeckError('Title cannot be empty');
      const theme = op.theme !== undefined ? op.theme : deck.theme;
      return { ...deck, title, theme };
    }
    case 'reorder': {
      const ids = deck.slides.map((s) => s.id);
      const order = op.order ?? [];
      const same = order.length === ids.length && ids.every((id) => order.includes(id));
      if (!same) throw new DeckError('Order must be a permutation of the existing slide ids');
      const byId = new Map(deck.slides.map((s) => [s.id, s]));
      return { ...deck, slides: order.map((id) => byId.get(id)!) };
    }
    case 'deleteSlide': {
      return { ...deck, slides: deck.slides.filter((s) => s.id !== op.id) };
    }
    case 'updateSlide': {
      const idx = deck.slides.findIndex((s) => s.id === op.id);
      if (idx < 0) throw new DeckError('Slide not found');
      const current = deck.slides[idx];
      const merged = { ...current, ...op.patch, type: current.type };
      const normalized = normalizeSlideInput(merged);
      const next = { ...normalized, id: current.id } as Slide;
      const slides = [...deck.slides];
      slides[idx] = next;
      return { ...deck, slides };
    }
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test`
Expected: PASS — all deck tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/decks.ts lib/decks.test.ts
git commit -m "feat(go): add pure deck operations (addSlide, applyDeckOp)"
```

---

### Task 4: Slide rendering to HTML (`lib/render-slides.ts`)

**Files:**
- Create: `lib/render-slides.ts`
- Test: `lib/render-slides.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/render-slides.test.ts`:
```ts
import { test, expect } from 'vitest';
import { slideToHtml, buildSections } from './render-slides';
import type { Deck } from './decks';

test('markdown slide renders to HTML', () => {
  const html = slideToHtml({ id: '1', type: 'markdown', content: '## Title' });
  expect(html).toContain('<h2');
  expect(html).toContain('Title');
});

test('image slide renders an img with escaped url and caption', () => {
  const html = slideToHtml({ id: '1', type: 'image', url: 'https://x.test/a.png?b="c', caption: 'Cap' });
  expect(html).toContain('<img');
  expect(html).toContain('https://x.test/a.png?b=&quot;c');
  expect(html).toContain('Cap');
});

test('embed slide renders a lazy iframe', () => {
  const html = slideToHtml({ id: '1', type: 'embed', url: 'https://dash.test' });
  expect(html).toContain('data-src="https://dash.test"');
  expect(html).toContain('<iframe');
});

test('html slide passes through raw html', () => {
  const html = slideToHtml({ id: '1', type: 'html', html: '<div class="x">hi</div>' });
  expect(html).toBe('<div class="x">hi</div>');
});

test('buildSections maps every slide and renders notes', () => {
  const deck: Deck = {
    slug: 's', title: 'T', createdAt: '', updatedAt: '',
    slides: [{ id: '1', type: 'markdown', content: 'Body', notes: 'speaker' }],
  };
  const sections = buildSections(deck);
  expect(sections).toHaveLength(1);
  expect(sections[0].html).toContain('Body');
  expect(sections[0].notes).toContain('speaker');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test`
Expected: FAIL — cannot resolve `./render-slides`.

- [ ] **Step 3: Implement `lib/render-slides.ts`**

```ts
import { marked } from 'marked';
import type { Deck, Slide } from './decks';

/** Escape a string for safe use inside a double-quoted HTML attribute. */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Escape a string for safe use as HTML text content. */
function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function md(source: string): string {
  return marked.parse(source, { async: false }) as string;
}

/** Render a single slide's inner HTML (the contents of its <section>). */
export function slideToHtml(slide: Slide): string {
  switch (slide.type) {
    case 'markdown':
      return md(slide.content);
    case 'html':
      return slide.html;
    case 'image': {
      const img = `<img src="${escapeAttr(slide.url)}" style="max-height:80vh;max-width:90vw;object-fit:contain" alt="${escapeAttr(slide.caption ?? '')}" />`;
      const caption = slide.caption
        ? `<figcaption style="margin-top:12px;font-size:0.6em;opacity:0.8">${escapeText(slide.caption)}</figcaption>`
        : '';
      return `<figure style="margin:0;display:flex;flex-direction:column;align-items:center">${img}${caption}</figure>`;
    }
    case 'embed':
      return `<iframe data-src="${escapeAttr(slide.url)}" style="width:100%;height:100%;border:0" allow="fullscreen" loading="lazy"></iframe>`;
  }
}

export interface Section {
  html: string;
  notes?: string;
}

/** Render every slide of a deck into reveal.js-ready sections. */
export function buildSections(deck: Deck): Section[] {
  return deck.slides.map((slide) => ({
    html: slideToHtml(slide),
    notes: slide.notes ? md(slide.notes) : undefined,
  }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/render-slides.ts lib/render-slides.test.ts
git commit -m "feat(go): render slides to reveal.js HTML"
```

---

### Task 5: Deck Blob store (`lib/deck-store.ts`)

**Files:**
- Create: `lib/deck-store.ts`

No unit test (pure IO against Vercel Blob); verified by typecheck and the smoke test in Task 10. Mirrors `lib/store.ts` exactly.

- [ ] **Step 1: Implement `lib/deck-store.ts`**

```ts
import { list, put, del } from '@vercel/blob';
import type { Deck } from './decks';

function getToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN not configured');
  return token;
}

function deckPath(slug: string): string {
  return `decks/${slug}.json`;
}

async function fetchDeck(downloadUrl: string, token: string): Promise<Deck | null> {
  const resp = await fetch(downloadUrl, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) return null;
  return (await resp.json()) as Deck;
}

export async function getDeck(slug: string): Promise<Deck | null> {
  const token = getToken();
  const path = deckPath(slug);
  const { blobs } = await list({ prefix: path, token });
  const blob = blobs.find((b) => b.pathname === path);
  if (!blob) return null;
  return fetchDeck(blob.downloadUrl, token);
}

export async function putDeck(deck: Deck): Promise<Deck> {
  const token = getToken();
  const toWrite: Deck = { ...deck, updatedAt: new Date().toISOString() };
  await put(deckPath(deck.slug), JSON.stringify(toWrite), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    // Deck docs are mutable; never serve a stale deck after an edit.
    cacheControlMaxAge: 0,
    token,
  });
  return toWrite;
}

export async function listDecks(): Promise<Deck[]> {
  const token = getToken();
  const { blobs } = await list({ prefix: 'decks/', token });
  const decks: Deck[] = [];
  for (const blob of blobs) {
    if (!blob.pathname.endsWith('.json')) continue;
    const deck = await fetchDeck(blob.downloadUrl, token);
    if (deck) decks.push(deck);
  }
  decks.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return decks;
}

export async function deleteDeckMedia(slug: string): Promise<void> {
  const token = getToken();
  const { blobs } = await list({ prefix: `deck-media/${slug}/`, token });
  await Promise.all(blobs.map((b) => del(b.url, { token })));
}

export async function deleteDeck(slug: string): Promise<void> {
  const token = getToken();
  const path = deckPath(slug);
  const { blobs } = await list({ prefix: path, token });
  const blob = blobs.find((b) => b.pathname === path);
  if (blob) await del(blob.url, { token });
  await deleteDeckMedia(slug);
}

/** Upload an image to public storage and return its public URL. */
export async function putMedia(
  slug: string,
  id: string,
  ext: string,
  data: Buffer,
  contentType: string,
): Promise<string> {
  const token = getToken();
  const { url } = await put(`deck-media/${slug}/${id}.${ext}`, data, {
    access: 'public',
    contentType,
    addRandomSuffix: false,
    token,
  });
  return url;
}
```

> **Note on access:** the deck JSON is written with `access: 'private'` (matching `lib/store.ts` for links) — it holds internal metrics and is only ever read server-side via `fetchDeck`, which authenticates with the token. Only uploaded **media** (`putMedia`) is `public`, because the browser loads those `<img>` URLs directly.

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors in `lib/deck-store.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/deck-store.ts
git commit -m "feat(go): add deck blob store"
```

---

### Task 6: Deck collection + item API routes

**Files:**
- Create: `app/api/decks/route.ts`
- Create: `app/api/decks/[slug]/route.ts`

- [ ] **Step 1: Implement `app/api/decks/route.ts` (create + list)**

```ts
import { NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/auth';
import { getDeck, putDeck, listDecks } from '@/lib/deck-store';
import { normalizeSlug, isValidSlug, generateSlug } from '@/lib/links';
import type { Deck } from '@/lib/decks';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const decks = await listDecks();
    // Summaries only — omit slide bodies from the list view.
    const summaries = decks.map((d) => ({
      slug: d.slug,
      title: d.title,
      theme: d.theme,
      slideCount: d.slides.length,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));
    return NextResponse.json({ decks: summaries });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Storage error' },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { title?: string; slug?: string; theme?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const title = body?.title?.trim();
  if (!title) {
    return NextResponse.json({ error: 'A title is required' }, { status: 400 });
  }

  try {
    let slug: string;
    if (body.slug && body.slug.trim()) {
      slug = normalizeSlug(body.slug);
      if (!isValidSlug(slug)) {
        return NextResponse.json(
          { error: 'Slug must be 1-40 chars (a-z, 0-9, dashes) and not reserved' },
          { status: 400 },
        );
      }
      if (await getDeck(slug)) {
        return NextResponse.json({ error: 'That slug is already taken' }, { status: 409 });
      }
    } else {
      slug = generateSlug();
      for (let i = 0; i < 5 && (await getDeck(slug)); i++) slug = generateSlug();
    }

    const now = new Date().toISOString();
    const deck: Deck = {
      slug,
      title,
      theme: body.theme?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
      slides: [],
    };
    const saved = await putDeck(deck);
    const viewUrl = new URL(`/d/${slug}`, request.url).toString();
    return NextResponse.json({ ok: true, slug, viewUrl, deck: saved }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Storage error' },
      { status: 503 },
    );
  }
}
```

- [ ] **Step 2: Implement `app/api/decks/[slug]/route.ts` (get + patch + delete)**

```ts
import { NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/auth';
import { getDeck, putDeck, deleteDeck } from '@/lib/deck-store';
import { normalizeSlug } from '@/lib/links';
import { applyDeckOp, DeckError, type DeckOp } from '@/lib/decks';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { slug } = await params;
  try {
    const deck = await getDeck(normalizeSlug(slug));
    if (!deck) return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
    return NextResponse.json({ deck });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Storage error' },
      { status: 503 },
    );
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { slug } = await params;

  let op: DeckOp;
  try {
    op = (await request.json()) as DeckOp;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const deck = await getDeck(normalizeSlug(slug));
    if (!deck) return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
    const updated = applyDeckOp(deck, op);
    const saved = await putDeck(updated);
    return NextResponse.json({ ok: true, deck: saved });
  } catch (e) {
    if (e instanceof DeckError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Storage error' },
      { status: 503 },
    );
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { slug } = await params;
  try {
    await deleteDeck(normalizeSlug(slug));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Storage error' },
      { status: 503 },
    );
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/decks/route.ts "app/api/decks/[slug]/route.ts"
git commit -m "feat(go): add deck create/list/get/patch/delete API"
```

---

### Task 7: Slide-append and media-upload API routes

**Files:**
- Create: `app/api/decks/[slug]/slides/route.ts`
- Create: `app/api/decks/[slug]/media/route.ts`

- [ ] **Step 1: Implement `app/api/decks/[slug]/slides/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/auth';
import { getDeck, putDeck } from '@/lib/deck-store';
import { normalizeSlug } from '@/lib/links';
import { addSlide, DeckError } from '@/lib/decks';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { slug } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const deck = await getDeck(normalizeSlug(slug));
    if (!deck) return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
    const updated = addSlide(deck, body);
    const saved = await putDeck(updated);
    const slide = saved.slides[saved.slides.length - 1];
    return NextResponse.json({ ok: true, slide, deck: saved }, { status: 201 });
  } catch (e) {
    if (e instanceof DeckError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Storage error' },
      { status: 503 },
    );
  }
}
```

- [ ] **Step 2: Implement `app/api/decks/[slug]/media/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/auth';
import { getDeck, putDeck, putMedia } from '@/lib/deck-store';
import { normalizeSlug, generateSlug } from '@/lib/links';
import { addSlide, MEDIA_MIME_EXT, MAX_MEDIA_BYTES } from '@/lib/decks';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { slug: raw } = await params;
  const slug = normalizeSlug(raw);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'A file field is required' }, { status: 400 });
  }
  const ext = MEDIA_MIME_EXT[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: `Unsupported image type: ${file.type || 'unknown'}` },
      { status: 400 },
    );
  }
  if (file.size > MAX_MEDIA_BYTES) {
    return NextResponse.json({ error: 'Image exceeds the 10 MB limit' }, { status: 400 });
  }

  try {
    const deck = await getDeck(slug);
    if (!deck) return NextResponse.json({ error: 'Deck not found' }, { status: 404 });

    const id = generateSlug(8);
    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await putMedia(slug, id, ext, buffer, file.type);

    const caption = (form.get('caption') as string | null)?.trim() || undefined;
    const updated = addSlide(deck, { type: 'image', url, caption });
    const saved = await putDeck(updated);
    const slide = saved.slides[saved.slides.length - 1];
    return NextResponse.json({ ok: true, url, slide, deck: saved }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Storage error' },
      { status: 503 },
    );
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/api/decks/[slug]/slides/route.ts" "app/api/decks/[slug]/media/route.ts"
git commit -m "feat(go): add slide-append and media-upload API"
```

---

### Task 8: Public deck viewer (`/d/[slug]`)

**Files:**
- Create: `app/d/[slug]/page.tsx`
- Create: `app/d/[slug]/DeckView.tsx`

- [ ] **Step 1: Implement the server page `app/d/[slug]/page.tsx`**

```tsx
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getDeck } from '@/lib/deck-store';
import { buildSections } from '@/lib/render-slides';
import { normalizeSlug } from '@/lib/links';
import DeckView from './DeckView';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const deck = await getDeck(normalizeSlug(slug));
    if (deck) return { title: deck.title };
  } catch {
    // fall through to default
  }
  return { title: 'Deck' };
}

export default async function DeckPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let deck = null;
  try {
    deck = await getDeck(normalizeSlug(slug));
  } catch {
    deck = null;
  }
  if (!deck) notFound();

  const sections = buildSections(deck);
  return <DeckView sections={sections} />;
}
```

- [ ] **Step 2: Implement the client component `app/d/[slug]/DeckView.tsx`**

```tsx
'use client';

import { useEffect, useRef } from 'react';
import type { Section } from '@/lib/render-slides';

import 'reveal.js/dist/reveal.css';
import 'reveal.js/dist/theme/black.css';
import 'reveal.js/plugin/highlight/monokai.css';

function sectionInnerHtml(section: Section): string {
  const notes = section.notes ? `<aside class="notes">${section.notes}</aside>` : '';
  return section.html + notes;
}

export default function DeckView({ sections }: { sections: Section[] }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let deck: { destroy?: () => void } | undefined;
    let destroyed = false;

    (async () => {
      const Reveal = (await import('reveal.js')).default as unknown as new (
        el: HTMLElement,
        config: Record<string, unknown>,
      ) => { initialize: () => Promise<void>; destroy?: () => void };
      const Notes = (await import('reveal.js/plugin/notes/notes.esm.js')).default;
      const Highlight = (await import('reveal.js/plugin/highlight/highlight.esm.js')).default;

      if (destroyed || !rootRef.current) return;
      const instance = new Reveal(rootRef.current, {
        hash: true,
        slideNumber: 'c/t',
        plugins: [Notes, Highlight],
      });
      await instance.initialize();
      deck = instance;
    })();

    return () => {
      destroyed = true;
      try {
        deck?.destroy?.();
      } catch {
        // reveal may already be torn down
      }
    };
  }, []);

  return (
    <div className="reveal" ref={rootRef} style={{ position: 'fixed', inset: 0 }}>
      <div className="slides">
        {sections.map((section, i) => (
          <section key={i} dangerouslySetInnerHTML={{ __html: sectionInnerHtml(section) }} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors. (If `reveal.js/plugin/*.esm.js` imports raise a "could not find a declaration file" error, add `// @ts-expect-error untyped reveal.js plugin entrypoint` on the line above each plugin import.)

- [ ] **Step 4: Commit**

```bash
git add "app/d/[slug]/page.tsx" "app/d/[slug]/DeckView.tsx"
git commit -m "feat(go): add public reveal.js deck viewer"
```

---

### Task 9: Decks admin UI

**Files:**
- Create: `app/decks/page.tsx`
- Create: `app/decks/DecksAdminClient.tsx`
- Modify: `app/AdminClient.tsx` (add a link to the decks admin)

- [ ] **Step 1: Implement the server page `app/decks/page.tsx`**

```tsx
import { listDecks } from '@/lib/deck-store';
import type { Deck } from '@/lib/decks';
import DecksAdminClient from './DecksAdminClient';

export const dynamic = 'force-dynamic';

export default async function DecksAdminPage() {
  let decks: Deck[] = [];
  let storageError: string | null = null;
  try {
    decks = await listDecks();
  } catch (e) {
    storageError = e instanceof Error ? e.message : String(e);
  }
  return <DecksAdminClient initialDecks={decks} storageError={storageError} />;
}
```

- [ ] **Step 2: Implement `app/decks/DecksAdminClient.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import type { Deck, Slide, SlideType } from '@/lib/decks';

const GREEN = '#1a3a2a';

export default function DecksAdminClient({
  initialDecks,
  storageError,
}: {
  initialDecks: Deck[];
  storageError: string | null;
}) {
  const [decks, setDecks] = useState<Deck[]>(initialDecks);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function refresh() {
    // Re-fetch each deck in full so the per-deck editors stay in sync.
    const res = await fetch('/api/decks');
    if (!res.ok) return;
    const { decks: summaries } = await res.json();
    const full = await Promise.all(
      (summaries ?? []).map(async (s: { slug: string }) => {
        const r = await fetch(`/api/decks/${encodeURIComponent(s.slug)}`);
        return r.ok ? (await r.json()).deck : null;
      }),
    );
    setDecks(full.filter(Boolean));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/decks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, slug: slug || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong');
        return;
      }
      setTitle('');
      setSlug('');
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function deleteDeck(s: string) {
    if (!confirm(`Delete deck "${s}" and all its slides?`)) return;
    await fetch(`/api/decks/${encodeURIComponent(s)}`, { method: 'DELETE' });
    await refresh();
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f8f7f4',
        fontFamily: '-apple-system, sans-serif',
        color: '#222',
        padding: '32px 16px',
      }}
    >
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>
        <a href="/" style={{ fontSize: '13px', color: GREEN }}>
          ← Short links
        </a>
        <h1 style={{ fontSize: '22px', fontWeight: 600, color: GREEN, margin: '8px 0 4px' }}>
          SFW Decks
        </h1>
        <p style={{ fontSize: '13px', color: '#888', margin: '0 0 24px' }}>
          Create and manage slide decks.
        </p>

        {storageError && (
          <div
            style={{
              background: '#fff4e5',
              border: '1px solid #f0c890',
              borderRadius: '8px',
              padding: '12px 14px',
              fontSize: '13px',
              color: '#8a5a00',
              marginBottom: '20px',
            }}
          >
            Storage isn&apos;t ready yet: {storageError}.
          </div>
        )}

        <form
          onSubmit={handleCreate}
          style={{
            background: '#fff',
            borderRadius: '12px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            padding: '20px',
            marginBottom: '28px',
          }}
        >
          <label style={labelStyle}>Deck title</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Weekly Review — Week 12"
            style={inputStyle}
          />
          <label style={labelStyle}>Custom slug (optional)</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="auto-generated"
            style={inputStyle}
          />
          {error && <p style={{ color: '#e53e3e', fontSize: '13px', margin: '4px 0 0' }}>{error}</p>}
          <button type="submit" disabled={busy} style={{ ...buttonStyle, marginTop: '14px' }}>
            {busy ? 'Creating…' : 'Create deck'}
          </button>
        </form>

        {decks.length === 0 ? (
          <p style={{ fontSize: '14px', color: '#999', textAlign: 'center' }}>No decks yet.</p>
        ) : (
          decks.map((deck) => (
            <DeckEditor key={deck.slug} deck={deck} origin={origin} onChange={refresh} onDelete={deleteDeck} />
          ))
        )}
      </div>
    </div>
  );
}

function DeckEditor({
  deck,
  origin,
  onChange,
  onDelete,
}: {
  deck: Deck;
  origin: string;
  onChange: () => Promise<void>;
  onDelete: (slug: string) => Promise<void>;
}) {
  const [type, setType] = useState<SlideType>('markdown');
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  function bodyFor(): Record<string, unknown> | null {
    if (type === 'markdown') return value.trim() ? { type, content: value, notes: notes || undefined } : null;
    if (type === 'html') return value.trim() ? { type, html: value, notes: notes || undefined } : null;
    return value.trim() ? { type, url: value.trim(), notes: notes || undefined } : null;
  }

  async function addSlide() {
    const body = bodyFor();
    if (!body) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/decks/${encodeURIComponent(deck.slug)}/slides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? 'Failed to add slide');
        return;
      }
      setValue('');
      setNotes('');
      await onChange();
    } finally {
      setBusy(false);
    }
  }

  async function uploadImage(file: File) {
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/decks/${encodeURIComponent(deck.slug)}/media`, {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? 'Upload failed');
        return;
      }
      await onChange();
    } finally {
      setBusy(false);
    }
  }

  async function patch(op: unknown) {
    await fetch(`/api/decks/${encodeURIComponent(deck.slug)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(op),
    });
    await onChange();
  }

  function move(index: number, dir: -1 | 1) {
    const order = deck.slides.map((s) => s.id);
    const j = index + dir;
    if (j < 0 || j >= order.length) return;
    [order[index], order[j]] = [order[j], order[index]];
    return patch({ op: 'reorder', order });
  }

  function describe(s: Slide): string {
    if (s.type === 'markdown') return s.content.split('\n')[0].slice(0, 60);
    if (s.type === 'html') return '<html block>';
    return s.url;
  }

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: '12px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        padding: '18px',
        marginBottom: '18px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: GREEN }}>{deck.title}</div>
          <a
            href={`${origin}/d/${deck.slug}`}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: '12px', color: '#888' }}
          >
            {origin}/d/{deck.slug} · {deck.slides.length} slides
          </a>
        </div>
        <button onClick={() => onDelete(deck.slug)} style={{ ...ghostButton, color: '#e53e3e' }}>
          Delete deck
        </button>
      </div>

      {deck.slides.length > 0 && (
        <div style={{ margin: '12px 0', borderTop: '1px solid #f0efec' }}>
          {deck.slides.map((s, i) => (
            <div
              key={s.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 0',
                borderBottom: '1px solid #f6f5f2',
                fontSize: '13px',
              }}
            >
              <span style={{ color: '#aaa', width: '64px' }}>{s.type}</span>
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  color: '#555',
                }}
                title={describe(s)}
              >
                {describe(s)}
              </span>
              <button onClick={() => move(i, -1)} style={ghostButton}>↑</button>
              <button onClick={() => move(i, 1)} style={ghostButton}>↓</button>
              <button
                onClick={() => patch({ op: 'deleteSlide', id: s.id })}
                style={{ ...ghostButton, color: '#e53e3e' }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginTop: '10px' }}>
        <select value={type} onChange={(e) => setType(e.target.value as SlideType)} style={selectStyle}>
          <option value="markdown">markdown</option>
          <option value="embed">embed (url)</option>
          <option value="html">html</option>
        </select>
        <label style={{ ...ghostButton, cursor: 'pointer' }}>
          Upload image
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadImage(f);
              e.target.value = '';
            }}
          />
        </label>
      </div>

      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={type === 'embed' ? 'https://dashboard.example.com' : type === 'html' ? '<div>…</div>' : '## Markdown heading'}
        rows={type === 'embed' ? 1 : 3}
        style={{ ...inputStyle, marginTop: '8px', fontFamily: 'monospace' }}
      />
      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Speaker notes (optional)"
        style={inputStyle}
      />
      <button onClick={addSlide} disabled={busy} style={buttonStyle}>
        {busy ? 'Working…' : 'Add slide'}
      </button>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: '#666',
  margin: '0 0 4px',
};
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid #ddd',
  borderRadius: '6px',
  fontSize: '14px',
  marginBottom: '12px',
  boxSizing: 'border-box',
};
const selectStyle: React.CSSProperties = {
  padding: '8px 10px',
  border: '1px solid #ddd',
  borderRadius: '6px',
  fontSize: '13px',
};
const buttonStyle: React.CSSProperties = {
  padding: '9px 18px',
  background: GREEN,
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  fontSize: '14px',
  cursor: 'pointer',
  fontWeight: 500,
};
const ghostButton: React.CSSProperties = {
  padding: '6px 10px',
  background: 'transparent',
  border: '1px solid #ddd',
  borderRadius: '6px',
  fontSize: '12px',
  cursor: 'pointer',
  color: '#444',
  whiteSpace: 'nowrap',
};
```

- [ ] **Step 3: Add a link to the decks admin from the links admin**

In `app/AdminClient.tsx`, immediately after the opening `<div style={{ maxWidth: '760px', margin: '0 auto' }}>` (line 99), add:
```tsx
        <a href="/decks" style={{ fontSize: '13px', color: GREEN, float: 'right' }}>
          Decks →
        </a>
```

- [ ] **Step 4: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/decks/page.tsx app/decks/DecksAdminClient.tsx app/AdminClient.tsx
git commit -m "feat(go): add decks admin UI"
```

---

### Task 10: Build, manual smoke test, and finalize

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `pnpm test`
Expected: PASS — all `lib/*.test.ts` green.

- [ ] **Step 2: Production build**

Run: `pnpm build`
Expected: build succeeds with the new routes listed: `/d/[slug]`, `/decks`, `/api/decks`, `/api/decks/[slug]`, `/api/decks/[slug]/slides`, `/api/decks/[slug]/media`.

- [ ] **Step 3: Manual smoke test (requires Blob token in `.env.local`)**

Start the dev server (`pnpm dev`) in a separate terminal, then with the admin password set, exercise the API. Replace `TOKEN` with `$SHORTENER_API_TOKEN`:
```bash
# create a deck
curl -s -X POST localhost:3000/api/decks -H "Authorization: Bearer TOKEN" \
  -H 'Content-Type: application/json' -d '{"title":"Smoke Deck","slug":"smoke"}'
# append a markdown slide
curl -s -X POST localhost:3000/api/decks/smoke/slides -H "Authorization: Bearer TOKEN" \
  -H 'Content-Type: application/json' -d '{"type":"markdown","content":"## Hello\n- one\n- two","notes":"hi"}'
# append a live-embed slide
curl -s -X POST localhost:3000/api/decks/smoke/slides -H "Authorization: Bearer TOKEN" \
  -H 'Content-Type: application/json' -d '{"type":"embed","url":"https://example.com"}'
# upload an image (any local png)
curl -s -X POST localhost:3000/api/decks/smoke/media -H "Authorization: Bearer TOKEN" \
  -F file=@some-image.png -F caption=Chart
```
Then open `http://localhost:3000/d/smoke`:
- Confirm slides render in order (markdown → embed → image), arrow keys navigate, and `c/t` slide numbers show.
- Press `S` — speaker-notes window opens and shows "hi" on slide 1.
- Confirm the embed slide loads example.com in an iframe and the image slide shows the caption.
- Open `/decks`, reorder a slide with ↑/↓, reload `/d/smoke`, confirm the order changed instantly (no stale cache).
- Clean up: delete the smoke deck from `/decks`.

- [ ] **Step 4: Push**

```bash
cd ../../ && ./pushall.ps1
```
(Per the monorepo workflow: commit directly to `main` and push both remotes. Vercel auto-deploys and auto-rolls back on build failure.)

---

## Notes for the implementer

- **`isValidUrl`, `generateSlug`, `normalizeSlug`** already exist in `lib/links.ts` — import, don't reimplement.
- **`generateSlug(8)`** produces 8-char ids for slides; the default `generateSlug()` (6 chars) is used for auto deck slugs, matching the links app.
- **Markdown/HTML are injected without sanitization** by design — only trusted (cookie/bearer) editors can author. Do not add a sanitizer unless the trust model changes.
- **Reveal plugin import paths** (`reveal.js/plugin/notes/notes.esm.js`, `.../highlight/highlight.esm.js`, `.../highlight/monokai.css`) are the real package entrypoints for reveal.js v5. If a future version moves them, check `node_modules/reveal.js/plugin/`.
- **Windows note:** bracketed route paths like `app/api/decks/[slug]/route.ts` must be quoted in `git add` under PowerShell/bash to avoid glob expansion.

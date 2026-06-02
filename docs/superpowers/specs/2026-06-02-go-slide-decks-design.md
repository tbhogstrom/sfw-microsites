# go Slide Decks — Design Spec

**Date:** 2026-06-02
**App:** `apps/go` (Next.js 16 URL shortener)
**Status:** Approved design, pending implementation plan

## Goal

Add a **Decks** feature to the existing `go` app so weekly review presentations live
on the web instead of as PowerPoint files. Decks are authored both from a web admin
**and** from the terminal / Jupyter notebooks via an HTTP API, and rendered as a
[reveal.js](https://revealjs.com) slide deck behind a short, shareable link.

### Primary use cases

1. Build a weekly review deck and share `go/d/week12` with the team — viewers need no login.
2. Embed a **live** dashboard or microsite (Crew Board, FieldFlow, etc.) as a slide so it
   can be shown interactively mid-presentation.
3. From a Jupyter notebook, `POST` a freshly generated chart image or a markdown slide
   directly into a deck — "data in → slide out" — without touching the web UI or redeploying.

## Non-goals

- No PowerPoint import / `.pptx` → web conversion. Authoring is web-native going forward.
- No per-deck password gating. Viewing is public-by-unguessable-link (see Trust model).
- No live-during-presentation collaborative editing. "On the fly" means quick to add
  anytime (publish → live instantly), not real-time multi-user.
- No WYSIWYG slide designer. Slides are markdown / image / embed / raw-HTML content.

## Architecture

A new feature module inside `apps/go`, reusing the app's existing Vercel Blob storage and
cookie + bearer-token auth (`lib/auth.ts`).

### Storage (Vercel Blob)

| Blob path                      | Access  | Cache            | Contents                                  |
| ------------------------------ | ------- | ---------------- | ----------------------------------------- |
| `decks/{slug}.json`            | private | `maxAge: 0`      | Deck metadata + ordered slides array      |
| `deck-media/{slug}/{id}.{ext}` | public  | default (immutable) | Uploaded slide images, referenced by URL |

Deck JSON is mutable, so it is written with `cacheControlMaxAge: 0` (same fix already
applied to links in `lib/store.ts`) so edits appear immediately. Uploaded media is
content-addressed by a generated id and never overwritten, so it can use default caching.

### Data model (`lib/decks.ts`)

```ts
export interface Deck {
  slug: string;
  title: string;
  theme?: string;        // reveal.js theme name; default "black"
  createdAt: string;     // ISO
  updatedAt: string;     // ISO
  slides: Slide[];
}

export type Slide =
  | { id: string; type: 'markdown'; content: string; notes?: string }
  | { id: string; type: 'image';    url: string; caption?: string; notes?: string }
  | { id: string; type: 'embed';    url: string; notes?: string }   // live page in <iframe>
  | { id: string; type: 'html';     html: string; notes?: string }; // raw HTML block
```

- `id` — short generated id (reuse `generateSlug`-style helper) for reorder / edit / delete addressing.
- `notes` — optional speaker notes; rendered into reveal's speaker-notes view (carries over
  the per-slide notes already written in the PowerPoint decks).
- `theme` — name of a bundled reveal.js theme; defaults to `"black"`.

### Validation rules (`lib/decks.ts`)

- Deck slug: reuse `isValidSlug` from `lib/links.ts`; **add** `d`, `decks`, `deck-media`
  to `RESERVED_SLUGS` so deck/viewer/media routes can't be shadowed.
- Slide `type` must be one of the four known values.
- `embed.url` and `image.url` must pass `isValidUrl` (http/https only).
- Media upload: enforce an allow-list of image MIME types (`image/png`, `image/jpeg`,
  `image/gif`, `image/webp`, `image/svg+xml`) and a size cap (e.g. 10 MB).

## Routes & API

### Viewer (public, no auth)

- `GET /d/[slug]` — server component reads the deck JSON via the deck store and renders a
  client `DeckView` component. Namespaced under `/d/` so it never collides with the
  shortener's catch-all `/[slug]` route. Missing deck → `notFound()` (404).

### Admin (cookie auth — humans)

A **Decks** section added to the existing admin page (alongside the links UI in
`app/AdminClient.tsx`, or a sibling client component if the file grows too large):

- List decks (title, slug, slide count, updated date) with links to the viewer.
- Create a deck (title + optional custom slug; auto-generate slug if blank).
- Delete a deck.
- Per-deck editor: add a slide (pick type), edit slide content (textarea for
  markdown/html/url, file picker for image), reorder slides (up/down), delete a slide,
  edit deck title/theme. Saves via the API below.

If `AdminClient.tsx` becomes too large hosting both links and decks, split decks into a
focused `DecksAdmin.tsx` client component — a file growing past one clear responsibility is
the signal to split.

### HTTP API (cookie **or** bearer token — `isAuthorized`)

All endpoints accept either the admin cookie (humans) or `Authorization: Bearer
$SHORTENER_API_TOKEN` (terminal / Jupyter / scripts), via the existing `isAuthorized`.

| Method & path                       | Purpose                                                        |
| ----------------------------------- | ------------------------------------------------------------- |
| `POST /api/decks`                   | Create a deck `{ title, slug?, theme? }` → returns the deck   |
| `GET /api/decks`                    | List decks (metadata, no slide bodies)                        |
| `GET /api/decks/[slug]`             | Get a full deck                                               |
| `PATCH /api/decks/[slug]`           | Update title/theme, reorder slides, or edit/delete a slide    |
| `DELETE /api/decks/[slug]`          | Delete a deck (and best-effort its media)                     |
| `POST /api/decks/[slug]/slides`     | Append a slide (markdown / embed / html / image-by-url)       |
| `POST /api/decks/[slug]/media`      | Upload an image (multipart) → store public blob, append image slide, return slide |

`PATCH` semantics: accept a small operation payload — e.g.
`{ op: 'reorder', order: [id, id, ...] }`, `{ op: 'updateSlide', id, patch }`,
`{ op: 'deleteSlide', id }`, `{ op: 'updateDeck', title?, theme? }` — keeping each mutation
explicit and testable rather than diffing whole slide arrays.

### Terminal / Jupyter ergonomics

Push a chart image straight from a notebook:

```python
import requests
BASE, TOKEN = "https://go.example.com", "..."
requests.post(f"{BASE}/api/decks/week12/media",
  headers={"Authorization": f"Bearer {TOKEN}"},
  files={"file": open("chart.png", "rb")},
  data={"caption": "Lead funnel"})
```

Push a markdown slide:

```python
requests.post(f"{BASE}/api/decks/week12/slides",
  headers={"Authorization": f"Bearer {TOKEN}"},
  json={"type": "markdown", "content": "## Results\n- Leads up 20%"})
```

## Rendering (`DeckView`, client component)

`'use client'`. On mount, dynamically import `reveal.js` and its CSS (reveal core +
theme), plus the Markdown, Notes, and Highlight plugins; initialize a single Reveal
instance over the slide DOM.

Slide → DOM mapping (one `<section>` per slide):

- **markdown** — pre-rendered to HTML server-side with `marked`, injected as HTML.
- **image** — `<img src=url>` with optional `<figcaption>` caption.
- **embed** — `<iframe data-src=url>` (reveal lazy-loads `data-src` when the slide is reached).
- **html** — raw HTML injected as-is.
- **notes** — `<aside class="notes">…</aside>` for the speaker view (press `S`).

Reveal's built-in PDF export (`/d/[slug]?print-pdf`) is available for free, giving a path
back to a static handout if needed.

**New dependencies:** `reveal.js`, `marked`.

## Trust model

- **View:** anyone with the link. Slugs are unguessable when auto-generated; custom slugs
  are the author's choice. Images are public blobs.
- **Edit:** cookie (admin) or bearer token only.
- **Injection:** markdown and raw-HTML slides are authored exclusively by trusted editors,
  so content is injected without heavy sanitization — consistent with the public-view /
  trusted-edit split. (If untrusted authoring is ever added, revisit with sanitization.)
- **Embedded auth-protected pages:** an `embed` slide pointing at a login-gated dashboard
  will only render for a viewer already authenticated to *that* app. The deck just frames
  the URL; it does not proxy credentials.

## Error handling

- Missing deck on viewer → `notFound()` / 404.
- Invalid slug / slide type / url → 400 with a clear message from the API.
- Media over size cap or wrong MIME → 400.
- Missing `BLOB_READ_WRITE_TOKEN` → surfaced by the existing store error path.
- Deck JSON always written with `cacheControlMaxAge: 0` so edits never serve stale.

## Testing & verification

`go` is a Next.js app (no `astro check`). Verification steps:

1. Unit tests for `lib/decks.ts` validation (slug reservation, slide-type guards, url
   checks, media MIME/size guards).
2. Typecheck / build: `pnpm build` (or `tsc --noEmit`) passes.
3. Manual smoke test:
   - Create a deck via `POST /api/decks`.
   - Append a markdown slide and an `embed` slide via the API.
   - Upload an image via `POST /api/decks/[slug]/media` (curl/Python).
   - Open `/d/[slug]`: confirm slides render in order, image + caption show, the embed
     iframe loads the live page, and speaker notes appear in the `S` view.
   - Edit a slide in the admin, reload viewer, confirm the change is instant (no stale cache).

## Open implementation notes

- Reuse `generateSlug` for slide ids and auto deck slugs.
- Follow `lib/store.ts` conventions for the deck store (`lib/deck-store.ts`):
  `getDeck`, `putDeck`, `listDecks`, `deleteDeck`, plus media `putMedia` / best-effort
  `deleteDeckMedia`.
- Keep API route handlers thin: parse + auth + validate, delegate to `lib/decks.ts` and
  the deck store.

# URL Shortener (`apps/go`) — Design

**Date:** 2026-05-27
**Status:** Approved, ready for implementation plan

## Purpose

A tiny self-hosted URL shortener for SFW Construction. Two driving uses:

1. **Office TV dashboard** — short, memorable links to internal dashboards/resources.
2. **Marketing** — short branded links for campaigns, mintable by hand or programmatically.

Built to reuse the existing `reports-portal` stack (Next.js 16, Vercel Blob,
cookie auth, Vercel deploy) so there is nothing new to operate.

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Domain | Buy a dedicated short domain (e.g. `.to`/`.co`/`.link`) | A shortener is only worthwhile on a short, memorable domain. |
| Create flow | Login-protected web form **+** bearer-token API | Form for humans, API for marketing automation. |
| Analytics | **None in v1** | YAGNI; addable later without rework. |
| Storage | Vercel Blob, one JSON file per slug | Reuses existing stack, zero new services, no read-modify-write races. |
| App placement | New app `apps/go`, own Vercel project | Keeps it on the dedicated short domain, decoupled from reports-portal. |

## Architecture

New Next.js 16 app `apps/go` in the monorepo. Mirrors `reports-portal`:
`@vercel/blob` for storage, `proxy.ts` (Next 16 middleware) for auth,
`vercel.json` for deploy, its own Vercel project mapped to the short domain.

### Routes

| Route | Access | Behavior |
|---|---|---|
| `GET /[slug]` | public | Look up slug → **307 redirect** to long URL. Unknown slug → 404. |
| `GET /` | password cookie | Admin UI: table of links + create form. Per-row delete and edit-destination. |
| `POST /api/links` | bearer token | Create a link: `{ url, slug?, note? }` → returns `{ slug, shortUrl }`. |
| `PUT /api/links/[slug]` | password cookie or token | Edit destination (overwrite the blob). |
| `DELETE /api/links/[slug]` | password cookie or token | Delete a link. |
| `POST /api/auth` | public | Password login; sets the auth cookie (same pattern as reports-portal). |

307 (temporary) is used rather than 301 so that editing a destination takes
effect immediately and is never permanently cached by browsers.

### Storage model (Vercel Blob)

One file per slug at `links/<slug>.json`:

```json
{
  "slug": "abc123",
  "url": "https://example.com/very/long/path",
  "note": "Spring siding campaign",
  "createdAt": "2026-05-27T00:00:00.000Z"
}
```

A small store helper module wraps Blob with: `getLink(slug)`, `putLink(link)`,
`listLinks()`, `deleteLink(slug)`. One file per slug means creates never
read-modify-write a shared document, so there are no concurrency races.

### Link creation rules

- **URL validation:** must parse as an `http(s)` URL; reject otherwise.
- **Custom slug:** must match `^[a-z0-9-]{1,40}$` and must not be a reserved
  word (`api`, `login`, `_next`, `favicon.ico`). Reject if the slug already
  exists.
- **Auto slug:** when no custom slug is given, generate a 6-character base62
  code (nanoid-style). Regenerate on the rare collision.

### Auth

- **Admin form:** a shared password in its own env var `GO_PASSWORD`, stored in
  an `httpOnly` cookie, enforced by `proxy.ts`. Same mechanism as
  `reports-portal`'s `PORTAL_PASSWORD`.
- **API:** `Authorization: Bearer <SHORTENER_API_TOKEN>` for `POST /api/links`
  and the mutate endpoints.
- **Public paths** (skipped by `proxy.ts`): `/[slug]`, `/api/links`
  (token-guarded internally), `/api/auth`, `/login`, `/_next/*`,
  `/favicon.ico`. Everything else requires the cookie.

### Environment variables

| Var | Purpose |
|---|---|
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob access (as in reports-portal). |
| `GO_PASSWORD` | Admin form password. |
| `SHORTENER_API_TOKEN` | Bearer token for the create/mutate API. |

## Error Handling

- Unknown slug on redirect → 404 page.
- Invalid URL or malformed/reserved/taken slug → 400 with a clear message
  (shown inline in the form, returned as JSON from the API).
- Missing/invalid bearer token on the API → 401.
- Missing/invalid cookie on protected pages → redirect to `/login`.

## Testing

- **Slug + URL validation** unit tests: valid/invalid URLs, reserved slugs,
  bad characters, length bounds, collision regeneration.
- **Store helper** tests against Blob (or a mock): put → get → list → delete
  round-trip.
- **Redirect route**: known slug 307s to the right URL; unknown slug 404s.
- **API**: create with/without custom slug; rejects bad token, bad URL,
  duplicate slug.

## Out of Scope (v1)

- Click analytics / tracking (counts, referrer, geo).
- QR code generation.
- Multi-user accounts or per-user link ownership.

All three are addable later without changing the storage model or routes.

## Build Order

1. Scaffold `apps/go` (Next 16, Tailwind, `proxy.ts`, `vercel.json`) mirroring reports-portal.
2. Blob store helper + slug/URL validation (with tests).
3. `GET /[slug]` redirect route.
4. `POST /api/links` + mutate endpoints + `POST /api/auth`.
5. Admin UI (`/` list + create form, delete, edit-destination) and `/login`.
6. Buy the short domain and connect it to the Vercel project; set env vars.

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

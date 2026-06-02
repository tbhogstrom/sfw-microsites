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

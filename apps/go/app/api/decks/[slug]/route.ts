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

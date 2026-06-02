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
  let deck;
  try {
    deck = await getDeck(normalizeSlug(slug));
  } catch {
    deck = null;
  }
  if (!deck) notFound();

  const sections = buildSections(deck);
  return <DeckView sections={sections} />;
}

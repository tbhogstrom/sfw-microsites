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

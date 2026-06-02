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
  // Best-effort: attempt every media deletion even if some fail.
  const results = await Promise.allSettled(blobs.map((b) => del(b.url, { token })));
  const failed = results.filter((r) => r.status === 'rejected').length;
  if (failed) {
    console.error(`deleteDeckMedia: ${failed}/${blobs.length} blobs not deleted for slug=${slug}`);
  }
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

/** Best-effort delete of a single media blob by URL — used to roll back an orphaned upload. */
export async function deleteMediaByUrl(url: string): Promise<void> {
  const token = getToken();
  await del(url, { token });
}

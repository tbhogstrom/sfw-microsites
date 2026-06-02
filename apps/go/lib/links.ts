export interface Link {
  slug: string;
  url: string;
  note?: string;
  createdAt: string;
}

// Slugs that would collide with real routes or look broken.
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

const SLUG_RE = /^[a-z0-9-]{1,40}$/;

// Lowercase + trim so lookups and custom slugs are consistent.
export function normalizeSlug(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug) && !RESERVED_SLUGS.has(slug);
}

export function isValidUrl(input: string): boolean {
  try {
    const u = new URL(input);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// Lowercase base36 keeps generated slugs case-insensitive-friendly in URLs.
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function generateSlug(length = 6): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

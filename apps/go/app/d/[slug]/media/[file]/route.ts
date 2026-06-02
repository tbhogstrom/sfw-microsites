import { getMedia } from '@/lib/deck-store';
import { normalizeSlug } from '@/lib/links';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; file: string }> },
) {
  const { slug, file } = await params;
  const normalizedSlug = normalizeSlug(slug);
  // Both segments are interpolated into the blob path; constrain them to the
  // exact shapes putMedia produces so nothing can escape the deck-media prefix.
  if (!/^[a-z0-9-]{1,40}$/.test(normalizedSlug) || !/^[a-z0-9-]+\.[a-z0-9]+$/.test(file)) {
    return new Response('Not found', { status: 404 });
  }
  let media: { body: ArrayBuffer; contentType: string } | null;
  try {
    media = await getMedia(normalizedSlug, file);
  } catch {
    return new Response('Service unavailable', { status: 503 });
  }
  if (!media) return new Response('Not found', { status: 404 });
  return new Response(media.body, {
    headers: {
      'Content-Type': media.contentType,
      // Content is addressed by a generated id and never overwritten → immutable.
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

import { getMedia } from '@/lib/deck-store';
import { normalizeSlug } from '@/lib/links';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; file: string }> },
) {
  const { slug, file } = await params;
  // Guard against path traversal / unexpected names: only <id>.<ext>.
  if (!/^[a-z0-9-]+\.[a-z0-9]+$/i.test(file)) {
    return new Response('Not found', { status: 404 });
  }
  const media = await getMedia(normalizeSlug(slug), file);
  if (!media) return new Response('Not found', { status: 404 });
  return new Response(media.body, {
    headers: {
      'Content-Type': media.contentType,
      // Content is addressed by a generated id and never overwritten → immutable.
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

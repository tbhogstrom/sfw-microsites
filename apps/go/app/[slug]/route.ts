import { NextResponse } from 'next/server';
import { getLink } from '@/lib/store';
import { normalizeSlug } from '@/lib/links';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const normalized = normalizeSlug(decodeURIComponent(slug));

  let link;
  try {
    link = await getLink(normalized);
  } catch {
    return new NextResponse('Short-link storage is not configured yet.', { status: 503 });
  }

  if (!link) {
    return new NextResponse('Short link not found.', { status: 404 });
  }

  // 307 (temporary) so edits to a destination take effect immediately and are
  // never permanently cached by browsers.
  return NextResponse.redirect(link.url, 307);
}

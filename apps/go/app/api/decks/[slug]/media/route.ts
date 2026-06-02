import { NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/auth';
import { getDeck, putDeck, putMedia } from '@/lib/deck-store';
import { normalizeSlug, generateSlug } from '@/lib/links';
import { addSlide, MEDIA_MIME_EXT, MAX_MEDIA_BYTES } from '@/lib/decks';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { slug: raw } = await params;
  const slug = normalizeSlug(raw);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'A file field is required' }, { status: 400 });
  }
  const ext = MEDIA_MIME_EXT[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: `Unsupported image type: ${file.type || 'unknown'}` },
      { status: 400 },
    );
  }
  if (file.size > MAX_MEDIA_BYTES) {
    return NextResponse.json({ error: 'Image exceeds the 10 MB limit' }, { status: 400 });
  }

  try {
    const deck = await getDeck(slug);
    if (!deck) return NextResponse.json({ error: 'Deck not found' }, { status: 404 });

    const id = generateSlug(8);
    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await putMedia(slug, id, ext, buffer, file.type);

    const caption = (form.get('caption') as string | null)?.trim() || undefined;
    const updated = addSlide(deck, { type: 'image', url, caption });
    const saved = await putDeck(updated);
    const slide = saved.slides[saved.slides.length - 1];
    return NextResponse.json({ ok: true, url, slide, deck: saved }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Storage error' },
      { status: 503 },
    );
  }
}

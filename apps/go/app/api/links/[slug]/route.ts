import { NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/auth';
import { getLink, putLink, deleteLink } from '@/lib/store';
import { normalizeSlug, isValidUrl } from '@/lib/links';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slug: raw } = await params;
  const slug = normalizeSlug(raw);

  let body: { url?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { url, note } = body ?? {};
  if (url !== undefined && !isValidUrl(url)) {
    return NextResponse.json({ error: 'A valid http(s) URL is required' }, { status: 400 });
  }

  try {
    const existing = await getLink(slug);
    if (!existing) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }
    const updated = {
      ...existing,
      url: url ?? existing.url,
      note: note !== undefined ? note.trim() || undefined : existing.note,
    };
    await putLink(updated);
    return NextResponse.json({ ok: true, link: updated });
  } catch (e) {
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
  const { slug: raw } = await params;
  try {
    await deleteLink(normalizeSlug(raw));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Storage error' },
      { status: 503 },
    );
  }
}

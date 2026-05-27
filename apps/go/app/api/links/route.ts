import { NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/auth';
import { getLink, putLink, listLinks } from '@/lib/store';
import { normalizeSlug, isValidSlug, isValidUrl, generateSlug, type Link } from '@/lib/links';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const links = await listLinks();
    return NextResponse.json({ links });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Storage error' },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { url?: string; slug?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { url, slug: rawSlug, note } = body ?? {};

  if (!url || !isValidUrl(url)) {
    return NextResponse.json({ error: 'A valid http(s) URL is required' }, { status: 400 });
  }

  let slug: string;
  try {
    if (rawSlug && rawSlug.trim()) {
      slug = normalizeSlug(rawSlug);
      if (!isValidSlug(slug)) {
        return NextResponse.json(
          { error: 'Slug must be 1-40 chars (a-z, 0-9, dashes) and not reserved' },
          { status: 400 },
        );
      }
      if (await getLink(slug)) {
        return NextResponse.json({ error: 'That slug is already taken' }, { status: 409 });
      }
    } else {
      slug = generateSlug();
      for (let i = 0; i < 5 && (await getLink(slug)); i++) {
        slug = generateSlug();
      }
    }

    const link: Link = {
      slug,
      url,
      note: note?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    await putLink(link);

    const shortUrl = new URL(`/${slug}`, request.url).toString();
    return NextResponse.json({ ok: true, slug, shortUrl, link }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Storage error' },
      { status: 503 },
    );
  }
}

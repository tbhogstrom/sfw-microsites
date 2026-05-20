import { NextResponse } from 'next/server';
import { findImageBlob, loadProject, saveImage, saveProject } from '@/lib/storage';

type Ctx = { params: Promise<{ id: string }> };

const MAX_BYTES = 25 * 1024 * 1024;
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const found = await findImageBlob(id);
  if (!found) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const res = await fetch(found.downloadUrl, {
    cache: 'no-store',
    headers: BLOB_TOKEN ? { Authorization: `Bearer ${BLOB_TOKEN}` } : undefined,
  });
  if (!res.ok) return NextResponse.json({ error: 'fetch_failed' }, { status: 502 });
  return new Response(res.body, {
    status: 200,
    headers: {
      'content-type': found.contentType,
      'cache-control': 'private, max-age=300',
    },
  });
}

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  const project = await loadProject(id);
  if (!project) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const contentType = req.headers.get('content-type') ?? '';
  if (contentType !== 'image/jpeg' && contentType !== 'image/png') {
    return NextResponse.json({ error: 'unsupported_content_type' }, { status: 415 });
  }
  const widthPx = Number(req.headers.get('x-image-width') ?? '0');
  const heightPx = Number(req.headers.get('x-image-height') ?? '0');
  if (!Number.isFinite(widthPx) || widthPx <= 0 || !Number.isFinite(heightPx) || heightPx <= 0) {
    return NextResponse.json({ error: 'missing_dimensions' }, { status: 400 });
  }

  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: 'too_large' }, { status: 413 });
  }
  const url = await saveImage(id, buf, contentType);

  const next = {
    ...project,
    image: { blobUrl: url, widthPx, heightPx },
    updatedAt: new Date().toISOString(),
  };
  await saveProject(next);
  return NextResponse.json({ image: next.image });
}

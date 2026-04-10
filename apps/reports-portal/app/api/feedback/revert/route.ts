import { NextResponse } from 'next/server';
import { del, list } from '@vercel/blob';

export async function POST(request: Request) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'BLOB_READ_WRITE_TOKEN not configured' }, { status: 503 });
  }

  const { date, projectId } = await request.json();
  if (!date || !projectId) {
    return NextResponse.json({ error: 'date and projectId are required' }, { status: 400 });
  }

  const prefix = `daily/${date}/${projectId}`;
  const { blobs } = await list({ prefix, token });

  const toDelete = blobs.filter(
    (b) => b.pathname === `${prefix}.revised.html` || b.pathname === `${prefix}.feedback.json`,
  );

  for (const blob of toDelete) {
    await del(blob.url, { token });
  }

  return NextResponse.json({ ok: true });
}

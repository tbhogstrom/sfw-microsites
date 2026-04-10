import { NextResponse } from 'next/server';
import { list, put } from '@vercel/blob';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  if (!date) {
    return NextResponse.json({ error: 'date required' }, { status: 400 });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'Storage not configured' }, { status: 503 });
  }

  const path = `notes/daily/${date}.json`;
  const { blobs } = await list({ prefix: path, token });
  const blob = blobs.find((b) => b.pathname === path);

  if (!blob) {
    return NextResponse.json({ notes: '' });
  }

  const resp = await fetch(blob.downloadUrl, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) {
    return NextResponse.json({ notes: '' });
  }

  const data = await resp.json();
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'Storage not configured' }, { status: 503 });
  }

  const { date, notes } = await request.json();
  if (!date) {
    return NextResponse.json({ error: 'date required' }, { status: 400 });
  }

  const path = `notes/daily/${date}.json`;
  await put(path, JSON.stringify({ notes, updated_at: new Date().toISOString() }), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    token,
  });

  return NextResponse.json({ ok: true });
}

import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';

export async function POST(request: Request) {
  // Verify ingest key
  const auth = request.headers.get('Authorization');
  const expectedKey = process.env.PORTAL_INGEST_KEY;
  if (!auth || auth !== `Bearer ${expectedKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { type, date, week_start, reports } = body;

  if (!reports || !Array.isArray(reports) || reports.length === 0) {
    return NextResponse.json({ error: 'No reports provided' }, { status: 400 });
  }

  const dateKey = type === 'weekly' ? week_start : date;
  if (!dateKey) {
    return NextResponse.json({ error: 'date or week_start required' }, { status: 400 });
  }

  const prefix = type === 'weekly' ? 'weekly' : 'daily';
  let published = 0;

  // Upload each report HTML
  for (const report of reports) {
    const path = `${prefix}/${dateKey}/${report.project_id}.html`;
    await put(path, report.html, {
      access: 'public',
      contentType: 'text/html',
      addRandomSuffix: false,
    });
    published++;
  }

  // Update manifest
  const manifest = {
    type,
    date: dateKey,
    published_at: new Date().toISOString(),
    reports: reports.map(
      (r: { project_id: string; project_name: string; project_address: string }) => ({
        project_id: r.project_id,
        project_name: r.project_name,
        project_address: r.project_address,
      }),
    ),
  };
  await put(`${prefix}/${dateKey}/manifest.json`, JSON.stringify(manifest), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
  });

  return NextResponse.json({ ok: true, published });
}

import { NextResponse } from 'next/server';
import { list, put } from '@vercel/blob';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request: Request) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'BLOB_READ_WRITE_TOKEN not configured' }, { status: 503 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 });
  }

  const { date, projectId, feedback } = await request.json();
  if (!date || !projectId || !feedback) {
    return NextResponse.json(
      { error: 'date, projectId, and feedback are required' },
      { status: 400 },
    );
  }

  // Fetch the current report HTML (revised if exists, otherwise original)
  const prefix = `daily/${date}/${projectId}`;
  const { blobs } = await list({ prefix, token });

  const revisedBlob = blobs.find((b) => b.pathname === `${prefix}.revised.html`);
  const originalBlob = blobs.find((b) => b.pathname === `${prefix}.html`);
  const sourceBlob = revisedBlob || originalBlob;

  if (!sourceBlob) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  const resp = await fetch(sourceBlob.downloadUrl, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    return NextResponse.json({ error: 'Failed to fetch report' }, { status: 500 });
  }
  const reportHtml = await resp.text();

  // Call Claude to apply the feedback
  const anthropic = new Anthropic({ apiKey });
  let revisedHtml: string;
  try {
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 16000,
      messages: [
        {
          role: 'user',
          content: `You are editing a construction field report. Apply the following feedback to the report HTML below. Only change what the feedback asks for. Preserve all HTML structure, styling, and formatting. Return only the revised HTML with no other text.

Feedback: ${feedback}

Report HTML:
${reportHtml}`,
        },
      ],
    });
    const textBlock = message.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'Claude returned no text' }, { status: 500 });
    }
    revisedHtml = textBlock.text;
  } catch (e) {
    return NextResponse.json(
      { error: `Claude API error: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }

  // Store revised HTML
  await put(`${prefix}.revised.html`, revisedHtml, {
    access: 'private',
    contentType: 'text/html',
    addRandomSuffix: false,
    allowOverwrite: true,
    token,
  });

  // Store feedback metadata
  await put(
    `${prefix}.feedback.json`,
    JSON.stringify({ feedback, applied_at: new Date().toISOString() }),
    {
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
      token,
    },
  );

  return NextResponse.json({ ok: true, html: revisedHtml });
}

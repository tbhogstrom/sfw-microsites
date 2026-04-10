import { NextResponse } from 'next/server';
import { list, put } from '@vercel/blob';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 120;

// Strip base64 data URIs (images, fonts) before sending to Claude, restore after.
// These can be 100s of KB each and Claude doesn't need them to edit text.
function stripDataUris(html: string): { stripped: string; replacements: Map<string, string> } {
  const replacements = new Map<string, string>();
  let counter = 0;
  const stripped = html.replace(/data:[^;]+;base64,[A-Za-z0-9+/=]+/g, (match) => {
    const placeholder = `__DATA_URI_${counter++}__`;
    replacements.set(placeholder, match);
    return placeholder;
  });
  return { stripped, replacements };
}

function restoreDataUris(html: string, replacements: Map<string, string>): string {
  let result = html;
  for (const [placeholder, original] of replacements) {
    result = result.replace(placeholder, original);
  }
  return result;
}

export async function POST(request: Request) {
  try {
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
      return NextResponse.json(
        {
          error: 'Report not found',
          detail: `No blob matching ${prefix}.html among ${blobs.length} blobs: ${blobs.map((b) => b.pathname).join(', ')}`,
        },
        { status: 404 },
      );
    }

    const resp = await fetch(sourceBlob.downloadUrl, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch report', detail: `${resp.status} ${resp.statusText}` },
        { status: 500 },
      );
    }
    const reportHtml = await resp.text();

    // Strip base64 data URIs to reduce token count dramatically
    const { stripped, replacements } = stripDataUris(reportHtml);

    // Call Claude to apply the feedback
    const anthropic = new Anthropic({ apiKey });
    let revisedStripped: string;
    try {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        system:
          'You edit construction field reports. Apply the requested changes to the HTML. Only change what the feedback asks for. Preserve all HTML structure, styling, and formatting. Placeholders like __DATA_URI_0__ represent images — leave them exactly as-is. Return ONLY the revised HTML, nothing else.',
        messages: [
          {
            role: 'user',
            content: `Feedback: ${feedback}\n\nReport HTML:\n${stripped}`,
          },
        ],
      });
      const textBlock = message.content.find((b) => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        return NextResponse.json(
          { error: 'Claude returned no text', detail: JSON.stringify(message.content) },
          { status: 500 },
        );
      }
      revisedStripped = textBlock.text;
    } catch (e) {
      return NextResponse.json(
        { error: `Claude API error: ${e instanceof Error ? e.message : String(e)}` },
        { status: 500 },
      );
    }

    // Restore base64 data URIs in the revised HTML
    const revisedHtml = restoreDataUris(revisedStripped, replacements);

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
  } catch (e) {
    return NextResponse.json(
      { error: `Unhandled error: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }
}

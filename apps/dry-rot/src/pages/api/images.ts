import type { APIRoute } from 'astro';
import { list, del } from '@vercel/blob';

export const GET: APIRoute = async ({ url }) => {
  try {
    const blobToken = import.meta.env.BLOB_READ_WRITE_TOKEN;

    if (!blobToken) {
      return new Response(
        JSON.stringify({ error: 'Blob storage not configured' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const folder = url.searchParams.get('folder') || undefined;
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const cursor = url.searchParams.get('cursor') || undefined;

    const result = await list({
      prefix: folder,
      limit,
      cursor,
      token: blobToken,
    });

    return new Response(
      JSON.stringify({
        blobs: result.blobs.map(blob => ({
          url: blob.url,
          pathname: blob.pathname,
          size: blob.size,
          uploadedAt: blob.uploadedAt,
        })),
        cursor: result.cursor,
        hasMore: result.hasMore,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('List images error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to list images',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  try {
    const blobToken = import.meta.env.BLOB_READ_WRITE_TOKEN;

    if (!blobToken) {
      return new Response(
        JSON.stringify({ error: 'Blob storage not configured' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { url } = await request.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'No URL provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    await del(url, { token: blobToken });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Delete image error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to delete image',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

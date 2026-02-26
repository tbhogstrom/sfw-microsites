import type { APIRoute } from 'astro';
import { put } from '@vercel/blob';
import { v4 as uuidv4 } from 'uuid';

export const prerender = false;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'heic', 'heif'];

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;
    const folder = formData.get('folder') as string || 'images';

    // Validate image exists
    if (!imageFile) {
      return new Response(
        JSON.stringify({ error: 'No image provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate file type
    const fileExtension = imageFile.name.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_TYPES.includes(imageFile.type) && !ALLOWED_EXTENSIONS.includes(fileExtension)) {
      return new Response(
        JSON.stringify({ error: 'Invalid file type. Please upload a JPEG, PNG, or HEIC image.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate file size
    if (imageFile.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ error: 'File size exceeds 10MB limit' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if Vercel Blob token is configured
    const blobToken = import.meta.env.BLOB_READ_WRITE_TOKEN;

    if (!blobToken) {
      // Development fallback - convert to base64
      const arrayBuffer = await imageFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString('base64');
      const dataUrl = `data:${imageFile.type};base64,${base64}`;

      return new Response(
        JSON.stringify({
          url: dataUrl,
          size: imageFile.size,
          contentType: imageFile.type,
          development: true
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Production upload to Vercel Blob
    const uploadId = uuidv4();
    const extension = fileExtension || 'jpg';
    const pathname = `${folder}/${uploadId}.${extension}`;

    const blob = await put(pathname, imageFile, {
      access: 'public',
      contentType: imageFile.type,
      token: blobToken,
    });

    return new Response(
      JSON.stringify({
        url: blob.url,
        pathname: blob.pathname,
        size: blob.size,
        contentType: blob.contentType,
        uploadedAt: blob.uploadedAt,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Upload error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to upload image',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

import { list, put } from '@vercel/blob';
import { TraceProjectSchema, type TraceProject } from './types';

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

function projectKey(id: string): string {
  return `projects/${id}.json`;
}

function imageKey(id: string, ext: 'jpg' | 'png'): string {
  return `images/${id}.${ext}`;
}

export async function saveProject(project: TraceProject): Promise<void> {
  TraceProjectSchema.parse(project);
  await put(projectKey(project.id), JSON.stringify(project), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    token: BLOB_TOKEN,
  });
}

export async function loadProject(id: string): Promise<TraceProject | null> {
  const key = projectKey(id);
  const { blobs } = await list({ prefix: key, token: BLOB_TOKEN });
  const blob = blobs.find((b) => b.pathname === key);
  if (!blob) return null;
  const res = await fetch(blob.downloadUrl, {
    cache: 'no-store',
    headers: BLOB_TOKEN ? { Authorization: `Bearer ${BLOB_TOKEN}` } : undefined,
  });
  if (!res.ok) return null;
  const json = await res.json();
  return TraceProjectSchema.parse(json);
}

export async function saveImage(
  id: string,
  body: Buffer,
  contentType: 'image/jpeg' | 'image/png',
): Promise<string> {
  const ext = contentType === 'image/jpeg' ? 'jpg' : 'png';
  const result = await put(imageKey(id, ext), body, {
    access: 'public',
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
    token: BLOB_TOKEN,
  });
  return result.url;
}

/**
 * Find the stored image's blob (private). Returns the downloadable URL we
 * can fetch from a server route with the BLOB_READ_WRITE_TOKEN.
 */
export async function findImageBlob(
  id: string,
): Promise<{ downloadUrl: string; contentType: string } | null> {
  for (const ext of ['jpg', 'png'] as const) {
    const key = imageKey(id, ext);
    const { blobs } = await list({ prefix: key, token: BLOB_TOKEN });
    const blob = blobs.find((b) => b.pathname === key);
    if (blob) {
      return {
        downloadUrl: blob.downloadUrl,
        contentType: ext === 'jpg' ? 'image/jpeg' : 'image/png',
      };
    }
  }
  return null;
}

import { list, put, del } from '@vercel/blob';
import type { Link } from './links';

function getToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN not configured');
  return token;
}

function pathFor(slug: string): string {
  return `links/${slug}.json`;
}

async function fetchBlob(downloadUrl: string, token: string): Promise<Link | null> {
  const resp = await fetch(downloadUrl, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) return null;
  return (await resp.json()) as Link;
}

export async function getLink(slug: string): Promise<Link | null> {
  const token = getToken();
  const path = pathFor(slug);
  const { blobs } = await list({ prefix: path, token });
  const blob = blobs.find((b) => b.pathname === path);
  if (!blob) return null;
  return fetchBlob(blob.downloadUrl, token);
}

export async function putLink(link: Link): Promise<void> {
  const token = getToken();
  await put(pathFor(link.slug), JSON.stringify(link), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    token,
  });
}

export async function listLinks(): Promise<Link[]> {
  const token = getToken();
  const { blobs } = await list({ prefix: 'links/', token });
  const links: Link[] = [];
  for (const blob of blobs) {
    if (!blob.pathname.endsWith('.json')) continue;
    const link = await fetchBlob(blob.downloadUrl, token);
    if (link) links.push(link);
  }
  // Newest first.
  links.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return links;
}

export async function deleteLink(slug: string): Promise<void> {
  const token = getToken();
  const path = pathFor(slug);
  const { blobs } = await list({ prefix: path, token });
  const blob = blobs.find((b) => b.pathname === path);
  if (blob) await del(blob.url, { token });
}

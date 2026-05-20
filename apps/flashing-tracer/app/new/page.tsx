import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function NewProjectPage() {
  const hdrs = await headers();
  const host = hdrs.get('host');
  const proto = hdrs.get('x-forwarded-proto') ?? 'http';
  const base = `${proto}://${host}`;
  const res = await fetch(`${base}/api/projects`, { method: 'POST', cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to create project: ${res.status}`);
  }
  const { id } = (await res.json()) as { id: string };
  redirect(`/p/${id}`);
}

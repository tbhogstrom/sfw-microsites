import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export default async function NewProjectPage() {
  const h = await headers();
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('host');
  const res = await fetch(`${proto}://${host}/api/projects`, { method: 'POST', cache: 'no-store' });
  if (!res.ok) throw new Error(`could not create project: ${res.status}`);
  const { id } = await res.json();
  redirect(`/calc/p/${id}`);
}

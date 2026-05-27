import { listLinks } from '@/lib/store';
import type { Link } from '@/lib/links';
import AdminClient from './AdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  let links: Link[] = [];
  let storageError: string | null = null;

  try {
    links = await listLinks();
  } catch (e) {
    storageError = e instanceof Error ? e.message : String(e);
  }

  return <AdminClient initialLinks={links} storageError={storageError} />;
}

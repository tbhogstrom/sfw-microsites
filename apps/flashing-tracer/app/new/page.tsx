import { redirect } from 'next/navigation';
import { blankProject } from '@/lib/blank';
import { saveProject } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export default async function NewProjectPage() {
  const project = blankProject();
  await saveProject(project);
  redirect(`/p/${project.id}`);
}

import { notFound } from 'next/navigation';
import { loadProject } from '@/lib/storage';
import { Editor } from './Editor';

type Props = { params: Promise<{ id: string }> };

export const dynamic = 'force-dynamic';

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;
  const project = await loadProject(id);
  if (!project) notFound();
  return <Editor initial={project} />;
}

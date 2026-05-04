import { notFound } from 'next/navigation';
import { loadProject } from '@/lib/storage';
import { Calculator } from './Calculator';

export default async function CalcPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await loadProject(id);
  if (!project) notFound();
  return <Calculator initial={project} />;
}

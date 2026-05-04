import { notFound } from 'next/navigation';
import { loadProject } from '@/lib/storage';
import { computeMaterialsList } from '@/lib/materials';
import { renderScopeBullets } from '@/lib/pdf/scope-templates';
import { wallSqFt, netSidingSqFt, trimLinFt } from '@/lib/geometry';
import { PRESET_LABELS } from '@/lib/presets';

export default async function ScopePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await loadProject(id);
  if (!project) notFound();
  const lines = computeMaterialsList(project);
  const bullets = renderScopeBullets(project);

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">Siding Project Scope</h1>
      <p className="mt-1 text-sm text-slate-500">
        Project {project.id} · {PRESET_LABELS[project.scope.presetId]}
      </p>
      <h2 className="mt-6 text-lg font-semibold">Wall summary</h2>
      <p>
        Wall {wallSqFt(project.wall).toFixed(0)} sq ft · Net siding{' '}
        {netSidingSqFt(project.wall, project.openings).toFixed(0)} sq ft · Trim{' '}
        {trimLinFt(project.wall, project.openings).toFixed(0)} lin ft
      </p>
      <h2 className="mt-6 text-lg font-semibold">Materials</h2>
      <ul>
        {lines.map((l) => (
          <li key={l.phase + l.material.id}>
            {l.phase}: {l.material.name} — {l.qty} {l.unit}
          </li>
        ))}
      </ul>
      <h2 className="mt-6 text-lg font-semibold">Scope of work</h2>
      <ul className="list-disc pl-5">
        {bullets.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>
    </main>
  );
}

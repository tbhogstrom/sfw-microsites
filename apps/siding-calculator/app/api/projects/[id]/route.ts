import { NextResponse } from 'next/server';
import { loadProject, saveProject } from '@/lib/storage';
import { ProjectSchema } from '@/lib/types';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const project = await loadProject(id);
  if (!project) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(project);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json();
  const parsed = ProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid', issues: parsed.error.issues }, { status: 400 });
  }
  if (parsed.data.id !== id) {
    return NextResponse.json({ error: 'id_mismatch' }, { status: 400 });
  }

  const existing = await loadProject(id);
  if (
    existing &&
    req.headers.get('if-match-updated-at') &&
    existing.updatedAt !== req.headers.get('if-match-updated-at')
  ) {
    return NextResponse.json(
      { error: 'stale', currentUpdatedAt: existing.updatedAt },
      { status: 409 },
    );
  }

  const next = { ...parsed.data, updatedAt: new Date().toISOString() };
  await saveProject(next);
  return NextResponse.json(next);
}

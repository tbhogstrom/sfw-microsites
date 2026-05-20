import { NextResponse } from 'next/server';
import { loadProject, saveProject } from '@/lib/storage';
import { TraceProjectSchema } from '@/lib/types';

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
  const parsed = TraceProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid', issues: parsed.error.issues }, { status: 400 });
  }
  if (parsed.data.id !== id) {
    return NextResponse.json({ error: 'id_mismatch' }, { status: 400 });
  }
  const next: typeof parsed.data = { ...parsed.data, updatedAt: new Date().toISOString() };
  await saveProject(next);
  return NextResponse.json(next);
}

import { NextResponse } from 'next/server';
import { blankProject } from '@/lib/blank';
import { saveProject } from '@/lib/storage';

export async function POST() {
  const project = blankProject();
  await saveProject(project);
  return NextResponse.json({ id: project.id }, { status: 201 });
}

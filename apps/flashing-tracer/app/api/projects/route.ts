import { NextResponse } from 'next/server';
import { ulid } from 'ulid';
import { saveProject } from '@/lib/storage';
import type { TraceProject } from '@/lib/types';

function blankProject(): TraceProject {
  const now = new Date().toISOString();
  return {
    id: ulid(),
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
    image: null,
    trace: { points: [], inchesPerPixel: null },
    labels: {},
    labelOffsets: {},
    view: 'image',
  };
}

export async function POST() {
  const project = blankProject();
  await saveProject(project);
  return NextResponse.json({ id: project.id }, { status: 201 });
}

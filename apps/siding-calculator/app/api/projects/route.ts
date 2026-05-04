import { NextResponse } from 'next/server';
import { ulid } from 'ulid';
import { saveProject } from '@/lib/storage';
import type { Project } from '@/lib/types';

function blankProject(): Project {
  const now = new Date().toISOString();
  return {
    id: ulid(),
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
    canvas: { widthFt: 30, heightFt: 12, snapInches: 12 },
    wall: { rect: { x: 3, y: 1, widthFt: 24, heightFt: 9 } },
    openings: [],
    scope: {
      presetId: 'siding-only',
      phases: {
        insulation: { enabled: false, materialId: null },
        sheathing: { enabled: false, materialId: null },
        vaporBarrier: { enabled: false, materialId: null },
        siding: { enabled: true, materialId: null },
        trim: { enabled: true, materialId: null },
        paint: { enabled: false, materialId: null },
      },
    },
  };
}

export async function POST() {
  const project = blankProject();
  await saveProject(project);
  return NextResponse.json({ id: project.id }, { status: 201 });
}

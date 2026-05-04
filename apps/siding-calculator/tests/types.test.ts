import { describe, it, expect } from 'vitest';
import { ProjectSchema, OpeningSchema, type Project } from '@/lib/types';

const baseProject: Project = {
  id: '01HXXXXXXXXXXXXXXXXXXXXXX',
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
  schemaVersion: 1,
  canvas: { widthFt: 30, heightFt: 12, snapInches: 12 },
  wall: { rect: { x: 0, y: 0, widthFt: 24, heightFt: 9 } },
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

describe('ProjectSchema', () => {
  it('accepts a valid project', () => {
    expect(ProjectSchema.parse(baseProject)).toEqual(baseProject);
  });

  it('rejects negative wall dimensions', () => {
    const bad = { ...baseProject, wall: { rect: { x: 0, y: 0, widthFt: -1, heightFt: 9 } } };
    expect(() => ProjectSchema.parse(bad)).toThrow();
  });

  it('rejects unknown phase', () => {
    const bad: any = {
      ...baseProject,
      scope: { ...baseProject.scope, phases: { ...baseProject.scope.phases, foo: {} } },
    };
    expect(() => ProjectSchema.parse(bad)).toThrow();
  });

  it('OpeningSchema requires positive dimensions', () => {
    expect(() =>
      OpeningSchema.parse({
        id: 'o1',
        type: 'window',
        x: 0,
        y: 0,
        widthFt: 0,
        heightFt: 1,
      }),
    ).toThrow();
  });
});

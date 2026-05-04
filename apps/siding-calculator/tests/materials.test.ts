import { describe, it, expect } from 'vitest';
import { computeMaterialsList, enabledPhasesMissingMaterial } from '@/lib/materials';
import type { Project } from '@/lib/types';

const baseProject: Project = {
  id: 'p1',
  createdAt: 't',
  updatedAt: 't',
  schemaVersion: 1,
  canvas: { widthFt: 30, heightFt: 12, snapInches: 12 },
  wall: { rect: { x: 0, y: 0, widthFt: 24, heightFt: 9 } }, // 216 sqft
  openings: [
    { id: 'd1', type: 'door', x: 10, y: 0, widthFt: 3, heightFt: 7 }, // 21 sqft
  ],
  scope: {
    presetId: 'reside-with-wrb',
    phases: {
      insulation: { enabled: false, materialId: null },
      sheathing: { enabled: false, materialId: null },
      vaporBarrier: { enabled: true, materialId: 'wrb-tyvek-drainwrap' },
      siding: { enabled: true, materialId: 'sid-hardieplank-625' },
      trim: { enabled: true, materialId: 'trim-hardietrim-44' },
      paint: { enabled: false, materialId: null },
    },
  },
};

describe('computeMaterialsList', () => {
  it('emits one line per enabled phase with a material', () => {
    const lines = computeMaterialsList(baseProject);
    expect(lines.map((l) => l.phase).sort()).toEqual(['siding', 'trim', 'vaporBarrier']);
  });

  it('siding qty applies waste factor and ceils', () => {
    const lines = computeMaterialsList(baseProject);
    const siding = lines.find((l) => l.phase === 'siding')!;
    // net = 216 - 21 = 195; waste 10% → 214.5; coverage 1 → ceil → 215
    expect(siding.qty).toBe(215);
    expect(siding.unit).toBe('sqft');
  });

  it('trim qty uses linear-ft target', () => {
    const lines = computeMaterialsList(baseProject);
    const trim = lines.find((l) => l.phase === 'trim')!;
    // corners 2*9=18, fascia 24, water-table 24, door perimeter 2*(3+7)=20 → 86
    // waste 10% → 94.6 → ceil → 95
    expect(trim.qty).toBe(95);
    expect(trim.unit).toBe('linft');
  });

  it('skips phases with no materialId even if enabled', () => {
    const proj = {
      ...baseProject,
      scope: {
        ...baseProject.scope,
        phases: { ...baseProject.scope.phases, siding: { enabled: true, materialId: null } },
      },
    };
    const lines = computeMaterialsList(proj);
    expect(lines.find((l) => l.phase === 'siding')).toBeUndefined();
  });

  it('enabledPhasesMissingMaterial flags phases enabled but unmateriald', () => {
    const proj = {
      ...baseProject,
      scope: {
        ...baseProject.scope,
        phases: { ...baseProject.scope.phases, insulation: { enabled: true, materialId: null } },
      },
    };
    expect(enabledPhasesMissingMaterial(proj)).toEqual(['insulation']);
    expect(enabledPhasesMissingMaterial(baseProject)).toEqual([]);
  });
});

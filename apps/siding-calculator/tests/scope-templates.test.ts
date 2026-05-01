import { describe, it, expect } from 'vitest';
import { renderScopeBullets } from '@/lib/pdf/scope-templates';
import type { Project } from '@/lib/types';

const project: Project = {
  id: 'p1',
  createdAt: 't',
  updatedAt: 't',
  schemaVersion: 1,
  canvas: { widthFt: 30, heightFt: 12, snapInches: 12 },
  wall: { rect: { x: 0, y: 0, widthFt: 24, heightFt: 9 } },
  openings: [],
  scope: {
    presetId: 'reside-with-wrb',
    phases: {
      insulation: { enabled: false, materialId: null },
      sheathing: { enabled: false, materialId: null },
      vaporBarrier: { enabled: true, materialId: 'wrb-tyvek-drainwrap' },
      siding: { enabled: true, materialId: 'sid-hardieplank-625' },
      trim: { enabled: true, materialId: 'trim-hardietrim-44' },
    },
  },
};

describe('renderScopeBullets', () => {
  it('produces bullets for the chosen preset, with material names filled in', () => {
    const bullets = renderScopeBullets(project);
    expect(bullets.some((b) => b.includes('Tyvek DrainWrap'))).toBe(true);
    expect(bullets.some((b) => b.includes('HardiePlank'))).toBe(true);
    expect(bullets.some((b) => b.includes('HardieTrim'))).toBe(true);
  });

  it('skips bullets for disabled phases', () => {
    const bullets = renderScopeBullets(project);
    expect(bullets.some((b) => /insulation/i.test(b))).toBe(false);
  });

  it('falls back to "selected material" wording when materialId is missing', () => {
    const bad = {
      ...project,
      scope: {
        ...project.scope,
        phases: {
          ...project.scope.phases,
          siding: { enabled: true, materialId: null },
        },
      },
    };
    const bullets = renderScopeBullets(bad);
    expect(bullets.some((b) => /selected siding/.test(b))).toBe(true);
  });
});

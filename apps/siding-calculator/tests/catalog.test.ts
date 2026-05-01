import { describe, it, expect } from 'vitest';
import { CATALOG, materialsByPhase, getMaterial } from '@/lib/catalog';
import { MaterialSchema, PHASE_KEYS } from '@/lib/types';

describe('CATALOG', () => {
  it('every entry validates against MaterialSchema', () => {
    for (const m of CATALOG) {
      expect(() => MaterialSchema.parse(m)).not.toThrow();
    }
  });

  it('has unique ids', () => {
    const ids = CATALOG.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every phase has at least one material', () => {
    for (const phase of PHASE_KEYS) {
      const matches = CATALOG.filter((m) => m.phase === phase);
      expect(matches.length, `phase ${phase} has no materials`).toBeGreaterThan(0);
    }
  });

  it('materialsByPhase filters correctly', () => {
    expect(materialsByPhase('siding').every((m) => m.phase === 'siding')).toBe(true);
  });

  it('getMaterial returns null for unknown ids', () => {
    expect(getMaterial('nope')).toBeNull();
  });

  it('getMaterial returns the material for known ids', () => {
    const first = CATALOG[0];
    expect(getMaterial(first.id)?.id).toBe(first.id);
  });
});

import { describe, it, expect } from 'vitest';
import { materialsToCsv } from '@/lib/csv/materials';
import type { MaterialsLine } from '@/lib/materials';
import type { Material } from '@/lib/types';

const sidingMat: Material = {
  id: 'sid-hardieplank-625',
  phase: 'siding',
  brand: 'James Hardie',
  name: 'HardiePlank Lap Siding (6.25" exposure)',
  unit: 'sqft',
  coveragePerUnit: 1,
  wastePct: 0.1,
};

describe('materialsToCsv', () => {
  it('emits header + one row per line', () => {
    const lines: MaterialsLine[] = [
      {
        phase: 'siding',
        material: sidingMat,
        requiredAmount: 195,
        qty: 215,
        unit: 'sqft',
        coverageNote: '1 sq ft per unit · waste +10%',
      },
    ];
    const out = materialsToCsv(lines);
    const rows = out.trim().split('\n');
    expect(rows.length).toBe(2);
    expect(rows[0]).toBe('Phase,Brand,Material,Quantity,Unit,Required (pre-waste),Coverage notes');
    expect(rows[1]).toContain('siding');
    expect(rows[1]).toContain('215');
  });

  it('quotes values containing commas or quotes', () => {
    const lines: MaterialsLine[] = [
      {
        phase: 'siding',
        material: { ...sidingMat, name: 'Plank, "lap" 6.25"' },
        requiredAmount: 1,
        qty: 1,
        unit: 'sqft',
        coverageNote: 'a, b',
      },
    ];
    const out = materialsToCsv(lines);
    expect(out).toContain('"Plank, ""lap"" 6.25"""');
  });

  it('emits header-only when given empty list', () => {
    const out = materialsToCsv([]);
    expect(out.trim().split('\n').length).toBe(1);
  });
});

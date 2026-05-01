import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { buildMaterialsWorkbook } from '@/lib/excel/materials-workbook';
import type { MaterialsLine } from '@/lib/materials';
import type { Project, Material } from '@/lib/types';

const sidingMat: Material = {
  id: 'sid-hardieplank-625',
  phase: 'siding',
  brand: 'James Hardie',
  name: 'HardiePlank Lap Siding (6.25" exposure)',
  unit: 'sqft',
  coveragePerUnit: 1,
  wastePct: 0.1,
};
const project: Project = {
  id: 'p1',
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
      siding: { enabled: true, materialId: 'sid-hardieplank-625' },
      trim: { enabled: false, materialId: null },
    },
  },
};
const lines: MaterialsLine[] = [
  {
    phase: 'siding',
    material: sidingMat,
    requiredAmount: 216,
    qty: 238,
    unit: 'sqft',
    coverageNote: '1 sq ft per unit · waste +10%',
  },
];

describe('buildMaterialsWorkbook', () => {
  it('returns a buffer that ExcelJS can read back', async () => {
    const buf = await buildMaterialsWorkbook(project, lines);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const ws = wb.getWorksheet('Materials');
    expect(ws).toBeDefined();
    expect(ws!.getCell('A1').value).toBe('Phase');
    expect(ws!.getCell('D2').value).toBe(238);
  });

  it('includes a project info sheet', async () => {
    const buf = await buildMaterialsWorkbook(project, lines);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    expect(wb.getWorksheet('Project')).toBeDefined();
  });
});

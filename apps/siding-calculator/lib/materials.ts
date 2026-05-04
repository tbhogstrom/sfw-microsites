import type { Project, PhaseKey, Material } from './types';
import { getMaterial } from './catalog';
import { netSidingSqFt, trimLinFt } from './geometry';
import { PHASE_KEYS } from './types';

export type MaterialsLine = {
  phase: PhaseKey;
  material: Material;
  requiredAmount: number; // sqft (or linft for trim) before waste
  qty: number; // ceil((required * (1+waste)) / coverage)
  unit: Material['unit'];
  coverageNote: string;
};

const UNIT_LABELS: Record<Material['unit'], string> = {
  sqft: 'sq ft',
  linft: 'lin ft',
  sheet: 'sheets',
  roll: 'rolls',
  piece: 'pieces',
  gallon: 'gallons',
};

const UNIT_PER_LABEL: Record<Material['unit'], string> = {
  sqft: 'sq ft',
  linft: 'lin ft',
  sheet: 'sheet',
  roll: 'roll',
  piece: 'piece',
  gallon: 'gallon',
};

const UNIT_DIM: Record<Material['unit'], string> = {
  sqft: 'sq ft',
  linft: 'lin ft',
  sheet: 'sq ft',
  roll: 'sq ft',
  piece: 'unit',
  gallon: 'sq ft',
};

/** Sum net siding area across every elevation in the project. */
export function totalSidingSqFt(project: Project): number {
  return project.elevations.reduce((sum, e) => sum + netSidingSqFt(e.wall, e.openings), 0);
}

/** Sum trim linear feet across every elevation in the project. */
export function totalTrimLinFt(project: Project): number {
  return project.elevations.reduce((sum, e) => sum + trimLinFt(e.wall, e.openings), 0);
}

export function computeMaterialsList(project: Project): MaterialsLine[] {
  const sidingArea = totalSidingSqFt(project);
  const trim = totalTrimLinFt(project);

  const lines: MaterialsLine[] = [];

  for (const phase of PHASE_KEYS) {
    const slot = project.scope.phases[phase];
    if (!slot.enabled || !slot.materialId) continue;
    const material = getMaterial(slot.materialId);
    if (!material) continue;

    // Trim is the only phase measured in linear feet; everything else (paint
    // included) targets the net siding area.
    const required = phase === 'trim' ? trim : sidingArea;
    const withWaste = required * (1 + material.wastePct);
    const qty = Math.ceil(withWaste / material.coveragePerUnit);

    lines.push({
      phase,
      material,
      requiredAmount: required,
      qty,
      unit: material.unit,
      coverageNote: `${material.coveragePerUnit} ${UNIT_DIM[material.unit]} per ${UNIT_PER_LABEL[material.unit]} · waste +${Math.round(material.wastePct * 100)}%`,
    });
  }

  return lines;
}

export function enabledPhasesMissingMaterial(project: Project): PhaseKey[] {
  const out: PhaseKey[] = [];
  for (const phase of PHASE_KEYS) {
    const slot = project.scope.phases[phase];
    if (slot.enabled && !slot.materialId) out.push(phase);
  }
  return out;
}

/** Display label for a unit, used by tables/exports. */
export function unitLabel(unit: Material['unit']): string {
  return UNIT_LABELS[unit];
}

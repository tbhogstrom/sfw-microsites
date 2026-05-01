import type { Project, PhaseKey, Material } from './types';
import { getMaterial } from './catalog';
import { netSidingSqFt, trimLinFt } from './geometry';

export type MaterialsLine = {
  phase: PhaseKey;
  material: Material;
  requiredAmount: number; // sqft (or linft for trim) before waste
  qty: number; // ceil((required * (1+waste)) / coverage)
  unit: Material['unit'];
  coverageNote: string;
};

export function computeMaterialsList(project: Project): MaterialsLine[] {
  const sidingArea = netSidingSqFt(project.wall, project.openings);
  const trim = trimLinFt(project.wall, project.openings);

  const lines: MaterialsLine[] = [];

  for (const phase of ['insulation', 'sheathing', 'vaporBarrier', 'siding', 'trim'] as const) {
    const slot = project.scope.phases[phase];
    if (!slot.enabled || !slot.materialId) continue;
    const material = getMaterial(slot.materialId);
    if (!material) continue;

    const required = phase === 'trim' ? trim : sidingArea;
    const withWaste = required * (1 + material.wastePct);
    const qty = Math.ceil(withWaste / material.coveragePerUnit);

    const unitWord =
      material.unit === 'sheet'
        ? 'sheet'
        : material.unit === 'roll'
          ? 'roll'
          : material.unit === 'piece'
            ? 'piece'
            : 'unit';
    const dimWord = material.unit === 'linft' ? 'lin ft' : 'sq ft';

    lines.push({
      phase,
      material,
      requiredAmount: required,
      qty,
      unit: material.unit,
      coverageNote: `${material.coveragePerUnit} ${dimWord} per ${unitWord} · waste +${Math.round(material.wastePct * 100)}%`,
    });
  }

  return lines;
}

export function enabledPhasesMissingMaterial(project: Project): PhaseKey[] {
  const out: PhaseKey[] = [];
  for (const phase of ['insulation', 'sheathing', 'vaporBarrier', 'siding', 'trim'] as const) {
    const slot = project.scope.phases[phase];
    if (slot.enabled && !slot.materialId) out.push(phase);
  }
  return out;
}

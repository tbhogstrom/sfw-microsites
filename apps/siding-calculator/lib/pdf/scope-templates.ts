import type { Project, PhaseKey } from '../types';
import { getMaterial } from '../catalog';
import { totalSidingSqFt, totalTrimLinFt } from '../materials';

function matName(project: Project, phase: PhaseKey): string {
  const id = project.scope.phases[phase].materialId;
  const m = id ? getMaterial(id) : null;
  return m ? m.name : `selected ${phase} material`;
}

export function renderScopeBullets(project: Project): string[] {
  const bullets: string[] = [];
  const phases = project.scope.phases;
  const sidingArea = Math.round(totalSidingSqFt(project));
  const trim = Math.round(totalTrimLinFt(project));

  bullets.push('Remove existing siding to sheathing.');

  if (phases.sheathing.enabled) {
    bullets.push(
      `Inspect and repair sheathing as needed; install ${matName(project, 'sheathing')} where rotted or missing.`,
    );
  }
  if (phases.insulation.enabled) {
    bullets.push(`Install ${matName(project, 'insulation')} in all open stud cavities.`);
  }
  if (phases.vaporBarrier.enabled) {
    bullets.push(
      `Install ${matName(project, 'vaporBarrier')} per manufacturer guide, with all seams taped.`,
    );
  }
  if (phases.siding.enabled) {
    bullets.push(
      `Install ${matName(project, 'siding')} (~${sidingArea} sq ft net) per manufacturer guide.`,
    );
  }
  if (phases.trim.enabled) {
    bullets.push(
      `Install ${matName(project, 'trim')} at corners, fascia, water-table, and all openings (~${trim} lin ft).`,
    );
  }
  if (phases.paint.enabled) {
    const colorNote = phases.paint.colorHex ? ` (${phases.paint.colorHex})` : '';
    bullets.push(
      `Apply ${matName(project, 'paint')}${colorNote} to all siding and trim (~${sidingArea} sq ft).`,
    );
  }

  bullets.push('Caulk and seal all penetrations and trim transitions.');
  bullets.push('Haul away debris and leave the work area broom-clean.');
  return bullets;
}

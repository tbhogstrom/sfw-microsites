import type { Project, PhaseKey } from '../types';
import { getMaterial } from '../catalog';
import { netSidingSqFt, trimLinFt } from '../geometry';

function matName(project: Project, phase: PhaseKey): string {
  const id = project.scope.phases[phase].materialId;
  const m = id ? getMaterial(id) : null;
  return m ? m.name : `selected ${phase} material`;
}

export function renderScopeBullets(project: Project): string[] {
  const bullets: string[] = [];
  const phases = project.scope.phases;
  const sidingArea = Math.round(netSidingSqFt(project.wall, project.openings));
  const trim = Math.round(trimLinFt(project.wall, project.openings));

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

  bullets.push('Caulk and seal all penetrations and trim transitions.');
  bullets.push('Haul away debris and leave the work area broom-clean.');
  return bullets;
}

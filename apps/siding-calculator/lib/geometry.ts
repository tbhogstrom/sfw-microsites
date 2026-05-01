import type { Project, Opening } from './types';

export function wallSqFt(wall: Project['wall']): number {
  const rectArea = wall.rect.widthFt * wall.rect.heightFt;
  const gableArea = wall.gable ? 0.5 * wall.rect.widthFt * wall.gable.peakHeightFt : 0;
  return rectArea + gableArea;
}

export function openingsSqFt(openings: Opening[]): number {
  return openings.reduce((sum, o) => sum + o.widthFt * o.heightFt, 0);
}

export function netSidingSqFt(wall: Project['wall'], openings: Opening[]): number {
  return Math.max(0, wallSqFt(wall) - openingsSqFt(openings));
}

// trimLinFt comes in the next task
export function trimLinFt(_wall: Project['wall'], _openings: Opening[]): number {
  throw new Error('not implemented');
}

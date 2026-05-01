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

export function trimLinFt(wall: Project['wall'], openings: Opening[]): number {
  const W = wall.rect.widthFt;
  const H = wall.rect.heightFt;

  const cornerBoards = 2 * H;
  const waterTable = W;

  let topRun: number;
  if (wall.gable) {
    // Two rake edges instead of a horizontal top fascia.
    const halfW = W / 2;
    const rake = Math.sqrt(halfW * halfW + wall.gable.peakHeightFt * wall.gable.peakHeightFt);
    topRun = 2 * rake;
  } else {
    topRun = W; // top fascia
  }

  const openingPerimeters = openings.reduce((sum, o) => sum + 2 * (o.widthFt + o.heightFt), 0);

  return cornerBoards + waterTable + topRun + openingPerimeters;
}

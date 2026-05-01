import { describe, it, expect } from 'vitest';
import {
  wallSqFt,
  openingsSqFt,
  netSidingSqFt,
  // trimLinFt is implemented in Task 6; forward-declared here for file shape.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  trimLinFt,
} from '@/lib/geometry';
import type { Project, Opening } from '@/lib/types';

const wallNoGable: Project['wall'] = {
  rect: { x: 0, y: 0, widthFt: 24, heightFt: 9 },
};
const wallWithGable: Project['wall'] = {
  rect: { x: 0, y: 0, widthFt: 24, heightFt: 9 },
  gable: { peakHeightFt: 6, peakOffsetFt: 0 },
};
const openings: Opening[] = [
  { id: 'w1', type: 'window', x: 2, y: 3, widthFt: 3, heightFt: 4 },
  { id: 'd1', type: 'door', x: 10, y: 0, widthFt: 3, heightFt: 7 },
];

describe('wallSqFt', () => {
  it('rect-only wall = W * H', () => {
    expect(wallSqFt(wallNoGable)).toBe(216);
  });
  it('with gable adds 0.5 * W * peakHeight', () => {
    expect(wallSqFt(wallWithGable)).toBe(216 + 72);
  });
});

describe('openingsSqFt', () => {
  it('sums all opening areas', () => {
    expect(openingsSqFt(openings)).toBe(3 * 4 + 3 * 7); // 33
  });
  it('returns 0 for empty array', () => {
    expect(openingsSqFt([])).toBe(0);
  });
});

describe('netSidingSqFt', () => {
  it('wall minus openings, never below zero', () => {
    expect(netSidingSqFt(wallNoGable, openings)).toBe(216 - 33);
    expect(
      netSidingSqFt(wallNoGable, [
        { id: 'huge', type: 'window', x: 0, y: 0, widthFt: 100, heightFt: 100 },
      ]),
    ).toBe(0);
  });
});

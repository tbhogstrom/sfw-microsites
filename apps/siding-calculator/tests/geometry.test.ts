import { describe, it, expect } from 'vitest';
import { wallSqFt, openingsSqFt, netSidingSqFt, trimLinFt } from '@/lib/geometry';
import type { Wall, Opening } from '@/lib/types';

const wallNoGable: Wall = {
  rect: { x: 0, y: 0, widthFt: 24, heightFt: 9 },
};
const wallWithGable: Wall = {
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

describe('trimLinFt', () => {
  const wallNoGable: Wall = { rect: { x: 0, y: 0, widthFt: 24, heightFt: 9 } };
  const wallWithGable: Wall = {
    rect: { x: 0, y: 0, widthFt: 24, heightFt: 9 },
    gable: { peakHeightFt: 6, peakOffsetFt: 0 },
  };

  it('rect-only: corners + fascia + water-table + opening perimeters', () => {
    // corners: 2 * 9 = 18
    // fascia (top): 24
    // water-table (bottom): 24
    // openings: window 2*(3+4)=14, door 2*(3+7)=20 → 34
    // total: 18 + 24 + 24 + 34 = 100
    const openings: Opening[] = [
      { id: 'w1', type: 'window', x: 2, y: 3, widthFt: 3, heightFt: 4 },
      { id: 'd1', type: 'door', x: 10, y: 0, widthFt: 3, heightFt: 7 },
    ];
    expect(trimLinFt(wallNoGable, openings)).toBe(100);
  });

  it('with gable: adds two rake hypotenuses, drops top fascia (replaced by rakes)', () => {
    // rake replaces the top fascia. Each rake = sqrt((W/2)^2 + peakHeight^2)
    // half-width 12, peak 6 → hypotenuse = sqrt(180) ≈ 13.4164
    // corners: 2*9 = 18
    // water-table: 24
    // rakes: 2 * sqrt(180) ≈ 26.8328
    // total ≈ 18 + 24 + 26.8328 = 68.8328
    expect(trimLinFt(wallWithGable, [])).toBeCloseTo(18 + 24 + 2 * Math.sqrt(180), 4);
  });

  it('returns > 0 for a tiny wall (defensive)', () => {
    const tiny: Wall = { rect: { x: 0, y: 0, widthFt: 0.0001, heightFt: 0.0001 } };
    expect(trimLinFt(tiny, [])).toBeGreaterThan(0);
  });
});

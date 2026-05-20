import { describe, expect, it } from 'vitest';
import {
  interiorAngleDeg,
  interiorVertices,
  rotateAroundVertex,
  segmentLengthInches,
  segmentLengthPx,
  segments,
  stretchSegmentLength,
} from '@/lib/geometry';
import type { Point } from '@/lib/types';

const p = (id: string, x: number, y: number): Point => ({ id, x, y });

describe('segmentLengthPx', () => {
  it('returns Euclidean distance', () => {
    expect(segmentLengthPx(p('a', 0, 0), p('b', 3, 4))).toBe(5);
  });

  it('returns 0 for coincident points', () => {
    expect(segmentLengthPx(p('a', 7, 7), p('b', 7, 7))).toBe(0);
  });
});

describe('segmentLengthInches', () => {
  it('returns null when no scale is set', () => {
    expect(segmentLengthInches(p('a', 0, 0), p('b', 3, 4), null)).toBeNull();
  });

  it('multiplies pixel distance by inches per pixel', () => {
    expect(segmentLengthInches(p('a', 0, 0), p('b', 10, 0), 0.5)).toBe(5);
  });
});

describe('interiorAngleDeg', () => {
  it('computes 90° on a right angle', () => {
    const a = p('a', 0, 1);
    const v = p('v', 0, 0);
    const c = p('c', 1, 0);
    expect(interiorAngleDeg(a, v, c)).toBeCloseTo(90, 6);
  });

  it('computes 180° when colinear (straight)', () => {
    const a = p('a', -1, 0);
    const v = p('v', 0, 0);
    const c = p('c', 1, 0);
    expect(interiorAngleDeg(a, v, c)).toBeCloseTo(180, 6);
  });

  it('computes 0° when neighbors overlap', () => {
    const a = p('a', 1, 0);
    const v = p('v', 0, 0);
    const c = p('c', 1, 0);
    expect(interiorAngleDeg(a, v, c)).toBeCloseTo(0, 6);
  });

  it('computes 45° on an isoceles right triangle vertex', () => {
    const a = p('a', 1, 0);
    const v = p('v', 0, 0);
    const c = p('c', 1, 1);
    expect(interiorAngleDeg(a, v, c)).toBeCloseTo(45, 6);
  });

  it('returns 0 if a degenerate (zero-length) neighbor is supplied', () => {
    const a = p('a', 0, 0);
    const v = p('v', 0, 0);
    const c = p('c', 1, 0);
    expect(interiorAngleDeg(a, v, c)).toBe(0);
  });
});

describe('segments', () => {
  it('produces N-1 segments from N points', () => {
    const pts = [p('a', 0, 0), p('b', 1, 0), p('c', 1, 1), p('d', 2, 1)];
    expect(segments(pts)).toHaveLength(3);
  });

  it('returns empty for fewer than two points', () => {
    expect(segments([])).toEqual([]);
    expect(segments([p('a', 0, 0)])).toEqual([]);
  });
});

describe('interiorVertices', () => {
  it('excludes the two endpoints', () => {
    const pts = [p('a', 0, 0), p('b', 1, 0), p('c', 2, 1), p('d', 3, 1)];
    const interior = interiorVertices(pts);
    expect(interior).toHaveLength(2);
    expect(interior[0].vertex.id).toBe('b');
    expect(interior[1].vertex.id).toBe('c');
  });

  it('returns empty for two or fewer points', () => {
    expect(interiorVertices([])).toEqual([]);
    expect(interiorVertices([p('a', 0, 0)])).toEqual([]);
    expect(interiorVertices([p('a', 0, 0), p('b', 1, 0)])).toEqual([]);
  });
});

describe('stretchSegmentLength', () => {
  it('resizes a segment along its direction and translates downstream', () => {
    const pts = [p('a', 0, 0), p('b', 10, 0), p('c', 10, 5)];
    const out = stretchSegmentLength(pts, 0, 20);
    expect(out[0]).toEqual(pts[0]);
    expect(out[1].x).toBeCloseTo(20, 6);
    expect(out[1].y).toBeCloseTo(0, 6);
    expect(out[2].x).toBeCloseTo(20, 6);
    expect(out[2].y).toBeCloseTo(5, 6);
  });

  it('preserves downstream segment lengths and angles', () => {
    const pts = [p('a', 0, 0), p('b', 4, 3), p('c', 9, 3), p('d', 9, 8)];
    const before = segments(pts).map((s) => segmentLengthPx(s.a, s.b));
    const out = stretchSegmentLength(pts, 0, 20);
    const after = segments(out).map((s) => segmentLengthPx(s.a, s.b));
    expect(after[0]).toBeCloseTo(20, 6);
    expect(after[1]).toBeCloseTo(before[1], 6);
    expect(after[2]).toBeCloseTo(before[2], 6);
  });

  it('is a no-op for invalid input', () => {
    const pts = [p('a', 0, 0), p('b', 1, 0)];
    expect(stretchSegmentLength(pts, 1, 5)).toBe(pts);
    expect(stretchSegmentLength(pts, -1, 5)).toBe(pts);
    expect(stretchSegmentLength(pts, 0, 0)).toBe(pts);
    expect(stretchSegmentLength(pts, 0, -1)).toBe(pts);
    expect(stretchSegmentLength([p('a', 0, 0), p('b', 0, 0)], 0, 5)).toEqual([
      p('a', 0, 0),
      p('b', 0, 0),
    ]);
  });
});

describe('rotateAroundVertex', () => {
  it('changes the interior angle at the vertex to the target', () => {
    const pts = [p('a', -1, 0), p('v', 0, 0), p('c', 1, 0)];
    // current angle is 180° (colinear). Rotate downstream so angle becomes 90°.
    const out = rotateAroundVertex(pts, 1, 90);
    expect(interiorAngleDeg(out[0], out[1], out[2])).toBeCloseTo(90, 4);
  });

  it('keeps downstream segment lengths', () => {
    const pts = [p('a', 0, 0), p('v', 5, 0), p('c', 5, 4), p('d', 9, 4)];
    const lensBefore = segments(pts).map((s) => segmentLengthPx(s.a, s.b));
    const out = rotateAroundVertex(pts, 1, 60);
    const lensAfter = segments(out).map((s) => segmentLengthPx(s.a, s.b));
    // Segment at vertex 1 onward changes orientation; lengths stay.
    expect(lensAfter[0]).toBeCloseTo(lensBefore[0], 6);
    expect(lensAfter[1]).toBeCloseTo(lensBefore[1], 6);
    expect(lensAfter[2]).toBeCloseTo(lensBefore[2], 6);
  });

  it('is a no-op at endpoints or for out-of-range angles', () => {
    const pts = [p('a', 0, 0), p('b', 1, 0), p('c', 1, 1)];
    expect(rotateAroundVertex(pts, 0, 90)).toBe(pts);
    expect(rotateAroundVertex(pts, 2, 90)).toBe(pts);
    expect(rotateAroundVertex(pts, 1, 0)).toBe(pts);
    expect(rotateAroundVertex(pts, 1, 180)).toBe(pts);
    expect(rotateAroundVertex(pts, 1, Number.NaN)).toBe(pts);
  });

  it('does not flip the downstream side of the angle', () => {
    // L-shape (vertex C above), CW chain a→v→c with v at origin.
    const pts = [p('a', 1, 0), p('v', 0, 0), p('c', 0, 1)];
    // Rotate to a sharper angle (45°). c should still be on the same (upper) side.
    const out = rotateAroundVertex(pts, 1, 45);
    expect(interiorAngleDeg(out[0], out[1], out[2])).toBeCloseTo(45, 4);
    expect(out[2].y).toBeGreaterThan(0);
  });
});

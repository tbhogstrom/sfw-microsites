import type { InteriorVertex, Point, Segment } from './types';

export function segmentLengthPx(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function segmentLengthInches(
  a: Point,
  b: Point,
  inchesPerPixel: number | null,
): number | null {
  if (inchesPerPixel == null) return null;
  return segmentLengthPx(a, b) * inchesPerPixel;
}

export function interiorAngleDeg(prev: Point, vertex: Point, next: Point): number {
  const ax = prev.x - vertex.x;
  const ay = prev.y - vertex.y;
  const bx = next.x - vertex.x;
  const by = next.y - vertex.y;
  const magA = Math.hypot(ax, ay);
  const magB = Math.hypot(bx, by);
  if (magA === 0 || magB === 0) return 0;
  const cos = (ax * bx + ay * by) / (magA * magB);
  const clamped = Math.max(-1, Math.min(1, cos));
  return (Math.acos(clamped) * 180) / Math.PI;
}

export function segments(points: Point[]): Segment[] {
  const out: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    out.push({ a: points[i], b: points[i + 1], index: i });
  }
  return out;
}

export function interiorVertices(points: Point[]): InteriorVertex[] {
  const out: InteriorVertex[] = [];
  for (let i = 1; i < points.length - 1; i++) {
    out.push({ prev: points[i - 1], vertex: points[i], next: points[i + 1], index: i });
  }
  return out;
}

/**
 * Resize the segment that starts at `segmentIndex` so its pixel length becomes
 * `newLengthPx`. The downstream points (from `segmentIndex + 1` onward) are
 * translated rigidly so all downstream lengths and angles are preserved.
 * No-op if `points` is too short, the segment is degenerate, or
 * `newLengthPx <= 0`.
 */
export function stretchSegmentLength(
  points: Point[],
  segmentIndex: number,
  newLengthPx: number,
): Point[] {
  if (segmentIndex < 0 || segmentIndex >= points.length - 1) return points;
  if (!Number.isFinite(newLengthPx) || newLengthPx <= 0) return points;

  const a = points[segmentIndex];
  const b = points[segmentIndex + 1];
  const currentLen = Math.hypot(b.x - a.x, b.y - a.y);
  if (currentLen === 0) return points;

  const ux = (b.x - a.x) / currentLen;
  const uy = (b.y - a.y) / currentLen;
  const bNew = { id: b.id, x: a.x + ux * newLengthPx, y: a.y + uy * newLengthPx };
  const dx = bNew.x - b.x;
  const dy = bNew.y - b.y;

  return points.map((p, i) => {
    if (i < segmentIndex + 1) return p;
    if (i === segmentIndex + 1) return bNew;
    return { ...p, x: p.x + dx, y: p.y + dy };
  });
}

/**
 * Rotate all points downstream of `vertexIndex` (exclusive) around
 * `points[vertexIndex]` so the interior angle at that vertex becomes
 * `newAngleDeg`. The direction of rotation preserves whichever side of
 * `prev→vertex` the downstream chain currently sits on.
 * No-op if `vertexIndex` is not interior or `newAngleDeg` is out of `(0, 180)`.
 */
export function rotateAroundVertex(
  points: Point[],
  vertexIndex: number,
  newAngleDeg: number,
): Point[] {
  if (vertexIndex <= 0 || vertexIndex >= points.length - 1) return points;
  if (!Number.isFinite(newAngleDeg) || newAngleDeg <= 0 || newAngleDeg >= 180) return points;

  const prev = points[vertexIndex - 1];
  const vertex = points[vertexIndex];
  const next = points[vertexIndex + 1];

  const ax = prev.x - vertex.x;
  const ay = prev.y - vertex.y;
  const bx = next.x - vertex.x;
  const by = next.y - vertex.y;
  const magA = Math.hypot(ax, ay);
  const magB = Math.hypot(bx, by);
  if (magA === 0 || magB === 0) return points;

  const cos = (ax * bx + ay * by) / (magA * magB);
  const currentAngleRad = Math.acos(Math.max(-1, Math.min(1, cos)));
  const currentAngleDeg = (currentAngleRad * 180) / Math.PI;
  const deltaDeg = newAngleDeg - currentAngleDeg;
  if (deltaDeg === 0) return points;

  // Cross product sign tells us which side `next` is on relative to `prev`.
  // Rotation direction must shrink/grow the angle without flipping the chain
  // to the other side. With `prev→vertex→next` cross > 0 (next is CCW from
  // prev), making the angle smaller means rotating `next` clockwise toward
  // `prev` — i.e. by `deltaDeg` (negative when shrinking). Inverted when
  // cross < 0.
  const cross = ax * by - ay * bx;
  const signedDeltaRad = (cross >= 0 ? deltaDeg : -deltaDeg) * (Math.PI / 180);
  const cosD = Math.cos(signedDeltaRad);
  const sinD = Math.sin(signedDeltaRad);

  return points.map((p, i) => {
    if (i <= vertexIndex) return p;
    const dx = p.x - vertex.x;
    const dy = p.y - vertex.y;
    return {
      ...p,
      x: vertex.x + dx * cosD - dy * sinD,
      y: vertex.y + dx * sinD + dy * cosD,
    };
  });
}

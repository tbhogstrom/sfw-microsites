'use client';
import React, { useMemo } from 'react';
import {
  interiorAngleDeg,
  interiorVertices,
  segmentLengthInches,
  segmentLengthPx,
  segments,
} from '@/lib/geometry';
import { formatLength } from '@/lib/parse';
import type { LabelOffset, Trace } from '@/lib/types';

type Props = {
  projectId: string;
  trace: Trace;
  labels: Record<string, string>;
  labelOffsets: Record<string, LabelOffset>;
};

export function PrintView({ projectId, trace, labels, labelOffsets }: Props) {
  const segs = useMemo(() => segments(trace.points), [trace.points]);
  const interior = useMemo(() => interiorVertices(trace.points), [trace.points]);

  const bbox = useMemo(() => {
    if (trace.points.length === 0) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of trace.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    // Include label-offset positions so leader lines never push off-page.
    for (const s of segs) {
      const off = labelOffsets[s.a.id];
      if (!off) continue;
      const lx = (s.a.x + s.b.x) / 2 + off.dx;
      const ly = (s.a.y + s.b.y) / 2 + off.dy;
      if (lx < minX) minX = lx;
      if (ly < minY) minY = ly;
      if (lx > maxX) maxX = lx;
      if (ly > maxY) maxY = ly;
    }
    const w = Math.max(1, maxX - minX);
    const h = Math.max(1, maxY - minY);
    const pad = Math.max(w, h) * 0.12;
    return { minX: minX - pad, minY: minY - pad, w: w + pad * 2, h: h + pad * 2 };
  }, [trace.points, segs, labelOffsets]);

  if (!bbox || trace.points.length < 2) {
    return (
      <div className="print-canvas hidden print:block">
        <p className="text-sm text-slate-500">Trace needs at least two points.</p>
      </div>
    );
  }

  // Scale graphical elements proportionally to the viewBox so they look right
  // on the printed page.
  const scale = Math.max(bbox.w, bbox.h) / 800;
  const polyStroke = 2.5 * scale;
  const dimFont = 13 * scale;
  const labelFont = 15 * scale;
  const angleArcR = 36 * scale;
  const leaderStroke = 1 * scale;
  const dotR = 2 * scale;
  const vertexDotR = 3 * scale;
  const liftPx = 10 * scale;

  const polylinePoints = trace.points.map((p) => `${p.x},${p.y}`).join(' ');

  const segmentDimLabel = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const inches = segmentLengthInches({ id: '', ...a }, { id: '', ...b }, trace.inchesPerPixel);
    if (inches == null)
      return `${segmentLengthPx({ id: '', ...a }, { id: '', ...b }).toFixed(0)} px`;
    return formatLength(inches).ftIn;
  };

  return (
    <div className="print-canvas hidden print:block">
      <svg
        viewBox={`${bbox.minX} ${bbox.minY} ${bbox.w} ${bbox.h}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
      >
        <polyline
          points={polylinePoints}
          fill="none"
          stroke="#1c2230"
          strokeWidth={polyStroke}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* angle arcs */}
        {interior.map(({ prev, vertex, next, index }) => {
          const aRad = Math.atan2(prev.y - vertex.y, prev.x - vertex.x);
          const bRad = Math.atan2(next.y - vertex.y, next.x - vertex.x);
          const deg = interiorAngleDeg(prev, vertex, next);
          const midA = (aRad + bRad) / 2;
          const labelDist = angleArcR + 10 * scale;
          const lx = vertex.x + Math.cos(midA) * labelDist;
          const ly = vertex.y + Math.sin(midA) * labelDist;
          return (
            <g key={`angle-${index}`}>
              <path
                d={describeArc(vertex.x, vertex.y, angleArcR, aRad, bRad)}
                fill="none"
                stroke="#94a3b8"
                strokeWidth={1 * scale}
              />
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={dimFont}
                fill="#334155"
              >
                {deg.toFixed(1)}°
              </text>
            </g>
          );
        })}

        {/* vertices */}
        {trace.points.map((p) => (
          <circle key={p.id} cx={p.x} cy={p.y} r={vertexDotR} fill="#1c2230" />
        ))}

        {/* segment dimensions and labels */}
        {segs.map(({ a, b, index }) => {
          const midX = (a.x + b.x) / 2;
          const midY = (a.y + b.y) / 2;
          const off = labelOffsets[a.id] ?? { dx: 0, dy: 0 };
          const hasOffset = off.dx !== 0 || off.dy !== 0;
          const labelX = midX + off.dx;
          const labelY = midY + off.dy - liftPx;
          const userLabel = labels[a.id];
          return (
            <g key={`seg-${index}`}>
              {hasOffset && (
                <>
                  <line
                    x1={midX}
                    y1={midY}
                    x2={labelX}
                    y2={labelY + 0.4 * dimFont}
                    stroke="#64748b"
                    strokeWidth={leaderStroke}
                  />
                  <circle cx={midX} cy={midY} r={dotR} fill="#64748b" />
                </>
              )}
              <text x={labelX} y={labelY} textAnchor="middle" fontSize={dimFont} fill="#1c2230">
                {segmentDimLabel(a, b)}
              </text>
              {userLabel && (
                <text
                  x={labelX}
                  y={labelY - (dimFont + 2 * scale)}
                  textAnchor="middle"
                  fontSize={labelFont}
                  fontWeight={600}
                  fill="#2a4d8f"
                >
                  {userLabel}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="print-meta">
        <div className="text-[10px] text-slate-500">
          Project {projectId} · {segs.length} segment{segs.length === 1 ? '' : 's'} ·{' '}
          {interior.length} angle{interior.length === 1 ? '' : 's'}
        </div>
      </div>
    </div>
  );
}

function describeArc(cx: number, cy: number, r: number, startRad: number, endRad: number): string {
  let diff = endRad - startRad;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  const sweep = diff > 0 ? 1 : 0;
  const x1 = cx + Math.cos(startRad) * r;
  const y1 = cy + Math.sin(startRad) * r;
  const x2 = cx + Math.cos(endRad) * r;
  const y2 = cy + Math.sin(endRad) * r;
  const largeArc = Math.abs(diff) > Math.PI ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} ${sweep} ${x2} ${y2}`;
}

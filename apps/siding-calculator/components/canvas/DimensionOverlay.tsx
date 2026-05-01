'use client';
import React from 'react';
import type { DragRect } from './useDrawingTool';

type Props = {
  draft: DragRect | null;
  pixelsPerFt: number;
  canvasHeightPx: number;
};

export function DimensionOverlay({ draft, pixelsPerFt }: Props) {
  if (!draft) return null;
  const x = draft.x * pixelsPerFt;
  const y = draft.y * pixelsPerFt;
  const w = draft.widthFt * pixelsPerFt;
  const h = draft.heightFt * pixelsPerFt;
  return (
    <g pointerEvents="none">
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill="rgba(42,77,143,0.08)"
        stroke="#2a4d8f"
        strokeDasharray="4 4"
      />
      <g transform={`scale(1,-1) translate(0, ${-(2 * (y + h + 10))})`}>
        <text x={x + w / 2} y={y + h + 10} textAnchor="middle" fontSize={11} fill="#1c2230">
          {draft.widthFt.toFixed(1)}' × {draft.heightFt.toFixed(1)}'
        </text>
      </g>
    </g>
  );
}

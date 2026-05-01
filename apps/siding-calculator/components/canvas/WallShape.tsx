'use client';
import React from 'react';
import type { Project } from '@/lib/types';

type Props = {
  wall: Project['wall'];
  pixelsPerFt: number;
  selected?: boolean;
  onSelect?: () => void;
};

export function WallShape({ wall, pixelsPerFt, selected, onSelect }: Props) {
  const x = wall.rect.x * pixelsPerFt;
  const y = wall.rect.y * pixelsPerFt;
  const w = wall.rect.widthFt * pixelsPerFt;
  const h = wall.rect.heightFt * pixelsPerFt;
  const stroke = selected ? '#2a4d8f' : '#34507a';
  return (
    <g onClick={onSelect}>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill="rgba(42,77,143,0.05)"
        stroke={stroke}
        strokeWidth={selected ? 2 : 1.5}
      />
      {wall.gable &&
        (() => {
          const peakX = x + w / 2 + wall.gable.peakOffsetFt * pixelsPerFt;
          const peakY = y + h + wall.gable.peakHeightFt * pixelsPerFt;
          return (
            <polygon
              points={`${x},${y + h} ${x + w},${y + h} ${peakX},${peakY}`}
              fill="rgba(42,77,143,0.05)"
              stroke={stroke}
              strokeWidth={selected ? 2 : 1.5}
            />
          );
        })()}
    </g>
  );
}

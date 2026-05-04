'use client';
import React from 'react';
import type { Wall } from '@/lib/types';

type Props = {
  wall: Wall;
  pixelsPerFt: number;
  selected?: boolean;
  onSelect?: () => void;
  sidingFill?: string;
  trimColor?: string | null;
};

export function WallShape({ wall, pixelsPerFt, selected, onSelect, sidingFill, trimColor }: Props) {
  const x = wall.rect.x * pixelsPerFt;
  const y = wall.rect.y * pixelsPerFt;
  const w = wall.rect.widthFt * pixelsPerFt;
  const h = wall.rect.heightFt * pixelsPerFt;
  const fill = sidingFill ?? 'rgba(42,77,143,0.05)';
  const stroke = selected ? '#2a4d8f' : (trimColor ?? '#34507a');
  const strokeWidth = selected ? 2.5 : trimColor ? 4 : 1.5;
  return (
    <g onClick={onSelect}>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      {wall.gable &&
        (() => {
          const peakX = x + w / 2 + wall.gable.peakOffsetFt * pixelsPerFt;
          const peakY = y + h + wall.gable.peakHeightFt * pixelsPerFt;
          return (
            <polygon
              points={`${x},${y + h} ${x + w},${y + h} ${peakX},${peakY}`}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
          );
        })()}
    </g>
  );
}

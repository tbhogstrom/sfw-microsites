'use client';
import React from 'react';
import type { Opening as OpeningT, Project } from '@/lib/types';

type Props = {
  opening: OpeningT;
  wall: Project['wall'];
  pixelsPerFt: number;
  selected?: boolean;
  onSelect?: (id: string) => void;
};

export function Opening({ opening, wall, pixelsPerFt, selected, onSelect }: Props) {
  const x = (wall.rect.x + opening.x) * pixelsPerFt;
  const y = (wall.rect.y + opening.y) * pixelsPerFt;
  const w = opening.widthFt * pixelsPerFt;
  const h = opening.heightFt * pixelsPerFt;
  const stroke = selected ? '#2a4d8f' : '#34507a';
  return (
    <g
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(opening.id);
      }}
    >
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill="white"
        stroke={stroke}
        strokeWidth={selected ? 2 : 1}
      />
      <text
        x={x + w / 2}
        y={y + h / 2}
        fontSize={Math.min(w, h) * 0.18}
        textAnchor="middle"
        dominantBaseline="middle"
        transform={`scale(1,-1) translate(0, ${-(2 * (y + h / 2))})`}
        fill="#34507a"
      >
        {opening.type}
      </text>
    </g>
  );
}

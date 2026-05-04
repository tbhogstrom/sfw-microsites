'use client';
import React from 'react';

type SidingPattern = {
  base: string;
  line: string;
  spacingFt: number;
  orientation: 'horizontal' | 'vertical';
  lineWidth?: number;
};

const SIDING_PATTERNS: Record<string, SidingPattern> = {
  'sid-hardieplank-625': {
    base: '#d8dde3',
    line: '#9aa3ae',
    spacingFt: 6.25 / 12,
    orientation: 'horizontal',
    lineWidth: 0.6,
  },
  'sid-hardiepanel': {
    base: '#d8dde3',
    line: '#7d8590',
    spacingFt: 4,
    orientation: 'vertical',
    lineWidth: 1.4,
  },
  'sid-cedar-bevel': {
    base: '#cda47b',
    line: '#7a563a',
    spacingFt: 6 / 12,
    orientation: 'horizontal',
    lineWidth: 0.6,
  },
  'sid-t1-11': {
    base: '#a87f5e',
    line: '#5e4126',
    spacingFt: 8 / 12,
    orientation: 'vertical',
    lineWidth: 1,
  },
  'sid-vinyl-generic': {
    base: '#eef0f3',
    line: '#cdd1d8',
    spacingFt: 4 / 12,
    orientation: 'horizontal',
    lineWidth: 0.5,
  },
};

const TRIM_COLORS: Record<string, string> = {
  'trim-hardietrim-44': '#ffffff',
  'trim-cedar-1x4': '#e8c89a',
  'trim-pvc-1x4': '#fafafa',
};

const DEFAULT_FILL = 'rgba(42,77,143,0.05)';

export function sidingFillFor(materialId: string | null | undefined): string {
  if (materialId && SIDING_PATTERNS[materialId]) {
    return `url(#siding-${materialId})`;
  }
  return DEFAULT_FILL;
}

export function trimColorFor(materialId: string | null | undefined): string | null {
  if (materialId && TRIM_COLORS[materialId]) return TRIM_COLORS[materialId];
  return null;
}

export function FinishDefs({ pixelsPerFt }: { pixelsPerFt: number }) {
  return (
    <defs>
      {Object.entries(SIDING_PATTERNS).map(([id, p]) => {
        const spacingPx = Math.max(2, p.spacingFt * pixelsPerFt);
        const tileW = p.orientation === 'vertical' ? spacingPx : Math.max(40, spacingPx);
        const tileH = p.orientation === 'horizontal' ? spacingPx : Math.max(40, spacingPx);
        return (
          <pattern
            key={id}
            id={`siding-${id}`}
            width={tileW}
            height={tileH}
            patternUnits="userSpaceOnUse"
          >
            <rect width={tileW} height={tileH} fill={p.base} />
            {p.orientation === 'horizontal' ? (
              <line
                x1={0}
                y1={0}
                x2={tileW}
                y2={0}
                stroke={p.line}
                strokeWidth={p.lineWidth ?? 0.5}
              />
            ) : (
              <line
                x1={0}
                y1={0}
                x2={0}
                y2={tileH}
                stroke={p.line}
                strokeWidth={p.lineWidth ?? 0.5}
              />
            )}
          </pattern>
        );
      })}
    </defs>
  );
}

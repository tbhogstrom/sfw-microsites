'use client';
import React from 'react';

type SidingPattern = {
  base: string;
  spacingFt: number;
  orientation: 'horizontal' | 'vertical';
  /** override line color; defaults to a derived darker shade of `base`. */
  line?: string;
  lineWidth?: number;
  /** for horizontal lap, render a soft shadow stripe just below each lap line. */
  shadow?: boolean;
};

const SIDING_PATTERNS: Record<string, SidingPattern> = {
  'sid-hardieplank-625': {
    base: '#dde2e8',
    spacingFt: 6.25 / 12,
    orientation: 'horizontal',
    lineWidth: 0.6,
    shadow: true,
  },
  'sid-hardiepanel': {
    base: '#dde2e8',
    spacingFt: 4,
    orientation: 'vertical',
    lineWidth: 1.4,
  },
  'sid-cedar-bevel': {
    base: '#cda47b',
    spacingFt: 6 / 12,
    orientation: 'horizontal',
    lineWidth: 0.6,
    shadow: true,
  },
  'sid-t1-11': {
    base: '#a87f5e',
    spacingFt: 8 / 12,
    orientation: 'vertical',
    lineWidth: 1,
  },
  'sid-vinyl-generic': {
    base: '#eef0f3',
    spacingFt: 4 / 12,
    orientation: 'horizontal',
    lineWidth: 0.5,
    shadow: true,
  },
};

const DEFAULT_TRIM_COLORS: Record<string, string> = {
  'trim-hardietrim-44': '#fafafa',
  'trim-cedar-1x4': '#e8c89a',
  'trim-pvc-1x4': '#fafafa',
};

const FALLBACK_TRIM = '#fafafa';
const DEFAULT_FILL = 'rgba(42,77,143,0.05)';

/**
 * Darken a hex color by `pct` (0..1). Used to derive lap-line colors from a
 * user-picked siding color so the texture stays visible.
 */
function darken(hex: string, pct: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.max(0, Math.round(((n >> 16) & 0xff) * (1 - pct)));
  const g = Math.max(0, Math.round(((n >> 8) & 0xff) * (1 - pct)));
  const b = Math.max(0, Math.round((n & 0xff) * (1 - pct)));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function patternIdFor(materialId: string, colorHex: string | undefined): string {
  return `siding-${materialId}-${(colorHex ?? 'default').replace('#', '')}`;
}

export function sidingFillFor(materialId: string | null | undefined, colorHex?: string): string {
  if (materialId && SIDING_PATTERNS[materialId]) {
    return `url(#${patternIdFor(materialId, colorHex)})`;
  }
  return DEFAULT_FILL;
}

export function trimColorFor(materialId: string | null | undefined, colorHex?: string): string {
  if (colorHex) return colorHex;
  if (materialId && DEFAULT_TRIM_COLORS[materialId]) return DEFAULT_TRIM_COLORS[materialId];
  return FALLBACK_TRIM;
}

type FinishDefsProps = {
  pixelsPerFt: number;
  /** Active siding material id, if any — used to scope which patterns we emit. */
  sidingMaterialId?: string | null;
  /** Active siding color override, if any. */
  sidingColorHex?: string;
};

export function FinishDefs({ pixelsPerFt, sidingMaterialId, sidingColorHex }: FinishDefsProps) {
  // Emit a pattern for every catalog siding so saved projects render correctly,
  // plus an extra one for the active material with its color override applied.
  const patterns: { id: string; pattern: SidingPattern; color: string | undefined }[] = [];
  for (const [id, p] of Object.entries(SIDING_PATTERNS)) {
    patterns.push({ id, pattern: p, color: undefined });
  }
  if (sidingMaterialId && sidingColorHex && SIDING_PATTERNS[sidingMaterialId]) {
    patterns.push({
      id: sidingMaterialId,
      pattern: SIDING_PATTERNS[sidingMaterialId],
      color: sidingColorHex,
    });
  }

  return (
    <defs>
      {patterns.map(({ id, pattern, color }) => {
        const base = color ?? pattern.base;
        const line = pattern.line ?? darken(base, 0.18);
        const shadow = darken(base, 0.08);
        const spacingPx = Math.max(2, pattern.spacingFt * pixelsPerFt);
        const tileW = pattern.orientation === 'vertical' ? spacingPx : Math.max(40, spacingPx);
        const tileH = pattern.orientation === 'horizontal' ? spacingPx : Math.max(40, spacingPx);
        const lineWidth = pattern.lineWidth ?? 0.5;
        return (
          <pattern
            key={patternIdFor(id, color)}
            id={patternIdFor(id, color)}
            width={tileW}
            height={tileH}
            patternUnits="userSpaceOnUse"
          >
            <rect width={tileW} height={tileH} fill={base} />
            {pattern.orientation === 'horizontal' ? (
              <>
                {pattern.shadow && (
                  <line
                    x1={0}
                    y1={tileH * 0.85}
                    x2={tileW}
                    y2={tileH * 0.85}
                    stroke={shadow}
                    strokeWidth={Math.max(1, lineWidth * 1.6)}
                    opacity={0.6}
                  />
                )}
                <line x1={0} y1={0} x2={tileW} y2={0} stroke={line} strokeWidth={lineWidth} />
              </>
            ) : (
              <line x1={0} y1={0} x2={0} y2={tileH} stroke={line} strokeWidth={lineWidth} />
            )}
          </pattern>
        );
      })}
    </defs>
  );
}

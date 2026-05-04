'use client';
import React from 'react';
import type { PhaseKey, Material } from '@/lib/types';
import { materialsByPhase } from '@/lib/catalog';

type Props = {
  phase: PhaseKey;
  enabled: boolean;
  materialId: string | null;
  colorHex?: string;
  onToggle: (next: boolean) => void;
  onPick: (id: string | null) => void;
  onColorChange?: (hex: string | undefined) => void;
};

const LABELS: Record<PhaseKey, string> = {
  insulation: 'Insulation',
  sheathing: 'Sheathing',
  vaporBarrier: 'Vapor Barrier / WRB',
  siding: 'Siding',
  trim: 'Trim',
  paint: 'Paint / Finish',
};

// Phases where a paint/finish color makes sense to override.
const COLOR_PICKABLE: Record<PhaseKey, boolean> = {
  insulation: false,
  sheathing: false,
  vaporBarrier: false,
  siding: true,
  trim: true,
  paint: true,
};

// Default swatch shown in the picker when no color override is set.
const DEFAULT_SWATCH = '#dde2e8';

export function PhaseRow({
  phase,
  enabled,
  materialId,
  colorHex,
  onToggle,
  onPick,
  onColorChange,
}: Props) {
  const options = materialsByPhase(phase);
  const showColor = COLOR_PICKABLE[phase] && enabled && !!materialId && !!onColorChange;
  return (
    <div className="flex items-center gap-3 border-b border-slate-100 py-2">
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} />
        <span className="w-44 text-sm font-medium">{LABELS[phase]}</span>
      </label>
      <select
        disabled={!enabled}
        value={materialId ?? ''}
        onChange={(e) => onPick(e.target.value || null)}
        className="flex-1 rounded border border-slate-200 px-2 py-1 disabled:bg-slate-50"
      >
        <option value="">— pick a material —</option>
        {options.map((m: Material) => (
          <option key={m.id} value={m.id}>
            {m.brand ? `${m.brand} · ` : ''}
            {m.name}
          </option>
        ))}
      </select>
      {showColor && (
        <div className="flex items-center gap-1">
          <label
            className="relative inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded border border-slate-200"
            title={colorHex ? `Color: ${colorHex}` : 'Pick a color'}
            style={{ background: colorHex ?? DEFAULT_SWATCH }}
          >
            <input
              type="color"
              value={colorHex ?? DEFAULT_SWATCH}
              onChange={(e) => onColorChange?.(e.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label={`${LABELS[phase]} color`}
            />
          </label>
          {colorHex && (
            <button
              type="button"
              onClick={() => onColorChange?.(undefined)}
              className="text-xs text-slate-500 underline"
              title="Reset to material default"
            >
              reset
            </button>
          )}
        </div>
      )}
    </div>
  );
}

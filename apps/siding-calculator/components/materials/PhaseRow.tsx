'use client';
import React from 'react';
import type { PhaseKey, Material } from '@/lib/types';
import { materialsByPhase } from '@/lib/catalog';

type Props = {
  phase: PhaseKey;
  enabled: boolean;
  materialId: string | null;
  onToggle: (next: boolean) => void;
  onPick: (id: string | null) => void;
};

const LABELS: Record<PhaseKey, string> = {
  insulation: 'Insulation',
  sheathing: 'Sheathing',
  vaporBarrier: 'Vapor Barrier / WRB',
  siding: 'Siding',
  trim: 'Trim',
};

export function PhaseRow({ phase, enabled, materialId, onToggle, onPick }: Props) {
  const options = materialsByPhase(phase);
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
    </div>
  );
}

'use client';
import React from 'react';
import type { PresetId } from '@/lib/types';
import { PRESET_LABELS } from '@/lib/presets';

type Props = {
  selected: PresetId;
  onChange: (next: PresetId) => void;
};

const ORDER: PresetId[] = ['siding-only', 'reside-with-wrb', 'full-envelope', 'custom'];

export function PresetPicker({ selected, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {ORDER.map((id) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`rounded-full border px-4 py-1.5 text-sm ${selected === id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white'}`}
        >
          {PRESET_LABELS[id]}
        </button>
      ))}
    </div>
  );
}

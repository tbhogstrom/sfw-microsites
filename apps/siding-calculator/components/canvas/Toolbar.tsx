'use client';
import React from 'react';
import type { DrawTool } from './useDrawingTool';
import type { Project } from '@/lib/types';

type Props = {
  canvas: Project['canvas'];
  onCanvasChange: (next: Project['canvas']) => void;
  tool: DrawTool;
  onToolChange: (t: DrawTool) => void;
};

const TOOLS: { id: DrawTool; label: string }[] = [
  { id: 'wall', label: '▭ Wall' },
  { id: 'gable', label: '△ Gable' },
  { id: 'window', label: '⊞ Window' },
  { id: 'door', label: '⊟ Door' },
  { id: 'garage-door', label: '▢ Garage' },
  { id: 'vent', label: '◇ Vent' },
];

export function Toolbar({ canvas, onCanvasChange, tool, onToolChange }: Props) {
  return (
    <div className="absolute top-4 left-4 flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm text-sm">
      <span className="text-slate-500">Canvas</span>
      <input
        type="number"
        min={5}
        max={120}
        step={1}
        value={canvas.widthFt}
        onChange={(e) => onCanvasChange({ ...canvas, widthFt: Number(e.target.value) })}
        className="w-14 border-b border-slate-300 px-1 text-center"
        aria-label="Canvas width (ft)"
      />
      <span>×</span>
      <input
        type="number"
        min={5}
        max={60}
        step={1}
        value={canvas.heightFt}
        onChange={(e) => onCanvasChange({ ...canvas, heightFt: Number(e.target.value) })}
        className="w-12 border-b border-slate-300 px-1 text-center"
        aria-label="Canvas height (ft)"
      />
      <span className="text-slate-400">ft</span>
      <span className="mx-2 h-4 w-px bg-slate-200" />
      {TOOLS.map((t) => (
        <button
          key={t.id}
          onClick={() => onToolChange(tool === t.id ? null : t.id)}
          className={`rounded-full px-2 py-0.5 ${tool === t.id ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

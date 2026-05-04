'use client';
import React from 'react';
import type { DrawTool } from './useDrawingTool';
import type { Project } from '@/lib/types';

type Props = {
  canvas: Project['canvas'];
  onCanvasChange: (next: Project['canvas']) => void;
  tool: DrawTool;
  onToolChange: (t: DrawTool) => void;
  zoom: number;
  onZoomChange: (next: number) => void;
};

const TOOLS: { id: DrawTool; label: string; tip: string }[] = [
  { id: 'wall', label: '▭ Wall', tip: 'Click and drag on the canvas to draw the wall to scale.' },
  {
    id: 'gable',
    label: '△ Gable',
    tip: 'Click anywhere to add a gable triangle on top of the wall. Edit the peak height in the drawer.',
  },
  {
    id: 'window',
    label: '⊞ Window',
    tip: 'Click and drag inside the wall to place a window. Default 3′×4′ if you click without dragging.',
  },
  {
    id: 'door',
    label: '⊟ Door',
    tip: 'Click and drag inside the wall to place a door. Default 3′×7′.',
  },
  {
    id: 'garage-door',
    label: '▢ Garage',
    tip: 'Click and drag inside the wall to place a garage door. Default 16′×7′.',
  },
  {
    id: 'vent',
    label: '◇ Vent',
    tip: 'Click and drag inside the wall to place a vent. Default 1′×1′.',
  },
];

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 3.0;
const ZOOM_STEP = 0.2;

function clampZoom(z: number): number {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Number(z.toFixed(2))));
}

export function Toolbar({ canvas, onCanvasChange, tool, onToolChange, zoom, onZoomChange }: Props) {
  return (
    <div className="absolute top-4 left-4 flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm text-sm">
      <span
        className="text-slate-500"
        title="Set the working area of the engineering paper, in feet."
      >
        Canvas
      </span>
      <input
        type="number"
        min={5}
        max={120}
        step={1}
        value={canvas.widthFt}
        onChange={(e) => onCanvasChange({ ...canvas, widthFt: Number(e.target.value) })}
        className="w-14 border-b border-slate-300 px-1 text-center"
        aria-label="Canvas width (ft)"
        title="Canvas width in feet"
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
        title="Canvas height in feet"
      />
      <span className="text-slate-400">ft</span>

      <span className="mx-2 h-4 w-px bg-slate-200" />

      {/* Zoom controls */}
      <button
        onClick={() => onZoomChange(clampZoom(zoom - ZOOM_STEP))}
        disabled={zoom <= ZOOM_MIN + 1e-6}
        title="Zoom out"
        aria-label="Zoom out"
        className="rounded-full px-2 py-0.5 hover:bg-slate-100 disabled:opacity-30"
      >
        −
      </button>
      <button
        onClick={() => onZoomChange(1)}
        title={`Zoom: ${Math.round(zoom * 100)}% — click to reset`}
        aria-label="Reset zoom"
        className="min-w-[3.5rem] rounded-full px-2 py-0.5 text-center text-xs hover:bg-slate-100"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        onClick={() => onZoomChange(clampZoom(zoom + ZOOM_STEP))}
        disabled={zoom >= ZOOM_MAX - 1e-6}
        title="Zoom in"
        aria-label="Zoom in"
        className="rounded-full px-2 py-0.5 hover:bg-slate-100 disabled:opacity-30"
      >
        +
      </button>

      <span className="mx-2 h-4 w-px bg-slate-200" />

      {TOOLS.map((t) => (
        <button
          key={t.id}
          onClick={() => onToolChange(tool === t.id ? null : t.id)}
          title={t.tip}
          className={`rounded-full px-2 py-0.5 transition ${
            tool === t.id ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

'use client';
import React from 'react';
import type { ToolMode, ViewMode } from '@/lib/types';

type Props = {
  tool: ToolMode;
  onToolChange: (t: ToolMode) => void;
  onClearPoints: () => void;
  onNewImage: () => void;
  pointCount: number;
  scaleSet: boolean;
  zoom: number;
  onZoomChange: (z: number) => void;
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  saveState: 'idle' | 'saving' | 'error';
  onPrint: () => void;
};

export function Toolbar({
  tool,
  onToolChange,
  onClearPoints,
  onNewImage,
  pointCount,
  scaleSet,
  zoom,
  onZoomChange,
  view,
  onViewChange,
  saveState,
  onPrint,
}: Props) {
  return (
    <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2 shadow-sm">
      <ToolButton active={tool === 'trace'} onClick={() => onToolChange('trace')}>
        Trace
      </ToolButton>
      <ToolButton active={tool === 'select'} onClick={() => onToolChange('select')}>
        Select
      </ToolButton>
      <ToolButton active={tool === 'label'} onClick={() => onToolChange('label')}>
        Label
      </ToolButton>
      <button
        type="button"
        onClick={() => onToolChange('select')}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
        disabled={tool === 'select'}
        title="Switch to select"
      >
        Finish
      </button>
      <Divider />
      <ToolButton active={view === 'image'} onClick={() => onViewChange('image')}>
        Image view
      </ToolButton>
      <ToolButton active={view === 'detail'} onClick={() => onViewChange('detail')}>
        Detail view
      </ToolButton>
      <Divider />
      <button
        type="button"
        onClick={onClearPoints}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
        disabled={pointCount === 0}
      >
        Clear points
      </button>
      <button
        type="button"
        onClick={onNewImage}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
      >
        New image
      </button>
      <button
        type="button"
        onClick={onPrint}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
        title="Open print preview"
      >
        Print
      </button>
      <Divider />
      <div className="flex items-center gap-1 text-sm text-slate-600">
        <button
          type="button"
          onClick={() => onZoomChange(Math.max(0.25, +(zoom - 0.25).toFixed(2)))}
          className="h-7 w-7 rounded border border-slate-300 hover:bg-slate-50"
          aria-label="Zoom out"
        >
          −
        </button>
        <span className="w-14 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          onClick={() => onZoomChange(Math.min(8, +(zoom + 0.25).toFixed(2)))}
          className="h-7 w-7 rounded border border-slate-300 hover:bg-slate-50"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => onZoomChange(1)}
          className="ml-1 rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-50"
        >
          Reset
        </button>
      </div>
      <div className="ml-auto flex items-center gap-3 text-sm text-slate-500">
        <span>
          {pointCount} {pointCount === 1 ? 'point' : 'points'} ·{' '}
          {scaleSet ? <span className="text-emerald-700">scale set</span> : 'no scale yet'}
        </span>
        <SaveIndicator state={saveState} />
      </div>
    </div>
  );
}

function ToolButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm ${
        active
          ? 'bg-[var(--accent)] text-white'
          : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-6 w-px bg-slate-200" />;
}

function SaveIndicator({ state }: { state: 'idle' | 'saving' | 'error' }) {
  if (state === 'saving') return <span className="text-slate-400">Saving…</span>;
  if (state === 'error') return <span className="text-red-600">Save failed</span>;
  return <span className="text-emerald-600">Saved</span>;
}

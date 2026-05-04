'use client';
import React, { useState } from 'react';
import type { Elevation } from '@/lib/types';

type Props = {
  elevations: Elevation[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
};

export function ElevationTabs({
  elevations,
  activeId,
  onSelect,
  onAdd,
  onRemove,
  onRename,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  function startEdit(e: Elevation) {
    setEditingId(e.id);
    setDraftName(e.name);
  }
  function commitEdit() {
    if (editingId && draftName.trim()) {
      onRename(editingId, draftName.trim().slice(0, 40));
    }
    setEditingId(null);
    setDraftName('');
  }

  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-slate-200 bg-white px-4 pb-1 pt-3 text-sm">
      <span className="mr-2 text-xs uppercase tracking-wider text-slate-400">Elevations</span>
      {elevations.map((e) => {
        const isActive = e.id === activeId;
        if (editingId === e.id) {
          return (
            <input
              key={e.id}
              autoFocus
              value={draftName}
              onChange={(ev) => setDraftName(ev.target.value)}
              onBlur={commitEdit}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter') commitEdit();
                if (ev.key === 'Escape') {
                  setEditingId(null);
                  setDraftName('');
                }
              }}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
            />
          );
        }
        return (
          <div
            key={e.id}
            className={`group flex items-center gap-1 rounded-t px-3 py-1 ${
              isActive
                ? 'border border-b-0 border-slate-300 bg-slate-50'
                : 'cursor-pointer text-slate-500 hover:bg-slate-50'
            }`}
          >
            <button
              onClick={() => onSelect(e.id)}
              onDoubleClick={() => startEdit(e)}
              title="Click to switch · double-click to rename"
              className={isActive ? 'font-medium text-slate-900' : ''}
            >
              {e.name}
            </button>
            {elevations.length > 1 && (
              <button
                onClick={() => {
                  if (confirm(`Remove "${e.name}"?`)) onRemove(e.id);
                }}
                title="Remove this elevation"
                className="rounded text-xs text-slate-400 opacity-0 hover:text-red-600 group-hover:opacity-100"
              >
                ×
              </button>
            )}
          </div>
        );
      })}
      <button
        onClick={onAdd}
        title="Add another elevation to this project"
        className="ml-2 rounded-full border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50"
      >
        + Add elevation
      </button>
    </div>
  );
}

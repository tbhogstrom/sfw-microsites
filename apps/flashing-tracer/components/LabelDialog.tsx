'use client';
import React, { useEffect, useRef, useState } from 'react';

type Props = {
  initialValue: string;
  anchorXPx: number;
  anchorYPx: number;
  onCancel: () => void;
  onConfirm: (text: string) => void;
};

export function LabelDialog({ initialValue, anchorXPx, anchorYPx, onCancel, onConfirm }: Props) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div
      className="no-print absolute z-20 -translate-x-1/2 -translate-y-full rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-lg"
      style={{ left: anchorXPx, top: anchorYPx - 8 }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="text-xs font-medium text-slate-600">Label this segment</div>
      <div className="mt-1 flex items-center gap-2">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onConfirm(value);
            if (e.key === 'Escape') onCancel();
          }}
          placeholder="Drip leg, Hem, Counterflashing…"
          className="w-56 rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <button
          type="button"
          onClick={() => onConfirm(value)}
          className="rounded bg-[var(--accent)] px-3 py-1 text-sm text-white"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-slate-300 px-2 py-1 text-sm text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
      <div className="mt-1 text-[10px] text-slate-400">
        Leave blank and press Enter to remove the label.
      </div>
    </div>
  );
}

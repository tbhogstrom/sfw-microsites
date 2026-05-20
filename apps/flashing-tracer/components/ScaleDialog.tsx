'use client';
import React, { useEffect, useRef, useState } from 'react';
import { parseLength } from '@/lib/parse';

type Props = {
  initialValue?: string;
  pixelLength: number;
  onCancel: () => void;
  onConfirm: (inchesPerPixel: number) => void;
  anchorXPx: number;
  anchorYPx: number;
};

export function ScaleDialog({
  initialValue,
  pixelLength,
  onCancel,
  onConfirm,
  anchorXPx,
  anchorYPx,
}: Props) {
  const [value, setValue] = useState(initialValue ?? '');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function submit() {
    if (pixelLength <= 0) {
      setError('Segment is too short to scale from.');
      return;
    }
    const inches = parseLength(value);
    if (inches == null || inches <= 0) {
      setError('Enter a length like 42, 3\'-6", or 42 1/2".');
      return;
    }
    onConfirm(inches / pixelLength);
  }

  return (
    <div
      className="no-print absolute z-20 -translate-x-1/2 -translate-y-full rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-lg"
      style={{ left: anchorXPx, top: anchorYPx - 8 }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="text-xs font-medium text-slate-600">How long is this segment?</div>
      <div className="mt-1 flex items-center gap-2">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.currentTarget.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') onCancel();
          }}
          placeholder={`42 or 3'-6"`}
          className="w-40 rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <button
          type="button"
          onClick={submit}
          className="rounded bg-[var(--accent)] px-3 py-1 text-sm text-white"
        >
          Set
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-slate-300 px-2 py-1 text-sm text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
      {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
    </div>
  );
}

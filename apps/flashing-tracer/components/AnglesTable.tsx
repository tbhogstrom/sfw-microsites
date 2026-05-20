'use client';
import React, { useMemo, useState } from 'react';
import { interiorAngleDeg, interiorVertices } from '@/lib/geometry';
import type { Trace } from '@/lib/types';
import { CopyCsvButton } from './CopyCsvButton';

type Props = {
  trace: Trace;
  onEditAngle: (vertexIndex: number, newAngleDeg: number) => void;
};

export function AnglesTable({ trace, onEditAngle }: Props) {
  const interior = useMemo(() => interiorVertices(trace.points), [trace.points]);

  const rows = interior.map(({ prev, vertex, next, index }) => ({
    index,
    deg: interiorAngleDeg(prev, vertex, next),
  }));

  const csvRows: string[][] = [
    ['Vertex', 'Interior angle (deg)'],
    ...rows.map((r) => [String(r.index + 1), r.deg.toFixed(2)]),
  ];

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <header className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <h3 className="text-sm font-semibold">Angles</h3>
        <CopyCsvButton rows={csvRows} />
      </header>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-600">
          <tr>
            <th className="px-3 py-1.5">Vertex #</th>
            <th className="px-3 py-1.5">Interior angle</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td className="px-3 py-2 text-slate-500" colSpan={2}>
                Trace at least three points.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.index} className="border-t border-slate-100">
              <td className="px-3 py-1.5 tabular-nums align-top">{r.index + 1}</td>
              <td className="px-3 py-1.5 tabular-nums align-top">
                <AngleCell current={r.deg} onSubmit={(deg) => onEditAngle(r.index, deg)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function AngleCell({ current, onSubmit }: { current: number; onSubmit: (deg: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(current.toFixed(1));
          setError(null);
          setEditing(true);
        }}
        className="w-full rounded px-1 py-0.5 text-left hover:bg-slate-100"
      >
        {current.toFixed(1)}°
      </button>
    );
  }

  const commit = () => {
    const n = Number(draft.replace(/°/g, '').trim());
    if (!Number.isFinite(n) || n <= 0 || n >= 180) {
      setError('Enter a value between 0 and 180');
      return;
    }
    onSubmit(n);
    setEditing(false);
  };

  return (
    <span className="flex items-center gap-1">
      <input
        autoFocus
        value={draft}
        onChange={(e) => {
          setDraft(e.currentTarget.value);
          setError(null);
        }}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        className="w-20 rounded border border-slate-300 px-1 py-0.5 text-sm"
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}

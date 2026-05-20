'use client';
import React, { useMemo, useState } from 'react';
import { segmentLengthInches, segmentLengthPx, segments } from '@/lib/geometry';
import { formatLength, parseLength } from '@/lib/parse';
import type { Trace } from '@/lib/types';
import { CopyCsvButton } from './CopyCsvButton';

type Props = {
  trace: Trace;
  labels: Record<string, string>;
  onEditLength: (segmentIndex: number, newLengthInches: number) => void;
  onEditLabel: (pointId: string, label: string) => void;
};

export function SegmentsTable({ trace, labels, onEditLength, onEditLabel }: Props) {
  const segs = useMemo(() => segments(trace.points), [trace.points]);
  const scaleSet = trace.inchesPerPixel != null;

  const rows = segs.map(({ a, b, index }) => {
    const inches = segmentLengthInches(a, b, trace.inchesPerPixel);
    const fmt = inches != null ? formatLength(inches) : null;
    return {
      index,
      pointId: a.id,
      label: labels[a.id] ?? '',
      ftIn: fmt?.ftIn ?? '—',
      decimal: fmt?.decimal ?? '—',
      inches,
      px: segmentLengthPx(a, b),
    };
  });

  const csvRows: string[][] = [
    ['Segment', 'Label', 'Length (ft-in)', 'Length (in)', 'Pixels'],
    ...rows.map((r) => [String(r.index + 1), r.label, r.ftIn, r.decimal, r.px.toFixed(2)]),
  ];

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <header className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <h3 className="text-sm font-semibold">Segments</h3>
        <CopyCsvButton rows={csvRows} />
      </header>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-600">
          <tr>
            <th className="px-3 py-1.5">#</th>
            <th className="px-3 py-1.5">Label</th>
            <th className="px-3 py-1.5">Length</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td className="px-3 py-2 text-slate-500" colSpan={3}>
                Trace at least two points.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.pointId} className="border-t border-slate-100">
              <td className="px-3 py-1.5 tabular-nums align-top">{r.index + 1}</td>
              <td className="px-3 py-1.5 align-top">
                <LabelCell value={r.label} onChange={(v) => onEditLabel(r.pointId, v)} />
              </td>
              <td className="px-3 py-1.5 tabular-nums align-top">
                <LengthCell
                  scaleSet={scaleSet}
                  current={r.inches}
                  display={r.ftIn}
                  onSubmit={(inches) => onEditLength(r.index, inches)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function LabelCell({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className={`block w-full truncate rounded px-1 py-0.5 text-left ${
          value ? 'text-[var(--accent)]' : 'text-slate-400 italic'
        } hover:bg-slate-100`}
      >
        {value || 'Add label…'}
      </button>
    );
  }
  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.currentTarget.value)}
      onBlur={() => {
        onChange(draft);
        setEditing(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          onChange(draft);
          setEditing(false);
        }
        if (e.key === 'Escape') setEditing(false);
      }}
      className="w-full rounded border border-slate-300 px-1 py-0.5 text-sm"
    />
  );
}

function LengthCell({
  scaleSet,
  current,
  display,
  onSubmit,
}: {
  scaleSet: boolean;
  current: number | null;
  display: string;
  onSubmit: (inches: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!scaleSet) {
    return <span className="text-slate-400">{display}</span>;
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(current != null ? current.toFixed(2) : '');
          setError(null);
          setEditing(true);
        }}
        className="w-full rounded px-1 py-0.5 text-left hover:bg-slate-100"
      >
        {display}
      </button>
    );
  }

  const commit = () => {
    const parsed = parseLength(draft);
    if (parsed == null || parsed <= 0) {
      setError('Enter a length like 42 or 3\'-6"');
      return;
    }
    onSubmit(parsed);
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
        className="w-24 rounded border border-slate-300 px-1 py-0.5 text-sm"
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}

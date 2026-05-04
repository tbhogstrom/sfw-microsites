'use client';
import React, { useState } from 'react';

type Props = {
  projectId: string;
};

async function fetchExport(projectId: string, format: 'csv' | 'xlsx' | 'pdf'): Promise<string> {
  const res = await fetch(`/api/projects/${projectId}/exports`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ format }),
  });
  if (!res.ok) throw new Error(`export failed: ${res.status}`);
  const { url } = await res.json();
  return url;
}

export function ExportButtons({ projectId }: Props) {
  const [busy, setBusy] = useState<string | null>(null);

  async function handle(format: 'csv' | 'xlsx' | 'pdf') {
    setBusy(format);
    try {
      const url = await fetchExport(projectId, format);
      window.open(url, '_blank');
    } finally {
      setBusy(null);
    }
  }

  const labels: Record<'csv' | 'xlsx' | 'pdf', string> = {
    csv: 'Download CSV',
    xlsx: 'Download Excel',
    pdf: 'Download Scope PDF',
  };

  return (
    <div className="flex flex-wrap gap-2">
      {(['csv', 'xlsx', 'pdf'] as const).map((fmt) => (
        <button
          key={fmt}
          onClick={() => handle(fmt)}
          disabled={busy !== null}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-60"
        >
          {busy === fmt ? 'Building…' : labels[fmt]}
        </button>
      ))}
    </div>
  );
}

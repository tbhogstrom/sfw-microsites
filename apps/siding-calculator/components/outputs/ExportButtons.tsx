'use client';
import React, { useState } from 'react';

type Props = {
  projectId: string;
  hasLead: boolean;
  onRequireLead: (intent: 'export') => void;
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

export function ExportButtons({ projectId, hasLead, onRequireLead }: Props) {
  const [busy, setBusy] = useState<string | null>(null);

  async function handle(format: 'csv' | 'xlsx' | 'pdf') {
    if ((format === 'xlsx' || format === 'pdf') && !hasLead) {
      onRequireLead('export');
      return;
    }
    setBusy(format);
    try {
      const url = await fetchExport(projectId, format);
      window.open(url, '_blank');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => handle('csv')}
        disabled={busy !== null}
        className="rounded border border-slate-300 px-3 py-1.5 text-sm"
      >
        {busy === 'csv' ? 'Building…' : 'Download CSV'}
      </button>
      <button
        onClick={() => handle('xlsx')}
        disabled={busy !== null}
        className="rounded border border-slate-300 px-3 py-1.5 text-sm"
      >
        {busy === 'xlsx'
          ? 'Building…'
          : hasLead
            ? 'Download Excel'
            : 'Download Excel — requires info'}
      </button>
      <button
        onClick={() => handle('pdf')}
        disabled={busy !== null}
        className="rounded border border-slate-300 px-3 py-1.5 text-sm"
      >
        {busy === 'pdf'
          ? 'Building…'
          : hasLead
            ? 'Download Scope PDF'
            : 'Download Scope PDF — requires info'}
      </button>
    </div>
  );
}

'use client';
import React, { useState } from 'react';

type Props = {
  projectId: string;
};

type Format = 'csv' | 'xlsx' | 'pdf';

export function ExportButtons({ projectId }: Props) {
  const [busy, setBusy] = useState<Format | null>(null);

  function handle(format: Format) {
    setBusy(format);
    // Trigger a real browser download via the streaming GET route.
    // The route regenerates the artifact and serves it with Content-Disposition: attachment.
    window.location.href = `/api/projects/${projectId}/exports?format=${format}`;
    // Reset busy state after a beat — we lose the navigation but the download itself runs in background.
    setTimeout(() => setBusy(null), 1500);
  }

  const labels: Record<Format, string> = {
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

'use client';
import React, { useRef, useState } from 'react';
import type { Opening } from '@/lib/types';

type Props = {
  projectId: string;
  elevationId: string;
  onDetected: (openings: Opening[]) => void;
};

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

export function AutoDetectButton({ projectId, elevationId, onDetected }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('image', file);
      form.append('elevationId', elevationId);
      const res = await fetch(`/api/projects/${projectId}/detect-openings`, {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || body.error || `HTTP ${res.status}`);
      }
      const { openings } = (await res.json()) as { openings: Opening[] };
      if (openings.length === 0) {
        setError('No openings detected. Try a clearer photo of the wall.');
      } else {
        onDetected(openings);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        title="Upload a photo of this wall and let Claude auto-detect windows, doors, and vents."
        className="rounded-full border border-emerald-600 bg-emerald-50 px-3 py-1 text-xs text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
      >
        {busy ? 'Detecting…' : '📷 Auto-detect from photo'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      {error && (
        <div className="max-w-[260px] rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}

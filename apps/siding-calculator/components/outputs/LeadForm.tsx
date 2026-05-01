'use client';
import React, { useState } from 'react';

type Props = {
  projectId: string;
  intent: 'export' | 'quote';
  onSuccess: () => void;
  onClose: () => void;
};

async function postLead(payload: Record<string, unknown>) {
  const res = await fetch('/api/lead', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`lead failed: ${res.status}`);
}

export function LeadForm({ projectId, intent, onSuccess, onClose }: Props) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await postLead({ projectId, intent, ...form });
      onSuccess();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold">
          {intent === 'quote' ? 'Get a quote' : 'A few details to download your scope'}
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          We&apos;ll only contact you about this project.
        </p>
        {(['name', 'email', 'phone', 'address'] as const).map((k) => (
          <label key={k} className="mt-3 block text-sm">
            <span className="capitalize text-slate-600">{k}</span>
            <input
              required
              type={k === 'email' ? 'email' : k === 'phone' ? 'tel' : 'text'}
              value={form[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>
        ))}
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded px-3 py-1.5 text-sm">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm text-white"
          >
            {busy ? 'Sending…' : intent === 'quote' ? 'Request quote' : 'Continue'}
          </button>
        </div>
      </form>
    </div>
  );
}

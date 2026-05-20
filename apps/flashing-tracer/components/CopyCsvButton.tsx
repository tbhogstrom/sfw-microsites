'use client';
import React, { useState } from 'react';

type Props = {
  rows: string[][];
  label?: string;
};

export function CopyCsvButton({ rows, label = 'Copy CSV' }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const csv = rows
      .map((row) =>
        row.map((cell) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(','),
      )
      .join('\n');
    try {
      await navigator.clipboard.writeText(csv);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback for browsers without async clipboard.
      const ta = document.createElement('textarea');
      ta.value = csv;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } finally {
        document.body.removeChild(ta);
      }
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="no-print rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
    >
      {copied ? 'Copied' : label}
    </button>
  );
}

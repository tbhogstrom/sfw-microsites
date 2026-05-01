'use client';
import React from 'react';
import type { MaterialsLine } from '@/lib/materials';

export function MaterialsTable({ lines }: { lines: MaterialsLine[] }) {
  if (lines.length === 0) {
    return (
      <p className="text-sm text-slate-500">Pick at least one phase + material to see your list.</p>
    );
  }
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-left">
          <th className="py-2">Phase</th>
          <th>Material</th>
          <th>Qty</th>
          <th>Unit</th>
          <th className="text-slate-500">Coverage</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l) => (
          <tr key={l.phase + l.material.id} className="border-b border-slate-100">
            <td className="py-2 capitalize">{l.phase.replace(/([A-Z])/g, ' $1').toLowerCase()}</td>
            <td>
              {l.material.brand ? `${l.material.brand} · ` : ''}
              {l.material.name}
            </td>
            <td className="font-medium">{l.qty}</td>
            <td>{l.unit === 'linft' ? 'lin ft' : l.unit === 'sqft' ? 'sq ft' : l.unit}</td>
            <td className="text-slate-500">{l.coverageNote}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

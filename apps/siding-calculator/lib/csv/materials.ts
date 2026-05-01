import type { MaterialsLine } from '../materials';

const HEADER = [
  'Phase',
  'Brand',
  'Material',
  'Quantity',
  'Unit',
  'Required (pre-waste)',
  'Coverage notes',
];

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function materialsToCsv(lines: MaterialsLine[]): string {
  const rows: string[] = [HEADER.join(',')];
  for (const l of lines) {
    rows.push(
      [
        l.phase,
        l.material.brand ?? '',
        l.material.name,
        l.qty,
        l.unit,
        l.requiredAmount.toFixed(2),
        l.coverageNote,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return rows.join('\n') + '\n';
}

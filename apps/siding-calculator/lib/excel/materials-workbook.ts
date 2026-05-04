import ExcelJS from 'exceljs';
import type { Project } from '../types';
import type { MaterialsLine } from '../materials';
import { wallSqFt, openingsSqFt, netSidingSqFt, trimLinFt } from '../geometry';
import { totalSidingSqFt, totalTrimLinFt } from '../materials';
import { PRESET_LABELS } from '../presets';

export async function buildMaterialsWorkbook(
  project: Project,
  lines: MaterialsLine[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SFW Siding Calculator';
  wb.created = new Date(project.createdAt);

  // --- Project sheet ---
  const proj = wb.addWorksheet('Project');
  proj.columns = [{ width: 28 }, { width: 50 }];
  proj.addRows([
    ['Project ID', project.id],
    ['Created', project.createdAt],
    ['Preset', PRESET_LABELS[project.scope.presetId]],
    ['Elevations', String(project.elevations.length)],
    ['Total net siding area', `${totalSidingSqFt(project).toFixed(1)} sq ft`],
    ['Total trim length', `${totalTrimLinFt(project).toFixed(1)} lin ft`],
    [],
  ]);
  proj.getColumn(1).font = { bold: true };

  // --- Per-elevation breakdown ---
  proj.addRow(['Per-elevation breakdown', '']);
  proj.lastRow!.font = { bold: true };
  proj.addRow(['Elevation', 'Wall · Net siding · Trim']);
  for (const e of project.elevations) {
    const wallDesc = `${e.wall.rect.widthFt}' × ${e.wall.rect.heightFt}'${e.wall.gable ? ` + gable peak ${e.wall.gable.peakHeightFt}'` : ''}`;
    const wallA = wallSqFt(e.wall).toFixed(1);
    const opA = openingsSqFt(e.openings).toFixed(1);
    const net = netSidingSqFt(e.wall, e.openings).toFixed(1);
    const trim = trimLinFt(e.wall, e.openings).toFixed(1);
    proj.addRow([
      e.name,
      `${wallDesc} · wall ${wallA} sqft · openings ${opA} sqft · net ${net} sqft · trim ${trim} linft`,
    ]);
  }

  // --- Materials sheet ---
  const ws = wb.addWorksheet('Materials');
  ws.columns = [
    { header: 'Phase', key: 'phase', width: 14 },
    { header: 'Brand', key: 'brand', width: 16 },
    { header: 'Material', key: 'material', width: 42 },
    { header: 'Quantity', key: 'qty', width: 10 },
    { header: 'Unit', key: 'unit', width: 8 },
    { header: 'Required (pre-waste)', key: 'required', width: 20 },
    { header: 'Coverage notes', key: 'notes', width: 36 },
  ];
  ws.getRow(1).font = { bold: true };

  for (const l of lines) {
    ws.addRow({
      phase: l.phase,
      brand: l.material.brand ?? '',
      material: l.material.name,
      qty: l.qty,
      unit: l.unit,
      required: Number(l.requiredAmount.toFixed(2)),
      notes: l.coverageNote,
    });
  }

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

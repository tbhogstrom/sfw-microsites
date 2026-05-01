import ExcelJS from 'exceljs';
import type { Project } from '../types';
import type { MaterialsLine } from '../materials';
import { wallSqFt, openingsSqFt, netSidingSqFt, trimLinFt } from '../geometry';
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
  proj.columns = [{ width: 28 }, { width: 40 }];
  proj.addRows([
    ['Project ID', project.id],
    ['Created', project.createdAt],
    ['Preset', PRESET_LABELS[project.scope.presetId]],
    ['Canvas', `${project.canvas.widthFt}' × ${project.canvas.heightFt}'`],
    [
      'Wall',
      `${project.wall.rect.widthFt}' × ${project.wall.rect.heightFt}'${project.wall.gable ? ` + gable peak ${project.wall.gable.peakHeightFt}'` : ''}`,
    ],
    ['Wall area', `${wallSqFt(project.wall).toFixed(1)} sq ft`],
    ['Openings area', `${openingsSqFt(project.openings).toFixed(1)} sq ft`],
    ['Net siding area', `${netSidingSqFt(project.wall, project.openings).toFixed(1)} sq ft`],
    ['Trim length', `${trimLinFt(project.wall, project.openings).toFixed(1)} lin ft`],
  ]);
  proj.getColumn(1).font = { bold: true };

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

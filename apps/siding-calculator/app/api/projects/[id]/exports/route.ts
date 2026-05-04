import { NextResponse } from 'next/server';
import { z } from 'zod';
import { loadProject, saveOutput, getOutputUrl } from '@/lib/storage';
import { computeMaterialsList } from '@/lib/materials';
import { materialsToCsv } from '@/lib/csv/materials';
import { buildMaterialsWorkbook } from '@/lib/excel/materials-workbook';
import { renderScopePdf } from '@/lib/pdf/scope-document';

const FormatSchema = z.object({ format: z.enum(['csv', 'xlsx', 'pdf']) });

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = FormatSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_format' }, { status: 400 });
  const { format } = parsed.data;

  const project = await loadProject(id);
  if (!project) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const lines = computeMaterialsList(project);
  const shareUrl = `${req.headers.get('origin') ?? ''}/calc/p/${project.id}`;

  let url: string;
  if (format === 'csv') {
    const csv = materialsToCsv(lines);
    url = await saveOutput(id, 'csv', csv, 'text/csv');
  } else if (format === 'xlsx') {
    const buf = await buildMaterialsWorkbook(project, lines);
    url = await saveOutput(
      id,
      'xlsx',
      buf,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  } else {
    const buf = await renderScopePdf(project, lines, shareUrl);
    url = await saveOutput(id, 'pdf', buf, 'application/pdf');
  }
  return NextResponse.json({ url });
}

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const formatParam = new URL(req.url).searchParams.get('format') as 'csv' | 'xlsx' | 'pdf' | null;
  if (!formatParam || !['csv', 'xlsx', 'pdf'].includes(formatParam)) {
    return NextResponse.json({ error: 'invalid_format' }, { status: 400 });
  }
  const u = await getOutputUrl(id, formatParam);
  if (!u) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.redirect(u);
}

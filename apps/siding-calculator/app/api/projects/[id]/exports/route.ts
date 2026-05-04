import { NextResponse } from 'next/server';
import { z } from 'zod';
import { loadProject, saveOutput } from '@/lib/storage';
import { computeMaterialsList } from '@/lib/materials';
import { materialsToCsv } from '@/lib/csv/materials';
import { buildMaterialsWorkbook } from '@/lib/excel/materials-workbook';
import { renderScopePdf } from '@/lib/pdf/scope-document';

const FormatSchema = z.object({ format: z.enum(['csv', 'xlsx', 'pdf']) });
type Format = 'csv' | 'xlsx' | 'pdf';

type Ctx = { params: Promise<{ id: string }> };

const CONTENT_TYPE: Record<Format, string> = {
  csv: 'text/csv',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};

const FILE_EXT: Record<Format, string> = {
  csv: 'csv',
  xlsx: 'xlsx',
  pdf: 'pdf',
};

async function buildArtifact(
  format: Format,
  project: NonNullable<Awaited<ReturnType<typeof loadProject>>>,
  shareUrl: string,
) {
  const lines = computeMaterialsList(project);
  if (format === 'csv') return Buffer.from(materialsToCsv(lines), 'utf-8');
  if (format === 'xlsx') return await buildMaterialsWorkbook(project, lines);
  return await renderScopePdf(project, lines, shareUrl);
}

// POST: generate and save to blob (server-side persistence). Returns success.
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = FormatSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_format' }, { status: 400 });
  const { format } = parsed.data;

  const project = await loadProject(id);
  if (!project) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const shareUrl = `${req.headers.get('origin') ?? ''}/calc/p/${project.id}`;
  const buf = await buildArtifact(format, project, shareUrl);
  await saveOutput(id, format, buf, CONTENT_TYPE[format]);
  return NextResponse.json({ ok: true });
}

// GET: stream the artifact to the client as a download.
// Re-generates fresh from project state every time so outputs are never stale.
export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const formatParam = new URL(req.url).searchParams.get('format') as Format | null;
  if (!formatParam || !['csv', 'xlsx', 'pdf'].includes(formatParam)) {
    return NextResponse.json({ error: 'invalid_format' }, { status: 400 });
  }

  const project = await loadProject(id);
  if (!project) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const shareUrl = `${req.headers.get('origin') ?? ''}/calc/p/${project.id}`;
  const buf = await buildArtifact(formatParam, project, shareUrl);

  const filename =
    formatParam === 'pdf'
      ? `siding-scope-${id}.pdf`
      : `siding-materials-${id}.${FILE_EXT[formatParam]}`;

  return new Response(buf as BodyInit, {
    headers: {
      'Content-Type': CONTENT_TYPE[formatParam],
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

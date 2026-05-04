import { NextResponse } from 'next/server';
import { ulid } from 'ulid';
import { loadProject } from '@/lib/storage';
import { detectOpenings, type SupportedMediaType } from '@/lib/vision';
import type { Opening } from '@/lib/types';

const SUPPORTED_TYPES: SupportedMediaType[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'vision_disabled', detail: 'ANTHROPIC_API_KEY not configured' },
      { status: 503 },
    );
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: 'invalid_form' }, { status: 400 });
  }

  const file = formData.get('image');
  const elevationId = formData.get('elevationId');

  if (!(file instanceof File) || typeof elevationId !== 'string') {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }
  if (!SUPPORTED_TYPES.includes(file.type as SupportedMediaType)) {
    return NextResponse.json(
      { error: 'unsupported_media_type', detail: `Got ${file.type}` },
      { status: 415 },
    );
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: 'image_too_large', detail: `Max ${MAX_IMAGE_BYTES / 1024 / 1024} MB` },
      { status: 413 },
    );
  }

  const project = await loadProject(id);
  if (!project) return NextResponse.json({ error: 'project_not_found' }, { status: 404 });

  const elevation = project.elevations.find((e) => e.id === elevationId);
  if (!elevation) return NextResponse.json({ error: 'elevation_not_found' }, { status: 404 });

  const buf = Buffer.from(await file.arrayBuffer());
  const base64 = buf.toString('base64');

  let detected;
  try {
    detected = await detectOpenings(base64, file.type as SupportedMediaType);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'vision_failed', detail: msg }, { status: 502 });
  }

  // Map image-relative (top-left origin, %) to wall-relative (bottom-left
  // origin, feet). Scale to the wall+gable bounding box on the assumption
  // that the photo frames the elevation.
  const wallW = elevation.wall.rect.widthFt;
  const wallH = elevation.wall.rect.heightFt;
  const totalH = wallH + (elevation.wall.gable?.peakHeightFt ?? 0);

  const openings: Opening[] = detected.map((d) => {
    const widthFt = clamp((d.widthPct / 100) * wallW, 0.25, wallW);
    const heightFt = clamp((d.heightPct / 100) * totalH, 0.25, totalH);
    const xLeft = (d.xPct / 100) * wallW;
    // The detector reports y from the top; our model has y from the bottom of
    // the wall. Convert: yBottomFromBottom = totalH - (yTopFromTop + height).
    const yBottom = totalH - ((d.yPct + d.heightPct) / 100) * totalH;
    return {
      id: ulid(),
      type: d.type,
      x: clamp(xLeft, 0, Math.max(0, wallW - widthFt)),
      y: clamp(yBottom, 0, Math.max(0, totalH - heightFt)),
      widthFt,
      heightFt,
    };
  });

  return NextResponse.json({ openings });
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

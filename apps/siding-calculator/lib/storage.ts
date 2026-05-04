import { put, list, del } from '@vercel/blob';
import { ulid } from 'ulid';
import { ProjectSchema, type Project } from './types';

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

function projectKey(id: string): string {
  return `projects/${id}.json`;
}
function outputKey(id: string, format: 'csv' | 'xlsx' | 'pdf'): string {
  return `outputs/${id}/materials.${format === 'pdf' ? 'pdf' : format}`;
}
function failedLeadKey(id: string): string {
  return `failed-leads/${id}.json`;
}

export async function saveProject(project: Project): Promise<void> {
  ProjectSchema.parse(project);
  await put(projectKey(project.id), JSON.stringify(project), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    token: BLOB_TOKEN,
  });
}

/**
 * Backfill missing fields when loading an older saved project so it conforms
 * to the current ProjectSchema. Each entry is a forward migration step.
 */
function migrate(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const r = raw as Record<string, any>;

  // v1 → v1.1: add paint phase if missing.
  const phases = r.scope?.phases;
  if (phases && !phases.paint) {
    phases.paint = { enabled: false, materialId: null };
  }

  // v1.x → v2: wrap top-level wall/openings/canvas into a single elevation.
  if (r.schemaVersion === 1 || (!r.elevations && r.wall)) {
    const elevationId = ulid();
    r.elevations = [
      {
        id: elevationId,
        name: 'Elevation 1',
        canvas: r.canvas ?? { widthFt: 30, heightFt: 12, snapInches: 12 },
        wall: r.wall,
        openings: r.openings ?? [],
      },
    ];
    r.activeElevationId = elevationId;
    r.schemaVersion = 2;
    delete r.wall;
    delete r.openings;
    delete r.canvas;
  }

  return r;
}

export async function loadProject(id: string): Promise<Project | null> {
  const key = projectKey(id);
  const { blobs } = await list({ prefix: key, token: BLOB_TOKEN });
  const blob = blobs.find((b) => b.pathname === key);
  if (!blob) return null;
  const res = await fetch(blob.downloadUrl, {
    cache: 'no-store',
    headers: BLOB_TOKEN ? { Authorization: `Bearer ${BLOB_TOKEN}` } : undefined,
  });
  if (!res.ok) return null;
  const json = await res.json();
  return ProjectSchema.parse(migrate(json));
}

export async function saveOutput(
  id: string,
  format: 'csv' | 'xlsx' | 'pdf',
  body: Buffer | string,
  contentType: string,
): Promise<string> {
  const result = await put(outputKey(id, format), body, {
    access: 'private',
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
    token: BLOB_TOKEN,
  });
  return result.url;
}

export async function getOutputUrl(
  id: string,
  format: 'csv' | 'xlsx' | 'pdf',
): Promise<string | null> {
  const key = outputKey(id, format);
  const { blobs } = await list({ prefix: key, token: BLOB_TOKEN });
  const blob = blobs.find((b) => b.pathname === key);
  return blob?.downloadUrl ?? null;
}

export async function saveFailedLead(id: string, payload: unknown): Promise<void> {
  await put(failedLeadKey(id), JSON.stringify(payload), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    token: BLOB_TOKEN,
  });
}

export async function deleteOutputs(id: string): Promise<void> {
  for (const fmt of ['csv', 'xlsx', 'pdf'] as const) {
    try {
      await del(outputKey(id, fmt), { token: BLOB_TOKEN });
    } catch {
      /* ignore */
    }
  }
}

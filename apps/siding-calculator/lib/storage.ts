import { put, head, del } from '@vercel/blob';
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
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    token: BLOB_TOKEN,
  });
}

export async function loadProject(id: string): Promise<Project | null> {
  try {
    const meta = await head(projectKey(id), { token: BLOB_TOKEN });
    const res = await fetch(meta.url, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    return ProjectSchema.parse(json);
  } catch (err: any) {
    if (err?.status === 404 || err?.code === 'BLOB_NOT_FOUND') return null;
    throw err;
  }
}

export async function saveOutput(
  id: string,
  format: 'csv' | 'xlsx' | 'pdf',
  body: Buffer | string,
  contentType: string,
): Promise<string> {
  const result = await put(outputKey(id, format), body, {
    access: 'public',
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
  try {
    const meta = await head(outputKey(id, format), { token: BLOB_TOKEN });
    return meta.url;
  } catch {
    return null;
  }
}

export async function saveFailedLead(id: string, payload: unknown): Promise<void> {
  await put(failedLeadKey(id), JSON.stringify(payload), {
    access: 'public',
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

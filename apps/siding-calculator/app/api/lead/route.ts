import { NextResponse } from 'next/server';
import { z } from 'zod';
import { loadProject, saveProject, saveFailedLead } from '@/lib/storage';
import { submitLead } from '@/lib/hubspot';
import type { Project } from '@/lib/types';

const Body = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  address: z.string().min(1),
  intent: z.enum(['export', 'quote']),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid', issues: parsed.error.issues }, { status: 400 });
  }

  const project = await loadProject(parsed.data.projectId);
  if (!project) return NextResponse.json({ error: 'project_not_found' }, { status: 404 });

  // Persist lead onto the project regardless of HubSpot outcome.
  const now = new Date().toISOString();
  const next: Project = {
    ...project,
    updatedAt: now,
    lead: {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      address: parsed.data.address,
      capturedAt: now,
    },
  };
  await saveProject(next);

  // Forward to HubSpot. Failures are dead-lettered; we still return 200.
  try {
    await submitLead(parsed.data);
    next.lead!.hubspotSubmittedAt = new Date().toISOString();
    await saveProject(next);
  } catch (err) {
    await saveFailedLead(`${parsed.data.projectId}-${Date.now()}`, {
      lead: parsed.data,
      error: String(err),
      failedAt: new Date().toISOString(),
    });
  }

  return NextResponse.json({ ok: true });
}

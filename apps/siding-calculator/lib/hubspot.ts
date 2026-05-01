export type LeadIntent = 'export' | 'quote';

export type LeadPayload = {
  projectId: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  intent: LeadIntent;
};

export type SubmitOpts = {
  maxAttempts?: number;
  backoffMs?: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function submitLead(lead: LeadPayload, opts: SubmitOpts = {}): Promise<void> {
  const portalId = process.env.HUBSPOT_PORTAL_ID;
  const formId = process.env.HUBSPOT_FORM_ID;
  if (!portalId || !formId) {
    throw new Error('HubSpot env vars missing (HUBSPOT_PORTAL_ID, HUBSPOT_FORM_ID)');
  }

  const url = `https://forms.hsforms.com/submissions/v3/integration/submit/${portalId}/${formId}`;
  const [firstname, ...rest] = lead.name.split(/\s+/);
  const lastname = rest.join(' ');

  const body = {
    fields: [
      { objectTypeId: '0-1', name: 'email', value: lead.email },
      { objectTypeId: '0-1', name: 'firstname', value: firstname },
      { objectTypeId: '0-1', name: 'lastname', value: lastname },
      { objectTypeId: '0-1', name: 'phone', value: lead.phone },
      { objectTypeId: '0-1', name: 'address', value: lead.address },
      { objectTypeId: '0-1', name: 'siding_calc_project_id', value: lead.projectId },
      { objectTypeId: '0-1', name: 'siding_calc_intent', value: lead.intent },
    ],
    context: { pageUri: `siding-calc/p/${lead.projectId}`, pageName: 'SFW Siding Calculator' },
  };

  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (process.env.HUBSPOT_BEARER) headers['authorization'] = `Bearer ${process.env.HUBSPOT_BEARER}`;

  const max = opts.maxAttempts ?? 3;
  const backoff = opts.backoffMs ?? 500;

  let lastErr: Error | null = null;
  for (let i = 1; i <= max; i++) {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    if (res.ok) return;
    const text = await res.text();
    lastErr = new Error(`HubSpot ${res.status}: ${text}`);
    if (res.status >= 400 && res.status < 500) throw lastErr; // don't retry 4xx
    if (i < max) await sleep(backoff * i);
  }
  throw lastErr ?? new Error('HubSpot submit failed');
}

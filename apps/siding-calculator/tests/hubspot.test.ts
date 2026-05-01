import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { submitLead } from '@/lib/hubspot';

const ORIGINAL_ENV = process.env;
beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, HUBSPOT_PORTAL_ID: '111', HUBSPOT_FORM_ID: 'fff' };
});
afterEach(() => {
  process.env = ORIGINAL_ENV;
  vi.unstubAllGlobals();
});

describe('submitLead', () => {
  it('POSTs to the HubSpot Forms endpoint with the right payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);

    await submitLead({
      projectId: 'p1',
      name: 'Tay',
      email: 't@x.com',
      phone: '503',
      address: 'PDX',
      intent: 'export',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/forms\.hsforms\.com\/submissions\/v3\/integration\/submit\/111\/fff/);
    const body = JSON.parse(init.body);
    expect(body.fields).toEqual(
      expect.arrayContaining([
        { objectTypeId: '0-1', name: 'email', value: 't@x.com' },
        { objectTypeId: '0-1', name: 'firstname', value: 'Tay' },
      ]),
    );
  });

  it('retries on 5xx and eventually succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => 'down' })
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => 'still down' })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      submitLead(
        {
          projectId: 'p1',
          name: 'A',
          email: 'a@b.com',
          phone: '1',
          address: 'x',
          intent: 'quote',
        },
        { maxAttempts: 3, backoffMs: 0 },
      ),
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('throws after exhausting retries', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 500, text: async () => 'err' });
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      submitLead(
        {
          projectId: 'p1',
          name: 'A',
          email: 'a@b.com',
          phone: '1',
          address: 'x',
          intent: 'quote',
        },
        { maxAttempts: 2, backoffMs: 0 },
      ),
    ).rejects.toThrow();
  });

  it('does not retry on 4xx', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 400, text: async () => 'bad' });
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      submitLead(
        {
          projectId: 'p1',
          name: 'A',
          email: 'a@b.com',
          phone: '1',
          address: 'x',
          intent: 'quote',
        },
        { maxAttempts: 5, backoffMs: 0 },
      ),
    ).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

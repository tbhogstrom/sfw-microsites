import { list } from '@vercel/blob';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function getManifests(
  prefix: string,
): Promise<{ manifests: { date: string; reports?: { length: number }[] }[]; error?: string }> {
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) return { manifests: [], error: 'No BLOB_READ_WRITE_TOKEN in env' };
    const { blobs } = await list({ prefix, token });
    if (blobs.length === 0)
      return { manifests: [], error: `list({prefix: "${prefix}"}) returned 0 blobs` };
    const manifestBlobs = blobs.filter((b) => b.pathname.endsWith('manifest.json'));
    if (manifestBlobs.length === 0)
      return {
        manifests: [],
        error: `${blobs.length} blobs but 0 manifests. Paths: ${blobs.map((b) => b.pathname).join(', ')}`,
      };
    const manifests = [];
    const fetchErrors = [];
    for (const blob of manifestBlobs) {
      try {
        const resp = await fetch(blob.downloadUrl, {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resp.ok) {
          manifests.push(await resp.json());
        } else {
          fetchErrors.push(`${blob.pathname}: ${resp.status}`);
        }
      } catch (fe) {
        fetchErrors.push(`${blob.pathname}: ${fe instanceof Error ? fe.message : String(fe)}`);
      }
    }
    if (manifests.length === 0 && fetchErrors.length > 0) {
      return {
        manifests: [],
        error: `Found ${manifestBlobs.length} manifests but fetch failed: ${fetchErrors.join('; ')}`,
      };
    }
    return {
      manifests: manifests.sort((a: { date: string }, b: { date: string }) =>
        b.date.localeCompare(a.date),
      ),
    };
  } catch (e) {
    return { manifests: [], error: `Exception: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export default async function HomePage() {
  const daily = await getManifests('daily');
  const weekly = await getManifests('weekly');
  const dailyManifests = daily.manifests;
  const weeklyManifests = weekly.manifests;
  const debugInfo = [
    daily.error,
    weekly.error,
    `daily:${daily.manifests.length} weekly:${weekly.manifests.length}`,
  ]
    .filter(Boolean)
    .join('; ');

  return (
    <div
      style={{ minHeight: '100vh', background: '#f8f7f4', fontFamily: '-apple-system, sans-serif' }}
    >
      <header style={{ background: '#1a3a2a', padding: '20px 24px', color: '#fff' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>
          SFW Construction — Project Reports
        </h1>
      </header>
      <div style={{ maxWidth: '800px', margin: '24px auto', padding: '0 16px' }}>
        {debugInfo && (
          <p
            style={{
              color: '#e53e3e',
              fontSize: '12px',
              marginBottom: '12px',
              fontFamily: 'monospace',
            }}
          >
            Debug: {debugInfo}
          </p>
        )}
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#333', marginBottom: '12px' }}>
          Daily Reports
        </h2>
        {dailyManifests.length === 0 ? (
          <p style={{ color: '#888', fontSize: '14px', marginBottom: '24px' }}>
            No daily reports published yet.
          </p>
        ) : (
          <div style={{ marginBottom: '32px' }}>
            {dailyManifests.map((m: { date: string; reports?: { length: number }[] }) => (
              <Link
                key={m.date}
                href={`/daily/${m.date}`}
                style={{
                  display: 'block',
                  background: '#fff',
                  border: '1px solid #eee',
                  borderRadius: '8px',
                  padding: '14px 18px',
                  marginBottom: '8px',
                  textDecoration: 'none',
                  color: '#333',
                }}
              >
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>
                      {new Date(m.date + 'T00:00:00').toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </div>
                    <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
                      {m.reports?.length || 0} project{m.reports?.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <span style={{ color: '#888', fontSize: '18px' }}>→</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#333', marginBottom: '12px' }}>
          Weekly Reports
        </h2>
        {weeklyManifests.length === 0 ? (
          <p style={{ color: '#888', fontSize: '14px' }}>No weekly reports published yet.</p>
        ) : (
          <div>
            {weeklyManifests.map((m: { date: string; reports?: { length: number }[] }) => (
              <Link
                key={m.date}
                href={`/weekly/${m.date}`}
                style={{
                  display: 'block',
                  background: '#fff',
                  border: '1px solid #eee',
                  borderRadius: '8px',
                  padding: '14px 18px',
                  marginBottom: '8px',
                  textDecoration: 'none',
                  color: '#333',
                }}
              >
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>
                      Week of{' '}
                      {new Date(m.date + 'T00:00:00').toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </div>
                    <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
                      {m.reports?.length || 0} project{m.reports?.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <span style={{ color: '#888', fontSize: '18px' }}>→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

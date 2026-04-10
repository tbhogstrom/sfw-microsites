import { list } from '@vercel/blob';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function getDateEntries(
  prefix: string,
): Promise<{ entries: { date: string; reportCount: number }[]; error?: string }> {
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) return { entries: [], error: 'No BLOB_READ_WRITE_TOKEN in env' };
    const { blobs } = await list({ prefix, token });
    if (blobs.length === 0)
      return { entries: [], error: `list({prefix: "${prefix}"}) returned 0 blobs` };

    // Count .html files per date folder (e.g. daily/2026-04-10/foo.html → 2026-04-10)
    const counts = new Map<string, number>();
    for (const blob of blobs) {
      if (!blob.pathname.endsWith('.html')) continue;
      const parts = blob.pathname.split('/');
      // pathname is like "daily/2026-04-10/project.html"
      if (parts.length >= 3) {
        const date = parts[1];
        counts.set(date, (counts.get(date) || 0) + 1);
      }
    }

    const entries = Array.from(counts.entries())
      .map(([date, reportCount]) => ({ date, reportCount }))
      .sort((a, b) => b.date.localeCompare(a.date));

    return { entries };
  } catch (e) {
    return { entries: [], error: `Exception: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export default async function HomePage() {
  const daily = await getDateEntries('daily');
  const weekly = await getDateEntries('weekly');
  const dailyEntries = daily.entries;
  const weeklyEntries = weekly.entries;
  const debugInfo = [daily.error, weekly.error].filter(Boolean).join('; ');

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
        {dailyEntries.length === 0 ? (
          <p style={{ color: '#888', fontSize: '14px', marginBottom: '24px' }}>
            No daily reports published yet.
          </p>
        ) : (
          <div style={{ marginBottom: '32px' }}>
            {dailyEntries.map((m) => (
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
                      {m.reportCount} project{m.reportCount !== 1 ? 's' : ''}
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
        {weeklyEntries.length === 0 ? (
          <p style={{ color: '#888', fontSize: '14px' }}>No weekly reports published yet.</p>
        ) : (
          <div>
            {weeklyEntries.map((m) => (
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
                      {m.reportCount} project{m.reportCount !== 1 ? 's' : ''}
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

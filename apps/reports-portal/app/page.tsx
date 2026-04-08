import { list, get } from '@vercel/blob';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function getManifests(prefix: string) {
  try {
    const { blobs } = await list({ prefix });
    const manifestBlobs = blobs.filter((b) => b.pathname.endsWith('manifest.json'));
    const manifests = [];
    for (const blob of manifestBlobs) {
      try {
        const result = await get(blob.pathname);
        if (result) {
          const text = await new Response(result.body).text();
          manifests.push(JSON.parse(text));
        }
      } catch {
        /* skip unreadable manifests */
      }
    }
    return manifests.sort((a: { date: string }, b: { date: string }) =>
      b.date.localeCompare(a.date),
    );
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const dailyManifests = await getManifests('daily/');
  const weeklyManifests = await getManifests('weekly/');

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

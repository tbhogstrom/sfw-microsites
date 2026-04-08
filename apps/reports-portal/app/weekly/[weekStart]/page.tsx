import { list } from '@vercel/blob';

export const dynamic = 'force-dynamic';

export default async function WeeklyReportPage({
  params,
}: {
  params: Promise<{ weekStart: string }>;
}) {
  const { weekStart } = await params;

  const { blobs } = await list({ prefix: `weekly/${weekStart}/` });
  const htmlBlobs = blobs.filter((b) => b.pathname.endsWith('.html'));

  const reports: string[] = [];
  for (const blob of htmlBlobs) {
    const resp = await fetch(blob.url, { cache: 'no-store' });
    if (resp.ok) {
      reports.push(await resp.text());
    }
  }

  const wsDate = new Date(weekStart + 'T00:00:00');
  const weDate = new Date(wsDate.getTime() + 4 * 86400000);
  const weekRange =
    wsDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) +
    ' – ' +
    weDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div
      style={{ minHeight: '100vh', background: '#f8f7f4', fontFamily: '-apple-system, sans-serif' }}
    >
      <header
        style={{
          background: '#1a2a3a',
          padding: '16px 24px',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <a href="/" style={{ color: '#fff', textDecoration: 'none', fontSize: '14px' }}>
          ← Back
        </a>
        <h1 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>
          Weekly Reports — {weekRange}
        </h1>
      </header>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 16px' }}>
        {reports.length === 0 ? (
          <p style={{ color: '#888', fontSize: '14px', textAlign: 'center', padding: '40px' }}>
            No reports found for this week.
          </p>
        ) : (
          reports.map((html, i) => <div key={i} dangerouslySetInnerHTML={{ __html: html }} />)
        )}
      </div>
    </div>
  );
}

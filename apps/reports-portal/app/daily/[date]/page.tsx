import { list } from '@vercel/blob';
import TeamNotes from './TeamNotes';
import ReportCard from './ReportCard';

export const dynamic = 'force-dynamic';

interface ReportData {
  projectId: string;
  originalHtml: string;
  revisedHtml: string | null;
  feedbackAppliedAt: string | null;
}

export default async function DailyReportPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  const { blobs } = await list({ prefix: `daily/${date}/`, token });

  // Find all original report HTML files (exclude .revised.html)
  const originalBlobs = blobs.filter(
    (b) => b.pathname.endsWith('.html') && !b.pathname.endsWith('.revised.html'),
  );

  const reports: ReportData[] = [];

  for (const blob of originalBlobs) {
    // Extract projectId: "daily/2026-04-10/abc123.html" -> "abc123"
    const filename = blob.pathname.split('/').pop() || '';
    const projectId = filename.replace('.html', '');

    // Fetch original HTML
    const origResp = await fetch(blob.downloadUrl, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!origResp.ok) continue;
    const originalHtml = await origResp.text();

    // Check for revised version
    let revisedHtml: string | null = null;
    const revisedBlob = blobs.find((b) => b.pathname === `daily/${date}/${projectId}.revised.html`);
    if (revisedBlob) {
      const revResp = await fetch(revisedBlob.downloadUrl, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (revResp.ok) {
        revisedHtml = await revResp.text();
      }
    }

    // Check for feedback metadata
    let feedbackAppliedAt: string | null = null;
    const feedbackBlob = blobs.find(
      (b) => b.pathname === `daily/${date}/${projectId}.feedback.json`,
    );
    if (feedbackBlob) {
      const fbResp = await fetch(feedbackBlob.downloadUrl, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (fbResp.ok) {
        const fbData = await fbResp.json();
        feedbackAppliedAt = fbData.applied_at || null;
      }
    }

    reports.push({ projectId, originalHtml, revisedHtml, feedbackAppliedAt });
  }

  const dateFormatted = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      style={{ minHeight: '100vh', background: '#f8f7f4', fontFamily: '-apple-system, sans-serif' }}
    >
      <header
        style={{
          background: '#1a3a2a',
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
          Daily Reports — {dateFormatted}
        </h1>
      </header>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 16px' }}>
        <TeamNotes date={date} />
        {reports.length === 0 ? (
          <p style={{ color: '#888', fontSize: '14px', textAlign: 'center', padding: '40px' }}>
            No reports found for this date.
          </p>
        ) : (
          reports.map((report) => (
            <ReportCard
              key={report.projectId}
              originalHtml={report.originalHtml}
              revisedHtml={report.revisedHtml}
              projectId={report.projectId}
              date={date}
              feedbackAppliedAt={report.feedbackAppliedAt}
            />
          ))
        )}
      </div>
    </div>
  );
}

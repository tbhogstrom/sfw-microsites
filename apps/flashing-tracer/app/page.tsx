import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="text-4xl font-semibold tracking-tight">Flashing Tracer</h1>
      <p className="mt-4 text-lg text-slate-600">
        Load a drawing image, trace the detail with dots, set one length to scale, edit lengths and
        angles, label the part, and share the URL.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/new"
          className="inline-flex items-center rounded-full bg-[var(--accent)] px-6 py-3 text-white"
        >
          Start a new trace →
        </Link>
      </div>
    </main>
  );
}

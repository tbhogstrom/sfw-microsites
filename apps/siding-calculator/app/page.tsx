import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="text-4xl font-semibold tracking-tight">Siding Calculator</h1>
      <p className="mt-4 text-lg text-slate-600">
        Sketch a wall to scale, drop in your windows and doors, pick your materials, and walk away
        with a clear scope you can share with a contractor.
      </p>
      <Link
        href="/calc/new"
        className="mt-8 inline-flex items-center rounded-full bg-[var(--accent)] px-6 py-3 text-white"
      >
        Start a project →
      </Link>
    </main>
  );
}

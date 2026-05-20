import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="text-3xl font-semibold">Project not found</h1>
      <p className="mt-3 text-slate-600">
        That trace URL doesn&apos;t exist anymore (or never did).
      </p>
      <Link
        href="/new"
        className="mt-6 inline-flex items-center rounded-full bg-[var(--accent)] px-5 py-2 text-white"
      >
        Start a new trace
      </Link>
    </main>
  );
}

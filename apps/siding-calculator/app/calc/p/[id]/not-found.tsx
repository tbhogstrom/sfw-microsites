import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md p-12 text-center">
      <h2 className="text-xl font-semibold">Project not found</h2>
      <p className="mt-2 text-sm text-slate-600">
        This share link is no longer valid, or it never existed.
      </p>
      <Link
        href="/calc/new"
        className="mt-6 inline-block rounded-full bg-[var(--accent)] px-5 py-2.5 text-white"
      >
        Start fresh →
      </Link>
    </main>
  );
}

'use client';
import React, { useEffect, useState } from 'react';

export function useIsDesktop(min = 1024): boolean {
  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= min);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [min]);
  return isDesktop;
}

export function MobileFallback({ projectId, onQuote }: { projectId: string; onQuote: () => void }) {
  return (
    <div className="mx-auto max-w-md p-6 text-center">
      <h2 className="text-xl font-semibold">Best on a larger screen</h2>
      <p className="mt-2 text-sm text-slate-600">
        The siding calculator drawing canvas is desktop / tablet only. Open this page on a laptop or
        tablet to draw your wall.
      </p>
      <p className="mt-3 text-sm text-slate-500">
        Project ID: <code>{projectId}</code>
      </p>
      <button onClick={onQuote} className="mt-6 rounded-full bg-emerald-600 px-5 py-2.5 text-white">
        Get a Quote →
      </button>
    </div>
  );
}

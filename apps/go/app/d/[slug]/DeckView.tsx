'use client';

import { useEffect, useRef } from 'react';
import type { Section } from '@/lib/render-slides';

import 'reveal.js/reveal.css';
import 'reveal.js/theme/black.css';
import 'reveal.js/plugin/highlight/monokai.css';

function sectionInnerHtml(section: Section): string {
  const notes = section.notes ? `<aside class="notes">${section.notes}</aside>` : '';
  return section.html + notes;
}

export default function DeckView({ sections }: { sections: Section[] }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let deck: { destroy?: () => void } | undefined;
    let destroyed = false;

    (async () => {
      const Reveal = (await import('reveal.js')).default as unknown as new (
        el: HTMLElement,
        config: Record<string, unknown>,
      ) => { initialize: () => Promise<void>; destroy?: () => void };
      const Notes = (await import('reveal.js/plugin/notes')).default;
      const Highlight = (await import('reveal.js/plugin/highlight')).default;

      if (destroyed || !rootRef.current) return;
      const instance = new Reveal(rootRef.current, {
        hash: true,
        slideNumber: 'c/t',
        plugins: [Notes, Highlight],
      });
      await instance.initialize();
      deck = instance;
    })();

    return () => {
      destroyed = true;
      try {
        deck?.destroy?.();
      } catch {
        // reveal may already be torn down
      }
    };
  }, []);

  return (
    <div className="reveal" ref={rootRef} style={{ position: 'fixed', inset: 0 }}>
      <div className="slides">
        {sections.map((section, i) => (
          <section key={i} dangerouslySetInnerHTML={{ __html: sectionInnerHtml(section) }} />
        ))}
      </div>
    </div>
  );
}

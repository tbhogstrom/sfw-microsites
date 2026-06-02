import { marked } from 'marked';
import type { Deck, Slide } from './decks';

/** Escape a string for safe use inside a double-quoted HTML attribute. */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Escape a string for safe use as HTML text content. */
function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function md(source: string): string {
  return marked.parse(source, { async: false }) as string;
}

/** Render a single slide's inner HTML (the contents of its <section>). */
export function slideToHtml(slide: Slide): string {
  switch (slide.type) {
    case 'markdown':
      return md(slide.content);
    case 'html':
      return slide.html;
    case 'image': {
      const img = `<img src="${escapeAttr(slide.url)}" style="max-height:80vh;max-width:90vw;object-fit:contain" alt="${escapeAttr(slide.caption ?? '')}" />`;
      const caption = slide.caption
        ? `<figcaption style="margin-top:12px;font-size:0.6em;opacity:0.8">${escapeText(slide.caption)}</figcaption>`
        : '';
      return `<figure style="margin:0;display:flex;flex-direction:column;align-items:center">${img}${caption}</figure>`;
    }
    case 'embed':
      return `<iframe data-src="${escapeAttr(slide.url)}" style="width:100%;height:100%;border:0" allow="fullscreen" loading="lazy"></iframe>`;
  }
}

export interface Section {
  html: string;
  notes?: string;
}

/** Render every slide of a deck into reveal.js-ready sections. */
export function buildSections(deck: Deck): Section[] {
  return deck.slides.map((slide) => ({
    html: slideToHtml(slide),
    notes: slide.notes ? md(slide.notes) : undefined,
  }));
}

import { isValidUrl } from './links';

export type SlideType = 'markdown' | 'image' | 'embed' | 'html';

export interface BaseSlide {
  id: string;
  notes?: string;
}
export interface MarkdownSlide extends BaseSlide {
  type: 'markdown';
  content: string;
}
export interface ImageSlide extends BaseSlide {
  type: 'image';
  url: string;
  caption?: string;
}
export interface EmbedSlide extends BaseSlide {
  type: 'embed';
  url: string;
}
export interface HtmlSlide extends BaseSlide {
  type: 'html';
  html: string;
}
export type Slide = MarkdownSlide | ImageSlide | EmbedSlide | HtmlSlide;

export interface Deck {
  slug: string;
  title: string;
  theme?: string;
  createdAt: string;
  updatedAt: string;
  slides: Slide[];
}

export const SLIDE_TYPES: SlideType[] = ['markdown', 'image', 'embed', 'html'];

export const MEDIA_MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};
export const MAX_MEDIA_BYTES = 10 * 1024 * 1024;

/** Thrown for caller-fixable (400-class) problems. */
export class DeckError extends Error {}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** Validate and normalize a slide payload (without an id). Throws DeckError if invalid. */
export function normalizeSlideInput(input: unknown): Omit<Slide, 'id'> {
  const o = (input ?? {}) as Record<string, unknown>;
  const type = o.type as SlideType;
  if (!SLIDE_TYPES.includes(type)) {
    throw new DeckError(`Invalid slide type: ${String(o.type)}`);
  }
  const notes = typeof o.notes === 'string' && o.notes.trim() ? o.notes : undefined;

  switch (type) {
    case 'markdown': {
      const content = str(o.content);
      if (!content.trim()) throw new DeckError('Markdown slide requires content');
      return { type, content, notes };
    }
    case 'html': {
      const html = str(o.html);
      if (!html.trim()) throw new DeckError('HTML slide requires html');
      return { type, html, notes };
    }
    case 'image': {
      const url = str(o.url);
      if (!isValidUrl(url)) throw new DeckError('Image slide requires a valid http(s) url');
      const caption = str(o.caption).trim() || undefined;
      return { type, url, caption, notes };
    }
    case 'embed': {
      const url = str(o.url);
      if (!isValidUrl(url)) throw new DeckError('Embed slide requires a valid http(s) url');
      return { type, url, notes };
    }
  }
}

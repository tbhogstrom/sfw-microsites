import { isValidUrl, generateSlug } from './links';

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
  const notesRaw = typeof o.notes === 'string' ? o.notes.trim() : '';
  const notes = notesRaw || undefined;

  switch (type) {
    case 'markdown': {
      const content = str(o.content);
      if (!content.trim()) throw new DeckError('Markdown slide requires content');
      return { type, content, notes } as Omit<Slide, 'id'>;
    }
    case 'html': {
      const html = str(o.html);
      if (!html.trim()) throw new DeckError('HTML slide requires html');
      return { type, html, notes } as Omit<Slide, 'id'>;
    }
    case 'image': {
      const url = str(o.url);
      if (!isValidUrl(url)) throw new DeckError('Image slide requires a valid http(s) url');
      const caption = str(o.caption).trim() || undefined;
      return { type, url, caption, notes } as Omit<Slide, 'id'>;
    }
    case 'embed': {
      const url = str(o.url);
      if (!isValidUrl(url)) throw new DeckError('Embed slide requires a valid http(s) url');
      return { type, url, notes } as Omit<Slide, 'id'>;
    }
  }
}

/** Build a full slide (with id) from input. Throws DeckError if invalid. */
export function makeSlide(input: unknown): Slide {
  const base = normalizeSlideInput(input);
  return { ...base, id: generateSlug(8) } as Slide;
}

/** Return a copy of the deck with a new validated slide appended. */
export function addSlide(deck: Deck, input: unknown): Deck {
  return { ...deck, slides: [...deck.slides, makeSlide(input)] };
}

export type DeckOp =
  | { op: 'updateDeck'; title?: string; theme?: string }
  | { op: 'reorder'; order: string[] }
  | { op: 'updateSlide'; id: string; patch: Record<string, unknown> }
  | { op: 'deleteSlide'; id: string };

/** Apply a single mutation op and return a new deck. Throws DeckError on bad input. */
export function applyDeckOp(deck: Deck, op: DeckOp): Deck {
  switch (op.op) {
    case 'updateDeck': {
      const title = op.title !== undefined ? op.title.trim() : deck.title;
      if (!title) throw new DeckError('Title cannot be empty');
      const theme = op.theme !== undefined ? op.theme : deck.theme;
      return { ...deck, title, theme };
    }
    case 'reorder': {
      const order = op.order ?? [];
      const idSet = new Set(deck.slides.map((s) => s.id));
      const orderSet = new Set(op.order ?? []);
      const same =
        (op.order ?? []).length === idSet.size &&
        orderSet.size === idSet.size &&
        [...idSet].every((id) => orderSet.has(id));
      if (!same) throw new DeckError('Order must be a permutation of the existing slide ids');
      const byId = new Map(deck.slides.map((s) => [s.id, s]));
      return { ...deck, slides: order.map((id) => byId.get(id)!) };
    }
    case 'deleteSlide': {
      return { ...deck, slides: deck.slides.filter((s) => s.id !== op.id) };
    }
    case 'updateSlide': {
      const idx = deck.slides.findIndex((s) => s.id === op.id);
      if (idx < 0) throw new DeckError('Slide not found');
      const current = deck.slides[idx];
      const merged = { ...current, ...op.patch, type: current.type };
      const normalized = normalizeSlideInput(merged);
      const next = { ...normalized, id: current.id } as Slide;
      const slides = [...deck.slides];
      slides[idx] = next;
      return { ...deck, slides };
    }
    default: {
      const _exhaustive: never = op;
      throw new DeckError(`Unknown op: ${(_exhaustive as { op?: string }).op}`);
    }
  }
}

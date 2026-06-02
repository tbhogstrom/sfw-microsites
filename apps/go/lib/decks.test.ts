import { test, expect } from 'vitest';
import { normalizeSlideInput, DeckError, SLIDE_TYPES } from './decks';

test('SLIDE_TYPES lists the four supported types', () => {
  expect(SLIDE_TYPES).toEqual(['markdown', 'image', 'embed', 'html']);
});

test('normalizeSlideInput accepts a markdown slide', () => {
  const s = normalizeSlideInput({ type: 'markdown', content: '## Hi', notes: 'say hi' });
  expect(s).toEqual({ type: 'markdown', content: '## Hi', notes: 'say hi' });
});

test('normalizeSlideInput rejects empty markdown', () => {
  expect(() => normalizeSlideInput({ type: 'markdown', content: '   ' })).toThrow(DeckError);
});

test('normalizeSlideInput accepts an image slide and trims caption', () => {
  const s = normalizeSlideInput({ type: 'image', url: 'https://x.test/a.png', caption: '  cap  ' });
  expect(s).toEqual({
    type: 'image',
    url: 'https://x.test/a.png',
    caption: 'cap',
    notes: undefined,
  });
});

test('normalizeSlideInput rejects a non-http embed url', () => {
  expect(() => normalizeSlideInput({ type: 'embed', url: 'javascript:alert(1)' })).toThrow(
    DeckError,
  );
});

test('normalizeSlideInput rejects an unknown type', () => {
  expect(() => normalizeSlideInput({ type: 'video', url: 'https://x.test' })).toThrow(DeckError);
});

import { addSlide, applyDeckOp } from './decks';
import type { Deck } from './decks';

function deckFixture(): Deck {
  return {
    slug: 'wk1',
    title: 'Week 1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    slides: [
      { id: 'a', type: 'markdown', content: 'A' },
      { id: 'b', type: 'markdown', content: 'B' },
    ],
  };
}

test('addSlide appends a validated slide with a generated id', () => {
  const next = addSlide(deckFixture(), { type: 'markdown', content: 'C' });
  expect(next.slides).toHaveLength(3);
  const added = next.slides[2];
  expect(added.type).toBe('markdown');
  expect(added.id).toMatch(/^[a-z0-9]{8}$/);
});

test('applyDeckOp reorder reverses the slides', () => {
  const next = applyDeckOp(deckFixture(), { op: 'reorder', order: ['b', 'a'] });
  expect(next.slides.map((s) => s.id)).toEqual(['b', 'a']);
});

test('applyDeckOp reorder rejects a non-permutation', () => {
  expect(() => applyDeckOp(deckFixture(), { op: 'reorder', order: ['b'] })).toThrow();
});

test('applyDeckOp deleteSlide removes by id', () => {
  const next = applyDeckOp(deckFixture(), { op: 'deleteSlide', id: 'a' });
  expect(next.slides.map((s) => s.id)).toEqual(['b']);
});

test('applyDeckOp updateSlide edits content and keeps id/type', () => {
  const next = applyDeckOp(deckFixture(), { op: 'updateSlide', id: 'a', patch: { content: 'A2' } });
  const s = next.slides[0] as { id: string; type: string; content: string };
  expect(s).toMatchObject({ id: 'a', type: 'markdown', content: 'A2' });
});

test('applyDeckOp updateDeck rejects an empty title', () => {
  expect(() => applyDeckOp(deckFixture(), { op: 'updateDeck', title: '   ' })).toThrow();
});

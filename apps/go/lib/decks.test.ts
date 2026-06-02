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

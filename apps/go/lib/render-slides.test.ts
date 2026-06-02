import { test, expect } from 'vitest';
import { slideToHtml, buildSections } from './render-slides';
import type { Deck } from './decks';

test('markdown slide renders to HTML', () => {
  const html = slideToHtml({ id: '1', type: 'markdown', content: '## Title' });
  expect(html).toContain('<h2');
  expect(html).toContain('Title');
});

test('image slide renders an img with escaped url and caption', () => {
  const html = slideToHtml({
    id: '1',
    type: 'image',
    url: 'https://x.test/a.png?b="c',
    caption: 'Cap',
  });
  expect(html).toContain('<img');
  expect(html).toContain('https://x.test/a.png?b=&quot;c');
  expect(html).toContain('Cap');
});

test('embed slide renders a lazy iframe', () => {
  const html = slideToHtml({ id: '1', type: 'embed', url: 'https://dash.test' });
  expect(html).toContain('data-src="https://dash.test"');
  expect(html).toContain('<iframe');
});

test('html slide passes through raw html', () => {
  const html = slideToHtml({ id: '1', type: 'html', html: '<div class="x">hi</div>' });
  expect(html).toBe('<div class="x">hi</div>');
});

test('buildSections maps every slide and renders notes', () => {
  const deck: Deck = {
    slug: 's',
    title: 'T',
    createdAt: '',
    updatedAt: '',
    slides: [{ id: '1', type: 'markdown', content: 'Body', notes: 'speaker' }],
  };
  const sections = buildSections(deck);
  expect(sections).toHaveLength(1);
  expect(sections[0].html).toContain('Body');
  expect(sections[0].notes).toContain('speaker');
});

import { strict as assert } from 'assert';
import { test } from 'node:test';
import { extractUrls, normalizeSitemap, validateUrl } from './urlCrawler.js';

test('urlCrawler: extractUrls should handle single URL', async (t) => {
  const urls = await extractUrls('https://example.com/page1');
  assert.deepEqual(urls, ['https://example.com/page1']);
});

test('urlCrawler: extractUrls should handle array of URLs', async (t) => {
  const inputUrls = ['https://example.com/page1', 'https://example.com/page2'];
  const urls = await extractUrls(inputUrls);
  assert.deepEqual(urls, inputUrls);
});

test('urlCrawler: extractUrls should deduplicate URLs', async (t) => {
  const inputUrls = ['https://example.com/page1', 'https://example.com/page1', 'https://example.com/page2'];
  const urls = await extractUrls(inputUrls);
  assert.deepEqual(urls, ['https://example.com/page1', 'https://example.com/page2']);
});

test('urlCrawler: validateUrl should return true for valid HTTP(S) URLs', (t) => {
  assert.equal(validateUrl('https://example.com'), true);
  assert.equal(validateUrl('http://example.com'), true);
  assert.equal(validateUrl('ftp://example.com'), false);
});

test('urlCrawler: normalizeSitemap should extract URLs from XML string', async (t) => {
  const xmlString = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/page1</loc>
  </url>
  <url>
    <loc>https://example.com/page2</loc>
  </url>
</urlset>`;

  const urls = await normalizeSitemap(xmlString);
  assert.deepEqual(urls, ['https://example.com/page1', 'https://example.com/page2']);
});

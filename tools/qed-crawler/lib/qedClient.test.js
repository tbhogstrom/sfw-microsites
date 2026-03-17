import { strict as assert } from 'assert';
import { test } from 'node:test';
import { QEDClient } from './qedClient.js';

test('qedClient: should initialize with handle', (t) => {
  const client = new QEDClient('sfw-construction');
  assert.equal(client.handle, 'sfw-construction');
});

test('qedClient: should format recommendations from scores', (t) => {
  const client = new QEDClient('sfw-construction');
  const scores = {
    engagement: 50,
    readability: 80,
    tone: 60
  };
  const recommendations = client.generateRecommendations(scores);
  assert.equal(Array.isArray(recommendations), true);
  assert.equal(recommendations.length > 0, true);
  // Should have recommendation for low engagement (below 70)
  assert.equal(recommendations.some(r => r.toLowerCase().includes('engagement')), true);
});

test('qedClient: should cache results', async (t) => {
  const client = new QEDClient('sfw-construction');
  const url = 'https://example.com/test';
  const mockResult = {
    url,
    scores: { engagement: 70, readability: 80, tone: 60 },
    composite: 72,
    status: 'success'
  };

  // Manually set cache for testing
  client.cache.set(url, mockResult);
  const cached = client.cache.get(url);
  assert.deepEqual(cached, mockResult);
});

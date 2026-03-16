import { strict as assert } from 'assert';
import { test } from 'node:test';
import { QEDClient } from './qedClient.js';

test('qedClient: should initialize with API key', (t) => {
  const client = new QEDClient('test-key');
  assert.equal(client.apiKey, 'test-key');
});

test('qedClient: should format recommendations from scores', (t) => {
  const client = new QEDClient('test-key');
  const scores = {
    engagement: 0.5,
    readability: 0.8,
    tone: 0.6
  };
  const recommendations = client.generateRecommendations(scores);
  assert.equal(Array.isArray(recommendations), true);
  assert.equal(recommendations.length > 0, true);
  // Should have recommendation for low engagement
  assert.equal(recommendations.some(r => r.toLowerCase().includes('engagement')), true);
});

test('qedClient: should cache results', async (t) => {
  const client = new QEDClient('test-key');
  const url = 'https://example.com/test';
  const mockResult = {
    url,
    scores: { engagement: 0.7, readability: 0.8, tone: 0.6 },
    status: 'success'
  };

  // Manually set cache for testing
  client.cache.set(url, mockResult);
  const cached = client.cache.get(url);
  assert.deepEqual(cached, mockResult);
});

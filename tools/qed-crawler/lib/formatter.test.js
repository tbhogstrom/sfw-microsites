import { strict as assert } from 'assert';
import { test } from 'node:test';
import { Formatter } from './formatter.js';

test('formatter: should format results to JSON', (t) => {
  const formatter = new Formatter('json');
  const results = [
    {
      url: 'https://example.com/page1',
      scores: { engagement: 0.7, readability: 0.8 },
      recommendations: ['Improve engagement'],
      status: 'success'
    }
  ];

  const output = formatter.format(results);
  const parsed = JSON.parse(output);
  assert.equal(Array.isArray(parsed), true);
  assert.equal(parsed[0].url, 'https://example.com/page1');
});

test('formatter: should format results to CSV', (t) => {
  const formatter = new Formatter('csv');
  const results = [
    {
      url: 'https://example.com/page1',
      scores: { engagement: 0.7, readability: 0.8 },
      recommendations: ['Improve engagement'],
      status: 'success'
    }
  ];

  const output = formatter.format(results);
  assert.equal(typeof output, 'string');
  assert.equal(output.includes('https://example.com/page1'), true);
});

test('formatter: should add recommendations to results', (t) => {
  const formatter = new Formatter('json');
  const result = {
    url: 'https://example.com',
    scores: { engagement: 0.5 },
    status: 'success'
  };

  const enhanced = formatter.addRecommendations(result);
  assert.equal(Array.isArray(enhanced.recommendations), true);
  assert.equal(enhanced.recommendations.length > 0, true);
});

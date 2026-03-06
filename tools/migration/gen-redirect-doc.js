#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const map = require('./redirect-map.json');

const lines = [
  '# Service Page Redirects',
  '',
  'Migration map from legacy service page URLs to new cluster page URLs.',
  'All redirects are 301 permanent (Astro static output default).',
  '',
  '**Source of truth:** `tools/migration/redirect-map.json`',
  '**Applied to:** each app\'s `astro.config.mjs` via `tools/migration/apply-redirects.js`',
  '**Validated by:** `node tools/migration/validate-redirects.js`',
  '',
  'Legacy service page files remain in `src/data/generated_content/` as content reference until cluster stubs are populated with generated content.',
  '',
  '---',
];

for (const [site, slugMap] of Object.entries(map)) {
  lines.push('');
  lines.push('## ' + site);
  lines.push('');
  lines.push('| Old URL | New URL |');
  lines.push('|---------|---------|');
  for (const [oldSlug, newSlug] of Object.entries(slugMap)) {
    lines.push('| /services/portland/' + oldSlug + ' | /services/portland/' + newSlug + ' |');
    lines.push('| /services/seattle/' + oldSlug + '  | /services/seattle/' + newSlug + '  |');
  }
}

const outDir = path.join(__dirname, '../../docs/migration');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'service-page-redirects.md'), lines.join('\n') + '\n');
console.log('Written docs/migration/service-page-redirects.md (' + lines.length + ' lines)');

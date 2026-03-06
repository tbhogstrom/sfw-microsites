#!/usr/bin/env node
/**
 * Validates that every legacy service page slug has a redirect in astro.config.mjs.
 *
 * Slug derivation matches services.ts logic:
 *   filename -> remove service_page_ prefix -> remove _<location>.md suffix ->
 *   replace _ with space -> replace " and " with " & " -> lowercase ->
 *   spaces to hyphens -> & to "and" -> remove non-alphanumeric except hyphen
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const APPS = [
  'beam-repair', 'chimney-repair', 'crawlspace-rot', 'deck-repair',
  'dry-rot', 'flashing-repair', 'lead-paint', 'leak-repair',
  'siding-repair', 'trim-repair'
];

function deriveSlug(fileName) {
  let name = fileName
    .replace('service_page_', '')
    .replace(/_(portland|seattle)\.md$/, '')
    .replace(/_/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/ and /g, ' & ');

  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9-]/g, '');
}

function extractRedirects(configContent) {
  const match = configContent.match(/redirects:\s*\{([\s\S]*?)\}/);
  if (!match) return new Set();
  const redirects = new Set();
  const lines = match[1].split('\n');
  for (const line of lines) {
    const keyMatch = line.match(/'([^']+)':/);
    if (keyMatch) redirects.add(keyMatch[1]);
  }
  return redirects;
}

let totalErrors = 0;

for (const app of APPS) {
  const contentDir = path.join(ROOT, 'apps', app, 'src', 'data', 'generated_content');
  const configPath = path.join(ROOT, 'apps', app, 'astro.config.mjs');

  if (!fs.existsSync(contentDir)) {
    console.warn(`WARN: no content dir for ${app}`);
    continue;
  }

  const configContent = fs.existsSync(configPath)
    ? fs.readFileSync(configPath, 'utf-8') : '';
  const definedRedirects = extractRedirects(configContent);

  const files = fs.readdirSync(contentDir).filter(
    f => f.startsWith('service_page_') &&
         !f.startsWith('service_page_cluster_') &&
         f.endsWith('.md') &&
         !f.includes('.ipynb_checkpoints')
  );

  const errors = [];

  for (const file of files) {
    const locationMatch = file.match(/_(portland|seattle)\.md$/);
    if (!locationMatch) continue;
    const location = locationMatch[1];
    const slug = deriveSlug(file);
    const oldUrl = `/services/${location}/${slug}`;

    if (!definedRedirects.has(oldUrl)) {
      errors.push(`  MISSING: ${oldUrl}  (from ${file})`);
    }
  }

  if (errors.length === 0) {
    console.log(`PASS ${app} (${files.length} legacy pages covered)`);
  } else {
    console.log(`FAIL ${app} — ${errors.length} missing redirects:`);
    errors.forEach(e => console.log(e));
    totalErrors += errors.length;
  }
}

console.log(`\n${totalErrors === 0 ? 'ALL PASS' : `TOTAL ERRORS: ${totalErrors}`}`);
process.exit(totalErrors > 0 ? 1 : 0);

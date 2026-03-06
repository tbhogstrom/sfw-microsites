#!/usr/bin/env node
/**
 * Reads tools/migration/redirect-map.json and updates each app's astro.config.mjs
 * with a redirects block covering both portland and seattle for each old slug.
 * Safe to re-run — replaces the redirects block each time.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const redirectMap = require('./redirect-map.json');

for (const [site, slugMap] of Object.entries(redirectMap)) {
  const configPath = path.join(ROOT, 'apps', site, 'astro.config.mjs');

  if (!fs.existsSync(configPath)) {
    console.warn(`WARN: ${configPath} not found, skipping`);
    continue;
  }

  const redirectEntries = [];
  for (const [oldSlug, newSlug] of Object.entries(slugMap)) {
    redirectEntries.push(
      `    '/services/portland/${oldSlug}': '/services/portland/${newSlug}',`,
      `    '/services/seattle/${oldSlug}':  '/services/seattle/${newSlug}',`
    );
  }

  const redirectsBlock = `  redirects: {\n${redirectEntries.join('\n')}\n  },`;

  let config = fs.readFileSync(configPath, 'utf-8');

  // Remove existing redirects block if present
  config = config.replace(/,?\s*\n?\s*redirects:\s*\{[\s\S]*?\},?/m, '');

  // Insert before the final }); of defineConfig
  config = config.replace(/\n\}\);[\s]*$/, `\n  ${redirectsBlock.trim()}\n});\n`);

  fs.writeFileSync(configPath, config, 'utf-8');
  console.log(`Updated ${site}/astro.config.mjs (${Object.keys(slugMap).length * 2} redirect entries)`);
}

console.log('\nDone. Run validate-redirects.js to verify coverage.');

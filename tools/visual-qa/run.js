#!/usr/bin/env node

import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { startServer } from './lib/server.js';
import { checkPage } from './lib/checks.js';
import { generateReport } from './lib/report.js';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

// --- Parse args ---
const args = process.argv.slice(2);
const site = args.find((a) => !a.startsWith('--'));
let pageFilter = args.find((a) => a.startsWith('--page='))?.split('=')[1] || null;
const modeArg = args.find((a) => a.startsWith('--mode='))?.split('=')[1] || undefined;

// Git Bash on Windows converts "/" to "C:/Program Files/Git/" — detect and fix
if (pageFilter && /^[A-Z]:/.test(pageFilter)) {
  pageFilter = '/';
}

if (!site) {
  console.error('Usage: node run.js <site-name> [--page=/path]');
  console.error('Example: node run.js siding-repair');
  console.error('Example: node run.js beam-repair --page=/');
  process.exit(1);
}

const appDir = resolve(REPO_ROOT, 'apps', site);
if (!existsSync(appDir)) {
  console.error(`Error: App directory not found: ${appDir}`);
  console.error(`Available sites: ${availableSites().join(', ')}`);
  process.exit(1);
}

function availableSites() {
  return readdirSync(resolve(REPO_ROOT, 'apps'));
}

// --- Define pages to check ---
function getPageRoutes(baseUrl) {
  const routes = [
    { path: '/', name: 'homepage' },
    { path: '/services', name: 'services/index' },
    { path: '/blog', name: 'blog/index' },
    { path: '/locations', name: 'locations/index' },
  ];

  if (pageFilter) {
    const filtered = routes.filter((r) => r.path === pageFilter);
    if (filtered.length === 0) {
      // Treat the filter as a custom path
      return [{ path: pageFilter, name: pageFilter.replace(/^\//, '') || 'homepage' }];
    }
    return filtered;
  }

  return routes;
}

// --- Main ---
async function main() {
  console.log(`Starting visual QA for: ${site}`);

  // Start server (tries dev, falls back to build+preview if dev returns 500)
  console.log('Starting server...');
  const server = await startServer(site, { mode: modeArg });
  console.log(`Server ready at: ${server.url} (mode: ${server.mode})`);

  // Set up report directory
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const reportDir = resolve(import.meta.dirname, 'reports', site, timestamp);
  await mkdir(reportDir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });

  try {
    const pages = getPageRoutes(server.url);
    const results = [];

    for (const route of pages) {
      const url = `${server.url}${route.path}`;
      console.log(`Checking: ${route.name} (${url})`);

      const page = await context.newPage();
      const result = await checkPage(page, url, route.name, reportDir);
      results.push(result);
      await page.close();
    }

    const report = await generateReport(site, results, reportDir);

    // Exit code reflects pass/fail for agent consumption
    process.exitCode = report.passed ? 0 : 1;
  } finally {
    await context.close();
    await browser.close();
    server.stop();
  }
}

main().catch((err) => {
  console.error('Visual QA failed:', err.message);
  process.exit(2);
});

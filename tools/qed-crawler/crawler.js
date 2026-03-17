#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs/promises';
import dotenv from 'dotenv';
import { extractUrls } from './lib/urlCrawler.js';
import { QEDClient } from './lib/qedClient.js';
import { Formatter } from './lib/formatter.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Parse command line arguments
 */
function parseArgs(argv) {
  const args = {
    target: null,
    format: 'json',
    output: null,
    handle: process.env.QED_HANDLE || 'default',
    concurrency: 3,
    dryRun: false,
    timeout: 30000
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const nextArg = argv[i + 1];

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (key === 'dry-run') {
        args.dryRun = true;
      } else if (nextArg && !nextArg.startsWith('--')) {
        if (key === 'format') args.format = nextArg;
        if (key === 'output') args.output = nextArg;
        if (key === 'handle') args.handle = nextArg;
        if (key === 'concurrency') args.concurrency = parseInt(nextArg, 10);
        if (key === 'timeout') args.timeout = parseInt(nextArg, 10);
        i++;
      }
    } else if (!args.target) {
      args.target = arg;
    }
  }

  return args;
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
QED Content Crawler v1.0.0

Usage:
  node crawler.js <target> [options]

Arguments:
  <target>              URL, sitemap URL, or file path containing URLs (one per line)

Options:
  --handle <handle>     QED profile handle to use (default: 'default', env: QED_HANDLE)
  --format json|csv     Output format (default: json)
  --output <file>       Write results to file (default: stdout)
  --concurrency <n>     Parallel QED requests (default: 3)
  --timeout <ms>        Timeout per URL in ms (default: 30000)
  --dry-run             Show what would be crawled, don't call QED

Examples:
  node crawler.js https://example.com
  node crawler.js https://example.com --handle sfw-construction
  node crawler.js https://example.com/sitemap.xml --format csv --output results.csv
  node crawler.js urls.txt --concurrency 5
  node crawler.js urls.txt --dry-run
`);
}

/**
 * Main execution
 */
async function main() {
  const args = parseArgs(process.argv);

  if (!args.target) {
    console.error('Error: No target provided');
    printHelp();
    process.exit(1);
  }

  try {
    console.log(`📍 Extracting URLs from: ${args.target}`);
    const urls = await extractUrls(args.target);

    if (urls.length === 0) {
      console.error('❌ No valid URLs found');
      process.exit(1);
    }

    console.log(`✓ Found ${urls.length} URL(s)`);
    urls.forEach(url => console.log(`  - ${url}`));

    if (args.dryRun) {
      console.log('\n✓ Dry-run complete. No QED requests made.');
      process.exit(0);
    }

    console.log(`\n📊 Grading content with QED.systems [${args.handle}] (${args.concurrency} parallel)...`);

    const qedClient = new QEDClient(args.handle);
    const results = await qedClient.gradeUrls(urls, args.concurrency);

    const successful = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'failed').length;

    console.log(`✓ Grading complete: ${successful} successful, ${failed} failed`);

    console.log(`\n📝 Formatting results as ${args.format.toUpperCase()}...`);

    const formatter = new Formatter(args.format);
    const output = formatter.format(results);

    if (args.output) {
      await fs.writeFile(args.output, output, 'utf-8');
      console.log(`✓ Results written to: ${args.output}`);
    } else {
      console.log('\n' + output);
    }

  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
    if (process.env.DEBUG) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

main();

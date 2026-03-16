# QED Content Crawler Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Node.js CLI tool that crawls microsites and external URLs, grades content using QED.systems API, and outputs JSON/CSV with scores and recommendations.

**Architecture:** Single-concern CLI with modular components: URL crawler (handles sitemaps/files/single URLs), QED client (API wrapper with rate limiting), and formatter (transforms scores into recommendations and outputs JSON/CSV).

**Tech Stack:** Node.js, minimal dependencies (dotenv, xml2js, csv-stringify, node-fetch), built-in CLI parsing.

---

## File Structure

```
tools/qed-crawler/
├── package.json              # Dependencies: dotenv, xml2js, csv-stringify, node-fetch
├── .env.example              # Template for QED_API_KEY
├── .gitignore                # node_modules, .env, .logs
├── README.md                 # Usage, examples, troubleshooting
├── crawler.js                # CLI entry point, orchestration
└── lib/
    ├── urlCrawler.js         # Parse sitemaps, read URL files, deduplicate
    ├── qedClient.js          # QED API wrapper, exponential backoff, caching
    └── formatter.js          # Convert scores → recommendations, output JSON/CSV
```

---

## Chunk 1: Project Setup

### Task 1: Initialize project structure and package.json

**Files:**
- Create: `tools/qed-crawler/package.json`
- Create: `tools/qed-crawler/crawler.js` (stub)
- Create: `tools/qed-crawler/lib/` (directory)

- [ ] **Step 1: Create package.json**

```bash
mkdir -p /c/Users/tfalcon/microsites/tools/qed-crawler/lib
cd /c/Users/tfalcon/microsites/tools/qed-crawler
```

Create `package.json`:
```json
{
  "name": "qed-crawler",
  "version": "1.0.0",
  "description": "CLI tool to crawl URLs and grade content with QED.systems",
  "type": "module",
  "main": "crawler.js",
  "scripts": {
    "start": "node crawler.js",
    "test": "node --test lib/*.test.js",
    "test:unit": "node --test lib/**/*.test.js"
  },
  "dependencies": {
    "dotenv": "^16.4.5",
    "xml2js": "^0.6.2",
    "csv-stringify": "^6.4.5"
  },
  "devDependencies": {},
  "engines": {
    "node": ">=18.0.0"
  }
}
```

- [ ] **Step 2: Run npm install**

```bash
cd /c/Users/tfalcon/microsites/tools/qed-crawler
npm install
```

Expected: `added X packages` message, node_modules/ directory created.

- [ ] **Step 3: Create stub crawler.js**

```javascript
#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Main entry point - will be populated later
async function main() {
  console.log('QED Crawler v1.0.0');
  console.log('Usage: node crawler.js <target> [options]');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
```

- [ ] **Step 4: Create lib directory**

```bash
mkdir -p /c/Users/tfalcon/microsites/tools/qed-crawler/lib
touch /c/Users/tfalcon/microsites/tools/qed-crawler/lib/.gitkeep
```

- [ ] **Step 5: Commit**

```bash
cd /c/Users/tfalcon/microsites/tools/qed-crawler
git add package.json package-lock.json crawler.js lib/
git commit -m "feat: initialize qed-crawler project structure"
```

---

### Task 2: Create .gitignore and .env.example

**Files:**
- Create: `tools/qed-crawler/.gitignore`
- Create: `tools/qed-crawler/.env.example`

- [ ] **Step 1: Create .gitignore**

```bash
cat > /c/Users/tfalcon/microsites/tools/qed-crawler/.gitignore << 'EOF'
node_modules/
.env
.env.local
.logs/
.backups/
*.log
results.json
results.csv
EOF
```

- [ ] **Step 2: Create .env.example**

```bash
cat > /c/Users/tfalcon/microsites/tools/qed-crawler/.env.example << 'EOF'
# QED.systems API configuration
QED_API_KEY=your_api_key_here
QED_API_URL=https://api.qed.systems
QED_API_TIMEOUT=30000

# Optional: for debugging
DEBUG=false
EOF
```

- [ ] **Step 3: Commit**

```bash
cd /c/Users/tfalcon/microsites/tools/qed-crawler
git add .gitignore .env.example
git commit -m "chore: add gitignore and env template"
```

---

## Chunk 2: URL Crawler Implementation

### Task 3: Write urlCrawler module

**Files:**
- Create: `tools/qed-crawler/lib/urlCrawler.js`
- Create: `tools/qed-crawler/lib/urlCrawler.test.js`

- [ ] **Step 1: Write failing test for URL extraction**

Create `lib/urlCrawler.test.js`:
```javascript
import { strict as assert } from 'assert';
import { test } from 'node:test';
import { extractUrls, normalizeSitemap } from './urlCrawler.js';

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
  const { validateUrl } = require('./urlCrawler.js');
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /c/Users/tfalcon/microsites/tools/qed-crawler
npm test
```

Expected: Test fails with "extractUrls is not exported" or similar.

- [ ] **Step 3: Write minimal implementation**

Create `lib/urlCrawler.js`:
```javascript
import { parseStringPromise } from 'xml2js';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Validate that a URL is HTTP or HTTPS
 * @param {string} url
 * @returns {boolean}
 */
export function validateUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Extract URLs from a sitemap XML string
 * @param {string} xmlString
 * @returns {Promise<string[]>}
 */
export async function normalizeSitemap(xmlString) {
  try {
    const parsed = await parseStringPromise(xmlString);
    const urlset = parsed.urlset?.url || [];
    return urlset.map(item => item.loc?.[0] || '').filter(Boolean);
  } catch (err) {
    throw new Error(`Failed to parse sitemap XML: ${err.message}`);
  }
}

/**
 * Extract URLs from a single URL, array, file, or sitemap
 * @param {string|string[]} target - URL, array of URLs, file path, or sitemap URL
 * @returns {Promise<string[]>} - Deduplicated array of valid URLs
 */
export async function extractUrls(target) {
  let urls = [];

  // Handle array input
  if (Array.isArray(target)) {
    urls = target;
  }
  // Handle single URL or file path
  else if (typeof target === 'string') {
    // Try as URL first
    if (validateUrl(target)) {
      // Check if it's a sitemap URL
      if (target.includes('sitemap')) {
        try {
          const response = await fetch(target, { timeout: 30000 });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const xmlText = await response.text();
          urls = await normalizeSitemap(xmlText);
        } catch (err) {
          throw new Error(`Failed to fetch sitemap from ${target}: ${err.message}`);
        }
      } else {
        // Single URL
        urls = [target];
      }
    }
    // Try as file path
    else {
      try {
        const content = await fs.readFile(target, 'utf-8');
        urls = content
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && validateUrl(line));
      } catch (err) {
        throw new Error(`Failed to read file or parse URL from ${target}: ${err.message}`);
      }
    }
  }

  // Validate and deduplicate
  const validUrls = [...new Set(urls.filter(validateUrl))];
  return validUrls;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /c/Users/tfalcon/microsites/tools/qed-crawler
npm test
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/tfalcon/microsites/tools/qed-crawler
git add lib/urlCrawler.js lib/urlCrawler.test.js
git commit -m "feat: implement URL crawler with tests"
```

---

## Chunk 3: QED Client Implementation

### Task 4: Write qedClient module

**Files:**
- Create: `tools/qed-crawler/lib/qedClient.js`
- Create: `tools/qed-crawler/lib/qedClient.test.js`

- [ ] **Step 1: Write failing test for QED client**

Create `lib/qedClient.test.js`:
```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /c/Users/tfalcon/microsites/tools/qed-crawler
npm test -- lib/qedClient.test.js
```

Expected: Test fails because QEDClient is not defined.

- [ ] **Step 3: Write minimal implementation**

Create `lib/qedClient.js`:
```javascript
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

/**
 * QED.systems API client with rate limiting and caching
 */
export class QEDClient {
  constructor(apiKey = process.env.QED_API_KEY) {
    if (!apiKey) {
      throw new Error('QED_API_KEY not provided. Set it in .env or pass it as argument.');
    }
    this.apiKey = apiKey;
    this.apiUrl = process.env.QED_API_URL || 'https://api.qed.systems';
    this.timeout = parseInt(process.env.QED_API_TIMEOUT || '30000', 10);
    this.cache = new Map();
    this.rateLimitDelay = 100; // ms between requests
    this.lastRequestTime = 0;
    this.maxRetries = 3;
  }

  /**
   * Generate recommendations based on QED scores
   * @param {object} scores - Scores object from QED
   * @returns {string[]} - Array of recommendations
   */
  generateRecommendations(scores) {
    const recommendations = [];
    const threshold = 0.7; // Score below 0.7 gets a recommendation

    if (scores.engagement && scores.engagement < threshold) {
      recommendations.push(
        'Strengthen your opening hook and add more compelling call-to-action elements to improve engagement.'
      );
    }

    if (scores.readability && scores.readability < threshold) {
      recommendations.push(
        'Simplify sentence structure and reduce jargon to improve readability scores.'
      );
    }

    if (scores.tone && scores.tone < threshold) {
      recommendations.push(
        'Align your messaging with brand voice guidelines for consistency.'
      );
    }

    // If no recommendations yet, add a general one
    if (recommendations.length === 0) {
      recommendations.push('Content meets baseline quality standards.');
    }

    return recommendations;
  }

  /**
   * Apply exponential backoff for rate limiting
   * @private
   */
  async applyRateLimit() {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.rateLimitDelay) {
      await new Promise(resolve =>
        setTimeout(resolve, this.rateLimitDelay - elapsed)
      );
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Fetch and grade a single URL with QED.systems
   * @param {string} url - URL to grade
   * @returns {Promise<object>} - Result object with scores and status
   */
  async gradeUrl(url) {
    // Check cache first
    if (this.cache.has(url)) {
      return this.cache.get(url);
    }

    let lastError;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        await this.applyRateLimit();

        const response = await fetch(`${this.apiUrl}/grade`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ url }),
          timeout: this.timeout
        });

        // Handle rate limiting with exponential backoff
        if (response.status === 429) {
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          console.warn(`Rate limited. Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const result = {
          url,
          scores: data.scores || {},
          metrics: data.metrics || {},
          status: 'success',
          timestamp: new Date().toISOString()
        };

        // Cache the result
        this.cache.set(url, result);
        return result;
      } catch (err) {
        lastError = err;
        // On timeout, don't retry
        if (err.name === 'AbortError') {
          break;
        }
      }
    }

    // Return error result after retries exhausted
    const errorResult = {
      url,
      status: 'failed',
      error: lastError?.message || 'Unknown error',
      timestamp: new Date().toISOString()
    };

    this.cache.set(url, errorResult);
    return errorResult;
  }

  /**
   * Grade multiple URLs in parallel with concurrency limit
   * @param {string[]} urls - Array of URLs
   * @param {number} concurrency - Max parallel requests (default: 3)
   * @returns {Promise<object[]>} - Array of result objects
   */
  async gradeUrls(urls, concurrency = 3) {
    const results = [];
    const inProgress = [];

    for (const url of urls) {
      const promise = this.gradeUrl(url)
        .then(result => {
          results.push(result);
          inProgress.splice(inProgress.indexOf(promise), 1);
          return result;
        });

      inProgress.push(promise);

      // Wait if we've hit concurrency limit
      if (inProgress.length >= concurrency) {
        await Promise.race(inProgress);
      }
    }

    // Wait for remaining requests
    await Promise.all(inProgress);
    return results;
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /c/Users/tfalcon/microsites/tools/qed-crawler
npm test -- lib/qedClient.test.js
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/tfalcon/microsites/tools/qed-crawler
git add lib/qedClient.js lib/qedClient.test.js
git commit -m "feat: implement QED client with rate limiting and caching"
```

---

## Chunk 4: Formatter Implementation

### Task 5: Write formatter module

**Files:**
- Create: `tools/qed-crawler/lib/formatter.js`
- Create: `tools/qed-crawler/lib/formatter.test.js`

- [ ] **Step 1: Write failing test for formatter**

Create `lib/formatter.test.js`:
```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /c/Users/tfalcon/microsites/tools/qed-crawler
npm test -- lib/formatter.test.js
```

Expected: Test fails because Formatter is not defined.

- [ ] **Step 3: Write minimal implementation**

Create `lib/formatter.js`:
```javascript
import { stringify } from 'csv-stringify/sync';

/**
 * Format QED results as JSON or CSV
 */
export class Formatter {
  constructor(format = 'json') {
    if (!['json', 'csv'].includes(format)) {
      throw new Error('Format must be "json" or "csv"');
    }
    this.format = format;
  }

  /**
   * Generate recommendations from scores
   * @param {object} scores
   * @returns {string[]}
   */
  generateRecommendations(scores = {}) {
    const recommendations = [];
    const threshold = 0.7;

    if ((scores.engagement || 0) < threshold) {
      recommendations.push(
        'Strengthen your opening hook and add compelling call-to-action elements.'
      );
    }

    if ((scores.readability || 0) < threshold) {
      recommendations.push(
        'Simplify sentence structure and reduce jargon for better readability.'
      );
    }

    if ((scores.tone || 0) < threshold) {
      recommendations.push(
        'Ensure consistent brand voice throughout the content.'
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('Content meets baseline quality standards.');
    }

    return recommendations;
  }

  /**
   * Add recommendations to a single result
   * @param {object} result
   * @returns {object}
   */
  addRecommendations(result) {
    return {
      ...result,
      recommendations: this.generateRecommendations(result.scores)
    };
  }

  /**
   * Format results as JSON string
   * @param {object[]} results
   * @returns {string}
   */
  formatJson(results) {
    return JSON.stringify(results, null, 2);
  }

  /**
   * Format results as CSV string
   * @param {object[]} results
   * @returns {string}
   */
  formatCsv(results) {
    const records = results.map(result => ({
      url: result.url,
      engagement: result.scores?.engagement || '',
      readability: result.scores?.readability || '',
      tone: result.scores?.tone || '',
      recommendation_1: result.recommendations?.[0] || '',
      recommendation_2: result.recommendations?.[1] || '',
      status: result.status,
      error: result.error || ''
    }));

    return stringify(records, { header: true });
  }

  /**
   * Format results based on configured format
   * @param {object[]} results
   * @returns {string}
   */
  format(results) {
    // Add recommendations to all results
    const enrichedResults = results.map(r => this.addRecommendations(r));

    if (this.format === 'json') {
      return this.formatJson(enrichedResults);
    } else if (this.format === 'csv') {
      return this.formatCsv(enrichedResults);
    }

    throw new Error(`Unknown format: ${this.format}`);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /c/Users/tfalcon/microsites/tools/qed-crawler
npm test -- lib/formatter.test.js
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/tfalcon/microsites/tools/qed-crawler
git add lib/formatter.js lib/formatter.test.js
git commit -m "feat: implement formatter for JSON and CSV output"
```

---

## Chunk 5: CLI Implementation

### Task 6: Write main CLI entry point

**Files:**
- Modify: `tools/qed-crawler/crawler.js`

- [ ] **Step 1: Write complete CLI implementation**

Replace `tools/qed-crawler/crawler.js`:

```javascript
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
  --format json|csv     Output format (default: json)
  --output <file>       Write results to file (default: stdout)
  --concurrency <n>     Parallel QED requests (default: 3)
  --timeout <ms>        Timeout per URL in ms (default: 30000)
  --dry-run             Show what would be crawled, don't call QED

Examples:
  node crawler.js https://example.com
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

    console.log(`\n📊 Grading content with QED.systems (${args.concurrency} parallel)...`);

    const qedClient = new QEDClient();
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
```

- [ ] **Step 2: Test CLI with help**

```bash
cd /c/Users/tfalcon/microsites/tools/qed-crawler
node crawler.js --help 2>&1 | head -5
```

Expected: Help message prints (or "Error: No target provided" then help).

- [ ] **Step 3: Test dry-run with sample URL**

```bash
cd /c/Users/tfalcon/microsites/tools/qed-crawler
node crawler.js https://example.com --dry-run
```

Expected: "Dry-run complete. No QED requests made."

- [ ] **Step 4: Make crawler.js executable**

```bash
chmod +x /c/Users/tfalcon/microsites/tools/qed-crawler/crawler.js
```

- [ ] **Step 5: Commit**

```bash
cd /c/Users/tfalcon/microsites/tools/qed-crawler
git add crawler.js
git commit -m "feat: implement CLI entry point with argument parsing"
```

---

## Chunk 6: Documentation and Polish

### Task 7: Write README.md

**Files:**
- Create: `tools/qed-crawler/README.md`

- [ ] **Step 1: Create README**

```bash
cat > /c/Users/tfalcon/microsites/tools/qed-crawler/README.md << 'EOF'
# QED Content Crawler

A CLI tool for crawling SFW Construction microsites and external URLs, grading content quality with [QED.systems](https://qed.systems), and outputting scores with actionable recommendations.

## Features

- **Multiple input formats**: single URL, sitemap, or file with URL list
- **Content grading**: Integrates with QED.systems API for comprehensive content scoring
- **Recommendations**: Auto-generates improvement suggestions based on scores
- **Output formats**: JSON (default) or CSV
- **Concurrent requests**: Configurable parallelism to speed up crawling
- **Rate limiting**: Exponential backoff for API rate limits
- **Caching**: Results cached during a run (no duplicate QED calls)

## Setup

1. Clone or download this tool
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create `.env` file with your QED API key:
   ```bash
   cp .env.example .env
   # Edit .env and add your QED_API_KEY
   ```

## Usage

### Basic usage

Grade a single URL:
```bash
node crawler.js https://siding-repair.sfwconstruction.com/services
```

### Grade a sitemap
```bash
node crawler.js https://siding-repair.sfwconstruction.com/sitemap.xml --output results.json
```

### Grade multiple URLs from a file
```bash
# Create urls.txt with one URL per line
node crawler.js urls.txt --format csv --output results.csv
```

### Options

- `--format json|csv` — Output format (default: `json`)
- `--output <file>` — Save results to file (default: stdout)
- `--concurrency <n>` — Parallel QED requests (default: `3`)
- `--timeout <ms>` — Per-URL timeout in milliseconds (default: `30000`)
- `--dry-run` — Show URLs that would be crawled, don't make QED calls

### Dry-run example

Preview what will be crawled without making API calls:
```bash
node crawler.js https://siding-repair.sfwconstruction.com/sitemap.xml --dry-run
```

## Output

### JSON Format

```json
[
  {
    "url": "https://siding-repair.sfwconstruction.com/services",
    "scores": {
      "engagement": 0.72,
      "readability": 0.88,
      "tone": 0.65
    },
    "recommendations": [
      "Strengthen your opening hook and add compelling call-to-action elements.",
      "Ensure consistent brand voice throughout the content."
    ],
    "status": "success",
    "timestamp": "2026-03-16T15:30:00Z"
  }
]
```

### CSV Format

| url | engagement | readability | tone | recommendation_1 | recommendation_2 | status |
|-----|-----------|-------------|------|-----------------|-----------------|--------|
| https://siding-repair... | 0.72 | 0.88 | 0.65 | Strengthen your opening hook... | Ensure consistent brand voice... | success |

## Recommendations

The tool generates recommendations based on score thresholds (< 0.7):

- **Engagement < 0.7**: Strengthen opening hooks and CTAs
- **Readability < 0.7**: Simplify sentence structure and reduce jargon
- **Tone < 0.7**: Align messaging with brand voice guidelines

## Error Handling

Failed URLs are included in output with `status: "failed"` and an error message:

```json
{
  "url": "https://example.com/missing",
  "status": "failed",
  "error": "HTTP 404: Not Found",
  "timestamp": "2026-03-16T15:30:00Z"
}
```

Common errors:
- **HTTP 404**: URL not found
- **Timeout**: URL took too long to respond (> 30s)
- **Network error**: Connection failed

## Troubleshooting

### Missing API Key
```
Error: QED_API_KEY not provided. Set it in .env or pass it as argument.
```
Create `.env` and add `QED_API_KEY=your_key_here`

### No URLs found
Check that:
- Your URL/sitemap is correct
- Your file exists and contains valid URLs (one per line)
- URLs start with `http://` or `https://`

### Rate limiting
The tool automatically retries with exponential backoff if QED returns HTTP 429. If you see timeouts, try reducing `--concurrency`.

## Development

Run tests:
```bash
npm test
```

Run with debug output:
```bash
DEBUG=true node crawler.js <target>
```

## Future Enhancements

- Database persistence for historical tracking
- Trend analysis and reports
- Resume capability for interrupted crawls
- Scheduled/cron integration
- Web UI dashboard
EOF
```

- [ ] **Step 2: Commit**

```bash
cd /c/Users/tfalcon/microsites/tools/qed-crawler
git add README.md
git commit -m "docs: add comprehensive README with usage and examples"
```

---

### Task 8: Final testing and validation

**Files:**
- All files (testing phase)

- [ ] **Step 1: Verify all tests pass**

```bash
cd /c/Users/tfalcon/microsites/tools/qed-crawler
npm test
```

Expected: All tests pass.

- [ ] **Step 2: Test package.json scripts**

```bash
cd /c/Users/tfalcon/microsites/tools/qed-crawler
npm run start
```

Expected: Help/usage message prints.

- [ ] **Step 3: Test with valid dry-run**

```bash
cd /c/Users/tfalcon/microsites/tools/qed-crawler
node crawler.js https://example.com --dry-run
```

Expected: "Extracting URLs..." → "✓ Found 1 URL(s)" → "Dry-run complete."

- [ ] **Step 4: Verify git history**

```bash
cd /c/Users/tfalcon/microsites/tools/qed-crawler
git log --oneline | head -10
```

Expected: All commits visible (initialize, gitignore, urlCrawler, qedClient, formatter, CLI, README).

- [ ] **Step 5: Final cleanup and commit**

```bash
cd /c/Users/tfalcon/microsites/tools/qed-crawler
# Make sure .gitignore is respected
git status
# Should NOT show node_modules, .env, or .logs
```

Expected: Clean working tree.

- [ ] **Step 6: Verify package.json exists and is correct**

```bash
cd /c/Users/tfalcon/microsites/tools/qed-crawler
cat package.json | grep -A 5 '"scripts"'
```

Expected: scripts section shows `start`, `test`, `test:unit`.

---

## Final Checklist

- [ ] All files created with correct paths
- [ ] All tests passing
- [ ] CLI works with dry-run
- [ ] .env.example documents required env vars
- [ ] README includes usage examples
- [ ] Git commits are clean and descriptive
- [ ] No uncommitted changes
- [ ] Ready for first integration test with real QED API

## Next Steps

After implementation:
1. Test with real QED API key against siding-repair microsite
2. Validate JSON/CSV output format
3. Test with multiple sitemaps
4. Monitor rate-limit behavior
5. Consider adding result persistence (v2)

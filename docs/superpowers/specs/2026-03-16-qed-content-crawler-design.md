# QED Content Crawler v1 Design

**Date:** 2026-03-16
**Status:** Design Phase
**Priority:** High (Siding Repair content audit)

## Overview

A Node.js CLI tool that crawls your microsites (and arbitrary URLs), submits content to QED.systems for quality grading, and outputs structured results (JSON/CSV) with auto-derived recommendations for content improvement.

**Primary Use:** Internal content quality assurance — ensure all pages conform to content guidelines for engagement and conversion.

**Target Sites:** All 11 SFW Construction microsites, with immediate focus on siding-repair.

## Requirements

### Functional
- Accept input as: single URL, sitemap URL, or file list of URLs
- Query QED.systems API for each URL to retrieve content quality scores
- Output results as JSON or CSV containing: URL, scores, and recommendations
- Handle basic error cases (404s, timeouts, rate limits)
- Support configurable parallelism/concurrency for batch runs

### Non-Functional
- CLI-only (no web UI)
- Lightweight, minimal dependencies
- Fast startup
- Clear error messages

## Architecture

### Components

#### 1. URL Crawler (`lib/urlCrawler.js`)
**Responsibility:** Take a target (URL, sitemap, or file) and generate a queue of URLs to audit.

**Inputs:**
- `target`: string (URL, file path, or sitemap URL)

**Outputs:**
- Array of unique, valid URLs

**Details:**
- Parse sitemaps (XML) to extract URLs
- Read text files (one URL per line)
- Handle single URLs directly
- Deduplicate URLs
- Respect robots.txt (skip if robots.txt explicitly disallows crawling for user agent)
- Basic validation (must be HTTP/HTTPS)

#### 2. QED Client (`lib/qedClient.js`)
**Responsibility:** Wrap QED.systems API calls and handle rate limiting.

**Inputs:**
- `url`: string (the page to grade)

**Outputs:**
- Object with QED.systems response: `{ url, scores, metrics, raw }`

**Details:**
- Use QED.systems MCP or HTTP API (whichever is available)
- Implement exponential backoff for rate limiting (respect HTTP 429)
- Timeout after 30s per URL
- Return null/error on failure; let caller decide to skip or retry
- Cache results in memory during a single run (don't re-query same URL twice)

#### 3. Recommendation Engine (inline in `lib/formatter.js`)
**Responsibility:** Convert QED scores into human-readable, actionable recommendations.

**Logic:**
- If engagement score < threshold → recommend "strengthen opening hook and CTAs"
- If readability score < threshold → recommend "simplify sentence structure and reduce jargon"
- If tone/voice inconsistency detected → recommend "align messaging with brand voice"
- Generate 2-3 specific, actionable recommendations per URL

**Output:** Array of recommendation strings, added to each result record.

#### 4. Output Formatter (`lib/formatter.js`)
**Responsibility:** Convert QED results into JSON or CSV.

**JSON Structure:**
```json
[
  {
    "url": "https://siding-repair.sfwconstruction.com/services",
    "scores": {
      "engagement": 0.72,
      "readability": 0.88,
      "tone": 0.65,
      ...
    },
    "recommendations": [
      "Strengthen opening hook to improve engagement score",
      "Add specific call-to-action above the fold"
    ],
    "status": "success",
    "timestamp": "2026-03-16T15:30:00Z"
  },
  ...
]
```

**CSV:** Flattened version with columns: URL, Score_Engagement, Score_Readability, Recommendation_1, Recommendation_2, Status

### CLI Interface

```bash
node crawler.js <target> [options]

# Examples:
node crawler.js https://siding-repair.sfwconstruction.com
node crawler.js https://siding-repair.sfwconstruction.com/sitemap.xml
node crawler.js urls.txt
node crawler.js urls.txt --format csv --output results.csv --concurrency 5 --dry-run
```

**Options:**
- `--format json|csv` — Output format (default: json)
- `--output <file>` — Write results to file (default: stdout)
- `--concurrency <n>` — Parallel QED requests (default: 3)
- `--dry-run` — Show what would be crawled, don't call QED
- `--timeout <ms>` — Timeout per URL (default: 30000)

## Data Flow

```
Input (URL/sitemap/file)
    ↓
URL Crawler extracts URLs
    ↓
[For each URL in parallel (respecting concurrency limit)]
    ├→ Fetch URL (HEAD request for validation)
    ├→ Call QED.systems API
    ├→ Store result (or error)
    ↓
Collect all results
    ↓
Recommendation Engine processes scores
    ↓
Output Formatter → JSON/CSV
    ↓
Write to file or stdout
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| URL returns 404 | Log warning, mark as "failed", continue |
| QED API times out | Retry once with backoff, then mark "timeout" |
| QED rate limits (429) | Exponential backoff, retry up to 3 times |
| Invalid URL format | Log error, skip URL |
| Network error | Log and skip |
| File not found | Exit with error message |

All errors appear in output with `status: "failed"` and an `error` field.

## File Structure

```
tools/qed-crawler/
├── package.json
├── .env.example
├── .gitignore
├── README.md
├── crawler.js            # CLI entry point, main orchestration
├── lib/
│   ├── urlCrawler.js     # URL extraction from sitemaps/files/single URL
│   ├── qedClient.js      # QED API wrapper, rate limiting
│   └── formatter.js      # Recommendations + JSON/CSV output
└── test/                 # (optional, v2+)
    └── urlCrawler.test.js
```

## Dependencies

- `dotenv` — Load QED API credentials from .env
- `node-fetch` or built-in `fetch` — HTTP requests
- `xml2js` — Sitemap parsing
- `csv-stringify` — CSV generation (if building CSV in-memory)

Keep minimal; prefer built-in Node APIs where possible.

## Assumptions & Future Work

**Assumptions:**
- QED.systems provides a queryable API or MCP
- URLs are publicly accessible (no auth required for content)
- Crawling public sitemaps is permitted by site owners

**Not in v1 (future):**
- Result persistence / database
- Historical tracking / trend analysis
- Resume on interrupted crawls
- Scheduling / cron integration
- Web UI for visualization

## Success Criteria

- [x] Can crawl siding-repair microsite (all pages)
- [x] Successfully calls QED.systems and retrieves scores for each URL
- [x] Outputs JSON and CSV with scores + recommendations
- [x] Handles 404s, timeouts, and rate limits gracefully
- [x] Dry-run mode works (shows URLs without calling QED)
- [x] Respects concurrency limits
- [x] Clear error messages on failures

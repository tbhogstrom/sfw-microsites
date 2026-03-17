# QED Content Crawler

A CLI tool for crawling SFW Construction microsites and external URLs, grading content quality against [QED.systems](https://qed.systems) quality profiles, and generating detailed trait-based reports.

## Features

- **Multiple input formats**: single URL, sitemap (XML), or file with URL list
- **Multi-profile grading**: Score content against different QED profiles (e.g., `qed.compelling-readme`, `qed.technical-writing`)
- **Trait-based scoring**: Get scores for 6-8 traits per profile (e.g., Hook Speed, Honest Specificity) with 0-100 scale
- **Merged reporting**: Combine multiple profiles into a single report with all traits visible
- **Output formats**: JSON (default), CSV, or trait-based CSV (all traits as columns)
- **Concurrent requests**: Configurable parallelism (default: 3) to speed up crawling
- **Rate limiting**: Exponential backoff for 429 responses
- **Caching**: Results cached in-memory to avoid duplicate API calls
- **Dry-run mode**: Preview what will be crawled without making API calls

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env` file (QED.systems API is public - no authentication key needed):
   ```bash
   cp .env.example .env
   ```

   Default `.env`:
   ```
   QED_HANDLE=default
   QED_API_URL=https://qed.systems
   QED_API_TIMEOUT=30000
   DEBUG=false
   ```

## Usage

### Grade a single URL
```bash
node crawler.js https://example.com --handle qed.compelling-readme
```

### Crawl and grade a sitemap
```bash
node crawler.js https://example.com/sitemap.xml --handle qed.compelling-readme --output results.json
```

### Test with dry-run (preview without API calls)
```bash
node crawler.js https://example.com/sitemap.xml --dry-run
```

### Grade with multiple profiles
```bash
# Run separate crawls with different profiles
node crawler.js https://example.com/sitemap.xml --handle qed.compelling-readme --output cr-results.json
node crawler.js https://example.com/sitemap.xml --handle qed.technical-writing --output tw-results.json

# Then merge them (merge-results.js)
node merge-results.js cr-results.json tw-results.json --output merged-report.json
```

### Export traits as separate CSV columns
After generating merged results:
```bash
node export-traits.js merged-report.json output-traits.csv
```

This creates a CSV with every trait as its own column for easy analysis in Excel/Sheets.

### Options

- `--handle <profile>` — QED profile to use (default: from `.env` or `default`)
- `--format json|csv` — Output format (default: `json`)
- `--output <file>` — Save results to file (default: stdout)
- `--concurrency <n>` — Parallel QED requests (default: `3`)
- `--timeout <ms>` — Per-URL timeout in milliseconds (default: `30000`)
- `--dry-run` — Show URLs that would be crawled, don't make QED calls

## QED Profiles

### qed.compelling-readme
Measures how well content hooks readers and explains value. Traits:
- Concrete Usage Demonstration
- Copy-Pasteable Setup
- Hook Speed
- Hype-Free Credibility
- Problem Framing
- Progressive Disclosure
- Structural Scannability
- Value Proposition Clarity

### qed.technical-writing
Measures technical clarity and depth. Traits:
- Actionable Takeaways
- Grounded Motivation
- Honest Specificity
- Incremental Complexity
- Narrative Throughline
- Progressive Concreteness

## Output Formats

### JSON Format (default)
```json
[
  {
    "url": "https://example.com/page",
    "scores": {
      "Hook Speed": 86,
      "Concrete Usage Demonstration": 79,
      "Copy-Pasteable Setup": 60
    },
    "composite": 75,
    "status": "success"
  }
]
```

### CSV Format
Standard CSV with URL, composite score, and status.

### Trait CSV Format (from export-traits.js)
```
url,path,CR_Composite,CR_Hook Speed,CR_Concrete Usage Demonstration,...,TW_Composite,TW_Honest Specificity,...,Average_Composite
https://example.com/,/,75,86,79,...,75,90,...,75
```

All individual traits visible as separate columns for easy filtering/sorting in spreadsheet applications.

## Real-World Examples

### Audit sidingrepairexperts.com
```bash
# Generate compelling-readme scores
node crawler.js https://sidingrepairexperts.com/sitemap.xml --handle qed.compelling-readme --output siding-cr.json

# Generate technical-writing scores
node crawler.js https://sidingrepairexperts.com/sitemap.xml --handle qed.technical-writing --output siding-tw.json

# Merge both into a report
node merge-results.js siding-cr.json siding-tw.json --output siding-merged.json

# Export with all traits as columns
node export-traits.js siding-merged.json siding-traits.csv
```

Result: `siding-traits.csv` with 43 URLs × 18 trait columns for detailed analysis.

## MCP Server Integration

QED.systems provides an MCP server for direct API access. To use it:

1. **In Claude Code**: The QED MCP server is available at `https://qed.systems/mcp`

2. **Available tools**:
   - `score` — Score content/URL against a profile: `mcp__qed__score(profile_handle, content, compare_to?, traits?)`
   - `list_traits` — List available traits for a profile: `mcp__qed__list_traits(profile_handle)`

3. **Example**:
   ```
   Tool: mcp__qed__list_traits
   Input: profile_handle = "qed.compelling-readme"
   Output: All 8 traits with descriptions
   ```

See https://qed.systems/docs for full API documentation.

## Troubleshooting

### No URLs found from sitemap
- Verify the sitemap URL is correct
- Check that it's a valid XML sitemap (not sitemap-index.xml - use individual sitemaps like sitemap-0.xml)
- Ensure URLs in sitemap start with `http://` or `https://`

### Rate limiting / 429 errors
The tool automatically retries with exponential backoff. If you see persistent timeouts:
- Reduce `--concurrency` from 3 to 1 or 2
- Increase `--timeout` to 60000 (60 seconds)

### Example with rate-limit handling:
```bash
node crawler.js https://large-site.com/sitemap.xml --concurrency 1 --timeout 60000 --output results.json
```

## Development

Run tests:
```bash
npm test
```

Run tests with coverage:
```bash
npm test 2>&1 | grep -E "passing|failing"
```

Debug output:
```bash
DEBUG=true node crawler.js <target>
```

## Files

- `crawler.js` — Main CLI entry point
- `lib/urlCrawler.js` — URL extraction from sitemaps and files
- `lib/qedClient.js` — QED.systems API client
- `lib/formatter.js` — JSON/CSV output formatting
- `lib/traitExporter.js` — Trait-to-CSV column conversion
- `merge-results.js` — Merge results from multiple profiles
- `export-traits.js` — Export merged results with traits as columns
- `lib/qedClient.test.js` — QED client tests

## Latest Updates (2026-03-17)

- ✅ Completed QED crawler implementation with 11 passing tests
- ✅ Audited all 43 pages on sidingrepairexperts.com with `qed.compelling-readme` and `qed.technical-writing` profiles
- ✅ Created trait-based CSV export with all 14 traits as separate columns
- ✅ Added `TraitExporter` class for spreadsheet-friendly output
- ✅ All results merged and validated (avg score: 60.8/100 across site)
- ✅ Tool ready for other 10 SFW microsites

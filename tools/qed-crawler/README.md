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

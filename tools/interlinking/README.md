# Interlinking Tool

Automatically suggest and insert contextual links from microsite content to:
- SFW Construction main site pages
- Related microsite DBAs

## Features

- Analyzes blog posts and service pages for relevant topics
- Suggests 1-2 contextual SFW Construction links per page
- Recommends related microsite cross-links
- Provides multiple natural anchor text options
- Respects interlinking best practices (no keyword stuffing, natural placement)

## Installation

```bash
cd tools/interlinking
npm install
```

## Usage

### Analyze a blog post and get link suggestions

```bash
node suggest-links.js --file ../../apps/deck-repair/src/data/blog-posts/post-slug.md
```

### Analyze all blog posts for a microsite

```bash
node suggest-links.js --microsite deck-repair
```

### Generate report for all microsites

```bash
node suggest-links.js --all
```

## Configuration

Edit `config.json` to customize:
- Number of links per page (default: 1-2)
- Link placement strategy
- Topic keywords for each microsite
- Excluded terms

## Data Files

- `sfw-links.json` - SFW Construction URLs and anchor text options
- `microsite-relationships.json` - Cross-linking map between microsites
- `config.json` - Tool configuration

## Output

The tool generates:
- Markdown with suggested link placements
- JSON report of suggestions
- Statistics on link coverage across microsites

# content-review

A multi-agent editorial pipeline for reviewing and improving AI-generated markdown content across the SFW Construction microsites.

## Overview

This tool uses a pipeline of specialized AI agents to audit, score, and rewrite markdown content files in the `apps/` directory. Each agent focuses on a specific editorial concern (tone, accuracy, SEO, readability, etc.) and produces structured feedback stored in a LanceDB vector database for retrieval and reporting.

## Setup

### Prerequisites

- Python 3.11+
- An OpenAI API key

### Install

```bash
cd tools/content-review

# Create virtual environment
python -m venv .venv

# Activate (Windows / Git Bash)
source .venv/Scripts/activate

# Install dependencies
pip install -r requirements-dev.txt
```

### Environment

Copy `.env.example` to `.env` and fill in your key:

```bash
cp .env.example .env
# Edit .env and set OPENAI_API_KEY
```

## Usage

```bash
# Run the full review pipeline on all sites
python review.py

# Review a single site
python review.py --site dry-rot

# Review a specific file
python review.py --file apps/dry-rot/src/content/home.md

# Output results as JSON
python review.py --output json

# Set verbosity
python review.py --verbose
```

### CLI Flags

| Flag | Description |
|------|-------------|
| `--site <name>` | Limit review to a single microsite (e.g. `dry-rot`) |
| `--file <path>` | Review a single markdown file |
| `--output <format>` | Output format: `text` (default) or `json` |
| `--verbose` | Enable verbose logging |
| `--dry-run` | Run agents but do not write results to LanceDB |

## Agents

Agents live in the `agents/` directory. Each agent is a self-contained module that receives a document and returns structured feedback.

| Agent | Responsibility |
|-------|---------------|
| `tone_agent` | Checks for consistent, professional brand voice |
| `accuracy_agent` | Flags factual claims that may need verification |
| `seo_agent` | Evaluates keyword usage, headings, and meta descriptions |
| `readability_agent` | Scores reading level and sentence complexity |
| `completeness_agent` | Checks that all required content sections are present |

## Notebooks

Exploratory notebooks live in `notebooks/`. Use them for one-off analysis, prompt tuning, and dataset inspection.

| Notebook | Purpose |
|----------|---------|
| `explore_results.ipynb` | Browse and filter stored review results |
| `prompt_tuning.ipynb` | Experiment with agent prompts interactively |

## LanceDB

Review results are persisted to a local LanceDB database at `.lancedb/` (gitignored). LanceDB stores results as vector embeddings, enabling semantic search over past reviews. The database is created automatically on first run.

To reset the database:

```bash
rm -rf .lancedb/
```

# Content Review Pipeline

Multi-agent editorial pipeline for SFW Construction microsites. Passes markdown content through specialist AI agents (quality cleaner → language editor) in sequence, improving content quality and brand alignment.

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

```bash
cp .env.example .env
# Edit .env and set OPENAI_API_KEY=sk-...
```

## Usage

Run from `tools/content-review/` with the venv active.

```bash
# Single file, dry run (preview only — no writes)
python review.py --file ../../apps/deck-repair/src/data/generated_content/some-file.md --dry-run

# Single file, apply changes
python review.py --file ../../apps/deck-repair/src/data/generated_content/some-file.md

# All files in one site
python review.py --microsite deck-repair

# All sites
python review.py --all

# Run only the quality cleaner agent
python review.py --file ../../apps/deck-repair/src/data/generated_content/some-file.md --agents quality-cleaner
```

### CLI Flags

| Flag | Description |
|------|-------------|
| `--file <path>` | Process a single markdown file (path relative to cwd) |
| `--microsite <name>` | Process all content files for one microsite app |
| `--all` | Process all 12 microsite apps |
| `--dry-run` | Preview output without writing files |
| `--agents <id,...>` | Comma-separated agent IDs to run (e.g. `quality-cleaner`) |

## Agents

Agent definitions live in `agents/`. Each agent is a markdown file with YAML frontmatter (model, temperature) and a prose system prompt.

| Agent file | ID | Purpose |
|---|---|---|
| `01-quality-cleaner.md` | `quality-cleaner` | Removes citation artifacts, fixes malformed link injections, dedupes H1 headings |
| `02-language-editor.md` | `language-editor` | Improves tone, voice, clarity, and brand alignment |

Pipeline order and shared context are configured in `pipeline.md`.

## Notebooks

| Notebook | Purpose |
|---|---|
| `01-test-quality-agent.ipynb` | Test quality cleaner on real files, inspect diffs |
| `02-test-language-agent.ipynb` | Test language editor, evaluate tone changes |
| `03-test-full-pipeline.ipynb` | End-to-end pipeline test with quality metrics |

## Testing

```bash
cd tools/content-review
source .venv/Scripts/activate
pytest tests/ -v
```

All 27 tests cover: agent config parsing, pipeline config parsing, OpenAI caller (mocked), pipeline runner (mocked), and LanceDB dedup store (mocked).

## LanceDB

After processing, content embeddings are stored in `.lancedb/` (gitignored). Used for near-duplicate detection — the CLI will warn when a processed file is very similar to another file across sites.

Future plans: use the vector store for RAG-style retrieval to give agents cross-site context when reviewing content.

To reset:

```bash
rm -rf .lancedb/
```

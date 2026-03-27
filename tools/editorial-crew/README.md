# Editorial Crew

Agentic editorial workflow for improving markdown content files. Uses Claude Agent SDK to run specialist agents (grammar, structure, readability, etc.) against markdown files.

## Setup

```bash
cd tools/editorial-crew
pip install -e .
```

Requires Python 3.11+ and a valid Claude API key in `.env` (copy from `.env.example`).

## Usage

```bash
# Run on a single file
python -m editorial_crew path/to/file.md

# Run on multiple files with glob
python -m editorial_crew "apps/siding-repair/src/data/generated_content/*.md"

# Run specific agents only
python -m editorial_crew file.md --agents grammar,structure
```

## Available Agents

See `editorial_crew/agents/registry.py` for the full list of specialist agents.

## Integration with Monorepo

This tool lives in the microsites monorepo at `tools/editorial-crew/`. It's a Python project (not a Node.js package) and is not part of the npm workspace.

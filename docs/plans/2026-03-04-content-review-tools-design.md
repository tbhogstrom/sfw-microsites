# Content Review Tools — Design Document

**Date:** 2026-03-04
**Status:** Approved
**Location:** `tools/content-review/`

---

## Problem

Generated content across 12 microsites contains recurring quality issues:
- Citation artifacts leaked from source books: `[Source: Author, Page N]`
- Malformed interlinking injections mid-sentence (e.g. `"...can For related services, [link] can help. lead to..."`)
- Duplicate H1 headings (title appears twice at top of file)
- Inconsistent tone, voice, and brand alignment across sites

There is no systematic way to review and improve content against editorial standards at scale.

---

## Goal

A multi-agent editorial pipeline that:
1. Passes content through specialist AI agents in sequence
2. Writes improved content back to source files
3. Uses LanceDB to detect near-duplicate content across the monorepo
4. Is testable in Jupyter notebooks and runnable via CLI for production use

---

## Architecture

### Directory Structure

```
tools/content-review/
├── agents/
│   ├── 01-quality-cleaner.md      # Strips artifacts, fixes malformed links, dedupes headings
│   ├── 02-language-editor.md      # Tone, voice, clarity, brand alignment
│   └── 03-seo-optimizer.md        # (future) keyword density, meta, H-tag structure
├── pipeline.md                    # Agent run order + shared brand/editorial context
├── review.py                      # CLI entrypoint
├── pipeline.py                    # Core orchestration logic
├── lancedb_store.py               # Embedding store for dedup detection
├── notebooks/
│   ├── 01-test-quality-agent.ipynb
│   ├── 02-test-language-agent.ipynb
│   └── 03-test-full-pipeline.ipynb
├── requirements.txt
└── README.md
```

---

## Agent Markdown Format

Each agent is a `.md` file with YAML frontmatter for config and a markdown body for the system prompt:

```markdown
---
id: quality-cleaner
name: Quality Cleaner
order: 1
model: gpt-4o
temperature: 0.2
input_format: markdown
output_format: markdown
---

## Role
...

## Tasks
...

## Rules
- Return only corrected markdown, no commentary
```

**`pipeline.md`** has frontmatter listing `agent_ids` in order plus shared context (brand name, service locations, tone keywords). Its markdown body provides global editorial context injected into every agent's system prompt.

---

## Agents (Initial Set)

### Agent 01 — Quality Cleaner
- Remove citation artifacts: `[Source: Author - Title, Page N]`
- Fix malformed link injections (links inserted mid-clause by the interlinking tool)
- Remove duplicate H1 headings (keep second occurrence — the formatted one)
- Preserve all other content exactly

### Agent 02 — Language Editor
- Align tone and voice with brand guidelines (defined in agent .md)
- Improve clarity and flow without changing factual claims
- Ensure calls to action are consistent across similar content types

### Agent 03 — SEO Optimizer *(planned, not in initial build)*
- Keyword density checks
- H-tag hierarchy validation
- Meta description review

---

## Pipeline Execution Flow

```
1. Load target file (markdown content)
2. Load pipeline.md → agent order + shared editorial context
3. For each agent in order:
   a. Build system prompt: agent body + shared context from pipeline.md
   b. Call OpenAI API (model and temperature from agent frontmatter)
   c. Validate response is valid markdown
   d. Pass output to next agent as input
4. Write final output back to original file
   - --dry-run flag previews output without writing
5. Embed final content → upsert into LanceDB by (app, filename)
```

---

## LanceDB Usage

**Scope (initial):** Duplicate content detection only.

- Embed all processed content and store by `(app, filename)` key
- On each run, query the store to surface near-duplicate pages across sites
- Surface similarity warnings in CLI output (not blocking — informational only)

**Future enhancement (not in initial build):**
- RAG injection: query LanceDB before each agent pass to surface similar pages as context, helping agents maintain consistency across the content corpus

---

## CLI Interface

```bash
# Single file
python review.py --file ../../apps/deck-repair/src/data/generated_content/some-file.md

# All files in one site
python review.py --microsite deck-repair

# All sites
python review.py --all

# Preview only (no writes)
python review.py --file <path> --dry-run

# Run specific agents only
python review.py --file <path> --agents 01
python review.py --file <path> --agents 01,02
```

---

## Notebooks

Three Jupyter notebooks for development and quality testing:

| Notebook | Purpose |
|---|---|
| `01-test-quality-agent.ipynb` | Run quality cleaner on sample files, inspect diffs |
| `02-test-language-agent.ipynb` | Test language editor, evaluate tone changes |
| `03-test-full-pipeline.ipynb` | End-to-end pipeline test with metrics |

---

## Dependencies

```
openai
lancedb
python-frontmatter
pydantic
click
jupyter
```

No LangChain — pipeline orchestration is implemented directly in `pipeline.py` for full transparency and debuggability.

---

## Non-Goals (Initial Build)

- No web UI (the Claude.ai export pattern from `service-page-exporter` is not used here)
- No LangChain or agent framework abstractions
- SEO agent deferred to a later iteration
- RAG context injection deferred to a later iteration

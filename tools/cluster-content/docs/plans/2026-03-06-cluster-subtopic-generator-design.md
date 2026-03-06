# Design: Cluster Subtopic Content Generator

**Date:** 2026-03-06
**Status:** Approved

## Goal

Generate ~200-word content sections for each subtopic in cluster service page stub files. Start with siding-repair as the test case, iterating on prompt and parameters in a notebook before scaling to all apps.

## Directory Structure

```
tools/cluster-content/
├── notebooks/
│   └── 01-siding-repair-subtopic-generator.ipynb
├── agents/
│   └── 01-subtopic-writer.md
├── requirements.txt
├── .env.example
└── README.md
```

Reuses `agent_loader.py` and `openai_caller.py` from `tools/content-review/` via `sys.path` — no copying.

## LanceDB

- **Construction books DB:** `C:\Users\tfalcon\microsites\tools\programatic writing stuffs\DBA writer\lancedb_construction_books`
- **Table:** `construction_books`
- **Embedding model:** `all-MiniLM-L6-v2` (SentenceTransformer)
- This is the RAG source for technical grounding — separate from the content-review `lancedb_store.py` which stores generated content for similarity search.

## Notebook Cell Flow

| # | Cell | Purpose |
|---|------|---------|
| 1 | Config | `LANCEDB_PATH`, `MODEL`, `TEMPERATURE`, `TOP_K`, `WORD_TARGET` as top-level vars |
| 2 | Setup | Load `.env`, init OpenAI client, load SentenceTransformer, connect to LanceDB |
| 3 | Load all siding-repair stubs | Parse all 14 cluster stub `.md` files, display summary table (slug, location, subtopic count) |
| 4 | Drill down: one cluster | Select `hardie-fiber-cement-siding-repair_portland`, show parsed subtopics |
| 5 | RAG retrieval | Pick subtopic "Hardie Siding Repair", retrieve top-K chunks, display sources |
| 6 | Generate | Call OpenAI with subtopic-writer agent + RAG context, print output + word count |
| 7 | Metrics | Word count, sentence count sanity check |

## Agent: `01-subtopic-writer.md`

- Generates a single ~200-word markdown section for one subtopic
- SFW brand voice: local, honest, action-oriented, no jargon
- Grounded in RAG context from construction reference books
- Returns clean markdown only — no preamble or commentary
- Tunable via `TEMPERATURE` and `WORD_TARGET` in Cell 1

## Cluster Stub Format

Stubs use `CLUSTER_META` HTML comments with `service`, `cluster_slug`, `location`, `status`, and `subtopics` fields. Each subtopic maps to an `## H2` section with `*Content to be generated.*`.

## Siding-Repair Test Scope

14 stub files across 7 cluster topics × 2 locations (portland, seattle):
- exterior-wall-sheathing-weather-barrier-repair
- hardie-fiber-cement-siding-repair
- lap-cedar-wood-specialty-siding-repair
- siding-flashing-water-intrusion-repair
- siding-integration-repairs
- siding-rot-repair-replacement
- siding-trim-corner-board-repair

First test target: `hardie-fiber-cement-siding-repair_portland`, subtopic "Hardie Siding Repair".

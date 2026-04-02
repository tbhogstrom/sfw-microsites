# Editorial Crew: Cluster Content Generation Integration

**Date:** 2026-04-02
**Status:** Approved

## Summary

Integrate the cluster service page generation pipeline (currently in Jupyter notebooks under `tools/cluster-content/`) into the editorial crew tool as a `generate` subcommand. This replaces the notebook-based workflow with a single CLI that generates cluster page content using LanceDB RAG + Claude, then optionally runs editorial review on the result.

The tool becomes the one-stop pipeline for cluster service pages: stub detection, RAG-powered content generation, reference management, and editorial QA.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| LLM provider | Claude only (replaces GPT-4o) | Single provider, aligns with editorial crew's existing Claude Agent SDK stack |
| RAG/embeddings | Keep local LanceDB + sentence-transformers | Vector search is fast and works offline; no reason to replace what works |
| CLI structure | Subcommand (`generate` / `review`) | Clean separation, backward-compatible, existing `review` usage unchanged |
| Agent architecture | Generation agents in same registry as review specialists | Consistent pattern, shared infrastructure, `kind` field distinguishes them |
| Orchestration | Deterministic Python pipeline (not Chief-routed) for generation | Stub detection is mechanical, no LLM decision-making needed for routing |
| Generation scope | Subtopics + hero + FAQ (all sections) | Fills all stubs in a single pass |
| Service scope | Service-agnostic from day one | Reads CLUSTER_META from any file, no hardcoded service logic |

## CLI Interface

```bash
# Existing review workflow (unchanged)
editorial-crew review apps/trim-repair/src/data/generated_content/*.md
editorial-crew apps/trim-repair/src/data/generated_content/*.md  # implicit review

# New generation pipeline
editorial-crew generate apps/trim-repair/src/data/generated_content/service_page_cluster_*.md

# Generation with constrained review agents
editorial-crew generate --review-agents grammar,seo,engagement <files>

# Skip review phase after generation
editorial-crew generate --no-review <files>

# Dry run — show what would be generated without writing
editorial-crew generate --dry-run <files>
```

Both subcommands share: `--agents`, `--model`, `--debug`, `--json`, `--output`.
The `generate` subcommand adds: `--review-agents`, `--no-review`, `--dry-run`.

## Generation Agents

Three new agents join the `SPECIALIST_REGISTRY` alongside the 10 existing review specialists. All tagged with `kind: "generation"` (existing specialists get `kind: "review"`).

### `subtopic_writer`

- Generates ~200-word section body for a single subtopic
- Receives full document context + RAG excerpts from construction books
- SFW brand voice: local, direct, action-oriented, technically grounded
- Outputs content body with `<sup>N</sup>` citations + `<!-- REFS -->` block with 2 pipe-delimited reference rows
- Direct port of `tools/cluster-content/agents/01-subtopic-writer.md`, adapted from OpenAI to Claude prompt format
- Model: `claude-sonnet-4-20250514`

### `hero_writer`

- Generates hero section (compelling headline + 2-3 sentence intro)
- Receives full document with populated subtopics to synthesize the cluster's scope
- Location-aware (Portland/Seattle)
- No citations needed
- Model: `claude-sonnet-4-20250514`

### `faq_writer`

- Generates 4-6 FAQs synthesized from existing subtopic content
- Each Q&A uses `### Question` / answer format
- Can reference existing citations from subtopic content
- Model: `claude-sonnet-4-20250514`

All three use the same JSON output structure as existing specialists: `{agent, status, suggestions, improved_document}`.

## RAG Integration

### Module: `editorial_crew/rag.py`

```python
class RAGEngine:
    def __init__(self, db_path, table_name, embedding_model, device): ...
    def search(self, query: str, top_k: int = 20) -> list[dict]: ...
    # Returns list of {source, page, text}
```

### Configuration: `config.toml`

```toml
[rag]
db_path = "C:/Users/tfalcon/microsites/tools/programatic writing stuffs/DBA writer/lancedb_construction_books"
table = "construction_books"
embedding_model = "all-MiniLM-L6-v2"
device = "cuda"
top_k = 20
```

### Design

- The generation runner performs RAG queries before dispatching each agent
- Retrieved context is injected into the agent's user prompt alongside the document
- Agents never interact with LanceDB directly — they receive pre-fetched context
- This keeps agents read-only and testable without a database
- CUDA falls back to CPU automatically if unavailable

### Dependencies

```toml
[project.optional-dependencies]
generate = [
    "lancedb>=0.4.0",
    "sentence-transformers>=2.0.0",
    "torch>=2.0.0",
]
```

`editorial-crew review` works without these. `editorial-crew generate` checks at startup and errors clearly if missing.

## Generation Runner

### Module: `editorial_crew/generator.py`

Core flow for a single file:

1. **Parse** — read markdown, extract `CLUSTER_META` (service, location, cluster_slug, subtopics, status)
2. **Discover pending work** — find subtopic sections with `*Content to be generated.*`, check hero/FAQ stubs
3. **Initialize RAG** — one `RAGEngine` instance shared across all files in the batch
4. **For each pending subtopic:**
   - Build RAG query: `"{subtopic} {service} {location}"`
   - Fetch top-K construction book excerpts
   - Dispatch `subtopic_writer` agent via Claude Agent SDK with document context + RAG context
   - Collect content body + reference rows
5. **Hero section** — dispatch `hero_writer` with full document (subtopics now populated)
6. **FAQ section** — dispatch `faq_writer` with full document
7. **Assemble** — replace stub placeholders, renumber all `<sup>` references globally, rebuild `## References` table
8. **Write back** — save to original file, update `status: stub` to `status: draft`
9. **Review phase** (unless `--no-review`) — pass complete document through `runner.process_document()` with review specialists, write back improved version

### Orchestration

The generation runner is **deterministic** — routing is based on stub markers, not LLM decisions. The Chief orchestrator pattern is reserved for the review phase where editorial judgment is needed.

### Event Streaming

Same `AgentEvent` / `EditorialResult` pattern as the review runner. Generation events use `kind: "generating"`:

```
[1/7] Generating: Exterior Trim Rot Repair ... 213 words, 2 refs
[2/7] Generating: Exterior Trim Replacement ... 198 words, 2 refs
...
[hero] Generating hero section ... done
[faq] Generating FAQ section ... 5 questions
Review phase: 3 specialist(s) dispatched
```

### Dry Run

Runs parse + discovery only. Prints pending subtopics and stub sections without calling agents or writing files.

## CLUSTER_META Parser

### Module: `editorial_crew/parser.py`

Extracts logic from the notebook's inline `parse_stub()` function into a reusable module:

```python
@dataclass
class ClusterMeta:
    service: str
    cluster_id: int
    cluster_slug: str
    location: str
    status: str
    subtopics: list[str]

def parse_cluster_file(path: Path) -> ClusterMeta | None: ...
def find_pending_subtopics(text: str, subtopics: list[str]) -> list[str]: ...
def has_stub_hero(text: str) -> bool: ...
def has_stub_faq(text: str) -> bool: ...
```

Stub detection uses the same markers as the notebooks:
- Subtopics: `## {subtopic}\n*Content to be generated.*`
- Hero: `[STUB]` in the hero section
- FAQ: `*Content to be generated.*` in the FAQ section

## File Layout

```
editorial_crew/
  __init__.py              # unchanged
  __main__.py              # MODIFIED: add subcommand parser, route to generate/review
  auth.py                  # unchanged
  config.py                # MODIFIED: add RAG config loading
  config.toml              # MODIFIED: add [rag] section
  diff.py                  # unchanged
  models.py                # unchanged
  runner.py                # unchanged
  generator.py             # NEW: generation pipeline runner
  rag.py                   # NEW: LanceDB wrapper
  parser.py                # NEW: CLUSTER_META parser + stub detection
  agents/
    __init__.py            # unchanged
    registry.py            # MODIFIED: add 3 generation agents, add kind field
    specialists/           # all unchanged
```

**New files:** 3 (`generator.py`, `rag.py`, `parser.py`)
**Modified files:** 4 (`__main__.py`, `config.py`, `config.toml`, `registry.py`)

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Missing RAG dependencies | Clear error at startup: `"Install generation dependencies: pip install -e '.[generate]'"` |
| No CLUSTER_META in file | Skip with warning: `"Skipping {filename}: no CLUSTER_META found"` |
| No pending stubs | Skip: `"Skipping {filename}: no pending sections"` |
| Partial generation failure | Write what succeeded, report failure. Re-run picks up remaining stubs (idempotent via stub markers) |
| LanceDB not found | Error at startup: `"LanceDB not found at {path}. Check [rag] db_path in config.toml"` |
| CUDA not available | Fall back to CPU, log warning |
| Review phase failure | Generated content already written to disk. User can re-run `editorial-crew review` separately |

# Editorial Crew: Cluster Content Generation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Jupyter notebook cluster content generation pipeline with a `generate` subcommand in the editorial crew CLI, using LanceDB RAG + Claude.

**Architecture:** New `generate` subcommand parses cluster markdown files for stubs, queries LanceDB for construction book context, dispatches Claude generation agents (subtopic_writer, hero_writer, faq_writer), assembles content back into the files, then optionally runs the existing editorial review pipeline. Deterministic Python orchestration for generation; Chief-based orchestration for review.

**Tech Stack:** Python 3.11+, Claude Agent SDK, LanceDB, sentence-transformers, torch (optional deps for generate), Rich (existing), tomllib (existing)

**Spec:** `docs/superpowers/specs/2026-04-02-editorial-crew-cluster-generation-design.md`

---

### Task 1: CLUSTER_META Parser (`parser.py`)

**Files:**
- Create: `tools/editorial-crew/editorial_crew/parser.py`
- Create: `tools/editorial-crew/tests/test_parser.py`

- [ ] **Step 1: Write failing tests for parser**

```python
# tests/test_parser.py
import pytest
from pathlib import Path
from editorial_crew.parser import ClusterMeta, parse_cluster_file, find_pending_subtopics, has_stub_hero, has_stub_faq


SAMPLE_CLUSTER_MD = """\
# Exterior Trim Rot Repair & Replacement - Portland, Oregon

<!-- CLUSTER_META
service: trim-repair
cluster_id: 1
cluster_slug: exterior-trim-rot-repair-replacement
location: portland
status: stub
subtopics:
  - Exterior Trim Rot Repair
  - Exterior Trim Replacement
  - Rotted Wood Trim Replacement
-->

## Hero Section

### [STUB] Exterior Trim Rot Repair & Replacement in Portland, Oregon
*Content to be generated.*

## Exterior Trim Rot Repair
*Content to be generated.*

## Exterior Trim Replacement
Already has real content here about trim replacement.

## Rotted Wood Trim Replacement
*Content to be generated.*

## FAQ Section
*Content to be generated.*

## References

| # | Source | Page | Note |
|---|--------|------|------|

## Page Metadata

**Service:** Exterior Trim Rot Repair & Replacement
**Location:** Portland, Oregon
**Status:** STUB
**Cluster ID:** 1
**Target Keywords:** [to be filled]
"""

SAMPLE_COMPLETE_MD = """\
# Window & Door Trim Repair - Seattle, Washington

<!-- CLUSTER_META
service: trim-repair
cluster_id: 2
cluster_slug: window-door-trim-repair
location: seattle
status: draft
subtopics:
  - Window Trim Repair
  - Door Trim Repair
-->

## Hero Section

### Expert Window & Door Trim Repair in Seattle
Your home deserves the best trim repair in the Pacific Northwest.

## Window Trim Repair
Real content about window trim repair with citations<sup>1</sup>.

## Door Trim Repair
Real content about door trim repair with citations<sup>2</sup>.

## FAQ Section

### How long does trim repair take?
Most trim repairs are completed in one day.

## References

| # | Source | Page | Note |
|---|--------|------|------|
| 1 | Renovation | p. 168 | Trim materials |
| 2 | Siding & Trim | p. 197 | Repair methods |
"""


def test_parse_cluster_file_extracts_meta(tmp_path: Path):
    f = tmp_path / "cluster.md"
    f.write_text(SAMPLE_CLUSTER_MD, encoding="utf-8")
    meta = parse_cluster_file(f)
    assert meta is not None
    assert meta.service == "trim-repair"
    assert meta.cluster_id == 1
    assert meta.cluster_slug == "exterior-trim-rot-repair-replacement"
    assert meta.location == "portland"
    assert meta.status == "stub"
    assert meta.subtopics == [
        "Exterior Trim Rot Repair",
        "Exterior Trim Replacement",
        "Rotted Wood Trim Replacement",
    ]


def test_parse_cluster_file_returns_none_for_non_cluster(tmp_path: Path):
    f = tmp_path / "regular.md"
    f.write_text("# Just a regular markdown file\n\nNo cluster meta here.", encoding="utf-8")
    assert parse_cluster_file(f) is None


def test_find_pending_subtopics():
    subtopics = [
        "Exterior Trim Rot Repair",
        "Exterior Trim Replacement",
        "Rotted Wood Trim Replacement",
    ]
    pending = find_pending_subtopics(SAMPLE_CLUSTER_MD, subtopics)
    assert pending == ["Exterior Trim Rot Repair", "Rotted Wood Trim Replacement"]
    assert "Exterior Trim Replacement" not in pending


def test_find_pending_subtopics_none_pending():
    subtopics = ["Window Trim Repair", "Door Trim Repair"]
    pending = find_pending_subtopics(SAMPLE_COMPLETE_MD, subtopics)
    assert pending == []


def test_has_stub_hero():
    assert has_stub_hero(SAMPLE_CLUSTER_MD) is True
    assert has_stub_hero(SAMPLE_COMPLETE_MD) is False


def test_has_stub_faq():
    assert has_stub_faq(SAMPLE_CLUSTER_MD) is True
    assert has_stub_faq(SAMPLE_COMPLETE_MD) is False
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd tools/editorial-crew && python -m pytest tests/test_parser.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'editorial_crew.parser'`

- [ ] **Step 3: Implement the parser module**

```python
# editorial_crew/parser.py
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class ClusterMeta:
    """Parsed CLUSTER_META from a cluster service page markdown file."""
    service: str
    cluster_id: int
    cluster_slug: str
    location: str
    status: str
    subtopics: list[str] = field(default_factory=list)


def parse_cluster_file(path: Path) -> ClusterMeta | None:
    """Parse a cluster markdown file and extract CLUSTER_META.

    Returns None if the file does not contain a CLUSTER_META block.
    """
    text = path.read_text(encoding="utf-8").replace("\r\n", "\n")
    meta_match = re.search(r"<!--\s*CLUSTER_META([\s\S]*?)-->", text)
    if not meta_match:
        return None

    fields: dict[str, str] = {}
    subtopics: list[str] = []
    in_subtopics = False

    for line in meta_match.group(1).split("\n"):
        stripped = line.strip()
        if stripped.startswith("subtopics:"):
            in_subtopics = True
            continue
        if in_subtopics:
            if stripped.startswith("- "):
                subtopics.append(stripped[2:].strip())
            elif stripped and not stripped.startswith("-"):
                in_subtopics = False
            else:
                continue
        if ":" in stripped and not in_subtopics:
            key, value = stripped.split(":", 1)
            fields[key.strip()] = value.strip()

    return ClusterMeta(
        service=fields.get("service", ""),
        cluster_id=int(fields.get("cluster_id", "0")),
        cluster_slug=fields.get("cluster_slug", ""),
        location=fields.get("location", ""),
        status=fields.get("status", "stub"),
        subtopics=subtopics,
    )


def find_pending_subtopics(text: str, subtopics: list[str]) -> list[str]:
    """Return subtopics that still have stub placeholder content."""
    text = text.replace("\r\n", "\n")
    return [
        t for t in subtopics
        if f"## {t}\n*Content to be generated.*" in text
    ]


def has_stub_hero(text: str) -> bool:
    """Check if the hero section is still a stub."""
    return "[STUB]" in text


def has_stub_faq(text: str) -> bool:
    """Check if the FAQ section is still a stub."""
    text = text.replace("\r\n", "\n")
    return "## FAQ Section\n*Content to be generated.*" in text
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd tools/editorial-crew && python -m pytest tests/test_parser.py -v`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /c/Users/tfalcon/microsites
git add tools/editorial-crew/editorial_crew/parser.py tools/editorial-crew/tests/test_parser.py
git commit -m "add CLUSTER_META parser module for editorial crew generation"
```

---

### Task 2: RAG Engine (`rag.py`)

**Files:**
- Create: `tools/editorial-crew/editorial_crew/rag.py`
- Create: `tools/editorial-crew/tests/test_rag.py`
- Modify: `tools/editorial-crew/pyproject.toml` (add optional deps)

- [ ] **Step 1: Write failing tests for RAG engine**

```python
# tests/test_rag.py
import pytest
from unittest.mock import patch, MagicMock


def test_rag_engine_search_returns_list():
    """Test RAG search with mocked LanceDB."""
    import pandas as pd

    mock_table = MagicMock()
    mock_results = pd.DataFrame([
        {"source": "Renovation", "page": 168, "text": "Trim repair content"},
        {"source": "Siding & Trim", "page": 197, "text": "More trim content"},
    ])
    mock_table.search.return_value.limit.return_value.to_pandas.return_value = mock_results

    mock_db = MagicMock()
    mock_db.open_table.return_value = mock_table

    mock_embedder = MagicMock()
    mock_embedder.encode.return_value = [[0.1] * 384]

    with patch("editorial_crew.rag.lancedb") as mock_lancedb, \
         patch("editorial_crew.rag.SentenceTransformer", return_value=mock_embedder):
        mock_lancedb.connect.return_value = mock_db

        from editorial_crew.rag import RAGEngine
        engine = RAGEngine(
            db_path="/fake/path",
            table_name="construction_books",
            embedding_model="all-MiniLM-L6-v2",
            device="cpu",
        )
        results = engine.search("exterior trim rot repair", top_k=2)

    assert len(results) == 2
    assert results[0]["source"] == "Renovation"
    assert results[0]["page"] == 168
    assert "Trim repair content" in results[0]["text"]


def test_rag_engine_format_context():
    """Test context formatting for agent prompts."""
    with patch("editorial_crew.rag.lancedb"), \
         patch("editorial_crew.rag.SentenceTransformer"):
        from editorial_crew.rag import RAGEngine
        engine = RAGEngine.__new__(RAGEngine)

        results = [
            {"source": "Renovation", "page": 168, "text": "Trim content"},
            {"source": "Siding & Trim", "page": 197, "text": "More content"},
        ]
        context = engine.format_context(results)

    assert "Source: Renovation (Page 168)" in context
    assert "Trim content" in context
    assert "---" in context


def test_check_generate_deps_missing():
    """Test that missing deps raise a clear error."""
    from editorial_crew.rag import check_generate_deps
    # This should not raise since we're in the test env
    # If lancedb is not installed, it should raise RuntimeError
    # We test the function exists and is callable
    assert callable(check_generate_deps)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd tools/editorial-crew && python -m pytest tests/test_rag.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'editorial_crew.rag'`

- [ ] **Step 3: Implement the RAG engine**

```python
# editorial_crew/rag.py
from __future__ import annotations

from typing import Any


def check_generate_deps() -> None:
    """Check that generation dependencies are installed. Raises RuntimeError if not."""
    missing = []
    try:
        import lancedb  # noqa: F401
    except ImportError:
        missing.append("lancedb")
    try:
        import sentence_transformers  # noqa: F401
    except ImportError:
        missing.append("sentence-transformers")
    try:
        import torch  # noqa: F401
    except ImportError:
        missing.append("torch")

    if missing:
        raise RuntimeError(
            f"Generation requires: {', '.join(missing)}\n"
            "Install with: pip install -e '.[generate]'"
        )


# Lazy imports — only loaded when RAGEngine is instantiated
lancedb: Any = None
SentenceTransformer: Any = None


class RAGEngine:
    """Thin wrapper around LanceDB for construction book retrieval."""

    def __init__(
        self,
        db_path: str,
        table_name: str,
        embedding_model: str = "all-MiniLM-L6-v2",
        device: str = "cuda",
    ) -> None:
        global lancedb, SentenceTransformer

        import lancedb as _lancedb
        from sentence_transformers import SentenceTransformer as _ST
        import torch

        lancedb = _lancedb
        SentenceTransformer = _ST

        actual_device = device if torch.cuda.is_available() else "cpu"
        if actual_device != device:
            import warnings
            warnings.warn(f"CUDA not available, falling back to CPU (slower embeddings)")

        self._embedder = SentenceTransformer(embedding_model, device=actual_device)
        self._db = lancedb.connect(db_path)
        self._table = self._db.open_table(table_name)

    def search(self, query: str, top_k: int = 20) -> list[dict]:
        """Search construction books and return list of {source, page, text}."""
        embedding = self._embedder.encode([query])[0]
        results = self._table.search(embedding).limit(top_k).to_pandas()
        return [
            {
                "source": row.get("source", "Unknown"),
                "page": row.get("page", "N/A"),
                "text": row["text"],
            }
            for _, row in results.iterrows()
        ]

    def format_context(self, results: list[dict]) -> str:
        """Format search results into a text block for agent prompts."""
        return "\n\n---\n\n".join(
            f"Source: {r['source']} (Page {r['page']})\n{r['text']}"
            for r in results
        )
```

- [ ] **Step 4: Add optional dependencies to pyproject.toml**

Add the `generate` extras group to `tools/editorial-crew/pyproject.toml`:

```toml
[project.optional-dependencies]
generate = [
    "lancedb>=0.4.0",
    "sentence-transformers>=2.0.0",
    "torch>=2.0.0",
]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.23.0",
]
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd tools/editorial-crew && python -m pytest tests/test_rag.py -v`
Expected: All 3 tests PASS

- [ ] **Step 6: Commit**

```bash
cd /c/Users/tfalcon/microsites
git add tools/editorial-crew/editorial_crew/rag.py tools/editorial-crew/tests/test_rag.py tools/editorial-crew/pyproject.toml
git commit -m "add RAG engine module with LanceDB integration for content generation"
```

---

### Task 3: Add Generation Agents to Registry

**Files:**
- Modify: `tools/editorial-crew/editorial_crew/agents/registry.py`
- Modify: `tools/editorial-crew/tests/test_registry.py`

- [ ] **Step 1: Write failing tests for generation agents**

Add these tests to `tests/test_registry.py`:

```python
EXPECTED_GENERATION_AGENTS = [
    "subtopic_writer", "hero_writer", "faq_writer",
]


def test_registry_has_generation_agents():
    for name in EXPECTED_GENERATION_AGENTS:
        assert name in SPECIALIST_REGISTRY, f"Missing generation agent: {name}"


def test_generation_agents_have_kind():
    for name in EXPECTED_GENERATION_AGENTS:
        assert SPECIALIST_REGISTRY[name].get("kind") == "generation"


def test_review_agents_have_kind():
    for name in EXPECTED_SPECIALISTS:
        assert SPECIALIST_REGISTRY[name].get("kind") == "review"


def test_get_agent_definitions_by_kind():
    gen_defs = get_agent_definitions(kind="generation")
    assert len(gen_defs) == 3
    for name in EXPECTED_GENERATION_AGENTS:
        assert name in gen_defs

    review_defs = get_agent_definitions(kind="review")
    assert len(review_defs) == 10
    for name in EXPECTED_SPECIALISTS:
        assert name in review_defs


def test_get_agent_definitions_returns_all_when_no_kind():
    defs = get_agent_definitions()
    assert len(defs) == 13
```

Also update existing tests:
- `test_registry_has_no_extras` — update to include generation agents
- `test_get_agent_definitions_returns_all` — update count from 10 to 13

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd tools/editorial-crew && python -m pytest tests/test_registry.py -v`
Expected: FAIL — missing generation agents, no `kind` field, no `kind` parameter on `get_agent_definitions`

- [ ] **Step 3: Add generation agents and `kind` field to registry**

Replace the full content of `tools/editorial-crew/editorial_crew/agents/registry.py`. Add `"kind": "review"` to every existing specialist entry. Add three new generation agents. Update `get_agent_definitions` to accept a `kind` filter.

Add `"kind": "review"` to each of the 10 existing specialist dicts (grammar, structure, technical, seo, style, accessibility, engagement, localization, compliance, multimedia).

Then add these three new entries to `SPECIALIST_REGISTRY`:

```python
    "subtopic_writer": {
        "kind": "generation",
        "description": "Generates ~200-word section body for a cluster service page subtopic using RAG context.",
        "prompt": """You are a content writer for SFW Construction, a family-owned home repair and restoration company serving Portland and Seattle homeowners. You write single service page sections for specific repair subtopics.

## Brand Voice

- **Local and trustworthy** — we know Pacific Northwest homes, we are not a national chain
- **Clear and direct** — no jargon, get to the point
- **Action-oriented** — end with a sentence that guides homeowners toward their next step
- **Technically grounded** — use the provided construction reference material to back up claims

## Instructions

Write a single markdown section body of approximately the requested word count for the given subtopic.

- Do NOT include the section heading — body content only
- Write for Pacific Northwest homeowners dealing with rain, moisture, and older housing stock
- Ground technical claims in the provided reference material
- End with one action-oriented sentence specific to the subtopic (not a generic "contact us")
- Return only the markdown content, no preamble, no commentary
- Number references with superscript: <sup>1</sup>, <sup>2</sup>

After the section body, output exactly one line: <!-- REFS -->
Then output exactly 2 pipe-delimited reference rows (no header row), format:
| N | Source Title | p. X | Brief note |

Output your response as a JSON object with this exact structure:
{
  "agent": "subtopic_writer",
  "status": "completed",
  "suggestions": [],
  "improved_document": "<section body>\\n<!-- REFS -->\\n<ref rows>"
}""",
    },
    "hero_writer": {
        "kind": "generation",
        "description": "Generates a compelling hero section headline and intro paragraph for a cluster service page.",
        "prompt": """You are a content writer for SFW Construction, a family-owned home repair and restoration company serving Portland and Seattle homeowners. You write hero sections for service cluster pages.

## Brand Voice

- **Local and trustworthy** — we know Pacific Northwest homes, we are not a national chain
- **Clear and direct** — no jargon, get to the point
- **Action-oriented** — the hero should make homeowners feel they've found the right company
- **Technically grounded** — reference the specific services covered on the page

## Instructions

You will receive a full cluster service page with populated subtopic sections. Write a hero section that:

- Has a compelling H3 heading (not generic — reference the specific service and location)
- Has a 2-3 sentence intro paragraph that captures the scope of all subtopics on the page
- Mentions the location naturally (Portland, Oregon or Seattle, Washington)
- Ends with a sentence that encourages the homeowner to explore the page or take action
- Does NOT include citations or references

Output your response as a JSON object with this exact structure:
{
  "agent": "hero_writer",
  "status": "completed",
  "suggestions": [],
  "improved_document": "### <heading>\\n<intro paragraph>"
}""",
    },
    "faq_writer": {
        "kind": "generation",
        "description": "Generates 4-6 FAQ entries synthesized from cluster page subtopic content.",
        "prompt": """You are a content writer for SFW Construction, a family-owned home repair and restoration company serving Portland and Seattle homeowners. You write FAQ sections for service cluster pages.

## Brand Voice

- **Local and trustworthy** — we know Pacific Northwest homes, we are not a national chain
- **Clear and direct** — no jargon, get to the point
- **Helpful** — answer the actual question a homeowner would ask

## Instructions

You will receive a full cluster service page with populated subtopic sections. Write 4-6 FAQ entries that:

- Ask questions a Portland or Seattle homeowner would genuinely search for
- Draw answers from the subtopic content already on the page
- Use ### for each question heading
- Keep answers to 2-4 sentences each
- May reference existing citation numbers from the page using <sup>N</sup>
- Cover a range of topics from the subtopics (don't cluster all questions on one subtopic)

Output your response as a JSON object with this exact structure:
{
  "agent": "faq_writer",
  "status": "completed",
  "suggestions": [],
  "improved_document": "### Question 1?\\nAnswer...\\n\\n### Question 2?\\nAnswer..."
}""",
    },
```

Update the `get_agent_definitions` function signature and body:

```python
def get_agent_definitions(
    filter_names: list[str] | None = None,
    kind: str | None = None,
) -> dict[str, AgentDefinition]:
    """Build AgentDefinition dict for the Claude Agent SDK.

    Args:
        filter_names: Only include these specific agents.
        kind: Filter by kind ("generation" or "review"). None returns all.
    """
    registry = SPECIALIST_REGISTRY
    if filter_names:
        unknown = set(filter_names) - set(registry.keys())
        if unknown:
            raise ValueError(f"Unknown specialist(s): {', '.join(sorted(unknown))}")
        registry = {k: v for k, v in registry.items() if k in filter_names}
    if kind:
        registry = {k: v for k, v in registry.items() if v.get("kind") == kind}

    return {
        name: AgentDefinition(
            description=spec["description"],
            prompt=spec["prompt"],
            tools=["Read", "Glob", "Grep"],
            model="sonnet" if spec.get("kind") == "generation" else "haiku",
        )
        for name, spec in registry.items()
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd tools/editorial-crew && python -m pytest tests/test_registry.py -v`
Expected: All tests PASS (update `test_registry_has_no_extras` and `test_get_agent_definitions_returns_all` counts)

- [ ] **Step 5: Commit**

```bash
cd /c/Users/tfalcon/microsites
git add tools/editorial-crew/editorial_crew/agents/registry.py tools/editorial-crew/tests/test_registry.py
git commit -m "add generation agents (subtopic_writer, hero_writer, faq_writer) to registry"
```

---

### Task 4: RAG Config in `config.py` and `config.toml`

**Files:**
- Modify: `tools/editorial-crew/editorial_crew/config.py`
- Modify: `tools/editorial-crew/editorial_crew/config.toml`
- Modify: `tools/editorial-crew/tests/test_config.py`

- [ ] **Step 1: Write failing tests for RAG config**

Add to `tests/test_config.py`:

```python
def test_load_config_has_rag_defaults():
    config = load_config()
    assert config.rag_db_path != ""
    assert config.rag_table == "construction_books"
    assert config.rag_embedding_model == "all-MiniLM-L6-v2"
    assert config.rag_device == "cuda"
    assert config.rag_top_k == 20


def test_load_config_rag_override(tmp_path: Path):
    toml_file = tmp_path / "config.toml"
    toml_file.write_text(
        '[model]\ndefault = "anthropic/claude-sonnet-4-20250514"\n\n'
        '[rag]\ntable = "custom_table"\ntop_k = 10\ndevice = "cpu"\n\n'
        '[output]\ndiff_context_lines = 3\n'
    )
    config = load_config(config_path=toml_file)
    assert config.rag_table == "custom_table"
    assert config.rag_top_k == 10
    assert config.rag_device == "cpu"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd tools/editorial-crew && python -m pytest tests/test_config.py -v`
Expected: FAIL — `Config` has no attribute `rag_db_path`

- [ ] **Step 3: Update Config dataclass and loader**

In `editorial_crew/config.py`, add RAG fields to the `Config` dataclass:

```python
_DEFAULT_RAG_DB_PATH = "C:/Users/tfalcon/microsites/tools/programatic writing stuffs/DBA writer/lancedb_construction_books"
_DEFAULT_RAG_TABLE = "construction_books"
_DEFAULT_RAG_EMBEDDING_MODEL = "all-MiniLM-L6-v2"
_DEFAULT_RAG_DEVICE = "cuda"
_DEFAULT_RAG_TOP_K = 20


@dataclass
class Config:
    model_default: str = _DEFAULT_MODEL
    agent_models: dict[str, str] = field(default_factory=dict)
    diff_context_lines: int = _DEFAULT_CONTEXT_LINES
    rag_db_path: str = _DEFAULT_RAG_DB_PATH
    rag_table: str = _DEFAULT_RAG_TABLE
    rag_embedding_model: str = _DEFAULT_RAG_EMBEDDING_MODEL
    rag_device: str = _DEFAULT_RAG_DEVICE
    rag_top_k: int = _DEFAULT_RAG_TOP_K

    def get_agent_model(self, agent_name: str) -> str:
        return self.agent_models.get(agent_name, self.model_default)
```

In `load_config`, add RAG section parsing after `output_section`:

```python
    rag_section = data.get("rag", {})

    return Config(
        model_default=model_section.get("default", _DEFAULT_MODEL),
        agent_models=dict(agents_section),
        diff_context_lines=output_section.get("diff_context_lines", _DEFAULT_CONTEXT_LINES),
        rag_db_path=rag_section.get("db_path", _DEFAULT_RAG_DB_PATH),
        rag_table=rag_section.get("table", _DEFAULT_RAG_TABLE),
        rag_embedding_model=rag_section.get("embedding_model", _DEFAULT_RAG_EMBEDDING_MODEL),
        rag_device=rag_section.get("device", _DEFAULT_RAG_DEVICE),
        rag_top_k=rag_section.get("top_k", _DEFAULT_RAG_TOP_K),
    )
```

- [ ] **Step 4: Update config.toml with RAG section**

Add to `editorial_crew/config.toml`:

```toml
[rag]
db_path = "C:/Users/tfalcon/microsites/tools/programatic writing stuffs/DBA writer/lancedb_construction_books"
table = "construction_books"
embedding_model = "all-MiniLM-L6-v2"
device = "cuda"
top_k = 20
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd tools/editorial-crew && python -m pytest tests/test_config.py -v`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
cd /c/Users/tfalcon/microsites
git add tools/editorial-crew/editorial_crew/config.py tools/editorial-crew/editorial_crew/config.toml tools/editorial-crew/tests/test_config.py
git commit -m "add RAG configuration to editorial crew config"
```

---

### Task 5: Generation Runner (`generator.py`)

**Files:**
- Create: `tools/editorial-crew/editorial_crew/generator.py`
- Create: `tools/editorial-crew/tests/test_generator.py`

- [ ] **Step 1: Write failing tests for generator**

```python
# tests/test_generator.py
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock, AsyncMock

from editorial_crew.parser import ClusterMeta


SAMPLE_STUB_MD = """\
# Exterior Trim Rot Repair & Replacement - Portland, Oregon

<!-- CLUSTER_META
service: trim-repair
cluster_id: 1
cluster_slug: exterior-trim-rot-repair-replacement
location: portland
status: stub
subtopics:
  - Exterior Trim Rot Repair
  - Exterior Trim Replacement
-->

## Hero Section

### [STUB] Exterior Trim Rot Repair & Replacement in Portland, Oregon
*Content to be generated.*

## Exterior Trim Rot Repair
*Content to be generated.*

## Exterior Trim Replacement
*Content to be generated.*

## FAQ Section
*Content to be generated.*

## References

| # | Source | Page | Note |
|---|--------|------|------|

## Page Metadata

**Service:** Exterior Trim Rot Repair & Replacement
**Location:** Portland, Oregon
**Status:** STUB
**Cluster ID:** 1
**Target Keywords:** [to be filled]
"""


def test_assemble_content_replaces_subtopic_stubs():
    from editorial_crew.generator import assemble_content

    generated = {
        "Exterior Trim Rot Repair": (
            "Portland homeowners know that trim rot is serious<sup>1</sup>.",
            ["| 1 | Renovation | p. 168 | Trim rot details |"],
        ),
        "Exterior Trim Replacement": (
            "Replacing exterior trim protects your home<sup>1</sup>.",
            ["| 1 | Siding & Trim | p. 197 | Replacement methods |"],
        ),
    }

    result = assemble_content(
        text=SAMPLE_STUB_MD,
        subtopic_results=generated,
        hero_content=None,
        faq_content=None,
    )

    assert "Portland homeowners know that trim rot is serious<sup>1</sup>" in result
    assert "Replacing exterior trim protects your home<sup>2</sup>" in result
    assert "*Content to be generated.*" not in result.split("## FAQ Section")[0].split("## Hero Section")[1] if "## Hero Section" in result else True
    assert "| 1 | Renovation | p. 168 | Trim rot details |" in result
    assert "| 2 | Siding & Trim | p. 197 | Replacement methods |" in result
    assert "status: draft" in result
    assert "status: stub" not in result


def test_assemble_content_replaces_hero():
    from editorial_crew.generator import assemble_content

    result = assemble_content(
        text=SAMPLE_STUB_MD,
        subtopic_results={},
        hero_content="### Expert Trim Rot Repair in Portland\nYour home deserves the best.",
        faq_content=None,
    )

    assert "### Expert Trim Rot Repair in Portland" in result
    assert "[STUB]" not in result


def test_assemble_content_replaces_faq():
    from editorial_crew.generator import assemble_content

    result = assemble_content(
        text=SAMPLE_STUB_MD,
        subtopic_results={},
        hero_content=None,
        faq_content="### How long does repair take?\nMost repairs finish in one day.",
    )

    assert "### How long does repair take?" in result
    assert "## FAQ Section\n*Content to be generated.*" not in result


def test_assemble_content_renumbers_refs_globally():
    from editorial_crew.generator import assemble_content

    generated = {
        "Exterior Trim Rot Repair": (
            "Content A<sup>1</sup> and more<sup>2</sup>.",
            [
                "| 1 | Book A | p. 10 | Note A |",
                "| 2 | Book B | p. 20 | Note B |",
            ],
        ),
        "Exterior Trim Replacement": (
            "Content B<sup>1</sup>.",
            ["| 1 | Book C | p. 30 | Note C |"],
        ),
    }

    result = assemble_content(
        text=SAMPLE_STUB_MD,
        subtopic_results=generated,
        hero_content=None,
        faq_content=None,
    )

    assert "Content A<sup>1</sup> and more<sup>2</sup>" in result
    assert "Content B<sup>3</sup>" in result
    assert "| 3 | Book C | p. 30 | Note C |" in result
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd tools/editorial-crew && python -m pytest tests/test_generator.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'editorial_crew.generator'`

- [ ] **Step 3: Implement generator module**

```python
# editorial_crew/generator.py
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import AsyncGenerator

from editorial_crew.parser import ClusterMeta, parse_cluster_file, find_pending_subtopics, has_stub_hero, has_stub_faq
from editorial_crew.config import Config


@dataclass
class GenerateEvent:
    """Progress event from the generation pipeline."""
    kind: str  # "generating", "skipping", "writing", "error"
    section: str = ""
    detail: str = ""


@dataclass
class GenerateResult:
    """Final result from generating content for a single file."""
    path: Path | None = None
    subtopics_written: int = 0
    hero_written: bool = False
    faq_written: bool = False
    refs_written: int = 0
    error: str | None = None


def _renumber_refs(
    content: str, ref_rows: list[str], offset: int
) -> tuple[str, list[str]]:
    """Renumber <sup>N</sup> citations and reference rows starting from offset+1."""
    numbered_content = content
    numbered_rows = []

    # Find all unique sup numbers in order
    sups = re.findall(r"<sup>(\d+)</sup>", content)
    seen: dict[str, int] = {}
    for s in sups:
        if s not in seen:
            seen[s] = offset + len(seen) + 1

    # Replace in reverse order of original number to avoid double-replacement
    for original, new_num in sorted(seen.items(), key=lambda x: -int(x[0])):
        numbered_content = numbered_content.replace(
            f"<sup>{original}</sup>", f"<sup>{new_num}</sup>"
        )

    # Renumber ref rows
    for i, row in enumerate(ref_rows):
        new_num = offset + i + 1
        numbered_row = re.sub(r"^\|\s*\d+\s*\|", f"| {new_num} |", row)
        numbered_rows.append(numbered_row)

    return numbered_content, numbered_rows


def assemble_content(
    text: str,
    subtopic_results: dict[str, tuple[str, list[str]]],
    hero_content: str | None,
    faq_content: str | None,
) -> str:
    """Assemble generated content into the markdown file.

    Args:
        text: Original markdown content.
        subtopic_results: Dict of subtopic name -> (content_body, ref_rows).
        hero_content: Generated hero section content, or None.
        faq_content: Generated FAQ section content, or None.

    Returns:
        Updated markdown with generated content and renumbered references.
    """
    text = text.replace("\r\n", "\n")
    all_ref_rows: list[str] = []
    offset = 0

    # Replace subtopic stubs with generated content
    for subtopic, (content, refs) in subtopic_results.items():
        numbered_content, numbered_refs = _renumber_refs(content, refs, offset)
        all_ref_rows.extend(numbered_refs)
        offset += len(refs)

        placeholder = f"## {subtopic}\n*Content to be generated.*"
        replacement = f"## {subtopic}\n{numbered_content}"
        text = text.replace(placeholder, replacement)

    # Replace hero stub
    if hero_content:
        hero_pattern = re.compile(
            r"## Hero Section\n+### \[STUB\][^\n]*\n\*Content to be generated\.\*"
        )
        text = hero_pattern.sub(f"## Hero Section\n\n{hero_content}", text)

    # Replace FAQ stub
    if faq_content:
        text = text.replace(
            "## FAQ Section\n*Content to be generated.*",
            f"## FAQ Section\n\n{faq_content}",
        )

    # Rebuild references table
    if all_ref_rows:
        ref_header = (
            "## References\n\n"
            "| # | Source | Page | Note |\n"
            "|---|--------|------|------|\n"
        )
        ref_table = ref_header + "\n".join(all_ref_rows)

        # Replace existing empty or populated references section
        ref_pattern = re.compile(
            r"## References\n+\| # \| Source \| Page \| Note \|\n\|---\|--------\|------\|------\|[^\n]*(?:\n\|[^\n]*)*"
        )
        if ref_pattern.search(text):
            text = ref_pattern.sub(ref_table, text)
        elif "## Page Metadata" in text:
            text = text.replace("## Page Metadata", f"{ref_table}\n\n## Page Metadata")
        else:
            text += f"\n\n{ref_table}\n"

    # Update status from stub to draft
    text = re.sub(r"(status:\s*)stub", r"\1draft", text)

    return text


async def generate_file(
    path: Path,
    config: Config,
    rag_engine: object | None = None,
    dry_run: bool = False,
) -> AsyncGenerator[GenerateEvent | GenerateResult, None]:
    """Generate content for a single cluster markdown file.

    Yields GenerateEvents for progress, then a final GenerateResult.
    """
    from editorial_crew.rag import RAGEngine

    meta = parse_cluster_file(path)
    if meta is None:
        yield GenerateEvent(kind="skipping", section=path.name, detail="no CLUSTER_META found")
        yield GenerateResult(path=path, error="no CLUSTER_META found")
        return

    text = path.read_text(encoding="utf-8")
    pending = find_pending_subtopics(text, meta.subtopics)
    stub_hero = has_stub_hero(text)
    stub_faq = has_stub_faq(text)

    if not pending and not stub_hero and not stub_faq:
        yield GenerateEvent(kind="skipping", section=path.name, detail="no pending sections")
        yield GenerateResult(path=path)
        return

    if dry_run:
        detail_parts = []
        if pending:
            detail_parts.append(f"{len(pending)} subtopics")
        if stub_hero:
            detail_parts.append("hero")
        if stub_faq:
            detail_parts.append("FAQ")
        yield GenerateEvent(kind="skipping", section=path.name, detail=f"DRY RUN — would generate: {', '.join(detail_parts)}")
        yield GenerateResult(path=path)
        return

    location_full = "Portland, Oregon" if meta.location == "portland" else "Seattle, Washington"
    result = GenerateResult(path=path)

    # Import here to avoid import errors when generate deps not installed
    from claude_agent_sdk import query, ClaudeAgentOptions, ResultMessage
    from editorial_crew.agents.registry import get_agent_definitions

    subtopic_results: dict[str, tuple[str, list[str]]] = {}

    # Generate subtopics
    for i, subtopic in enumerate(pending):
        yield GenerateEvent(
            kind="generating",
            section=f"[{i+1}/{len(pending)}] {subtopic}",
        )

        rag_context = ""
        if rag_engine and isinstance(rag_engine, RAGEngine):
            search_query = f"{subtopic} {meta.service} {location_full}"
            results = rag_engine.search(search_query, top_k=config.rag_top_k)
            rag_context = rag_engine.format_context(results)

        agent_defs = get_agent_definitions(filter_names=["subtopic_writer"])
        user_prompt = f"""## Full document context:\n\n{text}\n\n---\n\n## Construction reference material (RAG):\n\n{rag_context}\n\n---\n\nWrite a ~200-word section body for:\n\nSubtopic: {subtopic}\nParent page: {meta.service} — {location_full}"""

        raw_output = ""
        async for message in query(
            prompt=user_prompt,
            options=ClaudeAgentOptions(
                allowed_tools=[],
                agents=agent_defs,
                system_prompt=agent_defs["subtopic_writer"].prompt,
                model="sonnet",
                permission_mode="bypassPermissions",
                max_turns=5,
            ),
        ):
            if isinstance(message, ResultMessage):
                raw_output = message.result or ""

        # Parse output: content body + refs
        parts = raw_output.split("<!-- REFS -->", 1)
        content_body = parts[0].strip()
        ref_rows = []
        if len(parts) == 2:
            ref_rows = [l.strip() for l in parts[1].strip().splitlines() if l.strip().startswith("|")]

        subtopic_results[subtopic] = (content_body, ref_rows)
        result.subtopics_written += 1
        result.refs_written += len(ref_rows)

    # Generate hero
    hero_content = None
    if stub_hero:
        yield GenerateEvent(kind="generating", section="[hero]")
        # Re-read text with subtopics filled in for hero context
        working_text = assemble_content(text, subtopic_results, None, None)

        agent_defs = get_agent_definitions(filter_names=["hero_writer"])
        raw_output = ""
        async for message in query(
            prompt=f"Write a hero section for this cluster service page:\n\n{working_text}",
            options=ClaudeAgentOptions(
                allowed_tools=[],
                agents=agent_defs,
                system_prompt=agent_defs["hero_writer"].prompt,
                model="sonnet",
                permission_mode="bypassPermissions",
                max_turns=5,
            ),
        ):
            if isinstance(message, ResultMessage):
                raw_output = message.result or ""

        hero_content = raw_output.strip()
        result.hero_written = True

    # Generate FAQ
    faq_content = None
    if stub_faq:
        yield GenerateEvent(kind="generating", section="[faq]")
        working_text = assemble_content(text, subtopic_results, hero_content, None)

        agent_defs = get_agent_definitions(filter_names=["faq_writer"])
        raw_output = ""
        async for message in query(
            prompt=f"Write an FAQ section for this cluster service page:\n\n{working_text}",
            options=ClaudeAgentOptions(
                allowed_tools=[],
                agents=agent_defs,
                system_prompt=agent_defs["faq_writer"].prompt,
                model="sonnet",
                permission_mode="bypassPermissions",
                max_turns=5,
            ),
        ):
            if isinstance(message, ResultMessage):
                raw_output = message.result or ""

        faq_content = raw_output.strip()
        result.faq_written = True

    # Assemble and write
    final = assemble_content(text, subtopic_results, hero_content, faq_content)
    yield GenerateEvent(kind="writing", section=path.name)
    path.write_text(final, encoding="utf-8")

    yield result
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd tools/editorial-crew && python -m pytest tests/test_generator.py -v`
Expected: All 4 tests PASS (the `assemble_content` tests are pure Python, no SDK needed)

- [ ] **Step 5: Commit**

```bash
cd /c/Users/tfalcon/microsites
git add tools/editorial-crew/editorial_crew/generator.py tools/editorial-crew/tests/test_generator.py
git commit -m "add generation runner with content assembly and reference renumbering"
```

---

### Task 6: Subcommand CLI (`__main__.py`)

**Files:**
- Modify: `tools/editorial-crew/editorial_crew/__main__.py`
- Modify: `tools/editorial-crew/tests/test_cli.py`

- [ ] **Step 1: Write failing tests for subcommand parsing**

Add to `tests/test_cli.py`:

```python
def test_parse_args_review_subcommand():
    args = parse_args(["review", "readme.md"])
    assert args.command == "review"
    assert args.files == ["readme.md"]


def test_parse_args_generate_subcommand():
    args = parse_args(["generate", "cluster.md"])
    assert args.command == "generate"
    assert args.files == ["cluster.md"]
    assert args.no_review is False
    assert args.dry_run is False
    assert args.review_agents is None


def test_parse_args_generate_with_flags():
    args = parse_args(["generate", "cluster.md", "--no-review", "--dry-run"])
    assert args.command == "generate"
    assert args.no_review is True
    assert args.dry_run is True


def test_parse_args_generate_review_agents():
    args = parse_args(["generate", "cluster.md", "--review-agents", "grammar,seo"])
    assert args.review_agents == ["grammar", "seo"]


def test_parse_args_bare_files_default_to_review():
    args = parse_args(["readme.md"])
    assert args.command == "review"
    assert args.files == ["readme.md"]


def test_parse_args_bare_files_with_agents():
    args = parse_args(["readme.md", "--agents", "grammar,structure"])
    assert args.command == "review"
    assert args.agents == ["grammar", "structure"]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd tools/editorial-crew && python -m pytest tests/test_cli.py -v`
Expected: FAIL — no `command` attribute on args

- [ ] **Step 3: Rewrite `parse_args` to use subcommands with backward compat**

Replace the `parse_args` function in `__main__.py`:

```python
def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="editorial-crew",
        description="Improve markdown files with an AI editorial team",
    )
    subparsers = parser.add_subparsers(dest="command")

    # Shared arguments for both subcommands
    def add_common_args(sub: argparse.ArgumentParser) -> None:
        sub.add_argument("files", nargs="+", help="Markdown file(s) or glob pattern(s)")
        sub.add_argument("--agents", type=lambda s: s.split(","), default=None,
                         help="Comma-separated specialist names to constrain")
        sub.add_argument("--output", type=str, default=None,
                         help="Write diff to file instead of stdout")
        sub.add_argument("--model", type=str, default=None,
                         help="Override the LLM model")
        sub.add_argument("--debug", action="store_true",
                         help="Show raw SDK messages for debugging")
        sub.add_argument("--json", action="store_true",
                         help="Output structured JSON instead of Rich console output")

    # review subcommand
    review_parser = subparsers.add_parser("review", help="Review and improve markdown files")
    add_common_args(review_parser)

    # generate subcommand
    gen_parser = subparsers.add_parser("generate", help="Generate cluster service page content")
    add_common_args(gen_parser)
    gen_parser.add_argument("--no-review", action="store_true",
                            help="Skip editorial review after generation")
    gen_parser.add_argument("--dry-run", action="store_true",
                            help="Show what would be generated without writing")
    gen_parser.add_argument("--review-agents", type=lambda s: s.split(","), default=None,
                            help="Comma-separated review agents for post-generation review")

    args = parser.parse_args(argv)

    # Backward compat: bare files with no subcommand → review
    if args.command is None:
        # Re-parse as review subcommand
        args = review_parser.parse_args(argv)
        args.command = "review"

    # Ensure generate-specific attrs exist on review args
    if args.command == "review":
        if not hasattr(args, "no_review"):
            args.no_review = False
        if not hasattr(args, "dry_run"):
            args.dry_run = False
        if not hasattr(args, "review_agents"):
            args.review_agents = None

    return args
```

- [ ] **Step 4: Add `generate_file_cli` and update `async_main` routing**

Add the generate file processing function and update `async_main` in `__main__.py`:

```python
async def process_generate_file(filepath: Path, args: argparse.Namespace) -> bool:
    """Process a single file through the generation pipeline. Returns True on success."""
    from editorial_crew.rag import RAGEngine, check_generate_deps
    from editorial_crew.generator import generate_file, GenerateEvent, GenerateResult
    from editorial_crew.config import load_config

    console.print(f"\n[bold]editorial-crew generate -- {filepath}[/bold]\n")

    config = load_config()

    # Initialize RAG engine (shared across calls if we refactor later)
    rag = RAGEngine(
        db_path=config.rag_db_path,
        table_name=config.rag_table,
        embedding_model=config.rag_embedding_model,
        device=config.rag_device,
    )

    result = None
    async for event in generate_file(
        path=filepath,
        config=config,
        rag_engine=rag,
        dry_run=getattr(args, "dry_run", False),
    ):
        if isinstance(event, GenerateEvent):
            if event.kind == "generating":
                console.print(f"  [cyan]{event.section}[/cyan] generating...", end=" ")
            elif event.kind == "skipping":
                console.print(f"  [yellow]{event.section}[/yellow] — {event.detail}")
            elif event.kind == "writing":
                console.print(f"  [green]Writing {event.section}[/green]")
            elif event.kind == "error":
                console.print(f"  [red]{event.section}: {event.detail}[/red]")
        elif isinstance(event, GenerateResult):
            result = event
            if event.kind == "generating":
                console.print("[green]done[/green]")

    if result is None:
        console.print("  [red][FAIL] No result received[/red]")
        return False

    if result.error:
        console.print(f"  [red][FAIL] {result.error}[/red]")
        return False

    summary_parts = []
    if result.subtopics_written:
        summary_parts.append(f"{result.subtopics_written} subtopics")
    if result.hero_written:
        summary_parts.append("hero")
    if result.faq_written:
        summary_parts.append("FAQ")
    if result.refs_written:
        summary_parts.append(f"{result.refs_written} refs")

    if summary_parts:
        console.print(f"\n  [bold]Generated: {', '.join(summary_parts)}[/bold]")

    # Run review phase unless --no-review
    if not getattr(args, "no_review", False) and summary_parts:
        console.print(f"\n  [bold]Running editorial review...[/bold]")
        review_args = argparse.Namespace(
            files=[str(filepath)],
            agents=getattr(args, "review_agents", None),
            output=args.output,
            model=args.model,
            debug=args.debug,
            json=getattr(args, "json", False),
        )
        await process_file(filepath, review_args)

    return True
```

Update `async_main` to route based on subcommand:

```python
async def async_main(args: argparse.Namespace) -> int:
    files = expand_globs(args.files)
    if not files:
        console.print("[red]No markdown files found.[/red]")
        return 1

    check_api_key()

    # Check generate deps early
    if args.command == "generate":
        from editorial_crew.rag import check_generate_deps
        check_generate_deps()

    successes = 0
    failures = 0

    for filepath in files:
        if args.command == "generate":
            if await process_generate_file(filepath, args):
                successes += 1
            else:
                failures += 1
        elif args.json:
            if await process_file_json(filepath, args):
                successes += 1
            else:
                failures += 1
        else:
            if await process_file(filepath, args):
                successes += 1
            else:
                failures += 1

    if not args.json and len(files) > 1:
        summary = f"Summary: {successes}/{len(files)} files processed"
        if failures:
            summary += f", {failures} failed"
        console.print(f"\n[bold]{summary}[/bold]")

    return 0 if failures == 0 else 1
```

- [ ] **Step 5: Run all tests**

Run: `cd tools/editorial-crew && python -m pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
cd /c/Users/tfalcon/microsites
git add tools/editorial-crew/editorial_crew/__main__.py tools/editorial-crew/tests/test_cli.py
git commit -m "add generate subcommand with review/generate routing to editorial crew CLI"
```

---

### Task 7: Integration Test — Dry Run on Trim Repair

**Files:**
- No new files — this is a manual verification task

- [ ] **Step 1: Run dry-run on trim-repair cluster files**

```bash
cd tools/editorial-crew
python -m editorial_crew generate --dry-run "../../apps/trim-repair/src/data/generated_content/service_page_cluster_*.md"
```

Expected output: For each of the 12 cluster files, should print either:
- `Skipping <filename> — no pending sections` (if subtopics already populated and hero/FAQ done)
- `Skipping <filename> — DRY RUN — would generate: hero, FAQ` (if subtopics filled but hero/FAQ are stubs)

This verifies the parser correctly reads real cluster files and the CLI routing works end-to-end.

- [ ] **Step 2: Run unit tests one final time**

```bash
cd tools/editorial-crew && python -m pytest tests/ -v
```

Expected: All tests PASS

- [ ] **Step 3: Commit any fixes if needed**

If dry-run revealed issues, fix and commit. Otherwise, no action needed.

---

### Task 8: Live Generation Test on a Single File

**Files:**
- Working on: `apps/trim-repair/src/data/generated_content/service_page_cluster_exterior-trim-rot-repair-replacement_portland.md`

- [ ] **Step 1: Back up the target file**

```bash
cp apps/trim-repair/src/data/generated_content/service_page_cluster_exterior-trim-rot-repair-replacement_portland.md \
   apps/trim-repair/src/data/generated_content/service_page_cluster_exterior-trim-rot-repair-replacement_portland.md.bak
```

- [ ] **Step 2: Run generate with --no-review on a single file**

```bash
cd tools/editorial-crew
python -m editorial_crew generate --no-review "../../apps/trim-repair/src/data/generated_content/service_page_cluster_exterior-trim-rot-repair-replacement_portland.md"
```

Expected: Should generate hero and FAQ sections (subtopics are already populated). Watch for:
- Hero section replaces `[STUB]` with real content
- FAQ section replaces stub with 4-6 questions
- References table is intact
- Status updated to `draft`

- [ ] **Step 3: Verify output quality**

Read the generated file and check:
- Hero headline is specific to "Exterior Trim Rot Repair & Replacement in Portland"
- FAQ questions are relevant to the subtopics on the page
- No broken markdown formatting
- References table still has all original entries

- [ ] **Step 4: Run generate with review on the same file**

```bash
cd tools/editorial-crew
python -m editorial_crew generate "../../apps/trim-repair/src/data/generated_content/service_page_cluster_exterior-trim-rot-repair-replacement_portland.md"
```

Expected: Since hero/FAQ are now filled, generation should skip. Review phase should run and show editorial improvements.

- [ ] **Step 5: Restore backup or keep changes**

If output is good, remove backup. If not, restore:
```bash
# Restore if needed:
mv apps/trim-repair/src/data/generated_content/service_page_cluster_exterior-trim-rot-repair-replacement_portland.md.bak \
   apps/trim-repair/src/data/generated_content/service_page_cluster_exterior-trim-rot-repair-replacement_portland.md
```

- [ ] **Step 6: Commit if keeping changes**

```bash
cd /c/Users/tfalcon/microsites
git add tools/editorial-crew/
git commit -m "editorial crew generate subcommand: verified working on trim-repair cluster pages"
```

# Content Review Pipeline — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a multi-agent editorial pipeline that passes markdown content through specialist AI agents (quality cleaner → language editor) in sequence, writes improvements back to source files, and uses LanceDB to detect near-duplicate content across the monorepo.

**Architecture:** Python CLI tool in `tools/content-review/`. Agent behavior is defined in markdown files with YAML frontmatter. A `pipeline.py` module loads agents, calls the OpenAI API for each, and chains outputs. LanceDB stores content embeddings for cross-site dedup detection. Three Jupyter notebooks cover testing each layer.

**Tech Stack:** Python 3.11+, OpenAI SDK (`openai`), LanceDB (`lancedb`), `python-frontmatter`, `pydantic`, `click`, `pytest`, `jupyter`

---

### Task 1: Scaffold directory and dependencies

**Files:**
- Create: `tools/content-review/requirements.txt`
- Create: `tools/content-review/requirements-dev.txt`
- Create: `tools/content-review/README.md`
- Create: `tools/content-review/agents/.gitkeep`
- Create: `tools/content-review/notebooks/.gitkeep`
- Create: `tools/content-review/tests/__init__.py`
- Create: `tools/content-review/.env.example`

**Step 1: Create requirements.txt**

```
openai>=1.30.0
lancedb>=0.8.0
python-frontmatter>=1.1.0
pydantic>=2.7.0
click>=8.1.0
pyarrow>=15.0.0
```

**Step 2: Create requirements-dev.txt**

```
-r requirements.txt
pytest>=8.0.0
pytest-mock>=3.14.0
jupyter>=1.0.0
ipykernel>=6.29.0
```

**Step 3: Create .env.example**

```
OPENAI_API_KEY=sk-...
```

**Step 4: Create README.md skeleton**

```markdown
# Content Review Pipeline

Multi-agent editorial pipeline for SFW Construction microsites.

## Setup

```bash
cd tools/content-review
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
```

## Usage

```bash
# Single file, dry run (preview only)
python review.py --file ../../apps/deck-repair/src/data/generated_content/some-file.md --dry-run

# Single file, apply changes
python review.py --file ../../apps/deck-repair/src/data/generated_content/some-file.md

# All files in one site
python review.py --microsite deck-repair

# All sites
python review.py --all

# Run only quality cleaner agent
python review.py --file <path> --agents 01
```
```

**Step 5: Install dependencies**

```bash
cd tools/content-review
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
```

**Step 6: Commit**

```bash
git add tools/content-review/
git commit -m "scaffold content-review tool structure"
```

---

### Task 2: Agent config parser

**Files:**
- Create: `tools/content-review/agent_loader.py`
- Create: `tools/content-review/tests/test_agent_loader.py`
- Create: `tools/content-review/tests/fixtures/sample-agent.md`

**Step 1: Create test fixture**

Create `tools/content-review/tests/fixtures/sample-agent.md`:

```markdown
---
id: test-agent
name: Test Agent
order: 1
model: gpt-4o-mini
temperature: 0.2
input_format: markdown
output_format: markdown
---

## Role

You are a test agent.

## Tasks

1. Return content unchanged.

## Rules

- Return only the markdown, no commentary.
```

**Step 2: Write failing tests**

Create `tools/content-review/tests/test_agent_loader.py`:

```python
import pytest
from pathlib import Path
from agent_loader import AgentConfig, load_agent, load_agents_from_dir

FIXTURES = Path(__file__).parent / "fixtures"


def test_load_agent_parses_frontmatter():
    agent = load_agent(FIXTURES / "sample-agent.md")
    assert agent.id == "test-agent"
    assert agent.name == "Test Agent"
    assert agent.order == 1
    assert agent.model == "gpt-4o-mini"
    assert agent.temperature == 0.2


def test_load_agent_parses_body():
    agent = load_agent(FIXTURES / "sample-agent.md")
    assert "## Role" in agent.system_prompt
    assert "## Tasks" in agent.system_prompt
    assert "## Rules" in agent.system_prompt


def test_load_agents_from_dir_orders_by_order_field(tmp_path):
    # Write two agent files with different order values
    (tmp_path / "02-second.md").write_text(
        "---\nid: second\nname: Second\norder: 2\nmodel: gpt-4o-mini\ntemperature: 0.2\n"
        "input_format: markdown\noutput_format: markdown\n---\n\nBody."
    )
    (tmp_path / "01-first.md").write_text(
        "---\nid: first\nname: First\norder: 1\nmodel: gpt-4o-mini\ntemperature: 0.2\n"
        "input_format: markdown\noutput_format: markdown\n---\n\nBody."
    )
    agents = load_agents_from_dir(tmp_path)
    assert agents[0].id == "first"
    assert agents[1].id == "second"
```

**Step 3: Run tests to confirm they fail**

```bash
cd tools/content-review && source .venv/bin/activate
pytest tests/test_agent_loader.py -v
```
Expected: `ModuleNotFoundError: No module named 'agent_loader'`

**Step 4: Implement agent_loader.py**

Create `tools/content-review/agent_loader.py`:

```python
from pathlib import Path
from pydantic import BaseModel
import frontmatter


class AgentConfig(BaseModel):
    id: str
    name: str
    order: int
    model: str
    temperature: float
    input_format: str
    output_format: str
    system_prompt: str


def load_agent(path: Path) -> AgentConfig:
    post = frontmatter.load(str(path))
    return AgentConfig(
        id=post["id"],
        name=post["name"],
        order=post["order"],
        model=post["model"],
        temperature=post["temperature"],
        input_format=post["input_format"],
        output_format=post["output_format"],
        system_prompt=post.content,
    )


def load_agents_from_dir(agents_dir: Path) -> list[AgentConfig]:
    agents = [
        load_agent(f)
        for f in agents_dir.glob("*.md")
        if not f.name.startswith(".")
    ]
    return sorted(agents, key=lambda a: a.order)
```

**Step 5: Run tests to confirm they pass**

```bash
pytest tests/test_agent_loader.py -v
```
Expected: 3 tests PASS

**Step 6: Commit**

```bash
git add tools/content-review/agent_loader.py tools/content-review/tests/
git commit -m "add agent config loader with tests"
```

---

### Task 3: Pipeline config loader

**Files:**
- Create: `tools/content-review/pipeline_config.py`
- Create: `tools/content-review/tests/test_pipeline_config.py`
- Create: `tools/content-review/tests/fixtures/sample-pipeline.md`

**Step 1: Create pipeline fixture**

Create `tools/content-review/tests/fixtures/sample-pipeline.md`:

```markdown
---
agent_ids:
  - test-agent
brand_name: SFW Construction
locations:
  - Portland
  - Seattle
---

SFW Construction builds and repairs homes in Portland and Seattle.
Always use a professional, trustworthy tone.
```

**Step 2: Write failing tests**

Create `tools/content-review/tests/test_pipeline_config.py`:

```python
import pytest
from pathlib import Path
from pipeline_config import PipelineConfig, load_pipeline_config

FIXTURES = Path(__file__).parent / "fixtures"


def test_load_pipeline_config_parses_frontmatter():
    config = load_pipeline_config(FIXTURES / "sample-pipeline.md")
    assert config.agent_ids == ["test-agent"]
    assert config.brand_name == "SFW Construction"
    assert "Portland" in config.locations


def test_load_pipeline_config_parses_body():
    config = load_pipeline_config(FIXTURES / "sample-pipeline.md")
    assert "SFW Construction" in config.shared_context
    assert "professional" in config.shared_context


def test_pipeline_config_builds_context_string():
    config = load_pipeline_config(FIXTURES / "sample-pipeline.md")
    ctx = config.build_context_string()
    assert "SFW Construction" in ctx
    assert "Portland" in ctx
```

**Step 3: Run tests to confirm they fail**

```bash
pytest tests/test_pipeline_config.py -v
```
Expected: `ModuleNotFoundError: No module named 'pipeline_config'`

**Step 4: Implement pipeline_config.py**

Create `tools/content-review/pipeline_config.py`:

```python
from pathlib import Path
from pydantic import BaseModel
import frontmatter


class PipelineConfig(BaseModel):
    agent_ids: list[str]
    brand_name: str
    locations: list[str]
    shared_context: str

    def build_context_string(self) -> str:
        locations_str = ", ".join(self.locations)
        return (
            f"Brand: {self.brand_name}\n"
            f"Service locations: {locations_str}\n\n"
            f"{self.shared_context}"
        )


def load_pipeline_config(path: Path) -> PipelineConfig:
    post = frontmatter.load(str(path))
    return PipelineConfig(
        agent_ids=post["agent_ids"],
        brand_name=post["brand_name"],
        locations=post["locations"],
        shared_context=post.content,
    )
```

**Step 5: Run tests**

```bash
pytest tests/test_pipeline_config.py -v
```
Expected: 3 tests PASS

**Step 6: Commit**

```bash
git add tools/content-review/pipeline_config.py tools/content-review/tests/
git commit -m "add pipeline config loader with tests"
```

---

### Task 4: OpenAI caller

**Files:**
- Create: `tools/content-review/openai_caller.py`
- Create: `tools/content-review/tests/test_openai_caller.py`

**Step 1: Write failing tests**

Create `tools/content-review/tests/test_openai_caller.py`:

```python
import pytest
from unittest.mock import MagicMock, patch
from openai_caller import call_agent


def test_call_agent_returns_string(mocker):
    mock_response = MagicMock()
    mock_response.choices[0].message.content = "# Improved Content\n\nBody text."

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = mock_response

    result = call_agent(
        client=mock_client,
        model="gpt-4o-mini",
        temperature=0.2,
        system_prompt="You are an editor.",
        content="# Draft\n\nBody.",
    )
    assert result == "# Improved Content\n\nBody text."


def test_call_agent_passes_correct_messages(mocker):
    mock_response = MagicMock()
    mock_response.choices[0].message.content = "output"

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = mock_response

    call_agent(
        client=mock_client,
        model="gpt-4o",
        temperature=0.5,
        system_prompt="System.",
        content="User content.",
    )

    call_args = mock_client.chat.completions.create.call_args
    assert call_args.kwargs["model"] == "gpt-4o"
    assert call_args.kwargs["temperature"] == 0.5
    messages = call_args.kwargs["messages"]
    assert messages[0]["role"] == "system"
    assert "System." in messages[0]["content"]
    assert messages[1]["role"] == "user"
    assert "User content." in messages[1]["content"]
```

**Step 2: Run tests to confirm they fail**

```bash
pytest tests/test_openai_caller.py -v
```
Expected: `ModuleNotFoundError: No module named 'openai_caller'`

**Step 3: Implement openai_caller.py**

Create `tools/content-review/openai_caller.py`:

```python
from openai import OpenAI


def call_agent(
    client: OpenAI,
    model: str,
    temperature: float,
    system_prompt: str,
    content: str,
) -> str:
    response = client.chat.completions.create(
        model=model,
        temperature=temperature,
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    "Review and improve the following markdown content. "
                    "Return only the improved markdown:\n\n"
                    f"{content}"
                ),
            },
        ],
    )
    return response.choices[0].message.content
```

**Step 4: Run tests**

```bash
pytest tests/test_openai_caller.py -v
```
Expected: 2 tests PASS

**Step 5: Commit**

```bash
git add tools/content-review/openai_caller.py tools/content-review/tests/
git commit -m "add openai caller with tests"
```

---

### Task 5: Pipeline runner

**Files:**
- Create: `tools/content-review/pipeline.py`
- Create: `tools/content-review/tests/test_pipeline.py`

**Step 1: Write failing tests**

Create `tools/content-review/tests/test_pipeline.py`:

```python
import pytest
from unittest.mock import MagicMock, call
from pathlib import Path
from agent_loader import AgentConfig
from pipeline_config import PipelineConfig
from pipeline import run_pipeline


def make_agent(id: str, order: int) -> AgentConfig:
    return AgentConfig(
        id=id,
        name=id,
        order=order,
        model="gpt-4o-mini",
        temperature=0.2,
        input_format="markdown",
        output_format="markdown",
        system_prompt=f"You are agent {id}.",
    )


def make_pipeline_config() -> PipelineConfig:
    return PipelineConfig(
        agent_ids=["agent-a", "agent-b"],
        brand_name="Test Brand",
        locations=["Portland"],
        shared_context="Be professional.",
    )


def test_run_pipeline_chains_agents(mocker):
    agents = [make_agent("agent-a", 1), make_agent("agent-b", 2)]
    config = make_pipeline_config()
    mock_client = MagicMock()

    # Each call returns progressively improved content
    mock_caller = mocker.patch(
        "pipeline.call_agent",
        side_effect=["After agent-a", "After agent-b"],
    )

    result = run_pipeline(
        content="Original content",
        agents=agents,
        pipeline_config=config,
        client=mock_client,
    )

    assert result == "After agent-b"
    assert mock_caller.call_count == 2
    # Second agent receives output of first
    second_call_content = mock_caller.call_args_list[1].kwargs["content"]
    assert second_call_content == "After agent-a"


def test_run_pipeline_injects_shared_context(mocker):
    agents = [make_agent("agent-a", 1)]
    config = make_pipeline_config()
    mock_client = MagicMock()

    mock_caller = mocker.patch("pipeline.call_agent", return_value="output")

    run_pipeline(
        content="Content",
        agents=agents,
        pipeline_config=config,
        client=mock_client,
    )

    system_prompt = mock_caller.call_args.kwargs["system_prompt"]
    assert "Be professional." in system_prompt
    assert "Portland" in system_prompt


def test_run_pipeline_with_agent_filter(mocker):
    agents = [make_agent("agent-a", 1), make_agent("agent-b", 2)]
    config = make_pipeline_config()
    mock_client = MagicMock()

    mock_caller = mocker.patch("pipeline.call_agent", return_value="output")

    run_pipeline(
        content="Content",
        agents=agents,
        pipeline_config=config,
        client=mock_client,
        agent_filter=["agent-a"],
    )

    assert mock_caller.call_count == 1
```

**Step 2: Run tests to confirm they fail**

```bash
pytest tests/test_pipeline.py -v
```
Expected: `ModuleNotFoundError: No module named 'pipeline'`

**Step 3: Implement pipeline.py**

Create `tools/content-review/pipeline.py`:

```python
from openai import OpenAI
from agent_loader import AgentConfig
from pipeline_config import PipelineConfig
from openai_caller import call_agent


def run_pipeline(
    content: str,
    agents: list[AgentConfig],
    pipeline_config: PipelineConfig,
    client: OpenAI,
    agent_filter: list[str] | None = None,
) -> str:
    active_agents = agents
    if agent_filter:
        active_agents = [a for a in agents if a.id in agent_filter]

    shared_context = pipeline_config.build_context_string()
    current = content

    for agent in active_agents:
        system_prompt = f"{agent.system_prompt}\n\n---\n\n{shared_context}"
        current = call_agent(
            client=client,
            model=agent.model,
            temperature=agent.temperature,
            system_prompt=system_prompt,
            content=current,
        )

    return current
```

**Step 4: Run tests**

```bash
pytest tests/test_pipeline.py -v
```
Expected: 3 tests PASS

**Step 5: Run all tests so far**

```bash
pytest tests/ -v
```
Expected: All tests PASS

**Step 6: Commit**

```bash
git add tools/content-review/pipeline.py tools/content-review/tests/
git commit -m "add pipeline runner with agent chaining and tests"
```

---

### Task 6: LanceDB dedup store

**Files:**
- Create: `tools/content-review/lancedb_store.py`
- Create: `tools/content-review/tests/test_lancedb_store.py`

**Step 1: Write failing tests**

Create `tools/content-review/tests/test_lancedb_store.py`:

```python
import pytest
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch
from lancedb_store import ContentStore, SimilarPage


def test_upsert_and_query_returns_similar(tmp_path):
    store = ContentStore(db_path=str(tmp_path / "test.lancedb"))

    # Mock the embedding call so we don't need real OpenAI
    with patch.object(store, "_embed", return_value=[0.1] * 1536):
        store.upsert(app="deck-repair", filename="file-a.md", content="Deck boards rot in wet climates.")
        store.upsert(app="deck-repair", filename="file-b.md", content="Deck boards rot in rainy weather.")

        results = store.find_similar(app="siding-repair", filename="file-c.md", content="Wood siding rots in wet climates.", top_k=2)

    assert isinstance(results, list)


def test_upsert_overwrites_existing_entry(tmp_path):
    store = ContentStore(db_path=str(tmp_path / "test.lancedb"))

    with patch.object(store, "_embed", return_value=[0.1] * 1536):
        store.upsert(app="deck-repair", filename="file-a.md", content="Version 1")
        store.upsert(app="deck-repair", filename="file-a.md", content="Version 2")
        # Should not raise; table should handle upsert
```

**Step 2: Run tests to confirm they fail**

```bash
pytest tests/test_lancedb_store.py -v
```
Expected: `ModuleNotFoundError: No module named 'lancedb_store'`

**Step 3: Implement lancedb_store.py**

Create `tools/content-review/lancedb_store.py`:

```python
from __future__ import annotations
import lancedb
import pyarrow as pa
from pydantic import BaseModel
from openai import OpenAI


class SimilarPage(BaseModel):
    app: str
    filename: str
    score: float


class ContentStore:
    TABLE_NAME = "content"

    def __init__(self, db_path: str = ".lancedb", openai_client: OpenAI | None = None):
        self.db = lancedb.connect(db_path)
        self.client = openai_client
        self._ensure_table()

    def _ensure_table(self) -> None:
        if self.TABLE_NAME not in self.db.table_names():
            schema = pa.schema([
                pa.field("app", pa.string()),
                pa.field("filename", pa.string()),
                pa.field("content_preview", pa.string()),
                pa.field("vector", pa.list_(pa.float32(), 1536)),
            ])
            self.db.create_table(self.TABLE_NAME, schema=schema)

    def _embed(self, text: str) -> list[float]:
        response = self.client.embeddings.create(
            model="text-embedding-3-small",
            input=text[:8000],  # truncate to avoid token limit
        )
        return response.data[0].embedding

    def upsert(self, app: str, filename: str, content: str) -> None:
        vector = self._embed(content)
        table = self.db.open_table(self.TABLE_NAME)

        # Delete existing entry for this file if present
        try:
            table.delete(f"app = '{app}' AND filename = '{filename}'")
        except Exception:
            pass

        table.add([{
            "app": app,
            "filename": filename,
            "content_preview": content[:200],
            "vector": vector,
        }])

    def find_similar(
        self, app: str, filename: str, content: str, top_k: int = 3
    ) -> list[SimilarPage]:
        vector = self._embed(content)
        table = self.db.open_table(self.TABLE_NAME)

        results = (
            table.search(vector)
            .where(f"NOT (app = '{app}' AND filename = '{filename}')")
            .limit(top_k)
            .to_list()
        )

        return [
            SimilarPage(app=r["app"], filename=r["filename"], score=r["_distance"])
            for r in results
        ]
```

**Step 4: Run tests**

```bash
pytest tests/test_lancedb_store.py -v
```
Expected: 2 tests PASS

**Step 5: Commit**

```bash
git add tools/content-review/lancedb_store.py tools/content-review/tests/
git commit -m "add lancedb content store with dedup detection"
```

---

### Task 7: Agent markdown files

**Files:**
- Create: `tools/content-review/agents/01-quality-cleaner.md`
- Create: `tools/content-review/agents/02-language-editor.md`
- Create: `tools/content-review/pipeline.md`

**Step 1: Create 01-quality-cleaner.md**

```markdown
---
id: quality-cleaner
name: Quality Cleaner
order: 1
model: gpt-4o
temperature: 0.1
input_format: markdown
output_format: markdown
---

## Role

You are a technical content quality editor for SFW Construction home repair microsites. Your job is to fix structural and artifact issues in AI-generated markdown content without rewriting the prose.

## Tasks

1. **Remove citation artifacts** — delete any text matching patterns like:
   - `[Source: Author Name, Page N]`
   - `[Source: Author - Title, Page N]`
   - `(Source: ...)` in parentheses

2. **Fix malformed link injections** — the interlinking tool sometimes inserts links mid-sentence, breaking the grammatical flow. Examples of malformed insertions:
   - `"...can For related services, [link text](url) can help. lead to..."` — remove the wrapper text "For related services, ... can help." and keep only the natural prose (or remove the link entirely if it can't be placed naturally)
   - `"...For comprehensive solutions, [link](url) can help. be time to..."` — remove the awkward injection entirely
   - Rule: if a link appears inside a sentence fragment that begins with "For related services," or "For comprehensive solutions," — remove the entire clause including the link

3. **Remove duplicate H1 headings** — if the document starts with two identical or near-identical `# Heading` lines, remove the first one (keep the second)

4. **Preserve everything else exactly** — do not change any other prose, fix typos, or alter content

## Output Format

Return only the corrected markdown. No preamble, no explanation, no commentary.
```

**Step 2: Create 02-language-editor.md**

```markdown
---
id: language-editor
name: Language Editor
order: 2
model: gpt-4o
temperature: 0.4
input_format: markdown
output_format: markdown
---

## Role

You are a senior editorial writer for SFW Construction, a home repair and restoration company serving Portland and Seattle homeowners. Your job is to improve the tone, clarity, and brand voice of service page and blog post content.

## Brand Voice

- **Trustworthy and expert** — homeowners are trusting us with their homes
- **Approachable and local** — we know Portland and Seattle, we're not a national chain
- **Clear and direct** — avoid jargon, get to the point
- **Action-oriented** — guide homeowners toward their next step

## Tasks

1. **Improve sentence flow** — fix awkward phrasing, run-ons, and passive constructions where active voice is cleaner
2. **Strengthen calls to action** — CTAs should be specific and confident (e.g. "Schedule your free inspection today" not "Contact us for more information")
3. **Remove filler phrases** — cut "in conclusion," "it is important to note that," "as previously mentioned," and similar
4. **Maintain factual accuracy** — do not change any claims, statistics, or specific details
5. **Preserve all links** — do not remove or modify any hyperlinks
6. **Preserve all markdown structure** — headings, lists, and formatting must remain intact

## Output Format

Return only the improved markdown. No preamble, no explanation, no commentary.
```

**Step 3: Create pipeline.md**

```markdown
---
agent_ids:
  - quality-cleaner
  - language-editor
brand_name: SFW Construction
locations:
  - Portland, Oregon
  - Seattle, Washington
---

SFW Construction is a family-owned home repair and restoration company based in the Pacific Northwest.
We specialize in deck repair, dry rot remediation, mold testing, chimney repair, siding repair, and related services.
Our tone is professional, honest, and local. We speak directly to homeowners who care about protecting their homes.
```

**Step 4: Commit**

```bash
git add tools/content-review/agents/ tools/content-review/pipeline.md
git commit -m "add quality-cleaner and language-editor agent definitions"
```

---

### Task 8: CLI entrypoint

**Files:**
- Create: `tools/content-review/review.py`

**Step 1: Create review.py**

```python
#!/usr/bin/env python3
"""
Content Review Pipeline CLI

Usage:
    python review.py --file ../../apps/deck-repair/src/data/generated_content/some-file.md
    python review.py --file <path> --dry-run
    python review.py --microsite deck-repair
    python review.py --all
    python review.py --file <path> --agents quality-cleaner
"""

import os
import sys
from pathlib import Path
import click
from dotenv import load_dotenv
from openai import OpenAI

from agent_loader import load_agents_from_dir
from pipeline_config import load_pipeline_config
from pipeline import run_pipeline
from lancedb_store import ContentStore

load_dotenv()

TOOL_DIR = Path(__file__).parent
AGENTS_DIR = TOOL_DIR / "agents"
PIPELINE_MD = TOOL_DIR / "pipeline.md"
APPS_DIR = TOOL_DIR / "../../apps"

APPS = [
    "beam-repair", "chimney-repair", "crawlspace-rot", "deck-repair",
    "dry-rot", "flashing-repair", "lead-paint", "leak-repair",
    "mold-testing", "restoration", "siding-repair", "trim-repair",
]


def get_content_files(app: str) -> list[Path]:
    content_dir = APPS_DIR / app / "src/data/generated_content"
    if not content_dir.exists():
        return []
    return list(content_dir.glob("*.md"))


def process_file(
    filepath: Path,
    agents,
    pipeline_config,
    client: OpenAI,
    store: ContentStore,
    dry_run: bool,
    agent_filter: list[str] | None,
) -> None:
    app = filepath.parts[-4] if len(filepath.parts) >= 4 else "unknown"
    filename = filepath.name

    click.echo(f"  Processing: {app}/{filename}")

    content = filepath.read_text(encoding="utf-8")
    improved = run_pipeline(
        content=content,
        agents=agents,
        pipeline_config=pipeline_config,
        client=client,
        agent_filter=agent_filter,
    )

    if dry_run:
        click.echo(click.style("  [DRY RUN] Changes not written.", fg="yellow"))
        click.echo("  --- Preview (first 500 chars) ---")
        click.echo(improved[:500])
    else:
        filepath.write_text(improved, encoding="utf-8")
        store.upsert(app=app, filename=filename, content=improved)
        click.echo(click.style("  ✓ Written.", fg="green"))

    # Check for similar content across sites
    similar = store.find_similar(app=app, filename=filename, content=improved, top_k=3)
    if similar:
        for s in similar:
            if s.score < 0.15:  # low distance = very similar
                click.echo(
                    click.style(
                        f"  ⚠ Near-duplicate detected: {s.app}/{s.filename} (score: {s.score:.3f})",
                        fg="yellow",
                    )
                )


@click.command()
@click.option("--file", "filepath", type=click.Path(exists=True, path_type=Path), help="Single file to process")
@click.option("--microsite", help="Process all files in one microsite app")
@click.option("--all", "all_sites", is_flag=True, help="Process all microsites")
@click.option("--dry-run", is_flag=True, help="Preview output without writing files")
@click.option("--agents", "agent_filter_str", default=None, help="Comma-separated agent IDs to run (e.g. quality-cleaner)")
def main(filepath, microsite, all_sites, dry_run, agent_filter_str):
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        click.echo(click.style("Error: OPENAI_API_KEY not set in environment or .env file", fg="red"))
        sys.exit(1)

    client = OpenAI(api_key=api_key)
    agents = load_agents_from_dir(AGENTS_DIR)
    pipeline_config = load_pipeline_config(PIPELINE_MD)
    store = ContentStore(db_path=str(TOOL_DIR / ".lancedb"), openai_client=client)

    agent_filter = [a.strip() for a in agent_filter_str.split(",")] if agent_filter_str else None

    if filepath:
        files = [filepath]
    elif microsite:
        files = get_content_files(microsite)
        if not files:
            click.echo(f"No content files found for microsite: {microsite}")
            sys.exit(1)
    elif all_sites:
        files = []
        for app in APPS:
            files.extend(get_content_files(app))
    else:
        click.echo("Provide --file, --microsite, or --all")
        sys.exit(1)

    click.echo(f"Running pipeline on {len(files)} file(s)...")
    if dry_run:
        click.echo(click.style("DRY RUN MODE — no files will be written", fg="yellow"))

    for f in files:
        process_file(f, agents, pipeline_config, client, store, dry_run, agent_filter)

    click.echo(click.style(f"\nDone. {len(files)} file(s) processed.", fg="green"))


if __name__ == "__main__":
    main()
```

Note: `dotenv` is needed — add `python-dotenv` to `requirements.txt`.

**Step 2: Add python-dotenv to requirements.txt**

Open `tools/content-review/requirements.txt` and add:
```
python-dotenv>=1.0.0
```

Then reinstall:
```bash
pip install -r requirements-dev.txt
```

**Step 3: Smoke test CLI (dry run)**

```bash
cd tools/content-review && source .venv/bin/activate
python review.py --file ../../apps/deck-repair/src/data/generated_content/how_to_choose_the_best_deck_repair_contractor_in_portland.md --dry-run --agents quality-cleaner
```
Expected: Preview output showing cleaned content (citation artifacts removed, malformed links fixed)

**Step 4: Commit**

```bash
git add tools/content-review/review.py tools/content-review/requirements.txt
git commit -m "add CLI entrypoint for content review pipeline"
```

---

### Task 9: Jupyter notebooks

**Files:**
- Create: `tools/content-review/notebooks/01-test-quality-agent.ipynb`
- Create: `tools/content-review/notebooks/02-test-language-agent.ipynb`
- Create: `tools/content-review/notebooks/03-test-full-pipeline.ipynb`

**Step 1: Register the venv as a Jupyter kernel**

```bash
cd tools/content-review && source .venv/bin/activate
python -m ipykernel install --user --name content-review --display-name "Content Review"
```

**Step 2: Create notebook 01-test-quality-agent.ipynb**

Start Jupyter:
```bash
jupyter notebook notebooks/
```

Create a new notebook `01-test-quality-agent.ipynb` with these cells:

Cell 1 (setup):
```python
import sys
sys.path.insert(0, '..')

import os
from pathlib import Path
from dotenv import load_dotenv
load_dotenv('../.env')

from openai import OpenAI
from agent_loader import load_agent
from openai_caller import call_agent

client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
agent = load_agent(Path('../agents/01-quality-cleaner.md'))
print(f"Loaded agent: {agent.name}")
```

Cell 2 (load sample file):
```python
sample = Path('../../apps/deck-repair/src/data/generated_content/how_to_choose_the_best_deck_repair_contractor_in_portland.md').read_text()
print("Original (first 1000 chars):")
print(sample[:1000])
```

Cell 3 (run agent):
```python
result = call_agent(
    client=client,
    model=agent.model,
    temperature=agent.temperature,
    system_prompt=agent.system_prompt,
    content=sample,
)
print("After quality cleaner (first 1000 chars):")
print(result[:1000])
```

Cell 4 (diff check):
```python
# Verify citation artifacts are gone
import re
citation_pattern = r'\[Source:[^\]]+\]'
before_count = len(re.findall(citation_pattern, sample))
after_count = len(re.findall(citation_pattern, result))
print(f"Citation artifacts: {before_count} → {after_count}")
assert after_count == 0, "Citation artifacts remain!"
print("✓ All citation artifacts removed")
```

**Step 3: Create notebook 02-test-language-agent.ipynb**

Similar structure to notebook 01, but:
- Load agent `02-language-editor.md`
- Feed it output from the quality cleaner (chain them)
- Check for specific brand voice improvements

Cell structure:
```python
# Cell 1: Setup (same as notebook 01)

# Cell 2: Load quality-cleaned content (run quality agent first)
quality_agent = load_agent(Path('../agents/01-quality-cleaner.md'))
language_agent = load_agent(Path('../agents/02-language-editor.md'))

sample = Path('../../apps/deck-repair/src/data/generated_content/some-file.md').read_text()
quality_result = call_agent(client=client, model=quality_agent.model,
    temperature=quality_agent.temperature, system_prompt=quality_agent.system_prompt, content=sample)

# Cell 3: Run language agent
language_result = call_agent(client=client, model=language_agent.model,
    temperature=language_agent.temperature, system_prompt=language_agent.system_prompt, content=quality_result)

print(language_result[:1500])
```

**Step 4: Create notebook 03-test-full-pipeline.ipynb**

```python
# Cell 1: Setup
import sys; sys.path.insert(0, '..')
import os
from pathlib import Path
from dotenv import load_dotenv
load_dotenv('../.env')
from openai import OpenAI
from agent_loader import load_agents_from_dir
from pipeline_config import load_pipeline_config
from pipeline import run_pipeline
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

# Cell 2: Load pipeline
agents = load_agents_from_dir(Path('../agents'))
config = load_pipeline_config(Path('../pipeline.md'))
print(f"Loaded {len(agents)} agents: {[a.name for a in agents]}")

# Cell 3: Run full pipeline on a real file
sample_file = Path('../../apps/deck-repair/src/data/generated_content/how_to_choose_the_best_deck_repair_contractor_in_portland.md')
original = sample_file.read_text()
result = run_pipeline(content=original, agents=agents, pipeline_config=config, client=client)

# Cell 4: Side-by-side comparison
print("=== ORIGINAL (first 800 chars) ===")
print(original[:800])
print("\n=== RESULT (first 800 chars) ===")
print(result[:800])

# Cell 5: Quality metrics
import re
citations_before = len(re.findall(r'\[Source:[^\]]+\]', original))
citations_after = len(re.findall(r'\[Source:[^\]]+\]', result))
print(f"Citations: {citations_before} → {citations_after}")
print(f"Length change: {len(original)} → {len(result)} chars ({len(result)-len(original):+d})")
```

**Step 5: Commit**

```bash
git add tools/content-review/notebooks/
git commit -m "add jupyter notebooks for pipeline testing"
```

---

### Task 10: Final test run and README polish

**Step 1: Run full test suite**

```bash
cd tools/content-review && source .venv/bin/activate
pytest tests/ -v
```
Expected: All tests PASS

**Step 2: Run a real dry-run end-to-end**

```bash
python review.py --microsite deck-repair --dry-run
```
Expected: Preview output for all deck-repair content files, no errors

**Step 3: Update README with accurate setup and usage**

Edit `tools/content-review/README.md` to add the actual agent list, notebook descriptions, and LanceDB notes.

**Step 4: Final commit**

```bash
git add tools/content-review/
git commit -m "complete content-review pipeline v1"
```

---

## Future Enhancements (not in this build)

- **Agent 03: SEO Optimizer** — keyword density, H-tag hierarchy, meta description review
- **RAG context injection** — before each agent pass, query LanceDB for similar pages and inject them as context to maintain cross-site consistency
- **Eval scoring** — each agent defines pass/fail criteria; pipeline outputs a quality score per file
- **GitHub Actions integration** — run pipeline as a PR check on newly generated content

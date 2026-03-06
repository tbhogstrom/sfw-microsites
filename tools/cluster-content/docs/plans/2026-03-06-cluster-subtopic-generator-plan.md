# Cluster Subtopic Generator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build `tools/cluster-content/` — notebook that generates ~200-word subtopic sections for cluster service page stubs using LanceDB RAG + OpenAI. Test case: siding-repair.

**Architecture:** Single Jupyter notebook. Reuses `agent_loader.py` from `tools/content-review/` via `sys.path`. LanceDB at `C:\Users\tfalcon\microsites\tools\programatic writing stuffs\DBA writer\lancedb_construction_books`. Notebook working directory is `tools/cluster-content/notebooks/` so relative paths use `../` for tool root, `../../../` for `apps/`.

**Tech Stack:** Python, Jupyter, `lancedb`, `sentence-transformers`, `openai`, `python-frontmatter`, `python-dotenv`

---

### Task 1: Scaffold

**Create `tools/cluster-content/requirements.txt`:**
```
lancedb>=0.3.0
sentence-transformers>=2.2.0
openai>=1.0.0
pandas>=2.0.0
python-dotenv>=1.0.0
python-frontmatter>=1.0.0
jupyter>=1.0.0
ipykernel>=6.0.0
```

**Create `tools/cluster-content/.env.example`:**
```
OPENAI_API_KEY=your-key-here
```

**Commit:**
```bash
git add tools/cluster-content/
git commit -m "add cluster-content tool scaffold"
```

---

### Task 2: Create the subtopic-writer agent

**Create `tools/cluster-content/agents/01-subtopic-writer.md`:**

```markdown
---
id: subtopic-writer
name: Subtopic Writer
order: 1
model: gpt-4o
temperature: 0.7
input_format: markdown
output_format: markdown
---

## Role

You are a content writer for SFW Construction, a family-owned home repair and restoration company serving Portland and Seattle homeowners. You write single service page sections for specific repair subtopics.

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
```

**Commit:**
```bash
git add tools/cluster-content/agents/
git commit -m "add subtopic-writer agent"
```

---

### Task 3: Create the notebook

**Create `tools/cluster-content/notebooks/01-siding-repair-subtopic-generator.ipynb`** as a new empty notebook using the NotebookEdit tool, then add these cells in order:

**Cell 1 (markdown):**
```markdown
# Siding Repair: Subtopic Content Generator

Loads all siding-repair cluster stubs, drills down to one cluster and one subtopic,
retrieves RAG context from the construction books LanceDB, and generates ~200-word content.

Tune parameters in the **Config** cell below before running.
```

**Cell 2 — Config (code):**
```python
from pathlib import Path

LANCEDB_PATH = r"C:\Users\tfalcon\microsites\tools\programatic writing stuffs\DBA writer\lancedb_construction_books"
LANCEDB_TABLE = "construction_books"
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
MODEL = "gpt-4o"
TEMPERATURE = 0.7
TOP_K = 5
WORD_TARGET = 200

SIDING_REPAIR_DIR = Path("../../../apps/siding-repair/src/data/generated_content")
AGENTS_DIR = Path("../agents")
CONTENT_REVIEW_DIR = Path("../../content-review")
```

**Cell 3 — Setup (code):**
```python
import sys, os, re
from dotenv import load_dotenv

load_dotenv("../.env")
sys.path.insert(0, str(CONTENT_REVIEW_DIR.resolve()))

import lancedb
from sentence_transformers import SentenceTransformer
from openai import OpenAI
from agent_loader import load_agent

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
embedder = SentenceTransformer(EMBEDDING_MODEL)
db = lancedb.connect(LANCEDB_PATH)
table = db.open_table(LANCEDB_TABLE)
agent = load_agent(AGENTS_DIR / "01-subtopic-writer.md")
print(f"LanceDB: {table.count_rows()} docs | Agent: {agent.name}")
```

**Cell 4 — Load all siding-repair stubs (code):**
```python
def parse_cluster_stub(path: Path) -> dict | None:
    content = path.read_text(encoding="utf-8")
    meta_match = re.search(r'<!--\s*CLUSTER_META([\s\S]*?)-->', content)
    if not meta_match:
        return None
    meta, subtopics, in_subtopics = {}, [], False
    for line in meta_match.group(1).split('\n'):
        s = line.strip()
        if s.startswith('subtopics:'):
            in_subtopics = True; continue
        if in_subtopics:
            if s.startswith('- '): subtopics.append(s[2:].strip())
            elif s and not s.startswith('-'): in_subtopics = False
        if ':' in s and not in_subtopics:
            k, v = s.split(':', 1)
            meta[k.strip()] = v.strip()
    meta['subtopics'] = subtopics
    meta['filename'] = path.name
    return meta

stubs = [s for s in (parse_cluster_stub(f) for f in sorted(SIDING_REPAIR_DIR.glob("service_page_cluster_*.md"))) if s]
print(f"{'Slug':<55} {'Loc':<10} Subtopics")
print("-" * 75)
for s in sorted(stubs, key=lambda x: (x.get('cluster_slug',''), x.get('location',''))):
    print(f"{s.get('cluster_slug','?'):<55} {s.get('location','?'):<10} {len(s['subtopics'])}")
```

**Cell 5 — Drill down to one cluster (code):**
```python
TARGET_SLUG = "hardie-fiber-cement-siding-repair"
TARGET_LOCATION = "portland"

cluster = next(s for s in stubs if s.get('cluster_slug') == TARGET_SLUG and s.get('location') == TARGET_LOCATION)
print(f"{cluster['cluster_slug']} ({cluster['location']})")
for i, t in enumerate(cluster['subtopics']):
    print(f"  [{i}] {t}")
```

**Cell 6 — RAG retrieval (code):**
```python
TARGET_SUBTOPIC_INDEX = 0  # change to pick a different subtopic
TARGET_SUBTOPIC = cluster['subtopics'][TARGET_SUBTOPIC_INDEX]

query = f"{TARGET_SUBTOPIC} {cluster.get('service','siding repair')} Portland"
results = table.search(embedder.encode([query])[0]).limit(TOP_K).to_pandas()

print(f"Subtopic: {TARGET_SUBTOPIC}\n")
for i, row in results.iterrows():
    print(f"[{i+1}] {row.get('source','?')} p.{row.get('page','?')}  dist={row['_distance']:.4f}")
    print(f"     {str(row['text'])[:150]}...\n")
```

**Cell 7 — Generate (code):**
```python
location_full = "Portland, Oregon" if TARGET_LOCATION == "portland" else "Seattle, Washington"
context = "\n\n---\n\n".join(
    f"Source: {row.get('source','?')} (Page {row.get('page','N/A')})\n{row['text']}"
    for _, row in results.iterrows()
)
user_prompt = f"""Reference material from construction books:

{context}

---

Write a ~{WORD_TARGET}-word section for the following:

Subtopic: {TARGET_SUBTOPIC}
Parent page: {cluster.get('service','siding repair')} - {location_full}

Do not include the heading. Return only the section body content."""

response = client.chat.completions.create(
    model=MODEL,
    temperature=TEMPERATURE,
    messages=[
        {"role": "system", "content": agent.system_prompt},
        {"role": "user", "content": user_prompt},
    ]
)
generated = response.choices[0].message.content
print(f"=== {TARGET_SUBTOPIC} ===\n\n{generated}")
```

**Cell 8 — Metrics (code):**
```python
words = len(generated.split())
sents = len(re.findall(r'[.!?]+', generated))
print(f"Words: {words} (target {WORD_TARGET}) | Sentences: {sents} | Avg: {words/max(sents,1):.1f} w/s")
```

**Commit:**
```bash
git add tools/cluster-content/
git commit -m "add siding-repair subtopic generator notebook"
```

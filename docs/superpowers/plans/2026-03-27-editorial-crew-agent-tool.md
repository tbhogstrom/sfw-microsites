# Editorial Crew Agent Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the editorial crew callable by Claude Code agents with structured JSON output and a skill file that teaches the agent workflow.

**Architecture:** Add a `--json` flag to the existing CLI that outputs structured JSON instead of Rich console output. Add a Claude Code skill file that documents how to invoke the tool and handle results. No new dependencies or infrastructure.

**Tech Stack:** Python 3.11+, pytest, Claude Code skills (markdown)

---

## File Structure

- Modify: `tools/editorial-crew/editorial_crew/__main__.py` — add `--json` flag, JSON output path
- Create: `.claude/skills/editorial-crew.md` — Claude Code skill file
- Modify: `tools/editorial-crew/tests/test_cli.py` — tests for `--json` flag parsing
- Create: `tools/editorial-crew/tests/test_json_output.py` — tests for JSON output formatting

---

### Task 1: Add `--json` flag to CLI argument parser

**Files:**
- Modify: `tools/editorial-crew/tests/test_cli.py`
- Modify: `tools/editorial-crew/editorial_crew/__main__.py`

- [ ] **Step 1: Write failing tests for `--json` flag parsing**

Add these tests to `tools/editorial-crew/tests/test_cli.py`:

```python
def test_parse_args_json_flag():
    args = parse_args(["readme.md", "--json"])
    assert args.json is True


def test_parse_args_json_default_false():
    args = parse_args(["readme.md"])
    assert args.json is False
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd tools/editorial-crew && python -m pytest tests/test_cli.py::test_parse_args_json_flag tests/test_cli.py::test_parse_args_json_default_false -v`
Expected: FAIL with `AttributeError: 'Namespace' object has no attribute 'json'`

- [ ] **Step 3: Add `--json` flag to `parse_args`**

In `tools/editorial-crew/editorial_crew/__main__.py`, add this argument to `parse_args` after the `--debug` argument:

```python
    parser.add_argument("--json", action="store_true",
                        help="Output structured JSON instead of Rich console output")
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd tools/editorial-crew && python -m pytest tests/test_cli.py -v`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add tools/editorial-crew/editorial_crew/__main__.py tools/editorial-crew/tests/test_cli.py
git commit -m "feat(editorial-crew): add --json flag to CLI parser"
```

---

### Task 2: Add JSON output formatting function

**Files:**
- Create: `tools/editorial-crew/tests/test_json_output.py`
- Modify: `tools/editorial-crew/editorial_crew/__main__.py`

- [ ] **Step 1: Write failing tests for JSON output formatting**

Create `tools/editorial-crew/tests/test_json_output.py`:

```python
import json

from editorial_crew.__main__ import format_json_result


def test_format_json_improved():
    result = format_json_result(
        filepath="apps/siding-repair/content.md",
        status="improved",
        specialists=["grammar", "seo"],
        diff="--- a\n+++ b\n@@ -1 +1 @@\n-old\n+new",
        improved_document="# New content",
        summary="Fixed grammar and SEO issues.",
    )
    parsed = json.loads(result)
    assert parsed["file"] == "apps/siding-repair/content.md"
    assert parsed["status"] == "improved"
    assert parsed["specialists_consulted"] == ["grammar", "seo"]
    assert parsed["diff"] == "--- a\n+++ b\n@@ -1 +1 @@\n-old\n+new"
    assert parsed["improved_document"] == "# New content"
    assert parsed["summary"] == "Fixed grammar and SEO issues."


def test_format_json_no_changes():
    result = format_json_result(
        filepath="readme.md",
        status="no_changes",
        specialists=["grammar"],
    )
    parsed = json.loads(result)
    assert parsed["file"] == "readme.md"
    assert parsed["status"] == "no_changes"
    assert parsed["specialists_consulted"] == ["grammar"]
    assert "diff" not in parsed
    assert "improved_document" not in parsed


def test_format_json_error():
    result = format_json_result(
        filepath="missing.md",
        status="error",
        error="File not found",
    )
    parsed = json.loads(result)
    assert parsed["file"] == "missing.md"
    assert parsed["status"] == "error"
    assert parsed["error"] == "File not found"
    assert "specialists_consulted" not in parsed


def test_format_json_is_valid_json():
    result = format_json_result(
        filepath="test.md",
        status="improved",
        specialists=["grammar"],
        diff="some diff",
        improved_document="# Content with \"quotes\" and\nnewlines",
        summary="Fixed things.",
    )
    parsed = json.loads(result)
    assert parsed["improved_document"] == "# Content with \"quotes\" and\nnewlines"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd tools/editorial-crew && python -m pytest tests/test_json_output.py -v`
Expected: FAIL with `ImportError: cannot import name 'format_json_result'`

- [ ] **Step 3: Implement `format_json_result`**

Add this function to `tools/editorial-crew/editorial_crew/__main__.py` after the `_agent_display_name` function:

```python
import json as json_mod


def format_json_result(
    filepath: str,
    status: str,
    specialists: list[str] | None = None,
    diff: str | None = None,
    improved_document: str | None = None,
    summary: str | None = None,
    error: str | None = None,
) -> str:
    """Format a processing result as a JSON string."""
    obj: dict = {"file": str(filepath), "status": status}

    if status == "error":
        obj["error"] = error or "Unknown error"
    else:
        if specialists is not None:
            obj["specialists_consulted"] = specialists
        if status == "improved":
            obj["diff"] = diff or ""
            obj["improved_document"] = improved_document or ""
            obj["summary"] = summary or ""

    return json_mod.dumps(obj, ensure_ascii=False)
```

Note: import `json` as `json_mod` to avoid collision with the `--json` CLI flag attribute name.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd tools/editorial-crew && python -m pytest tests/test_json_output.py -v`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add tools/editorial-crew/editorial_crew/__main__.py tools/editorial-crew/tests/test_json_output.py
git commit -m "feat(editorial-crew): add format_json_result function"
```

---

### Task 3: Wire JSON output into the file processing pipeline

**Files:**
- Modify: `tools/editorial-crew/editorial_crew/__main__.py`

- [ ] **Step 1: Add `process_file_json` function**

Add this function to `tools/editorial-crew/editorial_crew/__main__.py` after the existing `process_file` function. This is the JSON-mode counterpart — it runs the same pipeline but captures events silently and prints JSON to stdout.

```python
async def process_file_json(filepath: Path, args: argparse.Namespace) -> bool:
    """Process a single file in JSON mode. Prints JSON to stdout. Returns True on success."""
    try:
        document = filepath.read_text(encoding="utf-8")
    except Exception as e:
        print(format_json_result(filepath=str(filepath), status="error", error=str(e)))
        return False

    result = None
    specialists: list[str] = []

    try:
        async for event in process_document(
            document=document,
            filename=filepath.name,
            filter_agents=args.agents,
            model_override=args.model,
            debug=False,
        ):
            if isinstance(event, AgentEvent):
                if event.kind == "subagent_done":
                    specialists.append(event.agent_name)
            elif isinstance(event, EditorialResult):
                result = event

        if result is None:
            print(format_json_result(filepath=str(filepath), status="error", error="No result received"))
            return False

        if result.error:
            print(format_json_result(filepath=str(filepath), status="error", error=result.error))
            return False

        if result.final_diff:
            # Extract summary from raw_result — take the first paragraph before the markdown
            summary = ""
            raw = result.raw_result.strip()
            if raw and not raw.startswith("#"):
                # Any text before the first heading is the summary
                idx = raw.find("\n#")
                if idx > 0:
                    summary = raw[:idx].strip()

            print(format_json_result(
                filepath=str(filepath),
                status="improved",
                specialists=specialists,
                diff=result.final_diff,
                improved_document=result.improved_document,
                summary=summary if summary else f"{len(specialists)} specialist(s) consulted.",
            ))
        else:
            print(format_json_result(
                filepath=str(filepath),
                status="no_changes",
                specialists=specialists,
            ))

        return True

    except Exception as e:
        print(format_json_result(filepath=str(filepath), status="error", error=str(e)))
        return False
```

- [ ] **Step 2: Update `async_main` to use `process_file_json` when `--json` is set**

Replace the for-loop in `async_main` with this:

```python
    for filepath in files:
        if args.json:
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
```

This suppresses the Rich summary in JSON mode.

- [ ] **Step 3: Verify existing tests still pass**

Run: `cd tools/editorial-crew && python -m pytest tests/ -v`
Expected: All existing tests PASS

- [ ] **Step 4: Commit**

```bash
git add tools/editorial-crew/editorial_crew/__main__.py
git commit -m "feat(editorial-crew): wire JSON output into processing pipeline"
```

---

### Task 4: Create Claude Code skill file

**Files:**
- Create: `.claude/skills/editorial-crew.md`

- [ ] **Step 1: Create the skill file**

Create `.claude/skills/editorial-crew.md`:

```markdown
---
name: editorial-crew
description: Review and improve markdown content files using the editorial crew tool
---

# Editorial Crew — Content Review Skill

Use this skill when the user asks to review, improve, edit, lint, or QA markdown content files.

## Prerequisites

The editorial crew tool must be installed. If you get a "No module named editorial_crew" error, tell the user:

> Run `pip install -e tools/editorial-crew` to install the editorial crew tool.

## Workflow

### 1. Identify Target Files

Based on the user's request, find the markdown file(s) to review. Content files are typically in:
- `apps/*/src/data/generated_content/*.md` — generated service content
- `apps/*/src/data/*.md` — other content files

Use Glob or Grep to locate files if the user gives a general description (e.g., "the siding repair service page").

### 2. Run Editorial Crew

Execute the tool with `--json` for structured output:

```bash
python -m editorial_crew <filepath> --json
```

**Optional flags:**
- `--agents grammar,seo,structure` — run only specific specialists (available: grammar, structure, technical, seo, style, accessibility, engagement, localization, compliance, multimedia)
- `--model <model>` — override the LLM model

**Important:** This tool takes 1-3 minutes per file. Warn the user before running on multiple files.

### 3. Parse the Result

The tool outputs a single JSON object per file. Parse the `status` field:

- `"improved"` — changes were suggested. Show the `diff` field and explain the `summary`.
- `"no_changes"` — no improvements needed. Tell the user.
- `"error"` — something went wrong. Show the `error` field.

### 4. Present Findings

Show the user the unified diff from the `diff` field. Explain the key changes in plain language based on the `summary` field and your reading of the diff. Be specific about what was changed and why.

### 5. Wait for Approval

Ask the user if they want to apply the changes. **Never auto-apply.** Options:
- **Apply all** — write the full `improved_document` to the file
- **Apply selectively** — user picks specific changes; make targeted edits with Edit tool
- **Reject** — do nothing

### 6. Apply Changes

On approval, use the Write tool to write the `improved_document` field content to the original file path. Do not use `git apply` or patch commands.

If the user wants only some changes, read the original file, then use the Edit tool to apply specific changes from the diff manually. Do not re-run editorial crew.
```

- [ ] **Step 2: Verify the skill file is valid markdown**

Read back `.claude/skills/editorial-crew.md` to confirm it renders correctly.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/editorial-crew.md
git commit -m "feat: add Claude Code skill for editorial crew"
```

---

### Task 5: End-to-end smoke test

**Files:** None (manual verification)

- [ ] **Step 1: Verify `--json` flag parses correctly**

Run: `cd tools/editorial-crew && python -c "from editorial_crew.__main__ import parse_args; a = parse_args(['test.md', '--json']); print(a.json)"`
Expected: `True`

- [ ] **Step 2: Verify `format_json_result` produces valid JSON**

Run:
```bash
cd tools/editorial-crew && python -c "
from editorial_crew.__main__ import format_json_result
import json
result = format_json_result('test.md', 'improved', ['grammar'], 'diff here', '# Doc', 'Summary')
print(result)
parsed = json.loads(result)
print('Valid JSON:', parsed['status'])
"
```
Expected: Prints the JSON string, then `Valid JSON: improved`

- [ ] **Step 3: Run full test suite**

Run: `cd tools/editorial-crew && python -m pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 4: Verify skill file exists and is readable**

Run: `cat .claude/skills/editorial-crew.md | head -5`
Expected: Shows the YAML frontmatter with `name: editorial-crew`

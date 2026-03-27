# Editorial Crew Agent Tool

Make the editorial crew callable by Claude Code agents so they can review and improve markdown content with user approval.

## Overview

Two changes:

1. **JSON output mode** — add `--json` flag to the editorial crew CLI that outputs structured JSON instead of Rich console output
2. **Claude Code skill** — a `.claude/skills/editorial-crew.md` file that teaches agents how to invoke the tool and handle results

## JSON Output Mode

### CLI Change

Add `--json` flag to `editorial_crew/__main__.py`. When set:

- Suppress all Rich console output (no panels, no colors, no status messages)
- Print a single JSON object to stdout per file
- For multiple files, print one JSON object per line (JSONL)

### Output Schema

**Success with changes:**

```json
{
  "file": "apps/siding-repair/src/data/generated_content/service-page.md",
  "status": "improved",
  "specialists_consulted": ["grammar", "structure", "seo"],
  "diff": "--- service-page.md (original)\n+++ service-page.md (improved)\n@@ -12,3 +12,3 @@\n...",
  "improved_document": "# Full improved markdown content...",
  "summary": "3 specialists consulted. Key changes: fixed passive voice in intro, restructured H2 hierarchy, improved meta description."
}
```

**No changes needed:**

```json
{
  "file": "apps/siding-repair/src/data/generated_content/service-page.md",
  "status": "no_changes",
  "specialists_consulted": ["grammar", "structure", "seo"]
}
```

**Error:**

```json
{
  "file": "apps/siding-repair/src/data/generated_content/service-page.md",
  "status": "error",
  "error": "Failed to read file: [Errno 2] No such file or directory"
}
```

### Implementation Details

- The `summary` field comes from the chief editor's synthesis — it's the natural-language explanation of what changed and why. Extract it from the `EditorialResult.raw_result` field.
- The `improved_document` field is the full improved markdown text. This is what the agent writes to disk on approval — more reliable than trying to apply a unified diff programmatically.
- The `diff` field is the unified diff for display to the user.
- JSON mode reuses all existing processing logic — it only changes how output is rendered.

## Claude Code Skill

### File Location

`.claude/skills/editorial-crew.md`

### Trigger Conditions

The skill activates when the user asks to review, improve, edit, lint, or QA markdown content files in the repo.

### Agent Workflow

The skill teaches the agent this workflow:

1. **Identify target files** — based on user request, find the markdown file(s) to review. Use Glob/Grep to locate them if the user gives a general description ("the siding repair service page").
2. **Run editorial crew** — execute `python -m editorial_crew <file> --json` via Bash tool. Optionally pass `--agents` to constrain to specific specialists.
3. **Parse JSON output** — read the JSON result from stdout.
4. **Present findings** — show the user the unified diff and summarize the key changes in plain language. Explain what the editorial crew found and why changes were suggested.
5. **Wait for approval** — ask the user if they want to apply the changes. Do not auto-apply.
6. **Apply on approval** — use the Write tool to write the `improved_document` content to the file. Do not use `git apply` or patch tools.
7. **Handle rejection** — if the user wants only some changes, make targeted edits manually using the Edit tool based on the diff. Do not re-run editorial crew.

### Documented Flags

- `--agents grammar,seo,structure,...` — run only specific specialists (all 10: grammar, structure, technical, seo, style, accessibility, engagement, localization, compliance, multimedia)
- `--model <model>` — override the LLM model used by the chief editor
- `--json` — required for agent use, outputs structured JSON

### Enforced Behaviors

- Always show the diff and explain changes before applying
- Never auto-apply changes
- Use Write tool with `improved_document`, not diff patching
- Warn if targeting many files — each file costs time and tokens
- If the tool is not installed, tell the user to run `pip install -e tools/editorial-crew`

## What's Not Changing

- The editorial crew's internal architecture (agents, registry, runner) stays the same
- The existing CLI behavior (Rich output, `--output` flag) is unchanged — `--json` is additive
- No new dependencies
- No HTTP server, MCP server, or other infrastructure

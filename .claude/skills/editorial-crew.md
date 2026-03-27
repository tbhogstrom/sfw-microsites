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

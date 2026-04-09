# Reports V3: Scope Context, Photo Count Suppression, Tone

**Date:** 2026-04-09
**Status:** Approved
**Scope:** `tools/photo-scanner` — `companycam.py`, `catalog.py`, `scanner.py`, `reports.py`

## Problem

The photo analysis pipeline (deep analysis, project summaries, daily/weekly reports) operates without knowing what SFW was contracted to do on each project. This means:

- The AI guesses at service types and phases from visual cues alone
- Project summaries can't distinguish in-scope vs. out-of-scope conditions
- Reports lack the framing that comes from knowing the contracted work

Additionally, two smaller issues:
- Reports show "X photos taken" even on light-activity days (< 10 photos), which looks thin
- AI-generated text uses severity adjectives ("major", "severe", "significant") that editorialize rather than describe

## Solution

### 1. Scope Context Pipeline (Approach C)

#### Data source

CompanyCam's project API returns a `notepad` field on every project — a rich Scope of Work text (174–1,498 chars, HTML-wrapped, populated on all 103 active projects). This is the primary context source.

CompanyCam Pages (AI overviews, lead carpenter notes) are not available via the public API — the `/pages` endpoint redirects to browser login. A feature request has been drafted. The design accommodates Pages as a future addition.

#### Schema change

Add `notepad TEXT` column to the `projects` table in `catalog.py`. Populated during project sync via `normalize_project()`.

Migration: `ALTER TABLE projects ADD COLUMN notepad TEXT DEFAULT ''` for existing databases.

#### Context abstraction

New function in `companycam.py`:

```python
def get_project_context(project: dict) -> dict:
    """Assemble project context from available sources.
    
    Today: notepad only. Extensible for Pages when API access opens.
    """
    notepad = project.get("notepad", "") or ""
    # Strip HTML tags, normalize whitespace
    scope_text = re.sub(r'<[^>]+>', '', notepad).strip().replace('&nbsp;', ' ')
    return {
        "scope_of_work": scope_text,
        "pages": [],  # future: list of page text content
    }
```

Single seam for future expansion. When Pages become available: add a `project_pages` table, fetch during sync, merge text into the `pages` list. All downstream consumers get it automatically.

#### Injection points (4 total)

**1. Deep analysis (`scanner.py` DEEP_PROMPT)**

Prepend scope block before each photo's analysis prompt when scope is available:

```
Project scope of work (contracted repairs):
{scope_text}

NOTE: This scope describes what was contracted. Scope can evolve during a project.
Photos may show conditions outside the scope — adjacent damage, staging, materials,
or unrelated areas. Use scope as context to inform your analysis, not as a filter.
If the photo shows something outside scope, analyze it normally.
```

When scope is empty, skip the preamble entirely (same behavior as v2).

No change to the DEEP_PROMPT JSON schema — same output fields. The scope context improves accuracy of `service_types`, `phase`, `scene`, and `damage_details` because the AI knows what was contracted.

**2. Project summary (`scanner.py` PROJECT_SUMMARY_PROMPT)**

Add scope as the first section of the prompt:

```
Project scope of work (what SFW Construction was contracted to do):
{scope_text}

Use this scope to align your summary and issue tracking against the contracted work.
Note which issues fall within scope and which are adjacent findings.
```

**3. Daily report (`reports.py` prompt builder)**

Add scope block after project name/address, before photo data:

```
Scope of work:
{scope_text}
```

**4. Weekly report (`reports.py` prompt builder)**

Same injection point as daily — after project header, before day-by-day breakdown.

### 2. Photo Count Suppression

Constant: `MIN_PHOTOS_FOR_COUNT = 10`

When `total_day_photos < MIN_PHOTOS_FOR_COUNT`:
- **Daily reports:** Omit `total_day_photos` from the report JSON (or set to `null`)
- **Weekly reports:** Omit `total_photos` from `daily_timeline` entries where that day's count is below the threshold

The data is still available in the catalog for internal use. This is a report-output change only.

### 3. Tone: Severity Adjectives → Factual Descriptions

Three changes:

**A. PROJECT_SUMMARY_PROMPT severity scale**

Change from:
```
"severity": "minor | moderate | major"
```
To:
```
"severity": "cosmetic | functional | structural"
```

- **cosmetic** — appearance only (peeling paint, staining, discoloration)
- **functional** — affects use but not structure (sticking door, broken seal, poor drainage)
- **structural** — load-bearing or envelope integrity (rotted sill plate, compromised beam, failed flashing allowing water into wall cavity)

**B. DEEP_PROMPT tone instruction**

Add: *"Describe damage factually. Don't use severity adjectives (major, severe, significant, extensive, critical). If the damage is structural, say 'structural.' Otherwise describe what you see — location, material, condition."*

**C. Report prompts (daily + weekly)**

Add to both REPORT_PROMPT and WEEKLY_REPORT_PROMPT: *"Use plain, factual language. No severity adjectives (major, severe, significant, extensive, critical). If repair work is structural, say that. Otherwise describe what was done and where."*

`report_config.json` risk/value matrix text is already factual and homeowner-friendly — no changes needed.

## Files Modified

| File | Changes |
|------|---------|
| `companycam.py` | `normalize_project()` extracts `notepad`; new `get_project_context()` helper |
| `catalog.py` | `notepad TEXT` column on `projects` table; migration for existing DB |
| `scanner.py` | Scope context in `DEEP_PROMPT` and `PROJECT_SUMMARY_PROMPT`; severity → cosmetic/functional/structural; tone instructions |
| `reports.py` | Scope context in daily + weekly prompt builders; tone instructions; `MIN_PHOTOS_FOR_COUNT = 10`; suppress photo count below threshold |

## Files NOT Modified

- `report_config.json` — matrix language already good
- `server.py` — no route changes; context flows through existing pipeline
- Templates — suppression is in the report JSON builder

## Future: Pages Integration

When CompanyCam adds Pages to their API:

1. Add `project_pages` table: `(project_id, page_id, title, content, fetched_at)`
2. Add `list_project_pages()` to `CompanyCamClient`
3. Fetch pages during project sync
4. Update `get_project_context()` to merge page text into the `pages` list
5. All four injection points get the richer context automatically

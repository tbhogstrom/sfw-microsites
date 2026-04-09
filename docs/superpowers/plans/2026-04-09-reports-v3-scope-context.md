# Reports V3: Scope Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inject CompanyCam project notepad (Scope of Work) into every stage of the photo analysis and reporting pipeline, suppress photo counts below 10, and replace severity adjectives with factual descriptors.

**Architecture:** Store notepad text in the existing `projects` table. A `get_project_context()` helper in `companycam.py` strips HTML and returns structured context. This context is injected into deep analysis (per-photo), project summaries, and daily/weekly report prompts. Photo count suppression and tone changes are prompt-level and output-level edits.

**Tech Stack:** Python, SQLite, Anthropic API, CompanyCam API v2

**Spec:** `docs/superpowers/specs/2026-04-09-reports-v3-scope-context-design.md`

---

### Task 1: Schema — Add `notepad` column to `projects` table

**Files:**
- Modify: `tools/photo-scanner/photo_scanner/catalog.py:22-33` (CREATE TABLE)
- Modify: `tools/photo-scanner/photo_scanner/catalog.py:92-100` (migrations block)

- [ ] **Step 1: Add `notepad` to CREATE TABLE statement**

In `catalog.py`, the `projects` table definition (line 22-33). Add `notepad TEXT DEFAULT ''` after the `summary TEXT` column:

```python
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                address TEXT DEFAULT '',
                lat REAL DEFAULT 0,
                lng REAL DEFAULT 0,
                created_at TEXT DEFAULT '',
                photo_count INTEGER DEFAULT 0,
                last_synced TEXT,
                last_analyzed TEXT,
                summary TEXT,
                notepad TEXT DEFAULT ''
            );
```

- [ ] **Step 2: Add migration for existing databases**

After the existing migration block (lines 92-100), add a new migration:

```python
        try:
            self.db.execute("SELECT notepad FROM projects LIMIT 0")
        except sqlite3.OperationalError:
            self.db.execute("ALTER TABLE projects ADD COLUMN notepad TEXT DEFAULT ''")
```

- [ ] **Step 3: Update `upsert_project` to include notepad**

Modify `upsert_project` (line 132-140) to accept and store the notepad field:

```python
    def upsert_project(self, project: dict):
        self.db.execute("""
            INSERT INTO projects (id, name, address, lat, lng, created_at, photo_count, notepad)
            VALUES (:id, :name, :address, :lat, :lng, :created_at, :photo_count, :notepad)
            ON CONFLICT(id) DO UPDATE SET
                name=excluded.name, address=excluded.address,
                lat=excluded.lat, lng=excluded.lng,
                photo_count=excluded.photo_count,
                notepad=excluded.notepad
        """, project)
        self.db.commit()
```

- [ ] **Step 4: Test migration locally**

Run:
```bash
cd tools/photo-scanner && python -c "from photo_scanner.catalog import Catalog; c = Catalog(); p = c.get_project(c.list_projects(per_page=1)[0]['id']); print('notepad' in p, p.get('notepad'))"
```

Expected: `True` followed by empty string (existing projects don't have notepad yet).

- [ ] **Step 5: Commit**

```bash
git add tools/photo-scanner/photo_scanner/catalog.py
git commit -m "feat(photo-scanner): add notepad column to projects table"
```

---

### Task 2: CompanyCam client — Extract notepad and add `get_project_context()`

**Files:**
- Modify: `tools/photo-scanner/photo_scanner/companycam.py:1-6` (imports)
- Modify: `tools/photo-scanner/photo_scanner/companycam.py:68-84` (normalize_project)
- Add function after `normalize_photo` (~line 112)

- [ ] **Step 1: Add `re` import**

At the top of `companycam.py`, add `import re` to the imports (line 2):

```python
"""Async client for the CompanyCam v2 API."""
import os
import re
from pathlib import Path
```

- [ ] **Step 2: Extract notepad in `normalize_project()`**

In `normalize_project()` (line 68-84), add `notepad` to the returned dict. The CompanyCam API returns `notepad` as HTML-wrapped text on every project response:

```python
    @staticmethod
    def normalize_project(raw: dict) -> dict:
        """Convert CompanyCam project response to our catalog schema."""
        addr = raw.get("address", {}) or {}
        coords = raw.get("coordinates", {}) or {}
        parts = [addr.get("street_address_1", ""), addr.get("city", ""), addr.get("state", "")]
        address_str = ", ".join(p for p in parts if p)
        return {
            "id": str(raw["id"]),
            "name": raw.get("name", "(unnamed)"),
            "address": address_str,
            "lat": coords.get("lat", 0) or 0,
            "lng": coords.get("lon", 0) or 0,
            "created_at": raw.get("created_at", ""),
            "updated_at": raw.get("updated_at", ""),
            "status": raw.get("status", "active"),
            "photo_count": raw.get("photo_count", 0),
            "notepad": raw.get("notepad", ""),
        }
```

- [ ] **Step 3: Add `get_project_context()` helper**

Add this function after `normalize_photo()` (after line 112):

```python
    @staticmethod
    def get_project_context(project: dict) -> dict:
        """Assemble project context from available sources.

        Today: notepad (Scope of Work) only.
        Extensible for CompanyCam Pages when API access opens.

        Args:
            project: A project dict from the catalog (must have 'notepad' key).

        Returns:
            Dict with 'scope_of_work' (plain text) and 'pages' (list, empty for now).
        """
        notepad = project.get("notepad", "") or ""
        scope_text = re.sub(r'<[^>]+>', '', notepad).strip()
        scope_text = scope_text.replace('&nbsp;', ' ').replace('&amp;', '&')
        return {
            "scope_of_work": scope_text,
            "pages": [],
        }
```

- [ ] **Step 4: Test context extraction**

Run:
```bash
cd tools/photo-scanner && python -c "
from photo_scanner.companycam import CompanyCamClient
ctx = CompanyCamClient.get_project_context({'notepad': '<div>&nbsp;SFW Construction will inspect the two window areas&nbsp;</div>'})
print(ctx)
assert ctx['scope_of_work'] == 'SFW Construction will inspect the two window areas'
assert ctx['pages'] == []
print('PASS')
"
```

Expected: Clean text output and `PASS`.

- [ ] **Step 5: Test with empty/None notepad**

Run:
```bash
cd tools/photo-scanner && python -c "
from photo_scanner.companycam import CompanyCamClient
for val in ['', None, '  ']:
    ctx = CompanyCamClient.get_project_context({'notepad': val})
    assert ctx['scope_of_work'] == '', f'Expected empty for {val!r}, got {ctx[\"scope_of_work\"]!r}'
print('PASS')
"
```

Expected: `PASS`

- [ ] **Step 6: Commit**

```bash
git add tools/photo-scanner/photo_scanner/companycam.py
git commit -m "feat(photo-scanner): extract notepad and add get_project_context helper"
```

---

### Task 3: Verify notepad flows through sync

**Files:**
- No code changes — this is a verification task

The project sync path is: `server.py` calls `cc_client.list_projects()` or `cc_client.get_project()` → `normalize_project()` → `catalog.upsert_project()`. Since we added `notepad` to both `normalize_project()` and `upsert_project()`, the notepad will flow through on the next sync.

- [ ] **Step 1: Test end-to-end sync**

Run:
```bash
cd tools/photo-scanner && python -c "
import asyncio
from photo_scanner.companycam import CompanyCamClient
from photo_scanner.catalog import Catalog

async def test():
    cc = CompanyCamClient()
    cat = Catalog()
    projects = await cc.list_projects(per_page=2)
    for raw in projects:
        norm = cc.normalize_project(raw)
        cat.upsert_project(norm)
        saved = cat.get_project(norm['id'])
        has_notepad = bool(saved.get('notepad', '').strip())
        print(f'{norm[\"name\"][:40]:40s} notepad_saved={has_notepad} ({len(saved.get(\"notepad\", \"\"))} chars)')
    await cc.close()
    cat.close()

asyncio.run(test())
"
```

Expected: Two projects with `notepad_saved=True` and non-zero char counts.

- [ ] **Step 2: Commit (if any fix was needed)**

Only commit if a code fix was required. Otherwise skip.

---

### Task 4: Inject scope into deep analysis prompt

**Files:**
- Modify: `tools/photo-scanner/photo_scanner/scanner.py:59-82` (DEEP_PROMPT)
- Modify: `tools/photo-scanner/photo_scanner/scanner.py:832-851` (analyze_one in analyze_project_from_catalog)

- [ ] **Step 1: Add scope preamble builder**

Add a helper function after the `DEEP_PROMPT` constant (after line 82 in `scanner.py`):

```python
def build_deep_prompt(scope_text: str = "") -> str:
    """Build the deep analysis prompt, optionally prepending project scope context."""
    if not scope_text:
        return DEEP_PROMPT
    scope_preamble = (
        f"Project scope of work (contracted repairs):\n{scope_text}\n\n"
        "NOTE: This scope describes what was contracted. Scope can evolve during a project.\n"
        "Photos may show conditions outside the scope — adjacent damage, staging, materials,\n"
        "or unrelated areas. Use scope as context to inform your analysis, not as a filter.\n"
        "If the photo shows something outside scope, analyze it normally.\n\n"
    )
    return scope_preamble + DEEP_PROMPT
```

- [ ] **Step 2: Update `analyze_project_from_catalog` to fetch scope and pass to deep analysis**

At the top of `analyze_project_from_catalog()` (after line 701), fetch the project and build context. Add these lines after the `_progress` helper (after line 713):

```python
    # Fetch project scope context for deep analysis
    from photo_scanner.companycam import CompanyCamClient
    project = catalog.get_project(project_id)
    project_context = CompanyCamClient.get_project_context(project) if project else {"scope_of_work": "", "pages": []}
    scope_text = project_context["scope_of_work"]
    deep_prompt = build_deep_prompt(scope_text)
```

- [ ] **Step 3: Use `deep_prompt` in the catalog-based deep analysis**

In the `analyze_one` inner function (line 832-869), replace `DEEP_PROMPT` with `deep_prompt` on line 848:

Change:
```python
                            {"type": "text", "text": DEEP_PROMPT},
```
To:
```python
                            {"type": "text", "text": deep_prompt},
```

- [ ] **Step 4: Add tone instruction to DEEP_PROMPT**

Add this line to `DEEP_PROMPT` (line 60-82), right after the "Pay special attention to" block and before the JSON schema. Insert after line 67:

```
Describe damage factually. Do not use severity adjectives (major, severe, significant, extensive, critical). If the damage is structural, say "structural." Otherwise describe what you see — location, material, condition.
```

The full `DEEP_PROMPT` becomes:
```python
DEEP_PROMPT = """\
Analyze this construction/home repair photo. Respond in JSON only, no other text.

Pay special attention to:
- WATER DAMAGE and DRY ROT: staining, discoloration, soft/crumbling wood, fungal growth, swelling, peeling paint from moisture, rot at joints/sill plates/window frames
- WINDOWS and DOORS: condition of frames, sills, trim, flashing, caulking, glazing, weather stripping, signs of moisture intrusion around openings
- NEW SIDING: type (cedar shake, lap, board-and-batten, fiber cement, vinyl), installation quality, trim details, flashing at transitions, paint/finish condition

Describe damage factually. Do not use severity adjectives (major, severe, significant, extensive, critical). If the damage is structural, say "structural." Otherwise describe what you see — location, material, condition.

{
  "scene": "one-line description of what is shown",
  "service_types": ["list from: siding, deck, dry-rot, chimney, crawlspace, flashing, trim, beam, leak, lead-paint, mold, restoration, windows, doors"],
  "phase": "one of: before, during, after, materials, overview, other",
  "entities": ["visible objects: tools, materials, building parts, damage types"],
  "damage_details": {
    "water_damage": "describe any water damage or dry rot visible — location, extent, severity. null if none",
    "window_door_condition": "describe condition of any windows/doors visible — frame, sill, trim, flashing, moisture issues. null if none",
    "siding_details": "describe siding type, condition, installation quality if visible. null if none"
  },
  "marketing_score": 1-5,
  "marketing_notes": "why this score — composition, lighting, clarity, subject interest",
  "before_after_potential": true or false
}
"""
```

- [ ] **Step 5: Commit**

```bash
git add tools/photo-scanner/photo_scanner/scanner.py
git commit -m "feat(photo-scanner): inject scope context into deep photo analysis"
```

---

### Task 5: Inject scope into project summary prompt and update severity scale

**Files:**
- Modify: `tools/photo-scanner/photo_scanner/scanner.py:85-121` (PROJECT_SUMMARY_PROMPT)
- Modify: `tools/photo-scanner/photo_scanner/scanner.py:886-951` (generate_project_summary)

- [ ] **Step 1: Update PROJECT_SUMMARY_PROMPT severity scale and add tone instruction**

Replace the `PROJECT_SUMMARY_PROMPT` (lines 85-121) with:

```python
PROJECT_SUMMARY_PROMPT = """\
You are analyzing all the photos from a single construction/home repair project. Below is the structured analysis data from each photo.

Your task: Summarize the project and create an issue tracker that inventories construction issues visible in "before" photos, and whether corresponding "after" or "during" photos show the resolution of each issue.

Pay special attention to:
- WATER DAMAGE and DRY ROT: any moisture intrusion, rot, fungal damage, staining — track each instance as a separate issue
- WINDOWS and DOORS: frame condition, sill rot, flashing failures, moisture around openings
- SIDING: type installed, areas replaced, quality of installation, transitions and flashing

Use plain, factual language. No severity adjectives (major, severe, significant, extensive, critical). If an issue is structural, say "structural." Otherwise describe what you see.

Respond in JSON only:
{
  "project_summary": "2-3 sentence overview of what work was done at this job site",
  "scope_of_work": ["list of major work categories performed"],
  "issues": [
    {
      "issue": "short description of the construction issue or damage",
      "service_type": "primary service type (siding, deck, dry-rot, etc.)",
      "severity": "cosmetic | functional | structural",
      "documented_before": true/false,
      "documented_during": true/false,
      "documented_after": true/false,
      "resolution_status": "resolved | in-progress | documented-only | unknown",
      "before_photos": ["photo IDs showing this issue before repair"],
      "after_photos": ["photo IDs showing this issue after repair"],
      "notes": "brief note on what the photos show for this issue"
    }
  ],
  "coverage_assessment": {
    "has_before_photos": true/false,
    "has_during_photos": true/false,
    "has_after_photos": true/false,
    "documentation_quality": "excellent | good | fair | poor",
    "missing_documentation": ["what's missing — e.g. 'no after photos for deck repair', 'no wide shots of completed work'"]
  }
}
"""
```

Key changes: `severity` is now `cosmetic | functional | structural`, and tone instruction added.

- [ ] **Step 2: Inject scope context into `generate_project_summary()`**

In `generate_project_summary()` (line 886-951), modify the prompt builder (lines 924-928) to include scope context:

Replace:
```python
    prompt = (
        f"Project: {project_name}\n"
        f"Total photos analyzed: {len(analyzed)}\n\n"
        f"Photo analysis data:\n{photo_data_text}\n\n"
        f"{PROJECT_SUMMARY_PROMPT}"
    )
```

With:
```python
    from photo_scanner.companycam import CompanyCamClient
    project_context = CompanyCamClient.get_project_context(project) if project else {"scope_of_work": "", "pages": []}
    scope_text = project_context["scope_of_work"]

    prompt_parts = [f"Project: {project_name}"]
    if scope_text:
        prompt_parts.append(
            f"\nProject scope of work (what SFW Construction was contracted to do):\n{scope_text}\n\n"
            "Use this scope to align your summary and issue tracking against the contracted work.\n"
            "Note which issues fall within scope and which are adjacent findings."
        )
    prompt_parts.append(f"\nTotal photos analyzed: {len(analyzed)}\n")
    prompt_parts.append(f"Photo analysis data:\n{photo_data_text}\n")
    prompt_parts.append(PROJECT_SUMMARY_PROMPT)

    prompt = "\n".join(prompt_parts)
```

- [ ] **Step 3: Commit**

```bash
git add tools/photo-scanner/photo_scanner/scanner.py
git commit -m "feat(photo-scanner): scope context in project summary, severity scale to cosmetic/functional/structural"
```

---

### Task 6: Inject scope into daily report prompt + tone + photo count suppression

**Files:**
- Modify: `tools/photo-scanner/photo_scanner/reports.py:5-28` (REPORT_PROMPT)
- Modify: `tools/photo-scanner/photo_scanner/reports.py:73-194` (generate_daily_report)

- [ ] **Step 1: Add `MIN_PHOTOS_FOR_COUNT` constant and update REPORT_PROMPT**

At the top of `reports.py`, after line 3 (`from pathlib import Path`), add:

```python
MIN_PHOTOS_FOR_COUNT = 10
```

Then update `REPORT_PROMPT` (lines 5-28) — add tone instruction after the existing rules:

```python
REPORT_PROMPT = """\
Generate a daily project report for a homeowner. Be friendly and concise. Lead with risk and value.

Rules:
- Short sentences. No filler.
- risk_before and risk_after: 1-2 sentences each
- what_we_did: 2-3 sentences max
- value_statement: 1-2 sentences
- headline: punchy, risk-focused, under 10 words
- Do NOT generate photo_captions — photos are shown without descriptions
- Use plain, factual language. No severity adjectives (major, severe, significant, extensive, critical). If repair work is structural, say that. Otherwise describe what was done and where.
- IMPORTANT: Never use declarative completion language like "all siding repaired", "all dry rot remediated", "all damage fixed", etc. This creates legal liability. Instead use hedged phrasing like "addressed the identified siding damage", "treated the areas of dry rot", "repaired the damaged sections". Describe what was worked on, not that everything is definitively complete.

Respond in JSON only:
{
  "headline": "short risk-focused headline",
  "risk_before": "what was at risk before today's work",
  "risk_after": "current risk status after today's work",
  "what_we_did": "plain-language summary of today's work",
  "value_statement": "why this matters to the homeowner",
  "issues_status": [
    {"issue": "name", "status": "resolved|in-progress|documented-only", "changed_today": true/false}
  ]
}
"""
```

- [ ] **Step 2: Inject scope context into daily report prompt builder**

In `generate_daily_report()`, after the project/address lines (around line 135-138), inject scope. Replace:

```python
    # Build the full prompt
    prompt_parts = [
        f"Project: {project['name'] if project else project_id}",
        f"Address: {project['address'] if project else ''}",
        f"Company: {defaults.get('company_name', 'SFW Construction')}",
        "",
        f"Today's photos ({len(day_photos)} total):",
```

With:

```python
    # Get project scope context
    from photo_scanner.companycam import CompanyCamClient
    project_context = CompanyCamClient.get_project_context(project) if project else {"scope_of_work": "", "pages": []}
    scope_text = project_context["scope_of_work"]

    # Build the full prompt
    prompt_parts = [
        f"Project: {project['name'] if project else project_id}",
        f"Address: {project['address'] if project else ''}",
        f"Company: {defaults.get('company_name', 'SFW Construction')}",
    ]
    if scope_text:
        prompt_parts.append(f"\nScope of work:\n{scope_text}")
    prompt_parts.extend([
        "",
        f"Today's photos ({len(day_photos)} total):",
    ])
```

- [ ] **Step 3: Suppress photo count below threshold**

Near the end of `generate_daily_report()`, around line 192, change:

```python
    report["total_day_photos"] = len(day_photos)
```

To:

```python
    report["total_day_photos"] = len(day_photos) if len(day_photos) >= MIN_PHOTOS_FOR_COUNT else None
```

- [ ] **Step 4: Commit**

```bash
git add tools/photo-scanner/photo_scanner/reports.py
git commit -m "feat(photo-scanner): scope context in daily reports, tone instructions, photo count suppression"
```

---

### Task 7: Inject scope into weekly report prompt + tone + photo count suppression

**Files:**
- Modify: `tools/photo-scanner/photo_scanner/reports.py:197-230` (WEEKLY_REPORT_PROMPT)
- Modify: `tools/photo-scanner/photo_scanner/reports.py:285-435` (generate_weekly_report)

- [ ] **Step 1: Update WEEKLY_REPORT_PROMPT with tone instruction**

Replace `WEEKLY_REPORT_PROMPT` (lines 197-230) with:

```python
WEEKLY_REPORT_PROMPT = """\
Generate a weekly project report for a homeowner. Be friendly and concise. Lead with risk and value.

This covers a full week of work. Provide both a narrative arc and a day-by-day timeline.

Rules:
- Short sentences. No filler.
- weekly_narrative: 3-4 sentences covering the week's arc — where we started, what we accomplished, where we stand now
- risk_before and risk_after: 1-2 sentences each (for the whole week, not per day)
- what_we_did: 2-3 sentences summarizing the week's work
- value_statement: 1-2 sentences
- photo_captions: one short sentence per photo, homeowner-friendly (no jargon)
- daily_timeline: one entry per day with photos, 1-sentence summary per day. Include total_photos (total photo count for that day)
- headline: punchy, risk-focused, under 10 words
- Do NOT predict next week's work
- Use plain, factual language. No severity adjectives (major, severe, significant, extensive, critical). If repair work is structural, say that. Otherwise describe what was done and where.
- IMPORTANT: Never use declarative completion language like "all siding repaired", "all dry rot remediated", "all damage fixed", etc. This creates legal liability. Instead use hedged phrasing like "addressed the identified siding damage", "treated the areas of dry rot", "repaired the damaged sections". Describe what was worked on, not that everything is definitively complete.

Respond in JSON only:
{
  "headline": "short risk-focused headline for the week",
  "weekly_narrative": "3-4 sentence arc of the week",
  "risk_before": "risk status at start of week",
  "risk_after": "risk status at end of week",
  "what_we_did": "summary of the week's work",
  "value_statement": "why this week matters",
  "photo_captions": {"photo_id": "caption", ...},
  "issues_status": [
    {"issue": "name", "status": "resolved|in-progress|documented-only", "changed_this_week": true/false}
  ],
  "daily_timeline": [
    {"date": "YYYY-MM-DD", "summary": "one sentence", "photo_ids": ["id1", "id2"], "total_photos": 5}
  ]
}
"""
```

- [ ] **Step 2: Inject scope context into weekly report prompt builder**

In `generate_weekly_report()`, after the project/address/week lines (around lines 367-373), inject scope. Replace:

```python
    # Build prompt
    prompt_parts = [
        f"Project: {project['name'] if project else project_id}",
        f"Address: {project['address'] if project else ''}",
        f"Company: {defaults.get('company_name', 'SFW Construction')}",
        f"Week: {sorted(days.keys())[0]} to {sorted(days.keys())[-1]}",
        f"Total photos this week: {len(week_photos)} across {len(days)} days",
        "",
        "Photos by day:",
```

With:

```python
    # Get project scope context
    from photo_scanner.companycam import CompanyCamClient
    project_context = CompanyCamClient.get_project_context(project) if project else {"scope_of_work": "", "pages": []}
    scope_text = project_context["scope_of_work"]

    # Build prompt
    prompt_parts = [
        f"Project: {project['name'] if project else project_id}",
        f"Address: {project['address'] if project else ''}",
        f"Company: {defaults.get('company_name', 'SFW Construction')}",
        f"Week: {sorted(days.keys())[0]} to {sorted(days.keys())[-1]}",
    ]
    if scope_text:
        prompt_parts.append(f"\nScope of work:\n{scope_text}")
    prompt_parts.extend([
        f"\nTotal photos this week: {len(week_photos)} across {len(days)} days",
        "",
        "Photos by day:",
    ])
```

- [ ] **Step 3: Suppress per-day photo count below threshold in weekly report output**

After the weekly report JSON is parsed (around line 422-424), post-process the `daily_timeline` to suppress low counts. Add after the report is parsed:

```python
    # Suppress photo counts below threshold
    for day_entry in report.get("daily_timeline", []):
        if day_entry.get("total_photos", 0) < MIN_PHOTOS_FOR_COUNT:
            day_entry["total_photos"] = None
```

- [ ] **Step 4: Commit**

```bash
git add tools/photo-scanner/photo_scanner/reports.py
git commit -m "feat(photo-scanner): scope context in weekly reports, tone instructions, photo count suppression"
```

---

### Task 8: Integration test — generate a daily report with scope context

**Files:**
- No code changes — verification only

- [ ] **Step 1: Sync a project to populate notepad**

Run:
```bash
cd tools/photo-scanner && python -c "
import asyncio
from photo_scanner.companycam import CompanyCamClient
from photo_scanner.catalog import Catalog

async def sync_one():
    cc = CompanyCamClient()
    cat = Catalog()
    projects = await cc.list_projects(per_page=1)
    raw = projects[0]
    norm = cc.normalize_project(raw)
    cat.upsert_project(norm)
    saved = cat.get_project(norm['id'])
    print(f'Project: {saved[\"name\"]}')
    print(f'Notepad ({len(saved.get(\"notepad\", \"\"))} chars): {saved.get(\"notepad\", \"\")[:200]}...')
    ctx = cc.get_project_context(saved)
    print(f'Scope: {ctx[\"scope_of_work\"][:200]}...')
    await cc.close()
    cat.close()

asyncio.run(sync_one())
"
```

Expected: Project with notepad populated and clean scope text.

- [ ] **Step 2: Start the server and trigger a daily report**

Run the server:
```bash
cd tools/photo-scanner && python -m photo_scanner
```

In another terminal, trigger a report for a date with known photos:
```bash
curl -X POST http://localhost:8000/api/reports/generate -H "Content-Type: application/json" -d '{"date": "2026-04-07"}'
```

Check the logs for "Scope of work:" appearing in the prompt output (if you have verbose logging), and verify the generated report JSON uses factual language without severity adjectives.

- [ ] **Step 3: Verify photo count suppression**

Check a generated report for a project with < 10 photos on a given day. The `total_day_photos` field should be `null` instead of a number.

- [ ] **Step 4: Commit (only if fixes were needed)**

Only commit if integration testing revealed a bug that needed fixing.

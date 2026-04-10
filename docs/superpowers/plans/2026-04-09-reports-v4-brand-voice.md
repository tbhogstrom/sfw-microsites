# Reports V4: Brand Style & Professional Voice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply SFW Construction's brand guidelines to report HTML output and rewrite report generation prompts with a formal, professional, authoritative voice.

**Architecture:** A new `report_style.py` module holds brand constants (colors, typography, layout). `render_report_html()` in `server.py` imports these constants for its CSS block. Both report prompts in `reports.py` are rewritten with professional voice and construction terminology. JSON output schema is unchanged.

**Tech Stack:** Python, HTML/CSS (inline, self-contained), Anthropic API

**Spec:** `docs/superpowers/specs/2026-04-09-reports-v4-brand-voice-design.md`

---

### Task 1: Create brand style module

**Files:**
- Create: `tools/photo-scanner/photo_scanner/report_style.py`

- [ ] **Step 1: Create the module**

Create `tools/photo-scanner/photo_scanner/report_style.py` with the full brand constants:

```python
"""SFW Construction brand constants for report rendering."""

# Brand colors
BG_LIGHT = "#fcfcfc"
TEXT_DARK = "#545454"
ACCENT = "#df653a"
HEADER_BG = "#545454"
HEADER_TEXT = "#fcfcfc"

# Typography
FONT_FAMILY = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
H1_SIZE = "32px"
H2_SIZE = "20px"
H3_SIZE = "16px"
BODY_SIZE = "16px"

# Component colors
BORDER = "#e8e8e8"
CARD_BG = "#ffffff"
FOOTER_BG = "#f0f0f0"
CAPTION_COLOR = "#757575"
SECTION_LABEL_COLOR = "#757575"

# Risk boxes
RISK_BEFORE_BG = "#fef3e2"
RISK_BEFORE_LABEL = "#b8860b"
RISK_BEFORE_TEXT = "#5a4a2a"
RISK_AFTER_BG = "#e8f5e9"
RISK_AFTER_LABEL = "#2e7d32"
RISK_AFTER_TEXT = "#2a4a2a"

# Issue status
STATUS_RESOLVED = "#2e7d32"
STATUS_IN_PROGRESS = ACCENT
STATUS_DOCUMENTED = "#b8860b"

# Emphasis: italic + accent color
EMPHASIS_STYLE = f"font-style: italic; color: {ACCENT}"
```

- [ ] **Step 2: Verify import**

Run:
```bash
cd tools/photo-scanner && python -c "from photo_scanner.report_style import *; print(ACCENT, HEADER_BG, FONT_FAMILY[:20])"
```

Expected: `#df653a #545454 system-ui, -apple-sy`

- [ ] **Step 3: Commit**

```bash
git add -f tools/photo-scanner/photo_scanner/report_style.py
git commit -m "feat(photo-scanner): add brand style constants module"
```

---

### Task 2: Update report HTML rendering with brand styles

**Files:**
- Modify: `tools/photo-scanner/photo_scanner/server.py:1240-1397` (render_report_html)

- [ ] **Step 1: Add import at top of render function**

At the start of `render_report_html()` (line 1242, after the docstring), add:

```python
    from photo_scanner import report_style as brand
```

- [ ] **Step 2: Replace header color logic**

Find the header color block (around lines 1248-1261):

```python
    # Format date
    if report_type == "weekly":
        from datetime import datetime, timedelta
        ws = datetime.strptime(date_str, "%Y-%m-%d")
        we = ws + timedelta(days=4)
        date_display = f"Week of {ws.strftime('%B %d')} – {we.strftime('%B %d, %Y')}"
        header_bg = "#1a2a3a"
        label = "Weekly Project Report"
    else:
        from datetime import datetime
        d = datetime.strptime(date_str, "%Y-%m-%d")
        date_display = d.strftime("%A, %B %d, %Y")
        header_bg = "#1a3a2a"
        label = "Daily Project Update"
```

Replace with:

```python
    # Format date
    if report_type == "weekly":
        from datetime import datetime, timedelta
        ws = datetime.strptime(date_str, "%Y-%m-%d")
        we = ws + timedelta(days=4)
        date_display = f"Week of {ws.strftime('%B %d')} – {we.strftime('%B %d, %Y')}"
        label = "Weekly Project Report"
    else:
        from datetime import datetime
        d = datetime.strptime(date_str, "%Y-%m-%d")
        date_display = d.strftime("%A, %B %d, %Y")
        label = "Daily Project Update"
    header_bg = brand.HEADER_BG
```

- [ ] **Step 3: Replace the entire CSS block**

Find the `css = """` block (lines 1263-1296). Replace the entire block with:

```python
    css = f"""
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }}
        body {{ background: {brand.BG_LIGHT}; }}
        .report-card {{ max-width: 680px; margin: 24px auto; background: {brand.CARD_BG}; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); overflow: hidden; font-family: {brand.FONT_FAMILY}; color: {brand.TEXT_DARK}; }}
        .report-header {{ padding: 20px 24px; color: {brand.HEADER_TEXT}; position: relative; padding-right: 90px; }}
        .report-logo {{ position: absolute; top: 50%; right: 20px; height: 50px; opacity: 0.85; transform: translateY(-50%); }}
        .date-label {{ font-size: 12px; opacity: 0.7; letter-spacing: 1px; text-transform: uppercase; }}
        .report-header h2 {{ font-size: {brand.H2_SIZE}; font-weight: 700; margin: 4px 0 0; }}
        .report-section {{ padding: 20px 24px; border-bottom: 1px solid {brand.BORDER}; }}
        .section-label {{ font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: {brand.SECTION_LABEL_COLOR}; font-weight: 600; margin-bottom: 8px; }}
        .report-section p {{ font-size: {brand.BODY_SIZE}; line-height: 1.6; }}
        .risk-boxes {{ display: flex; gap: 16px; }}
        .risk-box {{ flex: 1; border-radius: 8px; padding: 14px; }}
        .risk-box.before {{ background: {brand.RISK_BEFORE_BG}; }}
        .risk-box.before .section-label {{ color: {brand.RISK_BEFORE_LABEL}; }}
        .risk-box.before p {{ color: {brand.RISK_BEFORE_TEXT}; }}
        .risk-box.after {{ background: {brand.RISK_AFTER_BG}; }}
        .risk-box.after .section-label {{ color: {brand.RISK_AFTER_LABEL}; }}
        .risk-box.after p {{ color: {brand.RISK_AFTER_TEXT}; }}
        .risk-arrow {{ display: flex; align-items: center; font-size: 24px; color: {brand.SECTION_LABEL_COLOR}; }}
        .report-photos {{ display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }}
        .report-photos img {{ width: 100%; border-radius: 8px; height: 160px; object-fit: cover; background: {brand.BORDER}; }}
        .report-photos .caption {{ font-size: 12px; color: {brand.CAPTION_COLOR}; margin-top: 4px; }}
        .issue-row {{ display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 4px 0; }}
        .report-footer {{ padding: 14px 24px; background: {brand.FOOTER_BG}; text-align: center; font-size: 12px; color: {brand.SECTION_LABEL_COLOR}; }}
        .day-entry {{ display: flex; gap: 12px; padding: 12px 0; border-bottom: 1px solid {brand.BORDER}; }}
        .day-entry:last-child {{ border-bottom: none; }}
        .day-date {{ min-width: 90px; font-size: 13px; font-weight: 600; color: {brand.TEXT_DARK}; }}
        .day-summary {{ flex: 1; font-size: 13px; color: {brand.TEXT_DARK}; line-height: 1.5; }}
        .day-thumbs {{ display: flex; gap: 4px; }}
        .day-thumbs img {{ width: 60px; height: 45px; object-fit: cover; border-radius: 4px; }}
    </style>
    """
```

Key changes from current: background `#fcfcfc`, text `#545454`, sans-serif font, `#e8e8e8` borders, photo height 160px, no font-family overrides on individual elements (inherited from `.report-card`), header h2 weight 700 and size 20px.

- [ ] **Step 4: Update section labels and photo count display**

Find the photos label block (around lines 1312-1317):

```python
        if report_type == "weekly":
            photos_label = "This Week's Photos"
        else:
            photos_label = f"Selected Photos from Today ({total_day_photos} photos taken)"
```

Replace with:

```python
        if report_type == "weekly":
            photos_label = "Selected Photos — This Week"
        else:
            if total_day_photos:
                photos_label = f"Selected Photos — {total_day_photos} documented today"
            else:
                photos_label = "Selected Photos"
```

- [ ] **Step 5: Update issue status colors**

Find the issue color logic (around line 1325):

```python
            color = "#2e7d32" if status == "resolved" else "#1976d2" if status == "in-progress" else "#b8860b"
```

Replace with:

```python
            color = brand.STATUS_RESOLVED if status == "resolved" else brand.STATUS_IN_PROGRESS if status == "in-progress" else brand.STATUS_DOCUMENTED
```

- [ ] **Step 6: Update section labels in the HTML body**

Find the `what_label` line (around line 1369):

```python
    what_label = "What We Accomplished" if report_type == "weekly" else "What We Did Today"
```

Replace with:

```python
    what_label = "Work Performed This Week" if report_type == "weekly" else "Work Performed Today"
```

Find the risk box labels in the HTML (around lines 1384-1386):

```python
            <div class="risk-box before"><div class="section-label">{'Risk at Start of Week' if report_type == 'weekly' else 'Risk Before Work'}</div><p>{rpt.get('risk_before','')}</p></div>
            <div class="risk-arrow">→</div>
            <div class="risk-box after"><div class="section-label">{"After This Week's Work" if report_type == 'weekly' else "After Today's Work"}</div><p>{rpt.get('risk_after','')}</p></div>
```

Replace with:

```python
            <div class="risk-box before"><div class="section-label">{'Condition at Start of Week' if report_type == 'weekly' else 'Condition Before Work'}</div><p>{rpt.get('risk_before','')}</p></div>
            <div class="risk-arrow">→</div>
            <div class="risk-box after"><div class="section-label">{"Condition After This Week" if report_type == 'weekly' else "Condition After Work"}</div><p>{rpt.get('risk_after','')}</p></div>
```

Find the value statement label (around line 1391):

```python
    <div class="report-section"><div class="section-label">The Value To Your Home</div><p>{rpt.get('value_statement','')}</p></div>
```

Replace with:

```python
    <div class="report-section"><div class="section-label">Value to Your Property</div><p>{rpt.get('value_statement','')}</p></div>
```

Find the weekly narrative label (around line 1367):

```python
        narrative_html = f'<div class="report-section"><div class="section-label">This Week\'s Progress</div><p>{rpt["weekly_narrative"]}</p></div>'
```

Replace with:

```python
        narrative_html = f'<div class="report-section"><div class="section-label">Weekly Summary</div><p>{rpt["weekly_narrative"]}</p></div>'
```

- [ ] **Step 7: Update header inline styles**

Find the header inline styles (around lines 1377-1379):

```python
        <div style="font-size:13px;opacity:0.8;font-family:-apple-system,sans-serif;margin-top:10px">{project_name}</div>
        <div style="font-size:12px;opacity:0.6;margin-top:2px;font-family:-apple-system,sans-serif">{project_address}</div>
        <div style="font-size:12px;opacity:0.6;margin-top:2px;font-family:-apple-system,sans-serif">{date_display}</div>
```

Replace with (remove font-family overrides — inherited from card):

```python
        <div style="font-size:13px;opacity:0.8;margin-top:10px">{project_name}</div>
        <div style="font-size:12px;opacity:0.6;margin-top:2px">{project_address}</div>
        <div style="font-size:12px;opacity:0.6;margin-top:2px">{date_display}</div>
```

- [ ] **Step 8: Update timeline day label**

Find the timeline photo label (around line 1357):

```python
                f'<div class="section-label">{day_label} — Selected Photos from Today ({total_photos} photos taken)</div>'
```

Replace with:

```python
                f'<div class="section-label">{day_label}{f" — {total_photos} documented" if total_photos else ""}</div>'
```

- [ ] **Step 9: Verify the render function parses**

Run:
```bash
cd tools/photo-scanner && python -c "from photo_scanner.server import render_report_html; print('OK')"
```

Expected: `OK`

- [ ] **Step 10: Commit**

```bash
git add -f tools/photo-scanner/photo_scanner/server.py
git commit -m "feat(photo-scanner): apply brand styles to report HTML rendering"
```

---

### Task 3: Rewrite daily report prompt with professional voice

**Files:**
- Modify: `tools/photo-scanner/photo_scanner/reports.py:7-31` (REPORT_PROMPT)

- [ ] **Step 1: Replace REPORT_PROMPT**

Find the `REPORT_PROMPT` constant (lines 7-31). Replace the entire constant with:

```python
REPORT_PROMPT = """\
Write as SFW Construction — a licensed general contractor communicating directly with the homeowner. Tone is formal, professional, and authoritative. Language should reflect craftsmanship expertise, not sales. Use precise construction terminology (e.g., "building envelope," "substrate," "flashing detail") but remain clear to a homeowner.

Generate a daily project report.

Rules:
- Structured, confident sentences. No casual language, filler, or exaggeration.
- headline: professional and specific, under 12 words (e.g., "Window Flashing Corrections Complete — Building Envelope Secured")
- risk_before and risk_after: 1-2 sentences each, factual, describing the condition and its implications for the structure
- what_we_did: 2-3 sentences. Describe the work performed with industry terminology. Position as expert contractor, not handyman.
- value_statement: 1-2 sentences. Focus on building trust through clarity — what was protected, what was corrected, why it matters structurally.
- Do NOT generate photo_captions — photos are shown without descriptions
- No severity adjectives (major, severe, significant, extensive, critical). If the repair is structural, say that. Otherwise describe what was done and where.
- No humor, sarcasm, or casual phrasing.
- IMPORTANT: Never use declarative completion language like "all siding repaired", "all dry rot remediated", "all damage fixed". This creates legal liability. Use precise language: "addressed the identified damage at the south elevation," "corrected the flashing detail at the window head."

Respond in JSON only:
{
  "headline": "professional, specific headline",
  "risk_before": "condition and structural implications before today's work",
  "risk_after": "current condition after today's work",
  "what_we_did": "work performed today, using construction terminology",
  "value_statement": "why this work matters to the property",
  "issues_status": [
    {"issue": "name", "status": "resolved|in-progress|documented-only", "changed_today": true/false}
  ]
}
"""
```

- [ ] **Step 2: Verify prompt loads**

Run:
```bash
cd tools/photo-scanner && python -c "from photo_scanner.reports import REPORT_PROMPT; print('licensed general contractor' in REPORT_PROMPT, 'friendly' not in REPORT_PROMPT)"
```

Expected: `True True`

- [ ] **Step 3: Commit**

```bash
git add -f tools/photo-scanner/photo_scanner/reports.py
git commit -m "feat(photo-scanner): rewrite daily report prompt with professional voice"
```

---

### Task 4: Rewrite weekly report prompt with professional voice

**Files:**
- Modify: `tools/photo-scanner/photo_scanner/reports.py:209-243` (WEEKLY_REPORT_PROMPT)

- [ ] **Step 1: Replace WEEKLY_REPORT_PROMPT**

Find the `WEEKLY_REPORT_PROMPT` constant (lines 209-243). Replace the entire constant with:

```python
WEEKLY_REPORT_PROMPT = """\
Write as SFW Construction — a licensed general contractor communicating directly with the homeowner. Tone is formal, professional, and authoritative. Language should reflect craftsmanship expertise, not sales. Use precise construction terminology (e.g., "building envelope," "substrate," "flashing detail") but remain clear to a homeowner.

Generate a weekly project report. This covers a full week of work.

Rules:
- Structured, confident sentences. No casual language, filler, or exaggeration.
- weekly_narrative: 3-4 sentences documenting the progression of work — initial conditions, work performed, current status
- risk_before and risk_after: 1-2 sentences each (for the whole week, not per day), factual, describing the condition and its structural implications
- what_we_did: 2-3 sentences summarizing the week's work with industry terminology
- value_statement: 1-2 sentences. Focus on building trust through clarity — what was protected, what was corrected, why it matters structurally.
- photo_captions: one concise sentence per photo using construction terminology, accessible to a homeowner
- daily_timeline: one entry per day, one-sentence professional summary. Include total_photos (total photo count for that day)
- headline: professional and specific, under 12 words
- Do NOT predict next week's work
- No severity adjectives (major, severe, significant, extensive, critical). If the repair is structural, say that. Otherwise describe what was done and where.
- No humor, sarcasm, or casual phrasing.
- IMPORTANT: Never use declarative completion language like "all siding repaired", "all dry rot remediated", "all damage fixed". This creates legal liability. Use precise language: "addressed the identified damage at the south elevation," "corrected the flashing detail at the window head."

Respond in JSON only:
{
  "headline": "professional, specific headline for the week",
  "weekly_narrative": "3-4 sentence progression of work",
  "risk_before": "condition at start of week",
  "risk_after": "condition at end of week",
  "what_we_did": "summary of work performed this week",
  "value_statement": "why this week's work matters to the property",
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

- [ ] **Step 2: Verify prompt loads**

Run:
```bash
cd tools/photo-scanner && python -c "from photo_scanner.reports import WEEKLY_REPORT_PROMPT; print('licensed general contractor' in WEEKLY_REPORT_PROMPT, 'friendly' not in WEEKLY_REPORT_PROMPT)"
```

Expected: `True True`

- [ ] **Step 3: Commit**

```bash
git add -f tools/photo-scanner/photo_scanner/reports.py
git commit -m "feat(photo-scanner): rewrite weekly report prompt with professional voice"
```

---

### Task 5: Integration test — generate a report with new styles and voice

**Files:**
- No code changes — verification only

- [ ] **Step 1: Verify all imports work together**

Run:
```bash
cd tools/photo-scanner && python -c "
from photo_scanner.report_style import ACCENT, HEADER_BG, FONT_FAMILY, STATUS_IN_PROGRESS
from photo_scanner.reports import REPORT_PROMPT, WEEKLY_REPORT_PROMPT, MIN_PHOTOS_FOR_COUNT
from photo_scanner.server import render_report_html

# Brand constants
assert ACCENT == '#df653a'
assert HEADER_BG == '#545454'
assert STATUS_IN_PROGRESS == '#df653a'
assert 'sans-serif' in FONT_FAMILY

# Voice
assert 'licensed general contractor' in REPORT_PROMPT
assert 'licensed general contractor' in WEEKLY_REPORT_PROMPT
assert 'friendly' not in REPORT_PROMPT
assert 'friendly' not in WEEKLY_REPORT_PROMPT
assert 'punchy' not in REPORT_PROMPT
assert 'punchy' not in WEEKLY_REPORT_PROMPT

# v3 features preserved
assert MIN_PHOTOS_FOR_COUNT == 10
assert 'severity adjectives' in REPORT_PROMPT
assert 'severity adjectives' in WEEKLY_REPORT_PROMPT
assert 'declarative completion' in REPORT_PROMPT.lower()

print('ALL CHECKS PASSED')
"
```

Expected: `ALL CHECKS PASSED`

- [ ] **Step 2: Test render with mock data**

Run:
```bash
cd tools/photo-scanner && python -c "
from photo_scanner.server import render_report_html

html = render_report_html(
    report={'headline': 'Test', 'risk_before': 'Before', 'risk_after': 'After', 'what_we_did': 'Work', 'value_statement': 'Value', 'photos': [], 'issues_status': []},
    project_name='Test Project',
    project_address='123 Main St',
    date_str='2026-04-09',
    report_type='daily',
    logo_b64='',
    photo_b64={},
)

# Check brand values are in rendered HTML
assert '#fcfcfc' in html, 'Missing brand background'
assert '#545454' in html, 'Missing brand text/header color'
assert 'system-ui' in html, 'Missing brand font'
assert 'Condition Before Work' in html, 'Missing updated label'
assert 'Work Performed Today' in html, 'Missing updated label'
assert 'Value to Your Property' in html, 'Missing updated label'
assert 'Georgia' not in html, 'Old serif font still present'
assert '#1a3a2a' not in html, 'Old daily header color still present'

print('RENDER CHECK PASSED')
"
```

Expected: `RENDER CHECK PASSED`

- [ ] **Step 3: Generate a live daily report (if server is running)**

Start the server and trigger a report for a project to see the new voice in action:

```bash
curl -X POST http://localhost:8000/api/reports/generate -H "Content-Type: application/json" -d '{"date": "2026-04-09", "project_id": "101024172"}'
```

Check the generated report for professional voice — headlines should read like "Window Flashing Corrections — Building Envelope Secured" rather than "Water Damage Found Behind Windows."

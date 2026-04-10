# Reports V4: Brand Style & Professional Voice

**Date:** 2026-04-09
**Status:** Approved
**Scope:** `tools/photo-scanner` — new `report_style.py`, modify `server.py`, modify `reports.py`

## Problem

The report HTML output and AI-generated text don't follow SFW Construction's brand guidelines. Currently:

- Typography uses Georgia serif; brand requires sans-serif
- Colors are ad-hoc (teal headers, off-white backgrounds); brand has a defined palette
- Report tone is "friendly and punchy"; brand voice is formal, professional, and authoritative
- No use of brand accent color (`#df653a`)
- Language reads as a friendly update rather than expert contractor documentation

## Brand Guidelines

### Style & Design
- Background: `#fcfcfc` (light), Text: `#545454` (dark)
- Headers: dark background (`#545454`) with light text (`#fcfcfc`)
- Accent color: `#df653a` (links, emphasis, active status)
- Typography: sans-serif
  - H1: 32px bold, H2: 20px bold, H3: 16px bold, Body: 16px
- Emphasis: italic AND accent color (`#df653a`)
- Buttons: accent background, light text, 10px padding, rounded corners

### Tone & Voice
- Formal, professional, and authoritative
- Traditional (grounded in craftsmanship, not trendy language)
- Serious (no humor, sarcasm, or playfulness)
- Neutral to slightly inspirational (build confidence through clarity, not hype)
- Use precise, industry-specific terminology (e.g., "building envelope")
- Position as expert contractor, not handyman

### Writing Rules
- Clear, structured, and confident
- No casual language, slang, or filler
- No exaggeration or hype
- Focus on educating, building trust, and demonstrating expertise

## Solution

### 1. Brand Style Module (`report_style.py`)

New file `photo_scanner/report_style.py` with brand constants:

```python
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
STATUS_IN_PROGRESS = "#df653a"   # brand accent for active work
STATUS_DOCUMENTED = "#b8860b"

# Emphasis
EMPHASIS_STYLE = f"font-style: italic; color: {ACCENT}"
```

### 2. HTML Rendering Updates (`server.py`)

`render_report_html()` CSS block updated to use brand constants:

**Color changes:**
- `body` background: `#f8f7f4` → `#fcfcfc`
- `.report-card` color: `#333` → `#545454`
- `.report-header` background: unified `#545454` for both daily and weekly (no more teal/navy distinction). Text: `#fcfcfc`
- `.report-footer` background: `#f0f0ee` → `#f0f0f0`, text: `#888` → `#757575`
- `.section-label` color: `#888` → `#757575`
- `.caption` color: `#666` → `#757575`
- In-progress issue status: `#1976d2` → `#df653a` (brand accent)

**Typography changes:**
- `.report-card` font-family: `Georgia, serif` → sans-serif stack from brand
- All `-apple-system, sans-serif` fragments → brand font family constant
- `.report-section p` font-size: `14px` → `16px`
- `.report-header h2` font-size: `22px` → `20px` (matches H2 spec)

**Layout adjustments:**
- Photo grid image height: `140px` → `160px` (proportional to larger body text)
- Card border-radius, section padding, and grid structure unchanged

**Photo count label logic:**
- `total_day_photos` is `None` (suppressed, <10): label says "Selected Photos"
- `total_day_photos` is present: label says "Selected Photos — {N} documented today"

**Section labels adjusted to brand voice:**
- "What We Did Today" → "Work Performed Today"
- "What We Accomplished" → "Work Performed This Week"
- "The Value To Your Home" → "Value to Your Property"
- "Risk Before Work" → "Condition Before Work"
- "After Today's Work" → "Condition After Work"
- "Risk at Start of Week" → "Condition at Start of Week"
- "After This Week's Work" → "Condition After This Week"
- "This Week's Progress" → "Weekly Summary"

### 3. Prompt Voice Rewrite (`reports.py`)

Both `REPORT_PROMPT` and `WEEKLY_REPORT_PROMPT` rewritten with brand voice. The voice block replaces "Be friendly and concise. Lead with risk and value."

**New voice instruction block (shared by both prompts):**

```
Write as SFW Construction — a licensed general contractor communicating directly
with the homeowner. Tone is formal, professional, and authoritative. Language
should reflect craftsmanship expertise, not sales. Use precise construction
terminology (e.g., "building envelope," "substrate," "flashing detail") but
remain clear to a homeowner.

Rules:
- Structured, confident sentences. No casual language, filler, or exaggeration.
- headline: professional and specific, under 12 words
  (e.g., "Window Flashing Corrections Complete — Building Envelope Secured")
- risk_before / risk_after: 1-2 sentences each, factual, describing the
  condition and its implications for the structure
- what_we_did: 2-3 sentences. Describe the work performed with industry
  terminology. Position as expert contractor, not handyman.
- value_statement: 1-2 sentences. Focus on building trust through clarity —
  what was protected, what was corrected, why it matters structurally.
- No severity adjectives (major, severe, significant, extensive, critical).
  If the repair is structural, say that.
- Never use declarative completion language ("all damage fixed"). Use precise
  language: "addressed the identified damage at the south elevation,"
  "corrected the flashing detail at the window head."
- No humor, sarcasm, or casual phrasing.
```

**Weekly-specific additions:**
- weekly_narrative instruction changes from "3-4 sentences covering the week's arc" to "3-4 sentences documenting the progression of work — initial conditions, work performed, current status."
- photo_captions: "one concise sentence per photo using construction terminology, accessible to a homeowner"
- daily_timeline: "one entry per day, one-sentence professional summary"

**Retained from v3:**
- JSON output schema — identical fields, no structural change
- Legal liability hedging rules
- No severity adjectives
- Photo count suppression (`MIN_PHOTOS_FOR_COUNT = 10`)
- Scope of work injection via `get_project_context()`

## Files

**New:**

| File | Purpose |
|------|---------|
| `photo_scanner/report_style.py` | Brand constants — colors, typography, layout values |

**Modified:**

| File | Changes |
|------|---------|
| `server.py` | `render_report_html()` CSS uses brand constants; unified header; sans-serif; 16px body; accent emphasis; updated section labels |
| `reports.py` | `REPORT_PROMPT` and `WEEKLY_REPORT_PROMPT` rewritten with professional voice and construction terminology |

**Not modified:**

| File | Reason |
|------|--------|
| `catalog.py` | No data changes |
| `companycam.py` | No API changes |
| `scanner.py` | Deep analysis and project summary prompts produce internal structured data, not homeowner-facing text |
| `report_config.json` | Risk/value matrix language is already factual |

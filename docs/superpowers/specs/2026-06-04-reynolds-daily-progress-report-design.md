# Reynolds Daily Progress Report — Design Spec

**Date:** 2026-06-04
**Author:** Tyler Falcon (with Claude)
**Status:** Approved design, pending implementation plan
**Type:** One-off custom report (not wired into the server's standing report system)

## Goal

Produce a self-contained, customer-facing HTML **daily progress report** for the George
Reynolds job, centered on a **photos-per-hour chart** that visually demonstrates how
thoroughly the crew worked and documented the day. The report supports two business goals:

1. Give the customer a polished daily report they trust.
2. Subtly position SFW to convert the customer to **exterior painting** services (the crew
   is already on site and staged with pumpjacks).

## Context

- **Customer / project:** George Reynolds — 538 NW View Ridge St, Camas, WA
- **CompanyCam project ID:** `106749565` (name: "George Reynolds 06-03-2026")
- **Report date:** 2026-06-03 (Pacific time)
- **Photos in catalog:** 82 total, spanning 3 days — **59 on 06-03**, 11 on 06-02, 12 on 06-04
- **Analysis state at design time:** none of the 82 photos are AI-analyzed (`scene` is null);
  `creator_name` is blank for all
- **Scope of work (verbatim, used as grounding context):**
  > SFW Construction will visit the property to inspect the trim around multiple large
  > picture windows where dry rot has been identified and determine the extent of underlying
  > damage. We will carefully open affected areas as needed to confirm conditions and complete
  > targeted repairs to restore the integrity of the trim and surrounding structure. Work will
  > be performed on a time and materials basis, allowing flexibility as we uncover the full
  > scope, with the option to proceed as far as the customer is comfortable. Given the height
  > and accessibility challenges of the home, our team will handle both the repair and
  > finishing work to ensure everything is completed safely and properly.

## Decisions (locked)

| Decision | Choice |
|---|---|
| AI analysis | Run full analysis first, then build report from analyzed data |
| Painting pitch | Subtle teaser (closing note, not a hard CTA) |
| Output format | Single self-contained HTML, images base64-embedded |
| Photo grid size | Generous — ~12–16 photos |
| Analysis scope | Whole project (all 82 photos) so 06-02 / 06-04 reports are instant later |
| Report date scope | 06-03 only (59 photos) |

## Architecture

A single standalone script: `tools/photo-scanner/make_reynolds_report.py`. Follows the repo's
existing one-off pattern (`render_ab_report.py`, `_sync_milwaukie.py`). Reuses existing library
code wherever possible; adds only the new per-hour chart + report assembly.

### Stage 1 — Analyze (grounded, idempotent)

- Load `.env`, open `Catalog()`, build `CompanyCamClient` and an async Anthropic client via
  the existing `get_async_anthropic_client()`.
- If the project's photos are not yet analyzed, call the existing
  `analyze_project_from_catalog(catalog, "106749565", cc_client, anthropic_client, on_progress=...)`.
  - This runs the existing two-pass pipeline: triage (pick / document / skip) → deep analysis
    (scene, service_types, phase, damage_details, marketing_score).
  - The deep prompt is built with `build_deep_prompt(scope_text)` using the Reynolds scope —
    scope is passed as **context, not fact** (existing prompt already states scope can evolve
    and photos may show out-of-scope conditions).
- Idempotent: re-running the script skips already-analyzed photos (`get_unanalyzed_photos`
  drives triage; deep pass only re-analyzes `picked` photos with null `scene`).

### Stage 2 — Per-hour data (pure facts, no AI)

- Select the 59 photos whose `taken_at` falls within the **06-03 Pacific day window**.
- Convert each `taken_at` (stored as a unix-timestamp string) to Pacific local time using
  `zoneinfo("America/Los_Angeles")` (DST-aware → PDT/UTC-7 in June). Fallback to a fixed
  `timezone(timedelta(hours=-7))` if `zoneinfo`/`tzdata` is unavailable on Windows.
- Bucket photo counts by hour of day across the working window (clamp display to ~6am–7pm,
  expand if data falls outside).
- Derive **thoroughness stats** entirely from data (no hallucination surface):
  - total photos that day
  - first-photo → last-photo span ("crew documented across ~X hours on site")
  - number of distinct hours with at least one photo
  - before / during / after coverage counts (from analyzed `phase`)

### Stage 3 — Narrative (AI, tightly grounded)

- Compute the 06-03 Pacific day boundaries as unix timestamps and call the existing
  `generate_daily_report(catalog, "106749565", ts_start, ts_end, anthropic_client)`.
- Returns: `headline`, `risk_before`, `risk_after`, `what_we_did`, `value_statement`,
  `issues_status`. (Existing `REPORT_PROMPT` already forbids severity adjectives, completion
  claims like "all dry rot remediated", and omits per-photo captions.)
- The narrative is restricted to analyzed photo fields + scope text. No predictions of future
  work, no invented specifics.

### Stage 4 — Render self-contained HTML

- **Photo selection for the grid:** from the 06-03 analyzed photos, take `triage_status ==
  "picked"`, sort by `marketing_score` desc with phase diversity (reuse the spirit of
  `select_best_photos` but raise the cap to 12–16). Prefer a spread across before/during/after.
- **Image embedding:** for each selected photo, fetch bytes via `cc_client.get_photo_bytes`,
  resize to a web thumbnail with PIL, base64-encode, inline as `data:` URIs. File is fully
  portable (email attachment / link, no server, no expiring URLs).
- **Chart:** render an inline **SVG bar chart** (no JavaScript) so it prints cleanly and
  survives email clients. X axis = hour of workday, Y = photo count, SFW brand color. Stat
  callouts rendered as text beside/above the chart.
- Write to `tools/photo-scanner/reynolds_progress_2026-06-03.html` and open in browser.

### Report layout (top to bottom)

1. **Header** — SFW branding, customer name, address, "Daily Progress Report — June 3, 2026"
2. **Headline + summary paragraph** (AI, grounded)
3. **Activity timeline** — the photos-per-hour SVG bar chart + thoroughness stat callouts
4. **What we did today** — `what_we_did`, with condition before / after
5. **Photo grid** — ~12–16 base64 thumbnails of the day's documented work
6. **Subtle painting teaser** — tasteful closing: crew is staged with pumpjacks and
   well-positioned to handle exterior painting / finishing while on site. No hard sell.

## Anti-hallucination guardrails

- The chart and every stat are computed **only** from timestamps and analyzed `phase` fields —
  never AI-narrated.
- Narrative is generated solely from analyzed photo data + the verbatim scope text; the
  existing prompt blocks completion language and severity adjectives.
- Per-photo captions are **off** (existing daily prompt already omits them), avoiding invented
  per-image detail.
- Scope text is labeled as contracted intent that "can evolve," not as a statement of what was
  done.

## Out of scope

- Not wired into the server's standing daily/weekly report system or the portal.
- No new catalog schema, no new server endpoints.
- 06-02 and 06-04 reports are not generated now (but become trivial: same script, different
  date — a future generalization, not built yet).

## Testing / verification

- Dry-run the per-hour bucketing against the known distribution (59 photos on 06-03).
- Confirm the analysis pass writes `scene`/`phase`/`marketing_score` for picked photos.
- Open the final HTML and visually verify: chart renders, ~12–16 images load (base64), no
  completion/severity language in the narrative, painting teaser reads as soft.

## Risks / notes

- **Timezone:** Windows Python may lack `tzdata`; fallback to fixed UTC-7 is correct for June
  (PDT). Verify the chart's hour buckets look like a real workday (morning-heavy, afternoon
  burst per the sampled data).
- **API cost:** ~10 triage grid calls + ~30–50 deep calls on Sonnet for the full 82-photo
  project. One-time; subsequent runs are cached.
- **Blank creator names:** do not surface crew names in the report (data unavailable).

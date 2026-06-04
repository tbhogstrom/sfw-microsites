# Reynolds Daily Progress Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a self-contained, customer-facing HTML daily progress report for the George Reynolds job (06-03-2026), centered on a photos-per-hour activity chart that demonstrates crew thoroughness, with a subtle exterior-painting teaser.

**Architecture:** A new importable module `photo_scanner/daily_progress.py` holds pure, unit-tested helpers (timezone/day-bounds, per-hour bucketing, thoroughness stats, photo selection, SVG chart, HTML render) plus an async orchestrator (`build_report`) and `main()`. It reuses the existing analysis pipeline (`analyze_project_from_catalog`) and narrative generator (`generate_daily_report`). The chart counts *all* photos for the day (direct query); the narrative and photo grid use only AI-analyzed picks.

**Tech Stack:** Python 3.12, sqlite (catalog), httpx (CompanyCam), Pillow (thumbnails), Anthropic async SDK (Sonnet), Jinja2 (HTML), inline SVG (chart). Tests: pytest.

---

## File Structure

- **Create** `tools/photo-scanner/photo_scanner/daily_progress.py` — all report logic (pure helpers + async orchestrator + `main`).
- **Create** `tools/photo-scanner/tests/test_daily_progress.py` — unit tests for the pure helpers (no network).
- **Output (generated, not committed)** `tools/photo-scanner/reynolds_progress_2026-06-03.html`.

All paths below are relative to `tools/photo-scanner/`. Run pytest from that directory.

Constants at the top of `daily_progress.py`:

```python
PROJECT_ID = "106749565"
REPORT_DATE = "2026-06-03"
COMPANY_NAME = "SFW Construction"
CUSTOMER_NAME = "George Reynolds"
ADDRESS = "538 NW View Ridge St, Camas, WA"
GRID_MAX = 16
PHASE_ORDER = ["before", "during", "after", "overview", "materials", "other"]
```

---

### Task 1: Module skeleton + timezone & day-bounds helpers

**Files:**
- Create: `photo_scanner/daily_progress.py`
- Test: `tests/test_daily_progress.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_daily_progress.py
from datetime import datetime
from photo_scanner.daily_progress import get_pacific_tz, pacific_day_bounds, fmt_time


def test_pacific_day_bounds_june_is_pdt():
    tz = get_pacific_tz()
    start, end = pacific_day_bounds("2026-06-03", tz)
    # 06-03 00:00 PDT == 06-03 07:00 UTC
    assert datetime.utcfromtimestamp(start).strftime("%Y-%m-%d %H:%M") == "2026-06-03 07:00"
    assert end - start == 24 * 3600


def test_fmt_time_strips_leading_zero():
    tz = get_pacific_tz()
    dt = datetime.fromtimestamp(pacific_day_bounds("2026-06-03", tz)[0] + 8 * 3600, tz)
    assert fmt_time(dt) == "8:00 AM"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_daily_progress.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'photo_scanner.daily_progress'`

- [ ] **Step 3: Write minimal implementation**

```python
# photo_scanner/daily_progress.py
"""One-off daily progress report: photos-per-hour chart + grounded narrative.

Usage:
    python -m photo_scanner.daily_progress            # Reynolds 06-03-2026 defaults
    python -m photo_scanner.daily_progress <project_id> <YYYY-MM-DD>
"""
from datetime import datetime, time, timedelta, timezone

PROJECT_ID = "106749565"
REPORT_DATE = "2026-06-03"
COMPANY_NAME = "SFW Construction"
CUSTOMER_NAME = "George Reynolds"
ADDRESS = "538 NW View Ridge St, Camas, WA"
GRID_MAX = 16
PHASE_ORDER = ["before", "during", "after", "overview", "materials", "other"]


def get_pacific_tz():
    """America/Los_Angeles if tzdata is available, else fixed PDT (UTC-7, correct for June)."""
    try:
        from zoneinfo import ZoneInfo
        tz = ZoneInfo("America/Los_Angeles")
        # Probe: zoneinfo can import but lack the tzdata database on Windows.
        datetime(2026, 6, 3, tzinfo=tz).utcoffset()
        return tz
    except Exception:
        return timezone(timedelta(hours=-7))


def pacific_day_bounds(date_str, tz):
    """Return (ts_start, ts_end) unix seconds for the local-midnight-to-midnight day."""
    d = datetime.strptime(date_str, "%Y-%m-%d").date()
    start = datetime.combine(d, time.min, tzinfo=tz)
    end = datetime.combine(d + timedelta(days=1), time.min, tzinfo=tz)
    return int(start.timestamp()), int(end.timestamp())


def fmt_time(dt):
    """Cross-platform '%-I:%M %p' (Windows strftime lacks %-I)."""
    return dt.strftime("%I:%M %p").lstrip("0")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_daily_progress.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add photo_scanner/daily_progress.py tests/test_daily_progress.py
git commit -m "feat(photo-scanner): daily_progress timezone + day-bounds helpers"
```

---

### Task 2: Per-hour bucketing + thoroughness stats

**Files:**
- Modify: `photo_scanner/daily_progress.py`
- Test: `tests/test_daily_progress.py`

- [ ] **Step 1: Write the failing test**

```python
# append to tests/test_daily_progress.py
from photo_scanner.daily_progress import bucket_photos_by_hour, compute_thoroughness_stats


def _ts(date_str, hour, tz):
    from photo_scanner.daily_progress import pacific_day_bounds
    return pacific_day_bounds(date_str, tz)[0] + hour * 3600


def test_bucket_photos_by_hour_counts_local_hours():
    tz = get_pacific_tz()
    ts = [_ts("2026-06-03", 8, tz)] * 3 + [_ts("2026-06-03", 8, tz) + 1800] + [_ts("2026-06-03", 15, tz)]
    counts = bucket_photos_by_hour([str(t) for t in ts], tz)
    assert counts[8] == 4
    assert counts[15] == 1


def test_compute_thoroughness_stats():
    tz = get_pacific_tz()
    ts = [_ts("2026-06-03", 7, tz), _ts("2026-06-03", 8, tz), _ts("2026-06-03", 17, tz)]
    stats = compute_thoroughness_stats([str(t) for t in ts], ["before", "during", "after"], tz)
    assert stats["total"] == 3
    assert stats["active_hours"] == 3
    assert stats["span_label"] == "7:00 AM – 5:00 PM"
    assert stats["span_hours"] == 10
    assert stats["phase_counts"] == {"before": 1, "during": 1, "after": 1}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_daily_progress.py -v`
Expected: FAIL — `ImportError: cannot import name 'bucket_photos_by_hour'`

- [ ] **Step 3: Write minimal implementation**

```python
# append to photo_scanner/daily_progress.py
from collections import Counter


def bucket_photos_by_hour(timestamps, tz):
    """{hour_of_day: count} from unix-timestamp strings/ints, in local tz."""
    counts = {}
    for ts in timestamps:
        h = datetime.fromtimestamp(int(ts), tz).hour
        counts[h] = counts.get(h, 0) + 1
    return counts


def compute_thoroughness_stats(timestamps, phases, tz):
    """Pure, fact-only stats for the day. No AI."""
    ints = sorted(int(t) for t in timestamps)
    first = datetime.fromtimestamp(ints[0], tz)
    last = datetime.fromtimestamp(ints[-1], tz)
    counts = bucket_photos_by_hour(timestamps, tz)
    return {
        "total": len(ints),
        "first_time": fmt_time(first),
        "last_time": fmt_time(last),
        "span_label": f"{fmt_time(first)} – {fmt_time(last)}",
        "span_hours": round((ints[-1] - ints[0]) / 3600),
        "active_hours": len(counts),
        "phase_counts": dict(Counter(phases)),
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_daily_progress.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit**

```bash
git add photo_scanner/daily_progress.py tests/test_daily_progress.py
git commit -m "feat(photo-scanner): per-hour bucketing + thoroughness stats"
```

---

### Task 3: Phase-diverse grid photo selection

**Files:**
- Modify: `photo_scanner/daily_progress.py`
- Test: `tests/test_daily_progress.py`

- [ ] **Step 1: Write the failing test**

```python
# append to tests/test_daily_progress.py
from photo_scanner.daily_progress import select_grid_photos


def _photo(pid, phase, score):
    return {"id": pid, "phase": phase, "marketing_score": score, "uri": f"u{pid}"}


def test_select_grid_returns_all_when_under_cap():
    photos = [_photo(i, "during", 3) for i in range(5)]
    assert len(select_grid_photos(photos, max_n=16)) == 5


def test_select_grid_caps_and_diversifies_phases():
    # 20 "during" + 2 "before" + 2 "after"; cap 16 must include the before/after ones
    photos = [_photo(f"d{i}", "during", 5) for i in range(20)]
    photos += [_photo("b1", "before", 1), _photo("b2", "before", 1)]
    photos += [_photo("a1", "after", 1), _photo("a2", "after", 1)]
    picked = select_grid_photos(photos, max_n=16)
    assert len(picked) == 16
    phases = {p["phase"] for p in picked}
    assert "before" in phases and "after" in phases
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_daily_progress.py -v`
Expected: FAIL — `ImportError: cannot import name 'select_grid_photos'`

- [ ] **Step 3: Write minimal implementation**

```python
# append to photo_scanner/daily_progress.py
def select_grid_photos(photos, max_n=GRID_MAX):
    """Up to max_n photos, score-sorted but round-robin across phases for diversity."""
    scored = sorted(photos, key=lambda p: p.get("marketing_score") or 0, reverse=True)
    if len(scored) <= max_n:
        return scored
    by_phase = {}
    for p in scored:
        by_phase.setdefault(p.get("phase") or "other", []).append(p)
    selected, seen, round_idx = [], set(), 0
    while len(selected) < max_n and any(round_idx < len(b) for b in by_phase.values()):
        for phase in PHASE_ORDER:
            bucket = by_phase.get(phase, [])
            if round_idx < len(bucket) and len(selected) < max_n:
                p = bucket[round_idx]
                if id(p) not in seen:
                    selected.append(p)
                    seen.add(id(p))
        round_idx += 1
    return selected
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_daily_progress.py -v`
Expected: PASS (6 passed)

- [ ] **Step 5: Commit**

```bash
git add photo_scanner/daily_progress.py tests/test_daily_progress.py
git commit -m "feat(photo-scanner): phase-diverse grid photo selection"
```

---

### Task 4: Inline SVG per-hour bar chart

**Files:**
- Modify: `photo_scanner/daily_progress.py`
- Test: `tests/test_daily_progress.py`

- [ ] **Step 1: Write the failing test**

```python
# append to tests/test_daily_progress.py
from photo_scanner.daily_progress import render_hour_chart_svg


def test_render_hour_chart_svg_smoke():
    svg = render_hour_chart_svg({8: 37, 15: 15, 11: 9}, start_hour=7, end_hour=18)
    assert svg.startswith("<svg")
    assert svg.rstrip().endswith("</svg>")
    # one bar rect per hour in range (7..17 inclusive = 11 bars)
    assert svg.count('class="bar"') == 11
    # tallest hour (8) labels its count
    assert ">37<" in svg


def test_render_hour_chart_svg_handles_empty():
    svg = render_hour_chart_svg({}, start_hour=7, end_hour=18)
    assert svg.startswith("<svg")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_daily_progress.py -v`
Expected: FAIL — `ImportError: cannot import name 'render_hour_chart_svg'`

- [ ] **Step 3: Write minimal implementation**

```python
# append to photo_scanner/daily_progress.py
def _hour_label(h):
    ampm = "AM" if h < 12 else "PM"
    disp = h % 12 or 12
    return f"{disp}{ampm}"


def render_hour_chart_svg(hour_counts, start_hour, end_hour):
    """Self-contained SVG bar chart. X = hour of day [start_hour, end_hour), Y = photo count."""
    hours = list(range(start_hour, end_hour))
    W, H = 720, 300
    pad_l, pad_b, pad_t = 40, 40, 24
    plot_w = W - pad_l - 16
    plot_h = H - pad_b - pad_t
    n = max(len(hours), 1)
    slot = plot_w / n
    bar_w = slot * 0.62
    max_count = max(hour_counts.values(), default=0) or 1
    accent = "#1f6feb"
    parts = [
        f'<svg viewBox="0 0 {W} {H}" width="100%" xmlns="http://www.w3.org/2000/svg" '
        f'font-family="Segoe UI, system-ui, sans-serif">',
        f'<line x1="{pad_l}" y1="{pad_t + plot_h}" x2="{W - 16}" y2="{pad_t + plot_h}" stroke="#d0d7de"/>',
    ]
    for i, h in enumerate(hours):
        c = hour_counts.get(h, 0)
        bh = (c / max_count) * plot_h
        x = pad_l + i * slot + (slot - bar_w) / 2
        y = pad_t + plot_h - bh
        parts.append(
            f'<rect class="bar" x="{x:.1f}" y="{y:.1f}" width="{bar_w:.1f}" height="{bh:.1f}" '
            f'rx="3" fill="{accent}" opacity="{0.35 + 0.65 * (c / max_count):.2f}"/>'
        )
        if c:
            parts.append(
                f'<text x="{x + bar_w / 2:.1f}" y="{y - 5:.1f}" text-anchor="middle" '
                f'font-size="11" fill="#57606a">{c}</text>'
            )
        parts.append(
            f'<text x="{pad_l + i * slot + slot / 2:.1f}" y="{pad_t + plot_h + 16}" '
            f'text-anchor="middle" font-size="10" fill="#8b949e">{_hour_label(h)}</text>'
        )
    parts.append("</svg>")
    return "\n".join(parts)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_daily_progress.py -v`
Expected: PASS (8 passed)

- [ ] **Step 5: Commit**

```bash
git add photo_scanner/daily_progress.py tests/test_daily_progress.py
git commit -m "feat(photo-scanner): inline SVG per-hour activity chart"
```

---

### Task 5: HTML render (light, print-friendly, painting teaser)

**Files:**
- Modify: `photo_scanner/daily_progress.py`
- Test: `tests/test_daily_progress.py`

- [ ] **Step 1: Write the failing test**

```python
# append to tests/test_daily_progress.py
from photo_scanner.daily_progress import render_report_html


def test_render_report_html_contains_sections():
    ctx = {
        "company_name": "SFW Construction",
        "customer_name": "George Reynolds",
        "address": "538 NW View Ridge St, Camas, WA",
        "date_label": "June 3, 2026",
        "headline": "Window Trim Inspection and Targeted Dry Rot Repairs",
        "summary": "Crew opened affected trim to confirm conditions.",
        "what_we_did": "Opened trim at picture windows.",
        "risk_before": "Dry rot identified at window trim.",
        "risk_after": "Affected areas opened and documented.",
        "chart_svg": "<svg>stub</svg>",
        "stats": {"total": 59, "span_label": "7:00 AM – 5:00 PM", "span_hours": 10,
                  "active_hours": 9, "first_time": "7:00 AM", "last_time": "5:00 PM",
                  "phase_counts": {"before": 5, "during": 30, "after": 4}},
        "images": [{"data_uri": "data:image/jpeg;base64,AAAA", "phase": "during"}],
    }
    html = render_report_html(ctx)
    assert "<!DOCTYPE html>" in html
    assert "George Reynolds" in html
    assert "<svg>stub</svg>" in html
    assert "data:image/jpeg;base64,AAAA" in html
    assert "pumpjacks" in html  # subtle painting teaser present
    assert "59" in html
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_daily_progress.py -v`
Expected: FAIL — `ImportError: cannot import name 'render_report_html'`

- [ ] **Step 3: Write minimal implementation**

```python
# append to photo_scanner/daily_progress.py
from jinja2 import Template

_REPORT_TEMPLATE = Template("""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{ customer_name }} — Daily Progress Report</title>
<style>
  :root { --ink:#1b2733; --muted:#5b6b7b; --line:#e3e8ee; --accent:#1f6feb; --bg:#f6f8fa; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Segoe UI', system-ui, sans-serif; color:var(--ink); background:var(--bg);
         line-height:1.55; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .sheet { max-width:880px; margin:0 auto; background:#fff; }
  .topbar { background:var(--ink); color:#fff; padding:22px 36px; display:flex;
            justify-content:space-between; align-items:baseline; }
  .topbar .co { font-size:20px; font-weight:700; letter-spacing:.02em; }
  .topbar .kind { font-size:12px; text-transform:uppercase; letter-spacing:.12em; color:#9fb3c8; }
  .meta { padding:20px 36px; border-bottom:1px solid var(--line); }
  .meta .cust { font-size:22px; font-weight:700; }
  .meta .sub { font-size:13px; color:var(--muted); margin-top:2px; }
  section { padding:24px 36px; border-bottom:1px solid var(--line); }
  h2 { font-size:13px; text-transform:uppercase; letter-spacing:.1em; color:var(--accent);
       margin-bottom:12px; }
  .headline { font-size:19px; font-weight:700; margin-bottom:8px; }
  p.body { font-size:14.5px; color:#33414f; margin-bottom:10px; }
  .stats { display:flex; gap:14px; flex-wrap:wrap; margin-bottom:18px; }
  .stat { background:var(--bg); border:1px solid var(--line); border-radius:10px;
          padding:12px 16px; min-width:120px; }
  .stat .v { font-size:24px; font-weight:700; font-variant-numeric:tabular-nums; }
  .stat .l { font-size:10px; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); }
  .ba { display:flex; gap:18px; flex-wrap:wrap; }
  .ba .col { flex:1; min-width:240px; }
  .ba .col h3 { font-size:12px; text-transform:uppercase; letter-spacing:.06em; color:var(--muted);
                margin-bottom:4px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:10px; }
  .grid figure { border:1px solid var(--line); border-radius:10px; overflow:hidden; background:#000; }
  .grid img { width:100%; height:160px; object-fit:cover; display:block; }
  .grid figcaption { font-size:10px; text-transform:uppercase; letter-spacing:.05em;
                     color:var(--muted); padding:5px 8px; background:#fff; }
  .teaser { background:#eef4ff; border:1px solid #cfe0ff; border-radius:12px; padding:18px 20px; }
  .teaser h2 { color:var(--accent); }
  .teaser p { font-size:14px; color:#2b3b52; }
  footer { padding:18px 36px; font-size:11px; color:var(--muted); }
  @media print { body { background:#fff; } .sheet { max-width:none; } section { break-inside:avoid; } }
</style></head>
<body><div class="sheet">
  <div class="topbar"><div class="co">{{ company_name }}</div>
    <div class="kind">Daily Progress Report</div></div>
  <div class="meta"><div class="cust">{{ customer_name }}</div>
    <div class="sub">{{ address }} &nbsp;·&nbsp; {{ date_label }}</div></div>

  <section>
    <div class="headline">{{ headline }}</div>
    <p class="body">{{ summary }}</p>
  </section>

  <section>
    <h2>Crew Activity Through the Day</h2>
    <div class="stats">
      <div class="stat"><div class="v">{{ stats.total }}</div><div class="l">Photos documented</div></div>
      <div class="stat"><div class="v">{{ stats.span_hours }} hrs</div><div class="l">On-site span</div></div>
      <div class="stat"><div class="v">{{ stats.active_hours }}</div><div class="l">Active hours</div></div>
      <div class="stat"><div class="v">{{ stats.span_label }}</div><div class="l">First → last photo</div></div>
    </div>
    {{ chart_svg }}
  </section>

  <section>
    <h2>What We Did Today</h2>
    <p class="body">{{ what_we_did }}</p>
    <div class="ba">
      <div class="col"><h3>Condition Before</h3><p class="body">{{ risk_before }}</p></div>
      <div class="col"><h3>Condition After Today</h3><p class="body">{{ risk_after }}</p></div>
    </div>
  </section>

  <section>
    <h2>Documented Work</h2>
    <div class="grid">
      {% for img in images %}
      <figure><img src="{{ img.data_uri }}" alt="job photo"/>
        {% if img.phase %}<figcaption>{{ img.phase }}</figcaption>{% endif %}</figure>
      {% endfor %}
    </div>
  </section>

  <section>
    <div class="teaser">
      <h2>While We're On Site</h2>
      <p>Our crew is already set up on your home with pumpjacks staging the upper elevations.
         That puts us in a strong position to handle exterior painting and finishing on these
         same walls while access is in place. If refreshing and protecting the exterior is
         something you're considering, we'd be glad to talk it through — no obligation.</p>
    </div>
  </section>

  <footer>{{ company_name }} · Prepared {{ date_label }}. Photo timestamps reflect on-site
    documentation. This report describes work performed and conditions observed to date.</footer>
</div></body></html>""")


def render_report_html(ctx):
    return _REPORT_TEMPLATE.render(**ctx)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_daily_progress.py -v`
Expected: PASS (10 passed)

- [ ] **Step 5: Commit**

```bash
git add photo_scanner/daily_progress.py tests/test_daily_progress.py
git commit -m "feat(photo-scanner): light print-friendly report HTML render"
```

---

### Task 6: Async orchestrator + main()

**Files:**
- Modify: `photo_scanner/daily_progress.py`

This task wires the helpers to live data. It calls CompanyCam + Anthropic, so it is verified by the end-to-end run in Task 7, not a unit test.

- [ ] **Step 1: Add imports and the orchestrator**

```python
# add near the top imports of photo_scanner/daily_progress.py
import asyncio
import io
import sys
from pathlib import Path

from PIL import Image

from photo_scanner.catalog import Catalog
from photo_scanner.companycam import CompanyCamClient
from photo_scanner.scanner import (
    analyze_project_from_catalog,
    get_async_anthropic_client,
    image_to_b64,
    log,
)
from photo_scanner.reports import generate_daily_report
```

```python
# append to photo_scanner/daily_progress.py
async def build_report(project_id, date_str, out_path):
    tz = get_pacific_tz()
    catalog = Catalog()
    client = get_async_anthropic_client()
    if client is None:
        raise SystemExit("No ANTHROPIC_API_KEY in .env — cannot analyze or write narrative.")
    cc = CompanyCamClient()
    try:
        # 1. Analyze the whole project if any photos are still unanalyzed (idempotent).
        if catalog.get_unanalyzed_photos(project_id):
            log("[daily_progress] Analyzing project photos…")
            await analyze_project_from_catalog(
                catalog, project_id, cc, client,
                on_progress=lambda d: log("  " + str(d.get("message", ""))),
            )

        ts_start, ts_end = pacific_day_bounds(date_str, tz)

        # 2. ALL photos that day (fact-only chart + stats) — direct query, not scene-filtered.
        rows = [dict(r) for r in catalog.db.execute(
            "SELECT taken_at, phase FROM photos WHERE project_id=? "
            "AND CAST(taken_at AS INTEGER)>=? AND CAST(taken_at AS INTEGER)<?",
            (project_id, ts_start, ts_end),
        ).fetchall()]
        if not rows:
            raise SystemExit(f"No photos found for {project_id} on {date_str}.")
        timestamps = [r["taken_at"] for r in rows]
        phases = [r["phase"] for r in rows if r["phase"]]
        hour_counts = bucket_photos_by_hour(timestamps, tz)
        stats = compute_thoroughness_stats(timestamps, phases, tz)
        lo = min(min(hour_counts), 7)
        hi = max(max(hour_counts) + 1, 18)
        chart_svg = render_hour_chart_svg(hour_counts, lo, hi)

        # 3. Analyzed picks → grid → base64 thumbnails.
        analyzed = catalog.get_photos_for_date(project_id, ts_start, ts_end)
        grid = select_grid_photos(analyzed, GRID_MAX)
        images = []
        for p in grid:
            try:
                raw = await cc.get_photo_bytes(p["uri"])
                b64, mt = image_to_b64(Image.open(io.BytesIO(raw)), max_dim=900)
                images.append({"data_uri": f"data:{mt};base64,{b64}", "phase": p.get("phase")})
            except Exception as e:
                log(f"[daily_progress] image fetch failed {p.get('id')}: {e}")

        # 4. Grounded narrative (existing generator; restricted to analyzed data + scope).
        report = await generate_daily_report(catalog, project_id, ts_start, ts_end, client) or {}

        # 5. Render + write.
        d = datetime.strptime(date_str, "%Y-%m-%d").date()
        ctx = {
            "company_name": COMPANY_NAME,
            "customer_name": CUSTOMER_NAME,
            "address": ADDRESS,
            "date_label": d.strftime("%B %-d, %Y").replace(" 0", " ") if sys.platform != "win32"
                          else f"{d.strftime('%B')} {d.day}, {d.year}",
            "headline": report.get("headline", "Daily Progress Update"),
            "summary": report.get("value_statement", ""),
            "what_we_did": report.get("what_we_did", ""),
            "risk_before": report.get("risk_before", ""),
            "risk_after": report.get("risk_after", ""),
            "chart_svg": chart_svg,
            "stats": stats,
            "images": images,
        }
        html = render_report_html(ctx)
        Path(out_path).write_text(html, encoding="utf-8")
        log(f"[daily_progress] Wrote {out_path} ({len(images)} photos embedded)")
    finally:
        await cc.close()
    return out_path


def main():
    project_id = sys.argv[1] if len(sys.argv) > 1 else PROJECT_ID
    date_str = sys.argv[2] if len(sys.argv) > 2 else REPORT_DATE
    out_path = f"reynolds_progress_{date_str}.html"
    path = asyncio.run(build_report(project_id, date_str, out_path))
    import webbrowser
    webbrowser.open(Path(path).resolve().as_uri())


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Verify the module imports cleanly (no syntax/import errors)**

Run: `python -c "import photo_scanner.daily_progress"`
Expected: no output, exit 0.

- [ ] **Step 3: Re-run the unit suite to confirm no regressions**

Run: `python -m pytest tests/test_daily_progress.py -v`
Expected: PASS (10 passed)

- [ ] **Step 4: Commit**

```bash
git add photo_scanner/daily_progress.py
git commit -m "feat(photo-scanner): daily_progress orchestrator + CLI entrypoint"
```

---

### Task 7: End-to-end run + verification (live APIs — costs tokens)

**Files:** none (runs the tool).

This runs the real analysis pass (~10 triage grid calls + ~30–50 deep calls on Sonnet for 82 photos) and fetches photos from CompanyCam. One-time; re-runs are cached.

- [ ] **Step 1: Generate the report**

Run: `python -m photo_scanner.daily_progress`
Expected: progress logs for triage + deep analysis, then `Wrote reynolds_progress_2026-06-03.html (N photos embedded)` with N between 12 and 16, and the file opens in the browser.

- [ ] **Step 2: Verify the chart data matches reality**

Run:
```bash
python -c "import sqlite3,collections,datetime,zoneinfo; \
c=sqlite3.connect('catalog.db'); \
rows=c.execute(\"SELECT taken_at FROM photos WHERE project_id='106749565'\").fetchall(); \
tz=zoneinfo.ZoneInfo('America/Los_Angeles'); \
b=collections.Counter(datetime.datetime.fromtimestamp(int(t[0]),tz).strftime('%Y-%m-%d') for t in rows); \
print(dict(b))"
```
Expected: `{'2026-06-04': 12, '2026-06-03': 59, '2026-06-02': 11}` — confirms the report's 06-03 total (59) is correct.

- [ ] **Step 3: Visually verify the rendered HTML**

Open `reynolds_progress_2026-06-03.html` and confirm:
- The per-hour SVG bar chart renders with a morning-heavy shape and an afternoon burst.
- Stat row shows 59 photos, an on-site span, and active hours.
- 12–16 photos load (base64 — they appear even offline).
- Narrative contains **no** completion language ("all … repaired/remediated/fixed") and **no** severity adjectives (major/severe/significant/extensive/critical). If any appear, that is a prompt-grounding failure — note it; do not hand-edit the narrative into a false claim.
- The painting teaser reads as a soft, no-obligation note.

- [ ] **Step 4: Report the result**

Summarize to the user: output path, photo count embedded, the day's total, and confirmation the narrative stayed grounded. Do not commit the generated `.html` (it is a deliverable artifact, not source).

---

## Self-Review

**Spec coverage:**
- Self-contained HTML, base64 images → Task 5 template + Task 6 embedding. ✓
- Photos-per-hour chart (Pacific, DST-aware w/ fallback) → Tasks 1, 2, 4, 6. ✓
- Thoroughness stats from facts only → Task 2. ✓
- AI analysis first, whole project → Task 6 `analyze_project_from_catalog`. ✓
- Grounded narrative, anti-hallucination → Task 6 `generate_daily_report` (existing guarded prompts) + Task 7 verification. ✓
- Generous grid (~12–16) → Task 3 (`GRID_MAX=16`) + Task 6. ✓
- Subtle painting teaser → Task 5 template copy. ✓
- 06-03 scope while analyzing all 82 → Task 6 day-bounds filter for chart/grid/narrative. ✓
- Light, print-friendly, customer-facing design → Task 5. ✓

**Placeholder scan:** No TBD/TODO; all code blocks complete; teaser copy is final. ✓

**Type consistency:** `bucket_photos_by_hour`, `compute_thoroughness_stats`, `select_grid_photos`, `render_hour_chart_svg`, `render_report_html`, `pacific_day_bounds`, `fmt_time`, `get_pacific_tz` referenced with identical names/signatures across tasks. `stats` dict keys (`total`, `span_hours`, `active_hours`, `span_label`, `phase_counts`, `first_time`, `last_time`) match between Task 2 producer, Task 5 template, and Task 6 context. ✓

**Note on `%-d`:** Windows `strftime` lacks `%-d`; Task 6 builds `date_label` without it on win32, and `fmt_time` (Task 1) avoids `%-I`. ✓

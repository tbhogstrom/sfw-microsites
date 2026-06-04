"""One-off daily progress report: photos-per-hour chart + grounded narrative.

Usage:
    python -m photo_scanner.daily_progress            # Reynolds 06-03-2026 defaults
    python -m photo_scanner.daily_progress <project_id> <YYYY-MM-DD>
"""
from collections import Counter
from datetime import datetime, time, timedelta, timezone

from jinja2 import Environment

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


def bucket_photos_by_hour(timestamps, tz):
    """{hour_of_day: count} from unix-timestamp strings/ints, in local tz."""
    counts = {}
    for ts in timestamps:
        h = datetime.fromtimestamp(int(ts), tz).hour
        counts[h] = counts.get(h, 0) + 1
    return counts


def compute_thoroughness_stats(timestamps, phases, tz):
    """Pure, fact-only stats for the day. No AI."""
    if not timestamps:
        return {"total": 0, "first_time": None, "last_time": None,
                "span_label": "—", "span_hours": 0, "active_hours": 0, "phase_counts": {}}
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


_env = Environment(autoescape=True)
_REPORT_TEMPLATE = _env.from_string("""<!DOCTYPE html>
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
    {{ chart_svg | safe }}
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
      <figure><img src="{{ img.data_uri | safe }}" alt="job photo"/>
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

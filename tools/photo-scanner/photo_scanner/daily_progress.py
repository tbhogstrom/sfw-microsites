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

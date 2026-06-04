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

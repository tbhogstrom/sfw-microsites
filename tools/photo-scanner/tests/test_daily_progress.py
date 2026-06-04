from datetime import datetime
from photo_scanner.daily_progress import get_pacific_tz, pacific_day_bounds, fmt_time


def test_pacific_day_bounds_june_is_pdt():
    tz = get_pacific_tz()
    start, end = pacific_day_bounds("2026-06-03", tz)
    # 06-03 00:00 PDT == 06-03 07:00 UTC
    from datetime import timezone
    assert datetime.fromtimestamp(start, tz=timezone.utc).strftime("%Y-%m-%d %H:%M") == "2026-06-03 07:00"
    assert end - start == 24 * 3600


def test_fmt_time_strips_leading_zero():
    tz = get_pacific_tz()
    dt = datetime.fromtimestamp(pacific_day_bounds("2026-06-03", tz)[0] + 8 * 3600, tz)
    assert fmt_time(dt) == "8:00 AM"


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


def test_compute_thoroughness_stats_empty():
    stats = compute_thoroughness_stats([], [], get_pacific_tz())
    assert stats["total"] == 0
    assert stats["active_hours"] == 0
    assert stats["phase_counts"] == {}


from photo_scanner.daily_progress import select_grid_photos


def _photo(pid, phase, score):
    return {"id": pid, "phase": phase, "marketing_score": score, "uri": f"u{pid}"}


def test_select_grid_returns_all_when_under_cap():
    photos = [_photo(i, "during", 3) for i in range(5)]
    assert len(select_grid_photos(photos, max_n=16)) == 5


def test_select_grid_caps_and_diversifies_phases():
    photos = [_photo(f"d{i}", "during", 5) for i in range(20)]
    photos += [_photo("b1", "before", 1), _photo("b2", "before", 1)]
    photos += [_photo("a1", "after", 1), _photo("a2", "after", 1)]
    picked = select_grid_photos(photos, max_n=16)
    assert len(picked) == 16
    phases = {p["phase"] for p in picked}
    assert "before" in phases and "after" in phases


from photo_scanner.daily_progress import render_hour_chart_svg


def test_render_hour_chart_svg_smoke():
    svg = render_hour_chart_svg({8: 37, 15: 15, 11: 9}, start_hour=7, end_hour=18)
    assert svg.startswith("<svg")
    assert svg.rstrip().endswith("</svg>")
    assert svg.count('class="bar"') == 11
    assert ">37<" in svg


def test_render_hour_chart_svg_handles_empty():
    svg = render_hour_chart_svg({}, start_hour=7, end_hour=18)
    assert svg.startswith("<svg")


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
    assert "pumpjacks" in html
    assert "59" in html

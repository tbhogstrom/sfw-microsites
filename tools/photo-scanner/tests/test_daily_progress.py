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

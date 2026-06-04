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

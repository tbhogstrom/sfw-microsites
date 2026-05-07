"""Video Store — Friday shoot-planning tool.

Given a video script document and the catalog, produce a ranked HTML shoot plan
for next Monday: which active CompanyCam projects within N miles of Portland are
likely to have the right work happening + visible conditions to film the shots.

See docs/superpowers/specs/2026-05-07-video-store-design.md.
"""
from __future__ import annotations

import math

from photo_scanner.catalog import Catalog

# Portland centroid (downtown)
PORTLAND_LAT = 45.5152
PORTLAND_LNG = -122.6784

# A project is "active" if it has a photo within this many days
DEFAULT_ACTIVE_WINDOW_DAYS = 30


# ==== Section: Distance + activity filter ====


def haversine_miles(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in miles between two lat/lng points."""
    r_miles = 3958.7613
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * r_miles * math.asin(math.sqrt(a))


def filter_candidate_projects(
    catalog: Catalog,
    *,
    max_distance_miles: float = 20,
    now_ts: int,
    active_window_days: int = DEFAULT_ACTIVE_WINDOW_DAYS,
) -> list[dict]:
    """Return projects within `max_distance_miles` of Portland that have at least
    one photo taken within `active_window_days`. Each result has a `distance_miles`
    field added. Sorted by distance ascending.
    """
    cutoff = now_ts - active_window_days * 86400
    rows = catalog.db.execute(
        """
        SELECT p.*
        FROM projects p
        WHERE p.lat != 0 AND p.lng != 0
          AND EXISTS (
              SELECT 1 FROM photos ph
              WHERE ph.project_id = p.id
                AND CAST(ph.taken_at AS INTEGER) >= ?
          )
        """,
        (cutoff,),
    ).fetchall()

    results = []
    for row in rows:
        project = dict(row)
        d = haversine_miles(PORTLAND_LAT, PORTLAND_LNG, project["lat"], project["lng"])
        if d <= max_distance_miles:
            project["distance_miles"] = round(d, 2)
            results.append(project)

    results.sort(key=lambda p: p["distance_miles"])
    return results

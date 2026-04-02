import pytest
from pathlib import Path
from editorial_crew.parser import ClusterMeta, parse_cluster_file, find_pending_subtopics, has_stub_hero, has_stub_faq


SAMPLE_CLUSTER_MD = """\
# Exterior Trim Rot Repair & Replacement - Portland, Oregon

<!-- CLUSTER_META
service: trim-repair
cluster_id: 1
cluster_slug: exterior-trim-rot-repair-replacement
location: portland
status: stub
subtopics:
  - Exterior Trim Rot Repair
  - Exterior Trim Replacement
  - Rotted Wood Trim Replacement
-->

## Hero Section

### [STUB] Exterior Trim Rot Repair & Replacement in Portland, Oregon
*Content to be generated.*

## Exterior Trim Rot Repair
*Content to be generated.*

## Exterior Trim Replacement
Already has real content here about trim replacement.

## Rotted Wood Trim Replacement
*Content to be generated.*

## FAQ Section
*Content to be generated.*

## References

| # | Source | Page | Note |
|---|--------|------|------|

## Page Metadata

**Service:** Exterior Trim Rot Repair & Replacement
**Location:** Portland, Oregon
**Status:** STUB
**Cluster ID:** 1
**Target Keywords:** [to be filled]
"""

SAMPLE_COMPLETE_MD = """\
# Window & Door Trim Repair - Seattle, Washington

<!-- CLUSTER_META
service: trim-repair
cluster_id: 2
cluster_slug: window-door-trim-repair
location: seattle
status: draft
subtopics:
  - Window Trim Repair
  - Door Trim Repair
-->

## Hero Section

### Expert Window & Door Trim Repair in Seattle
Your home deserves the best trim repair in the Pacific Northwest.

## Window Trim Repair
Real content about window trim repair with citations<sup>1</sup>.

## Door Trim Repair
Real content about door trim repair with citations<sup>2</sup>.

## FAQ Section

### How long does trim repair take?
Most trim repairs are completed in one day.

## References

| # | Source | Page | Note |
|---|--------|------|------|
| 1 | Renovation | p. 168 | Trim materials |
| 2 | Siding & Trim | p. 197 | Repair methods |
"""


def test_parse_cluster_file_extracts_meta(tmp_path: Path):
    f = tmp_path / "cluster.md"
    f.write_text(SAMPLE_CLUSTER_MD, encoding="utf-8")
    meta = parse_cluster_file(f)
    assert meta is not None
    assert meta.service == "trim-repair"
    assert meta.cluster_id == 1
    assert meta.cluster_slug == "exterior-trim-rot-repair-replacement"
    assert meta.location == "portland"
    assert meta.status == "stub"
    assert meta.subtopics == [
        "Exterior Trim Rot Repair",
        "Exterior Trim Replacement",
        "Rotted Wood Trim Replacement",
    ]


def test_parse_cluster_file_returns_none_for_non_cluster(tmp_path: Path):
    f = tmp_path / "regular.md"
    f.write_text("# Just a regular markdown file\n\nNo cluster meta here.", encoding="utf-8")
    assert parse_cluster_file(f) is None


def test_find_pending_subtopics():
    subtopics = [
        "Exterior Trim Rot Repair",
        "Exterior Trim Replacement",
        "Rotted Wood Trim Replacement",
    ]
    pending = find_pending_subtopics(SAMPLE_CLUSTER_MD, subtopics)
    assert pending == ["Exterior Trim Rot Repair", "Rotted Wood Trim Replacement"]
    assert "Exterior Trim Replacement" not in pending


def test_find_pending_subtopics_none_pending():
    subtopics = ["Window Trim Repair", "Door Trim Repair"]
    pending = find_pending_subtopics(SAMPLE_COMPLETE_MD, subtopics)
    assert pending == []


def test_has_stub_hero():
    assert has_stub_hero(SAMPLE_CLUSTER_MD) is True
    assert has_stub_hero(SAMPLE_COMPLETE_MD) is False


def test_has_stub_faq():
    assert has_stub_faq(SAMPLE_CLUSTER_MD) is True
    assert has_stub_faq(SAMPLE_COMPLETE_MD) is False

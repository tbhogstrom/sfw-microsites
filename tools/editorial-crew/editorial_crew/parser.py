from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class ClusterMeta:
    """Parsed CLUSTER_META from a cluster service page markdown file."""
    service: str
    cluster_id: int
    cluster_slug: str
    location: str
    status: str
    subtopics: list[str] = field(default_factory=list)


def parse_cluster_file(path: Path) -> ClusterMeta | None:
    """Parse a cluster markdown file and extract CLUSTER_META.

    Returns None if the file does not contain a CLUSTER_META block.
    """
    text = path.read_text(encoding="utf-8").replace("\r\n", "\n")
    meta_match = re.search(r"<!--\s*CLUSTER_META([\s\S]*?)-->", text)
    if not meta_match:
        return None

    fields: dict[str, str] = {}
    subtopics: list[str] = []
    in_subtopics = False

    for line in meta_match.group(1).split("\n"):
        stripped = line.strip()
        if stripped.startswith("subtopics:"):
            in_subtopics = True
            continue
        if in_subtopics:
            if stripped.startswith("- "):
                subtopics.append(stripped[2:].strip())
            elif stripped and not stripped.startswith("-"):
                in_subtopics = False
            else:
                continue
        if ":" in stripped and not in_subtopics:
            key, value = stripped.split(":", 1)
            fields[key.strip()] = value.strip()

    try:
        cluster_id = int(fields.get("cluster_id", "0"))
    except ValueError:
        cluster_id = 0

    return ClusterMeta(
        service=fields.get("service", ""),
        cluster_id=cluster_id,
        cluster_slug=fields.get("cluster_slug", ""),
        location=fields.get("location", ""),
        status=fields.get("status", "stub"),
        subtopics=subtopics,
    )


def find_pending_subtopics(text: str, subtopics: list[str]) -> list[str]:
    """Return subtopics that still have stub placeholder content."""
    text = text.replace("\r\n", "\n")
    return [
        t for t in subtopics
        if f"## {t}\n*Content to be generated.*" in text
    ]


def has_stub_hero(text: str) -> bool:
    """Check if the hero section is still a stub."""
    text = text.replace("\r\n", "\n")
    return bool(re.search(r"## Hero Section\n[\s\S]*?\[STUB\]", text))


def has_stub_faq(text: str) -> bool:
    """Check if the FAQ section is still a stub."""
    text = text.replace("\r\n", "\n")
    return "## FAQ Section\n*Content to be generated.*" in text

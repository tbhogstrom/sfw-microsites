from __future__ import annotations

import difflib


def generate_diff(
    original: str,
    improved: str,
    filename: str = "document.md",
    context_lines: int = 3,
) -> str:
    """Generate a unified diff between original and improved text.

    Returns an empty string if there are no differences.
    """
    original_lines = original.splitlines(keepends=True)
    improved_lines = improved.splitlines(keepends=True)

    diff = difflib.unified_diff(
        original_lines,
        improved_lines,
        fromfile=f"{filename} (original)",
        tofile=f"{filename} (improved)",
        n=context_lines,
    )

    return "".join(diff)

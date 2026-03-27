from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class Suggestion(BaseModel):
    """A single editorial suggestion tied to a line in the original document."""

    line: int | None
    type: str
    original: str
    suggested: str
    reason: str


class EditorialFeedback(BaseModel):
    """Structured feedback from a specialist agent."""

    agent: str
    status: Literal["completed", "skipped"]
    suggestions: list[Suggestion]
    improved_document: str

    @property
    def suggestion_count(self) -> int:
        return len(self.suggestions)

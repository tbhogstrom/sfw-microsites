from editorial_crew.models import Suggestion, EditorialFeedback


def test_suggestion_with_line():
    s = Suggestion(line=5, type="grammar", original="teh", suggested="the", reason="Typo")
    assert s.line == 5
    assert s.type == "grammar"


def test_suggestion_without_line():
    s = Suggestion(line=None, type="clarity", original="x", suggested="y", reason="z")
    assert s.line is None


def test_editorial_feedback_suggestion_count():
    fb = EditorialFeedback(
        agent="grammar_agent",
        status="completed",
        suggestions=[
            Suggestion(line=1, type="grammar", original="a", suggested="b", reason="c"),
            Suggestion(line=2, type="grammar", original="d", suggested="e", reason="f"),
        ],
        improved_document="# Fixed doc",
    )
    assert fb.suggestion_count == 2


def test_editorial_feedback_skipped():
    fb = EditorialFeedback(
        agent="technical_agent",
        status="skipped",
        suggestions=[],
        improved_document="# Same doc",
    )
    assert fb.suggestion_count == 0
    assert fb.status == "skipped"


def test_editorial_feedback_invalid_status():
    import pytest
    with pytest.raises(Exception):
        EditorialFeedback(
            agent="x",
            status="invalid",
            suggestions=[],
            improved_document="x",
        )

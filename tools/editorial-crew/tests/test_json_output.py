import json

from editorial_crew.__main__ import format_json_result


def test_format_json_improved():
    result = format_json_result(
        filepath="apps/siding-repair/content.md",
        status="improved",
        specialists=["grammar", "seo"],
        diff="--- a\n+++ b\n@@ -1 +1 @@\n-old\n+new",
        improved_document="# New content",
        summary="Fixed grammar and SEO issues.",
    )
    parsed = json.loads(result)
    assert parsed["file"] == "apps/siding-repair/content.md"
    assert parsed["status"] == "improved"
    assert parsed["specialists_consulted"] == ["grammar", "seo"]
    assert parsed["diff"] == "--- a\n+++ b\n@@ -1 +1 @@\n-old\n+new"
    assert parsed["improved_document"] == "# New content"
    assert parsed["summary"] == "Fixed grammar and SEO issues."


def test_format_json_no_changes():
    result = format_json_result(
        filepath="readme.md",
        status="no_changes",
        specialists=["grammar"],
    )
    parsed = json.loads(result)
    assert parsed["file"] == "readme.md"
    assert parsed["status"] == "no_changes"
    assert parsed["specialists_consulted"] == ["grammar"]
    assert "diff" not in parsed
    assert "improved_document" not in parsed


def test_format_json_error():
    result = format_json_result(
        filepath="missing.md",
        status="error",
        error="File not found",
    )
    parsed = json.loads(result)
    assert parsed["file"] == "missing.md"
    assert parsed["status"] == "error"
    assert parsed["error"] == "File not found"
    assert "specialists_consulted" not in parsed


def test_format_json_is_valid_json():
    result = format_json_result(
        filepath="test.md",
        status="improved",
        specialists=["grammar"],
        diff="some diff",
        improved_document="# Content with \"quotes\" and\nnewlines",
        summary="Fixed things.",
    )
    parsed = json.loads(result)
    assert parsed["improved_document"] == "# Content with \"quotes\" and\nnewlines"

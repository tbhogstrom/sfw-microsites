from editorial_crew.diff import generate_diff


def test_generate_diff_with_changes():
    original = "# My Poject\n\nSome text here.\n"
    improved = "# My Project\n\nSome text here.\n"
    result = generate_diff(original, improved, filename="readme.md")
    assert "--- readme.md (original)" in result
    assert "+++ readme.md (improved)" in result
    assert "-# My Poject" in result
    assert "+# My Project" in result


def test_generate_diff_no_changes():
    text = "# Perfect\n\nNo changes needed.\n"
    result = generate_diff(text, text, filename="readme.md")
    assert result == ""


def test_generate_diff_context_lines():
    original = "line1\nline2\nline3\nline4\nline5\n"
    improved = "line1\nline2\nLINE3\nline4\nline5\n"
    result = generate_diff(original, improved, filename="test.md", context_lines=1)
    assert "line1" not in result
    assert "line2" in result
    assert "-line3" in result
    assert "+LINE3" in result

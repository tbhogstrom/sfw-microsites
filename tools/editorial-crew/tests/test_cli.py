from editorial_crew.__main__ import parse_args


def test_parse_args_single_file():
    args = parse_args(["readme.md"])
    assert args.files == ["readme.md"]
    assert args.agents is None
    assert args.output is None


def test_parse_args_with_agents():
    args = parse_args(["readme.md", "--agents", "grammar,structure"])
    assert args.agents == ["grammar", "structure"]


def test_parse_args_with_output():
    args = parse_args(["readme.md", "--output", "out.patch"])
    assert args.output == "out.patch"


def test_parse_args_model():
    args = parse_args(["readme.md", "--model", "anthropic/claude-haiku-3-5"])
    assert args.model == "anthropic/claude-haiku-3-5"

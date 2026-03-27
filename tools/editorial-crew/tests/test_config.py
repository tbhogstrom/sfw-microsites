from pathlib import Path
from editorial_crew.config import load_config, Config


def test_load_default_config():
    config = load_config()
    assert config.model_default == "anthropic/claude-sonnet-4-20250514"
    assert config.diff_context_lines == 3


def test_load_config_with_override(tmp_path: Path):
    toml_file = tmp_path / "config.toml"
    toml_file.write_text('[model]\ndefault = "anthropic/claude-haiku-3-5"\n\n[output]\ndiff_context_lines = 5\n')
    config = load_config(config_path=toml_file)
    assert config.model_default == "anthropic/claude-haiku-3-5"
    assert config.diff_context_lines == 5


def test_config_agent_model_override(tmp_path: Path):
    toml_file = tmp_path / "config.toml"
    toml_file.write_text('[model]\ndefault = "anthropic/claude-sonnet-4-20250514"\n\n[agents]\ngrammar = "anthropic/claude-haiku-3-5"\n\n[output]\ndiff_context_lines = 3\n')
    config = load_config(config_path=toml_file)
    assert config.get_agent_model("grammar") == "anthropic/claude-haiku-3-5"
    assert config.get_agent_model("structure") == "anthropic/claude-sonnet-4-20250514"

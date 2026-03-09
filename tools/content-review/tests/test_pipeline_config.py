import pytest
from pathlib import Path
from pipeline_config import PipelineConfig, load_pipeline_config

FIXTURES = Path(__file__).parent / "fixtures"


def test_load_pipeline_config_parses_frontmatter():
    config = load_pipeline_config(FIXTURES / "sample-pipeline.md")
    assert config.agent_ids == ["test-agent"]
    assert config.brand_name == "SFW Construction"
    assert "Portland" in config.locations


def test_load_pipeline_config_parses_body():
    config = load_pipeline_config(FIXTURES / "sample-pipeline.md")
    assert "SFW Construction" in config.shared_context
    assert "professional" in config.shared_context


def test_pipeline_config_builds_context_string():
    config = load_pipeline_config(FIXTURES / "sample-pipeline.md")
    ctx = config.build_context_string()
    assert "SFW Construction" in ctx
    assert "Portland" in ctx


def test_load_pipeline_config_raises_for_missing_file(tmp_path):
    with pytest.raises(FileNotFoundError):
        load_pipeline_config(tmp_path / "nonexistent.md")


def test_load_pipeline_config_raises_for_missing_fields(tmp_path):
    bad = tmp_path / "bad-pipeline.md"
    bad.write_text("---\nbrand_name: Test\n---\n\nBody.")  # missing agent_ids and locations
    with pytest.raises(ValueError):
        load_pipeline_config(bad)


def test_load_pipeline_config_raises_for_type_mismatch(tmp_path):
    bad = tmp_path / "bad-types.md"
    bad.write_text(
        "---\nagent_ids: test-agent\nbrand_name: Test\nlocations: Portland\n---\n\nBody."
    )
    with pytest.raises(ValueError):
        load_pipeline_config(bad)


def test_load_pipeline_config_raises_for_empty_agent_ids(tmp_path):
    bad = tmp_path / "empty-agents.md"
    bad.write_text(
        "---\nagent_ids: []\nbrand_name: Test\nlocations:\n  - Portland\n---\n\nBody."
    )
    with pytest.raises(ValueError):
        load_pipeline_config(bad)


def test_pipeline_config_includes_bryan():
    config = load_pipeline_config(Path("pipeline.md"))
    assert "bryan" in config.agent_ids
    idx_bryan = config.agent_ids.index("bryan")
    idx_language = config.agent_ids.index("language-editor")
    assert idx_bryan < idx_language

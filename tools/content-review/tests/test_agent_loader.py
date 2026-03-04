import pytest
from pathlib import Path
from agent_loader import AgentConfig, load_agent, load_agents_from_dir

FIXTURES = Path(__file__).parent / "fixtures"


def test_load_agent_parses_frontmatter():
    agent = load_agent(FIXTURES / "sample-agent.md")
    assert agent.id == "test-agent"
    assert agent.name == "Test Agent"
    assert agent.order == 1
    assert agent.model == "gpt-4o-mini"
    assert agent.temperature == 0.2


def test_load_agent_parses_body():
    agent = load_agent(FIXTURES / "sample-agent.md")
    assert "## Role" in agent.system_prompt
    assert "## Tasks" in agent.system_prompt
    assert "## Rules" in agent.system_prompt


def test_load_agents_from_dir_orders_by_order_field(tmp_path):
    # Write two agent files with different order values
    (tmp_path / "02-second.md").write_text(
        "---\nid: second\nname: Second\norder: 2\nmodel: gpt-4o-mini\ntemperature: 0.2\n"
        "input_format: markdown\noutput_format: markdown\n---\n\nBody."
    )
    (tmp_path / "01-first.md").write_text(
        "---\nid: first\nname: First\norder: 1\nmodel: gpt-4o-mini\ntemperature: 0.2\n"
        "input_format: markdown\noutput_format: markdown\n---\n\nBody."
    )
    agents = load_agents_from_dir(tmp_path)
    assert agents[0].id == "first"
    assert agents[1].id == "second"


def test_load_agent_raises_on_missing_field(tmp_path):
    bad = tmp_path / "bad.md"
    bad.write_text("---\nid: x\n---\n\nBody.")  # missing name, order, model, etc.
    with pytest.raises((KeyError, ValueError)):
        load_agent(bad)


def test_load_agents_from_dir_raises_for_nonexistent_dir(tmp_path):
    missing = tmp_path / "does-not-exist"
    with pytest.raises(FileNotFoundError):
        load_agents_from_dir(missing)

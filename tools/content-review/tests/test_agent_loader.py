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


def test_load_agent_injects_voice_file(tmp_path):
    voice = tmp_path / "voice.md"
    voice.write_text("## Voice\n\nHe says 'protect your home'.")

    agent_file = tmp_path / "03-bryan.md"
    agent_file.write_text(
        "---\nid: bryan\nname: Bryan\norder: 2\nmodel: gpt-4o\ntemperature: 0.3\n"
        "input_format: markdown\noutput_format: markdown\nvoice_file: voice.md\n---\n\n## Role\n\nYou are Bryan."
    )

    agent = load_agent(agent_file)
    assert "protect your home" in agent.system_prompt
    assert "## Role" in agent.system_prompt


def test_load_agent_voice_file_missing_raises(tmp_path):
    agent_file = tmp_path / "03-bryan.md"
    agent_file.write_text(
        "---\nid: bryan\nname: Bryan\norder: 2\nmodel: gpt-4o\ntemperature: 0.3\n"
        "input_format: markdown\noutput_format: markdown\nvoice_file: nonexistent.md\n---\n\n## Role\n\nYou are Bryan."
    )
    with pytest.raises(FileNotFoundError):
        load_agent(agent_file)


def test_load_agent_without_voice_file_unchanged():
    agent = load_agent(FIXTURES / "sample-agent.md")
    # system_prompt should be exactly the markdown body, no injection
    assert "---" not in agent.system_prompt or agent.system_prompt.startswith("##")

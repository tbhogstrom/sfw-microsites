import pytest
from unittest.mock import MagicMock
from agent_loader import AgentConfig
from pipeline_config import PipelineConfig
from pipeline import run_pipeline


def make_agent(id: str, order: int) -> AgentConfig:
    return AgentConfig(
        id=id,
        name=id,
        order=order,
        model="gpt-4o-mini",
        temperature=0.2,
        input_format="markdown",
        output_format="markdown",
        system_prompt=f"You are agent {id}.",
    )


def make_pipeline_config() -> PipelineConfig:
    return PipelineConfig(
        agent_ids=["agent-a", "agent-b"],
        brand_name="Test Brand",
        locations=["Portland"],
        shared_context="Be professional.",
    )


def test_run_pipeline_chains_agents(mocker):
    agents = [make_agent("agent-a", 1), make_agent("agent-b", 2)]
    config = make_pipeline_config()
    mock_client = MagicMock()

    mock_caller = mocker.patch(
        "pipeline.call_agent",
        side_effect=["After agent-a", "After agent-b"],
    )

    result = run_pipeline(
        content="Original content",
        agents=agents,
        pipeline_config=config,
        client=mock_client,
    )

    assert result == "After agent-b"
    assert mock_caller.call_count == 2
    # Second agent receives output of first
    second_call_content = mock_caller.call_args_list[1].kwargs["content"]
    assert second_call_content == "After agent-a"


def test_run_pipeline_injects_shared_context(mocker):
    agents = [make_agent("agent-a", 1)]
    config = make_pipeline_config()
    mock_client = MagicMock()

    mock_caller = mocker.patch("pipeline.call_agent", return_value="output")

    run_pipeline(
        content="Content",
        agents=agents,
        pipeline_config=config,
        client=mock_client,
    )

    system_prompt = mock_caller.call_args.kwargs["system_prompt"]
    assert "Be professional." in system_prompt
    assert "Portland" in system_prompt


def test_run_pipeline_with_agent_filter(mocker):
    agents = [make_agent("agent-a", 1), make_agent("agent-b", 2)]
    config = make_pipeline_config()
    mock_client = MagicMock()

    mock_caller = mocker.patch("pipeline.call_agent", return_value="output")

    run_pipeline(
        content="Content",
        agents=agents,
        pipeline_config=config,
        client=mock_client,
        agent_filter=["agent-a"],
    )

    assert mock_caller.call_count == 1


def test_run_pipeline_returns_original_if_no_agents(mocker):
    config = make_pipeline_config()
    mock_client = MagicMock()
    mock_caller = mocker.patch("pipeline.call_agent", return_value="output")

    result = run_pipeline(
        content="Original",
        agents=[],
        pipeline_config=config,
        client=mock_client,
    )

    assert result == "Original"
    assert mock_caller.call_count == 0


def test_run_pipeline_passes_correct_model_and_temperature(mocker):
    agents = [make_agent("agent-a", 1)]
    agents[0] = AgentConfig(
        id="agent-a", name="agent-a", order=1,
        model="gpt-4o", temperature=0.7,
        input_format="markdown", output_format="markdown",
        system_prompt="Custom prompt."
    )
    config = make_pipeline_config()
    mock_client = MagicMock()

    mock_caller = mocker.patch("pipeline.call_agent", return_value="output")

    run_pipeline(content="Content", agents=agents, pipeline_config=config, client=mock_client)

    assert mock_caller.call_args.kwargs["model"] == "gpt-4o"
    assert mock_caller.call_args.kwargs["temperature"] == 0.7

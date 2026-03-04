from openai import OpenAI
from agent_loader import AgentConfig
from pipeline_config import PipelineConfig
from openai_caller import call_agent


def run_pipeline(
    content: str,
    agents: list[AgentConfig],
    pipeline_config: PipelineConfig,
    client: OpenAI,
    agent_filter: list[str] | None = None,
) -> str:
    active_agents = agents
    if agent_filter is not None:
        active_agents = [a for a in agents if a.id in agent_filter]

    shared_context = pipeline_config.build_context_string()
    current = content

    for agent in active_agents:
        system_prompt = f"{agent.system_prompt}\n\n---\n\n{shared_context}"
        current = call_agent(
            client=client,
            model=agent.model,
            temperature=agent.temperature,
            system_prompt=system_prompt,
            content=current,
        )

    return current

# editorial_crew/runner.py
from __future__ import annotations

from dataclasses import dataclass, field
from typing import AsyncGenerator

from claude_agent_sdk import (
    query,
    ClaudeAgentOptions,
    ResultMessage,
    AssistantMessage,
)

from editorial_crew.agents.registry import get_agent_definitions
from editorial_crew.diff import generate_diff


# Import subagent lifecycle messages if available
try:
    from claude_agent_sdk import TaskStartedMessage, TaskNotificationMessage
except ImportError:
    TaskStartedMessage = None
    TaskNotificationMessage = None


@dataclass
class AgentEvent:
    """An event from the editorial process for display."""
    kind: str  # "subagent_start", "subagent_done", "chief_thinking", "result", "debug"
    agent_name: str = ""
    text: str = ""


@dataclass
class EditorialResult:
    """Result from processing a single document."""
    final_diff: str = ""
    improved_document: str = ""
    raw_result: str = ""
    error: str | None = None


async def process_document(
    document: str,
    filename: str,
    filter_agents: list[str] | None = None,
    model_override: str | None = None,
    debug: bool = False,
) -> AsyncGenerator[AgentEvent | EditorialResult, None]:
    """Process a markdown document, yielding events as they occur."""
    agents = get_agent_definitions(filter_names=filter_agents)
    agent_names = ", ".join(agents.keys())

    if filter_agents:
        routing = f"You MUST use ALL of these specialist agents: {agent_names}"
    else:
        routing = (
            f"Available specialists: {agent_names}. "
            "Classify the document type and select 3-5 relevant specialists. "
            "Not every document needs every specialist."
        )

    system_prompt = f"""You are the Editor-in-Chief of an editorial review team. Your job is to coordinate
specialist editors to improve a markdown document.

## Process

1. Read the document provided in the user message
2. {routing}
3. Invoke each chosen specialist agent with the full document text
4. After all specialists report back, synthesize their feedback into a single improved document
5. Produce the final improved version of the complete document

## Rules

- Preserve the author's voice and intent
- Do not add new content -- only improve what exists
- If specialists disagree, use your editorial judgment
- Your final output must be the COMPLETE improved markdown document, nothing else
- Do NOT wrap the output in code fences, add commentary, or include any preamble
- Your ENTIRE response must be the improved markdown document and NOTHING else
- Do not start with phrases like "Here is" or "The agent identified" -- just output the markdown"""

    result = EditorialResult()

    try:
        async for message in query(
            prompt=f"Review and improve this markdown document ({filename}):\n\n{document}",
            options=ClaudeAgentOptions(
                allowed_tools=["Read", "Glob", "Grep", "Agent"],
                agents=agents,
                system_prompt=system_prompt,
                model=model_override,
                permission_mode="bypassPermissions",
                max_turns=50,
            ),
        ):
            msg_type = type(message).__name__

            if debug:
                yield AgentEvent(kind="debug", text=f"[{msg_type}]")

            # Detect subagent dispatch from AssistantMessage with ToolUseBlock
            if isinstance(message, AssistantMessage) and message.content:
                for block in message.content:
                    block_cls = type(block).__name__

                    if block_cls == "ToolUseBlock" and getattr(block, "name", "") in ("Agent", "Task"):
                        input_data = getattr(block, "input", {})
                        agent_type = input_data.get("subagent_type", "unknown")
                        yield AgentEvent(kind="subagent_start", agent_name=agent_type)

                    elif block_cls == "TextBlock" and not getattr(message, "parent_tool_use_id", None):
                        text = getattr(block, "text", "").strip()
                        if text:
                            yield AgentEvent(kind="chief_thinking", text=text)

            # Detect subagent lifecycle via TaskStartedMessage / TaskNotificationMessage
            if TaskStartedMessage and isinstance(message, TaskStartedMessage):
                yield AgentEvent(kind="subagent_start", agent_name=getattr(message, "agent_type", "specialist"))

            if TaskNotificationMessage and isinstance(message, TaskNotificationMessage):
                yield AgentEvent(kind="subagent_done", agent_name=getattr(message, "agent_type", "specialist"))

            # Capture final result
            if isinstance(message, ResultMessage):
                result.raw_result = message.result or ""

        # Strip any preamble before the first markdown heading
        improved = result.raw_result.strip()
        if improved and "\n#" in improved and not improved.startswith("#"):
            idx = improved.index("\n#")
            improved = improved[idx + 1:]
        improved = improved.strip()
        if improved:
            result.improved_document = improved
            result.final_diff = generate_diff(document, improved, filename=filename)

    except Exception as e:
        result.error = str(e)

    yield result

from pathlib import Path
from pydantic import BaseModel
import frontmatter


class AgentConfig(BaseModel):
    id: str
    name: str
    order: int
    model: str
    temperature: float
    input_format: str
    output_format: str
    system_prompt: str


def load_agent(path: Path) -> AgentConfig:
    post = frontmatter.load(str(path))
    return AgentConfig(
        id=post["id"],
        name=post["name"],
        order=post["order"],
        model=post["model"],
        temperature=post["temperature"],
        input_format=post["input_format"],
        output_format=post["output_format"],
        system_prompt=post.content,
    )


def load_agents_from_dir(agents_dir: Path) -> list[AgentConfig]:
    agents = [
        load_agent(f)
        for f in agents_dir.glob("*.md")
        if not f.name.startswith(".")
    ]
    return sorted(agents, key=lambda a: a.order)

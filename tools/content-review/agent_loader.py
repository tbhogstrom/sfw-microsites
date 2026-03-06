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
    voice_file: str | None = None


def load_agent(path: Path) -> AgentConfig:
    post = frontmatter.load(str(path))
    required = ["id", "name", "order", "model", "temperature", "input_format", "output_format"]
    missing = [k for k in required if k not in post]
    if missing:
        raise ValueError(f"{path}: missing required frontmatter fields: {missing}")

    system_prompt = post.content
    voice_file = post.get("voice_file")
    if voice_file:
        voice_path = path.parent / voice_file
        if not voice_path.exists():
            raise FileNotFoundError(f"voice_file not found: {voice_path}")
        voice_content = voice_path.read_text(encoding="utf-8")
        system_prompt = f"{system_prompt}\n\n---\n\n{voice_content}"

    return AgentConfig(
        id=post["id"],
        name=post["name"],
        order=post["order"],
        model=post["model"],
        temperature=post["temperature"],
        input_format=post["input_format"],
        output_format=post["output_format"],
        system_prompt=system_prompt,
        voice_file=voice_file,
    )


def load_agents_from_dir(agents_dir: Path) -> list[AgentConfig]:
    if not agents_dir.is_dir():
        raise FileNotFoundError(f"Agents directory not found: {agents_dir}")
    agents = [
        load_agent(f)
        for f in agents_dir.glob("*.md")
        if not f.name.startswith(".")
    ]
    return sorted(agents, key=lambda a: a.order)

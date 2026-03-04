from pathlib import Path
from pydantic import BaseModel
import frontmatter


class PipelineConfig(BaseModel):
    agent_ids: list[str]
    brand_name: str
    locations: list[str]
    shared_context: str

    def build_context_string(self) -> str:
        locations_str = ", ".join(self.locations)
        return (
            f"Brand: {self.brand_name}\n"
            f"Service locations: {locations_str}\n\n"
            f"{self.shared_context}"
        )


def load_pipeline_config(path: Path) -> PipelineConfig:
    if not path.exists():
        raise FileNotFoundError(f"Pipeline config not found: {path}")
    post = frontmatter.load(str(path))
    required = ["agent_ids", "brand_name", "locations"]
    missing = [k for k in required if k not in post]
    if missing:
        raise ValueError(f"{path}: missing required frontmatter fields: {missing}")
    return PipelineConfig(
        agent_ids=post["agent_ids"],
        brand_name=post["brand_name"],
        locations=post["locations"],
        shared_context=post.content,
    )

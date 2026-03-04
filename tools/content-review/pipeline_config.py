from pathlib import Path
from pydantic import BaseModel, Field, ValidationError
import frontmatter


class PipelineConfig(BaseModel):
    agent_ids: list[str] = Field(min_length=1)
    brand_name: str
    locations: list[str] = Field(min_length=1)
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
    try:
        return PipelineConfig(
            agent_ids=post.get("agent_ids"),
            brand_name=post.get("brand_name"),
            locations=post.get("locations"),
            shared_context=post.content,
        )
    except (ValidationError, Exception) as e:
        raise ValueError(f"{path}: invalid pipeline config — {e}") from e

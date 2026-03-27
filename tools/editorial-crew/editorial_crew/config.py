from __future__ import annotations

import tomllib
from dataclasses import dataclass, field
from pathlib import Path


_DEFAULT_CONFIG = Path(__file__).parent / "config.toml"

_DEFAULT_MODEL = "anthropic/claude-sonnet-4-20250514"
_DEFAULT_CONTEXT_LINES = 3


@dataclass
class Config:
    model_default: str = _DEFAULT_MODEL
    agent_models: dict[str, str] = field(default_factory=dict)
    diff_context_lines: int = _DEFAULT_CONTEXT_LINES

    def get_agent_model(self, agent_name: str) -> str:
        return self.agent_models.get(agent_name, self.model_default)


def load_config(config_path: Path | None = None) -> Config:
    """Load config from a TOML file. Falls back to bundled defaults."""
    path = config_path or _DEFAULT_CONFIG
    if not path.exists():
        return Config()

    with open(path, "rb") as f:
        data = tomllib.load(f)

    model_section = data.get("model", {})
    agents_section = data.get("agents", {})
    output_section = data.get("output", {})

    return Config(
        model_default=model_section.get("default", _DEFAULT_MODEL),
        agent_models=dict(agents_section),
        diff_context_lines=output_section.get("diff_context_lines", _DEFAULT_CONTEXT_LINES),
    )

# editorial_crew/auth.py
from __future__ import annotations

import os
from pathlib import Path


def _load_env_file() -> None:
    """Load .env file, handling UTF-16 and UTF-8 encodings.

    Checks CWD first, then falls back to the package root.
    """
    env_path = Path.cwd() / ".env"
    if not env_path.exists():
        env_path = Path(__file__).parent.parent / ".env"
    if not env_path.exists():
        return
    raw = env_path.read_bytes()
    if raw.startswith(b"\xff\xfe") or raw.startswith(b"\xfe\xff"):
        text = raw.decode("utf-16")
    else:
        text = raw.decode("utf-8-sig")
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip().strip('"').strip("'")
        if key and value and key not in os.environ:
            os.environ[key] = value


def check_api_key() -> None:
    """Ensure ANTHROPIC_API_KEY is set. Falls back to CLAUDE_CODE_OAUTH_TOKEN."""
    _load_env_file()

    # If ANTHROPIC_API_KEY is already set, we're good
    if os.environ.get("ANTHROPIC_API_KEY"):
        return

    # Fall back: copy OAuth token to ANTHROPIC_API_KEY so the Agent SDK picks it up
    oauth = os.environ.get("CLAUDE_CODE_OAUTH_TOKEN")
    if oauth:
        os.environ["ANTHROPIC_API_KEY"] = oauth
        return

    raise RuntimeError(
        "No API key found. Set one of:\n"
        "  export ANTHROPIC_API_KEY=your-api-key\n"
        "  export CLAUDE_CODE_OAUTH_TOKEN=your-oauth-token"
    )

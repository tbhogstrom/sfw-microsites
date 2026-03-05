#!/usr/bin/env python3
"""
Content Review Pipeline CLI

Run from tools/content-review/ with the venv active.

Usage:
    python review.py --file ../../apps/deck-repair/src/data/generated_content/some-file.md --dry-run
    python review.py --microsite deck-repair
    python review.py --all
    python review.py --file <path> --agents quality-cleaner
"""

import os
import sys
from pathlib import Path

import click
from dotenv import load_dotenv
from openai import OpenAI

from agent_loader import load_agents_from_dir
from lancedb_store import ContentStore
from pipeline import run_pipeline
from pipeline_config import load_pipeline_config

load_dotenv()

TOOL_DIR = Path(__file__).parent
AGENTS_DIR = TOOL_DIR / "agents"
PIPELINE_MD = TOOL_DIR / "pipeline.md"
APPS_DIR = TOOL_DIR / "../../apps"

APPS = [
    "beam-repair",
    "chimney-repair",
    "crawlspace-rot",
    "deck-repair",
    "dry-rot",
    "flashing-repair",
    "lead-paint",
    "leak-repair",
    "mold-testing",
    "restoration",
    "siding-repair",
    "trim-repair",
]


def get_content_files(app: str) -> list[Path]:
    content_dir = APPS_DIR / app / "src/data/generated_content"
    if not content_dir.exists():
        return []
    return list(content_dir.glob("*.md"))


def resolve_app_name(filepath: Path) -> str:
    """Extract the microsite app name from a content file path."""
    try:
        # Path structure: .../apps/<app>/src/data/generated_content/<file>.md
        parts = filepath.resolve().parts
        apps_idx = next(i for i, p in enumerate(parts) if p == "apps")
        return parts[apps_idx + 1]
    except (StopIteration, IndexError):
        return "unknown"


def process_file(
    filepath: Path,
    agents,
    pipeline_config,
    client: OpenAI,
    store: ContentStore,
    dry_run: bool,
    agent_filter: list[str] | None,
) -> None:
    app = resolve_app_name(filepath)
    filename = filepath.name

    click.echo(f"  Processing: {app}/{filename}")

    content = filepath.read_text(encoding="utf-8")
    improved = run_pipeline(
        content=content,
        agents=agents,
        pipeline_config=pipeline_config,
        client=client,
        agent_filter=agent_filter,
    )

    if dry_run:
        click.echo(click.style("  [DRY RUN] Changes not written.", fg="yellow"))
        click.echo("  --- Preview (first 500 chars) ---")
        click.echo(improved[:500])
        click.echo("  ---")
    else:
        filepath.write_text(improved, encoding="utf-8")
        store.upsert(app=app, filename=filename, content=improved)
        click.echo(click.style("  Written.", fg="green"))

    # Warn on near-duplicate content (dry-run also queries if store has data)
    try:
        similar = store.find_similar(app=app, filename=filename, content=improved, top_k=3)
        for s in similar:
            if s.score < 0.15:
                click.echo(
                    click.style(
                        f"  WARNING: near-duplicate detected: {s.app}/{s.filename} (score: {s.score:.3f})",
                        fg="yellow",
                    )
                )
    except Exception:
        pass  # Don't let dedup check crash the pipeline


@click.command()
@click.option(
    "--file",
    "filepath",
    type=click.Path(exists=True, path_type=Path),
    help="Single file to process",
)
@click.option("--microsite", help="Process all files for one microsite app (e.g. deck-repair)")
@click.option("--all", "all_sites", is_flag=True, help="Process all 12 microsite apps")
@click.option("--dry-run", is_flag=True, help="Preview output without writing files")
@click.option(
    "--agents",
    "agent_filter_str",
    default=None,
    help="Comma-separated agent IDs to run (e.g. quality-cleaner,language-editor)",
)
def main(filepath, microsite, all_sites, dry_run, agent_filter_str):
    """Content review pipeline for SFW Construction microsites."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        click.echo(
            click.style(
                "Error: OPENAI_API_KEY not set. Copy .env.example to .env and add your key.",
                fg="red",
            )
        )
        sys.exit(1)

    client = OpenAI(api_key=api_key)
    agents = load_agents_from_dir(AGENTS_DIR)
    pipeline_config = load_pipeline_config(PIPELINE_MD)
    store = ContentStore(db_path=str(TOOL_DIR / ".lancedb"), openai_client=client)

    agent_filter = (
        [a.strip() for a in agent_filter_str.split(",")] if agent_filter_str else None
    )

    if filepath:
        files = [filepath]
    elif microsite:
        files = get_content_files(microsite)
        if not files:
            click.echo(f"No content files found for microsite: {microsite}")
            sys.exit(1)
    elif all_sites:
        files = []
        for app in APPS:
            files.extend(get_content_files(app))
        if not files:
            click.echo("No content files found across any sites.")
            sys.exit(1)
    else:
        click.echo("Provide --file, --microsite, or --all. Use --help for usage.")
        sys.exit(1)

    mode = "DRY RUN" if dry_run else "LIVE"
    click.echo(f"Running pipeline [{mode}] on {len(files)} file(s)...")
    if agent_filter:
        click.echo(f"  Agents: {', '.join(agent_filter)}")
    else:
        click.echo(f"  Agents: {', '.join(a.name for a in agents)} (all)")

    for f in files:
        process_file(f, agents, pipeline_config, client, store, dry_run, agent_filter)

    click.echo(click.style(f"\nDone. {len(files)} file(s) processed.", fg="green"))


if __name__ == "__main__":
    main()

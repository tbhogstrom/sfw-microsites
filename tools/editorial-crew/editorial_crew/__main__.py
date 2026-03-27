from __future__ import annotations

import argparse
import asyncio
import glob
import os
import sys
from pathlib import Path

# Force UTF-8 output on Windows to avoid cp1252 encoding errors
if sys.platform == "win32":
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from rich.console import Console
from rich.panel import Panel
from rich.syntax import Syntax

from editorial_crew.runner import process_document, EditorialResult, AgentEvent
from editorial_crew.auth import check_api_key

console = Console()


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="editorial-crew",
        description="Improve markdown files with an AI editorial team",
    )
    parser.add_argument("files", nargs="+", help="Markdown file(s) or glob pattern(s)")
    parser.add_argument("--agents", type=lambda s: s.split(","), default=None,
                        help="Comma-separated specialist names to constrain")
    parser.add_argument("--output", type=str, default=None,
                        help="Write diff to file instead of stdout")
    parser.add_argument("--model", type=str, default=None,
                        help="Override the LLM model")
    parser.add_argument("--debug", action="store_true",
                        help="Show raw SDK messages for debugging")
    parser.add_argument("--json", action="store_true",
                        help="Output structured JSON instead of Rich console output")
    return parser.parse_args(argv)


def expand_globs(patterns: list[str]) -> list[Path]:
    """Expand glob patterns into file paths."""
    files = []
    for pattern in patterns:
        matches = glob.glob(pattern, recursive=True)
        if matches:
            files.extend(Path(m) for m in matches if Path(m).is_file())
        else:
            path = Path(pattern)
            if path.is_file():
                files.append(path)
            else:
                console.print(f"[yellow]Warning: no files matched '{pattern}'[/yellow]")
    return files


def _agent_display_name(name: str) -> str:
    """Convert agent key to display name: 'grammar' -> 'Grammar Agent'."""
    return name.replace("_", " ").replace("-", " ").title()
    if not name.lower().endswith("agent"):
        return f"{name} Agent"
    return name


async def process_file(filepath: Path, args: argparse.Namespace) -> bool:
    """Process a single file. Returns True on success, False on failure."""
    console.print(f"\n[bold]editorial-crew -- {filepath}[/bold]\n")

    try:
        document = filepath.read_text(encoding="utf-8")
    except Exception as e:
        console.print(f"  [red][FAIL] Failed to read file: {e}[/red]")
        return False

    result = None
    agents_started: list[str] = []
    agents_done: list[str] = []

    try:
        async for event in process_document(
            document=document,
            filename=filepath.name,
            filter_agents=args.agents,
            model_override=args.model,
            debug=getattr(args, "debug", False),
        ):
            if isinstance(event, AgentEvent):
                if event.kind == "debug":
                    console.print(f"  [dim magenta]DEBUG: {event.text}[/dim magenta]")
                    continue

                if event.kind == "subagent_start":
                    display = _agent_display_name(event.agent_name)
                    agents_started.append(event.agent_name)
                    console.print(f"  [cyan]>> {display}[/cyan] dispatched")

                elif event.kind == "subagent_done":
                    display = _agent_display_name(event.agent_name)
                    agents_done.append(event.agent_name)
                    console.print(f"  [green][ok] {display}[/green] reported back")

                elif event.kind == "chief_thinking":
                    # Show a condensed version of the chief's reasoning
                    text = event.text
                    if len(text) > 200:
                        text = text[:200] + "..."
                    console.print(f"  [dim]{text}[/dim]")

            elif isinstance(event, EditorialResult):
                result = event

        if result is None:
            console.print("  [red][FAIL] No result received[/red]")
            return False

        if result.error:
            console.print(f"  [red][FAIL] {result.error}[/red]")
            return False

        # Summary line
        n_agents = len(agents_started)
        if n_agents:
            console.print(f"\n  [bold]{n_agents} specialist(s) consulted[/bold]")

        # Display diff
        if result.final_diff:
            console.print()
            syntax = Syntax(result.final_diff, "diff", theme="monokai", line_numbers=False)
            console.print(Panel(syntax, title="Unified Diff", border_style="green"))
        else:
            console.print("  [green]No changes needed[/green]")

        if args.output and result.final_diff:
            Path(args.output).write_text(result.final_diff, encoding="utf-8")
            console.print(f"\n  [dim]Diff written to {args.output}[/dim]")

        return True

    except Exception as e:
        console.print(f"  [red][FAIL] Error processing file: {e}[/red]")
        return False


async def async_main(args: argparse.Namespace) -> int:
    files = expand_globs(args.files)
    if not files:
        console.print("[red]No markdown files found.[/red]")
        return 1

    check_api_key()

    successes = 0
    failures = 0

    for filepath in files:
        if await process_file(filepath, args):
            successes += 1
        else:
            failures += 1

    if len(files) > 1:
        summary = f"Summary: {successes}/{len(files)} files processed"
        if failures:
            summary += f", {failures} failed"
        console.print(f"\n[bold]{summary}[/bold]")

    return 0 if failures == 0 else 1


def main():
    args = parse_args()
    sys.exit(asyncio.run(async_main(args)))


if __name__ == "__main__":
    main()

"""CLI: python -m photo_scanner.report_project <project_id> [--output report.html] [--json out.json]

Generates a project-level homeowner report and saves it to the catalog.
Optionally writes a standalone HTML or JSON file to disk.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

from photo_scanner.anthropic_auth import (
    describe_anthropic_auth,
    get_async_anthropic_client,
    load_project_env,
)
from photo_scanner.catalog import Catalog
from photo_scanner.companycam import CompanyCamClient
from photo_scanner.reports import ANTHROPIC_MODEL, generate_project_report

TEMPLATES_DIR = Path(__file__).parent / "templates"


def _render_html(report: dict, project: dict) -> str:
    env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)))
    template = env.get_template("project_report.html")
    return template.render(
        report=report,
        project=project,
        report_json=json.dumps(report, indent=2),
    )


async def _run(project_id: str, output_html: Path | None, output_json: Path | None) -> int:
    load_project_env()
    print(f"[report_project] Anthropic auth: {describe_anthropic_auth()}", file=sys.stderr)

    catalog = Catalog()
    project = catalog.get_project(project_id)
    if not project:
        print(f"[report_project] ERROR: project {project_id!r} not found in catalog. Sync it first.",
              file=sys.stderr)
        return 2

    anthropic_client = get_async_anthropic_client()
    if not anthropic_client:
        print("[report_project] ERROR: no Anthropic auth configured.", file=sys.stderr)
        return 2

    cc_token = os.environ.get("COMPANYCAM_API_TOKEN", "")
    if not cc_token:
        print("[report_project] ERROR: COMPANYCAM_API_TOKEN not set in env/.env.", file=sys.stderr)
        return 2
    cc_client = CompanyCamClient(token=cc_token)

    print(f"[report_project] Generating report for {project['name']!r}...", file=sys.stderr)
    try:
        report = await generate_project_report(
            catalog=catalog, project_id=project_id,
            anthropic_client=anthropic_client, cc_client=cc_client,
        )
    except ValueError as e:
        print(f"[report_project] ERROR: {e}", file=sys.stderr)
        return 2

    new_id = catalog.save_project_report(project_id, report, model=ANTHROPIC_MODEL)
    print(f"[report_project] Saved as project_reports.id = {new_id}", file=sys.stderr)
    print(f"[report_project] Headline: {report.get('headline','')}", file=sys.stderr)
    print(f"[report_project] Photos:   {len(report.get('photos', []))} (partial={report.get('partial')})",
          file=sys.stderr)

    if output_json:
        output_json.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(f"[report_project] Wrote JSON to {output_json}", file=sys.stderr)

    if output_html:
        html = _render_html(report, project)
        output_html.write_text(html, encoding="utf-8")
        print(f"[report_project] Wrote HTML to {output_html}", file=sys.stderr)

    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a project-level homeowner report.")
    parser.add_argument("project_id", help="CompanyCam project ID")
    parser.add_argument("--output", type=Path, default=None,
                        help="Optional: write standalone HTML to this path")
    parser.add_argument("--json", dest="output_json", type=Path, default=None,
                        help="Optional: write the raw report JSON to this path")
    args = parser.parse_args()
    rc = asyncio.run(_run(args.project_id, args.output, args.output_json))
    sys.exit(rc)


if __name__ == "__main__":
    main()

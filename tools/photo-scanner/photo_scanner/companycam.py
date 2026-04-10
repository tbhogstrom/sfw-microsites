"""Async client for the CompanyCam v2 API."""
import os
import re
from pathlib import Path

import httpx
from dotenv import load_dotenv

BASE_URL = "https://api.companycam.com/v2"


class CompanyCamClient:
    """Async CompanyCam API client with bearer token auth."""

    def __init__(self, token: str = None):
        if token is None:
            env_path = Path(__file__).parent.parent / ".env"
            if env_path.exists():
                load_dotenv(env_path)
            token = os.environ.get("COMPANYCAM_API_TOKEN")
            if not token:
                raise ValueError("COMPANYCAM_API_TOKEN not set in .env")
        self._client = httpx.AsyncClient(
            base_url=BASE_URL,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            timeout=30.0,
        )

    async def close(self):
        await self._client.aclose()

    @staticmethod
    def _check_response(resp: httpx.Response) -> None:
        """Raise HTTPStatusError for error responses. Safe to call on mock responses."""
        if resp.is_error:
            resp.raise_for_status()

    async def list_projects(self, page: int = 1, per_page: int = 50, query: str = None) -> list[dict]:
        params = {"page": page, "per_page": per_page}
        if query:
            params["query"] = query
        resp = await self._client.get("/projects", params=params)
        self._check_response(resp)
        return resp.json()

    async def get_project(self, project_id: str) -> dict:
        resp = await self._client.get(f"/projects/{project_id}")
        self._check_response(resp)
        return resp.json()

    async def list_project_photos(self, project_id: str, page: int = 1, per_page: int = 50) -> list[dict]:
        params = {"page": page, "per_page": per_page}
        resp = await self._client.get(f"/projects/{project_id}/photos", params=params)
        self._check_response(resp)
        return resp.json()

    async def get_photo(self, photo_id: str) -> dict:
        resp = await self._client.get(f"/photos/{photo_id}")
        self._check_response(resp)
        return resp.json()

    async def get_photo_bytes(self, uri: str) -> bytes:
        """Download photo bytes from a CompanyCam URI. Used for analysis — not stored to disk."""
        resp = await self._client.get(uri)
        self._check_response(resp)
        return resp.content

    @staticmethod
    def normalize_project(raw: dict) -> dict:
        """Convert CompanyCam project response to our catalog schema."""
        addr = raw.get("address", {}) or {}
        coords = raw.get("coordinates", {}) or {}
        parts = [addr.get("street_address_1", ""), addr.get("city", ""), addr.get("state", "")]
        address_str = ", ".join(p for p in parts if p)
        return {
            "id": str(raw["id"]),
            "name": raw.get("name") or "(unnamed)",
            "address": address_str,
            "lat": coords.get("lat", 0) or 0,
            "lng": coords.get("lon", 0) or 0,
            "created_at": raw.get("created_at", ""),
            "updated_at": raw.get("updated_at", ""),
            "status": raw.get("status", "active"),
            "photo_count": raw.get("photo_count", 0),
            "notepad": raw.get("notepad", ""),
        }

    @staticmethod
    def normalize_photo(raw: dict, project_id: str) -> dict:
        """Convert CompanyCam photo response to our catalog schema."""
        uris = raw.get("uris", [])
        full_uri = ""
        thumb_uri = ""
        for u in uris:
            if u.get("type") == "original":
                full_uri = u.get("url", "")
            elif u.get("type") == "web":
                thumb_uri = u.get("url", "")
        if not full_uri and uris:
            full_uri = uris[0].get("url", "")
        if not thumb_uri:
            thumb_uri = full_uri

        creator = raw.get("creator", {}) or {}
        captured_at = raw.get("captured_at") or raw.get("created_at", "")

        return {
            "id": str(raw["id"]),
            "project_id": str(project_id),
            "uri": full_uri,
            "thumb_uri": thumb_uri,
            "taken_at": str(captured_at),
            "creator_name": creator.get("display_name", ""),
        }

    @staticmethod
    def get_project_context(project: dict) -> dict:
        """Assemble project context from available sources.

        Today: notepad (Scope of Work) only.
        Extensible for CompanyCam Pages when API access opens.

        Args:
            project: A project dict from the catalog (must have 'notepad' key).

        Returns:
            Dict with 'scope_of_work' (plain text) and 'pages' (list, empty for now).
        """
        notepad = project.get("notepad", "") or ""
        scope_text = re.sub(r'<[^>]+>', '', notepad)
        scope_text = scope_text.replace('&nbsp;', ' ').replace('&amp;', '&').strip()
        return {
            "scope_of_work": scope_text,
            "pages": [],
        }

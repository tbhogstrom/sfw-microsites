"""Tests for CompanyCam API client using mocked HTTP responses."""
import json
import pytest
import httpx
from unittest.mock import AsyncMock, patch
from photo_scanner.companycam import CompanyCamClient


@pytest.fixture
def client():
    return CompanyCamClient(token="test-token")


@pytest.mark.asyncio
async def test_list_projects(client):
    mock_response = httpx.Response(
        200,
        json=[
            {"id": "101", "name": "Gary Bracelin", "address": {"street_address_1": "123 Main", "city": "Portland", "state": "OR"}, "coordinates": {"lat": 45.5, "lon": -122.6}, "photo_count": 47, "created_at": 1774999578, "updated_at": 1775230931, "status": "active"},
        ],
    )
    with patch.object(client._client, "get", new_callable=AsyncMock, return_value=mock_response):
        projects = await client.list_projects(page=1, per_page=50)
    assert len(projects) == 1
    assert projects[0]["id"] == "101"
    assert projects[0]["name"] == "Gary Bracelin"


@pytest.mark.asyncio
async def test_list_projects_with_query(client):
    mock_response = httpx.Response(200, json=[])
    with patch.object(client._client, "get", new_callable=AsyncMock, return_value=mock_response) as mock_get:
        await client.list_projects(query="Gary")
    call_args = mock_get.call_args
    assert "query" in str(call_args) or "q" in str(call_args)


@pytest.mark.asyncio
async def test_get_project(client):
    mock_response = httpx.Response(
        200,
        json={"id": "101", "name": "Test Project", "photo_count": 10},
    )
    with patch.object(client._client, "get", new_callable=AsyncMock, return_value=mock_response):
        project = await client.get_project("101")
    assert project["name"] == "Test Project"


@pytest.mark.asyncio
async def test_list_project_photos(client):
    mock_response = httpx.Response(
        200,
        json=[
            {"id": "ph1", "uris": [{"type": "original", "url": "https://full.jpg"}, {"type": "web", "url": "https://web.jpg"}], "captured_at": 1775230800, "created_at": 1775230800, "creator": {"display_name": "Alice"}},
        ],
    )
    with patch.object(client._client, "get", new_callable=AsyncMock, return_value=mock_response):
        photos = await client.list_project_photos("101", page=1, per_page=50)
    assert len(photos) == 1
    assert photos[0]["id"] == "ph1"


@pytest.mark.asyncio
async def test_get_photo_bytes(client):
    mock_response = httpx.Response(200, content=b"\xff\xd8\xff\xe0fake-jpeg-bytes")
    with patch.object(client._client, "get", new_callable=AsyncMock, return_value=mock_response):
        data = await client.get_photo_bytes("https://example.com/photo.jpg")
    assert data[:4] == b"\xff\xd8\xff\xe0"


@pytest.mark.asyncio
async def test_auth_header(client):
    mock_response = httpx.Response(200, json=[])
    with patch.object(client._client, "get", new_callable=AsyncMock, return_value=mock_response) as mock_get:
        await client.list_projects()
    assert client._client.headers["Authorization"] == "Bearer test-token"


@pytest.mark.asyncio
async def test_api_error_raises(client):
    mock_response = httpx.Response(401, text="Unauthorized")
    mock_response.request = httpx.Request("GET", "https://api.companycam.com/v2/projects")
    with patch.object(client._client, "get", new_callable=AsyncMock, return_value=mock_response):
        with pytest.raises(httpx.HTTPStatusError):
            await client.list_projects()


def test_normalize_project():
    raw = {
        "id": "101",
        "name": "Gary Bracelin 03-25-2026",
        "address": {"street_address_1": "4523 NE Multnomah St", "city": "Portland", "state": "OR"},
        "coordinates": {"lat": 45.5244172, "lon": -122.6966638},
        "photo_count": 47,
        "created_at": 1774999578,
    }
    result = CompanyCamClient.normalize_project(raw)
    assert result["id"] == "101"
    assert result["name"] == "Gary Bracelin 03-25-2026"
    assert "Portland" in result["address"]
    assert result["lat"] == 45.5244172
    assert result["lng"] == -122.6966638
    assert result["photo_count"] == 47


def test_normalize_photo():
    raw = {
        "id": "ph1",
        "uris": [
            {"type": "original", "url": "https://example.com/original.jpg"},
            {"type": "web", "url": "https://example.com/web.jpg"},
        ],
        "captured_at": 1775230800,
        "created_at": 1775230800,
        "creator": {"display_name": "Alice"},
    }
    result = CompanyCamClient.normalize_photo(raw, "101")
    assert result["id"] == "ph1"
    assert result["project_id"] == "101"
    assert result["uri"] == "https://example.com/original.jpg"
    assert result["thumb_uri"] == "https://example.com/web.jpg"
    assert result["creator_name"] == "Alice"

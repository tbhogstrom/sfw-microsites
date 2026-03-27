import os
import pytest
from unittest.mock import patch
from editorial_crew.auth import check_api_key


def test_check_api_key_present():
    with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "api-key-456"}):
        check_api_key()  # should not raise


def test_check_api_key_oauth_fallback():
    with patch.dict(os.environ, {"CLAUDE_CODE_OAUTH_TOKEN": "oauth-123"}, clear=True):
        check_api_key()
        assert os.environ.get("ANTHROPIC_API_KEY") == "oauth-123"


def test_check_api_key_missing_raises(tmp_path, monkeypatch):
    # Point .env loading to a nonexistent dir so it can't find any .env
    monkeypatch.setattr("editorial_crew.auth.Path", lambda *a: tmp_path / "nope")
    with patch.dict(os.environ, {}, clear=True):
        with pytest.raises(RuntimeError, match="No API key found"):
            check_api_key()

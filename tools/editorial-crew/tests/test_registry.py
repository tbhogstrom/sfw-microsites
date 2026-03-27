import pytest
from unittest.mock import patch, MagicMock
import sys

# Mock claude_agent_sdk before importing registry
mock_sdk = MagicMock()
mock_sdk.AgentDefinition = MagicMock
sys.modules["claude_agent_sdk"] = mock_sdk

from editorial_crew.agents.registry import SPECIALIST_REGISTRY, get_agent_definitions


EXPECTED_SPECIALISTS = [
    "grammar", "structure", "technical", "seo", "style",
    "accessibility", "engagement", "localization", "compliance", "multimedia",
]


def test_registry_has_all_specialists():
    for name in EXPECTED_SPECIALISTS:
        assert name in SPECIALIST_REGISTRY, f"Missing specialist: {name}"


def test_registry_has_no_extras():
    for name in SPECIALIST_REGISTRY:
        assert name in EXPECTED_SPECIALISTS, f"Unexpected specialist: {name}"


def test_get_agent_definitions_returns_all():
    defs = get_agent_definitions()
    assert len(defs) == 10
    for name in EXPECTED_SPECIALISTS:
        assert name in defs


def test_get_agent_definitions_filtered():
    defs = get_agent_definitions(filter_names=["grammar", "seo"])
    assert len(defs) == 2
    assert "grammar" in defs
    assert "seo" in defs


def test_get_agent_definitions_unknown_raises():
    with pytest.raises(ValueError, match="Unknown specialist"):
        get_agent_definitions(filter_names=["grammar", "nonexistent"])

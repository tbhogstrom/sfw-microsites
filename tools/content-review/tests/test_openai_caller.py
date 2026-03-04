import pytest
from unittest.mock import MagicMock
from openai_caller import call_agent


def test_call_agent_returns_string(mocker):
    mock_response = MagicMock()
    mock_response.choices[0].message.content = "# Improved Content\n\nBody text."

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = mock_response

    result = call_agent(
        client=mock_client,
        model="gpt-4o-mini",
        temperature=0.2,
        system_prompt="You are an editor.",
        content="# Draft\n\nBody.",
    )
    assert result == "# Improved Content\n\nBody text."


def test_call_agent_passes_correct_messages(mocker):
    mock_response = MagicMock()
    mock_response.choices[0].message.content = "output"

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = mock_response

    call_agent(
        client=mock_client,
        model="gpt-4o",
        temperature=0.5,
        system_prompt="System.",
        content="User content.",
    )

    call_args = mock_client.chat.completions.create.call_args
    assert call_args.kwargs["model"] == "gpt-4o"
    assert call_args.kwargs["temperature"] == 0.5
    messages = call_args.kwargs["messages"]
    assert messages[0]["role"] == "system"
    assert "System." in messages[0]["content"]
    assert messages[1]["role"] == "user"
    assert "User content." in messages[1]["content"]


def test_call_agent_raises_on_empty_response(mocker):
    mock_response = MagicMock()
    mock_response.choices[0].message.content = ""

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = mock_response

    with pytest.raises(ValueError, match="empty response"):
        call_agent(
            client=mock_client,
            model="gpt-4o-mini",
            temperature=0.2,
            system_prompt="System.",
            content="Content.",
        )


def test_call_agent_raises_on_none_response(mocker):
    mock_response = MagicMock()
    mock_response.choices[0].message.content = None

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = mock_response

    with pytest.raises(ValueError, match="empty response"):
        call_agent(
            client=mock_client,
            model="gpt-4o-mini",
            temperature=0.2,
            system_prompt="System.",
            content="Content.",
        )

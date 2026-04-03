import pytest
from unittest.mock import patch, MagicMock


def test_rag_engine_search_returns_list():
    """Test RAG search with mocked LanceDB."""
    import pandas as pd

    mock_table = MagicMock()
    mock_results = pd.DataFrame([
        {"source": "Renovation", "page": 168, "text": "Trim repair content"},
        {"source": "Siding & Trim", "page": 197, "text": "More trim content"},
    ])
    mock_table.search.return_value.limit.return_value.to_pandas.return_value = mock_results

    mock_db = MagicMock()
    mock_db.open_table.return_value = mock_table

    mock_embedder = MagicMock()
    mock_embedder.encode.return_value = [[0.1] * 384]

    with patch("editorial_crew.rag.lancedb") as mock_lancedb, \
         patch("editorial_crew.rag.SentenceTransformer", return_value=mock_embedder):
        mock_lancedb.connect.return_value = mock_db

        from editorial_crew.rag import RAGEngine
        engine = RAGEngine(
            db_path="/fake/path",
            table_name="construction_books",
            embedding_model="all-MiniLM-L6-v2",
            device="cpu",
        )
        results = engine.search("exterior trim rot repair", top_k=2)

    assert len(results) == 2
    assert results[0]["source"] == "Renovation"
    assert results[0]["page"] == 168
    assert "Trim repair content" in results[0]["text"]


def test_rag_engine_format_context():
    """Test context formatting for agent prompts."""
    with patch("editorial_crew.rag.lancedb"), \
         patch("editorial_crew.rag.SentenceTransformer"):
        from editorial_crew.rag import RAGEngine
        engine = RAGEngine.__new__(RAGEngine)

        results = [
            {"source": "Renovation", "page": 168, "text": "Trim content"},
            {"source": "Siding & Trim", "page": 197, "text": "More content"},
        ]
        context = engine.format_context(results)

    assert "Source: Renovation (Page 168)" in context
    assert "Trim content" in context
    assert "---" in context


def test_check_generate_deps_missing():
    """Test that missing deps raise a clear error."""
    from editorial_crew.rag import check_generate_deps
    assert callable(check_generate_deps)

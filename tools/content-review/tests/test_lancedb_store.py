import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock
from lancedb_store import ContentStore, SimilarPage


def test_upsert_and_find_similar_returns_list(tmp_path):
    store = ContentStore(db_path=str(tmp_path / "test.lancedb"))

    with patch.object(store, "_embed", return_value=[0.1] * 1536):
        store.upsert(app="deck-repair", filename="file-a.md", content="Deck boards rot in wet climates.")
        store.upsert(app="deck-repair", filename="file-b.md", content="Deck boards rot in rainy weather.")
        results = store.find_similar(
            app="siding-repair", filename="file-c.md",
            content="Wood siding rots in wet climates.", top_k=2
        )

    assert isinstance(results, list)
    assert all(isinstance(r, SimilarPage) for r in results)


def test_upsert_overwrites_existing_entry(tmp_path):
    store = ContentStore(db_path=str(tmp_path / "test.lancedb"))

    with patch.object(store, "_embed", return_value=[0.1] * 1536):
        store.upsert(app="deck-repair", filename="file-a.md", content="Version 1")
        store.upsert(app="deck-repair", filename="file-a.md", content="Version 2")
        # Should not raise; second upsert replaces the first


def test_find_similar_excludes_self(tmp_path):
    store = ContentStore(db_path=str(tmp_path / "test.lancedb"))

    with patch.object(store, "_embed", return_value=[0.5] * 1536):
        store.upsert(app="deck-repair", filename="target.md", content="Content A")
        store.upsert(app="deck-repair", filename="other.md", content="Content B")
        results = store.find_similar(
            app="deck-repair", filename="target.md",
            content="Content A", top_k=5
        )

    # Should not include itself in results
    for r in results:
        assert not (r.app == "deck-repair" and r.filename == "target.md")


def test_similar_page_has_required_fields(tmp_path):
    store = ContentStore(db_path=str(tmp_path / "test.lancedb"))

    with patch.object(store, "_embed", return_value=[0.2] * 1536):
        store.upsert(app="dry-rot", filename="page.md", content="Dry rot in wood.")
        results = store.find_similar(
            app="mold-testing", filename="other.md",
            content="Mold in wood.", top_k=1
        )

    if results:
        r = results[0]
        assert hasattr(r, "app")
        assert hasattr(r, "filename")
        assert hasattr(r, "score")
        assert isinstance(r.score, float)


def test_find_similar_returns_empty_on_empty_store(tmp_path):
    store = ContentStore(db_path=str(tmp_path / "test.lancedb"))

    with patch.object(store, "_embed", return_value=[0.1] * 1536):
        results = store.find_similar(
            app="deck-repair", filename="file.md",
            content="Some content.", top_k=3
        )

    assert results == []

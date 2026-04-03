from __future__ import annotations

from typing import Any


def check_generate_deps() -> None:
    """Check that generation dependencies are installed. Raises RuntimeError if not."""
    missing = []
    try:
        import lancedb  # noqa: F401
    except ImportError:
        missing.append("lancedb")
    try:
        import sentence_transformers  # noqa: F401
    except ImportError:
        missing.append("sentence-transformers")
    try:
        import torch  # noqa: F401
    except ImportError:
        missing.append("torch")

    if missing:
        raise RuntimeError(
            f"Generation requires: {', '.join(missing)}\n"
            "Install with: pip install -e '.[generate]'"
        )


# Lazy imports — only loaded when RAGEngine is instantiated
lancedb: Any = None
SentenceTransformer: Any = None


class RAGEngine:
    """Thin wrapper around LanceDB for construction book retrieval."""

    def __init__(
        self,
        db_path: str,
        table_name: str,
        embedding_model: str = "all-MiniLM-L6-v2",
        device: str = "cuda",
    ) -> None:
        global lancedb, SentenceTransformer

        if lancedb is None:
            import lancedb as _lancedb
            lancedb = _lancedb

        if SentenceTransformer is None:
            from sentence_transformers import SentenceTransformer as _ST
            SentenceTransformer = _ST

        try:
            import torch
            actual_device = device if torch.cuda.is_available() else "cpu"
            if actual_device != device:
                import warnings
                warnings.warn("CUDA not available, falling back to CPU (slower embeddings)")
        except ImportError:
            actual_device = "cpu"

        self._embedder = SentenceTransformer(embedding_model, device=actual_device)
        self._db = lancedb.connect(db_path)
        self._table = self._db.open_table(table_name)

    def search(self, query: str, top_k: int = 20) -> list[dict]:
        """Search construction books and return list of {source, page, text}."""
        embedding = self._embedder.encode([query])[0]
        results = self._table.search(embedding).limit(top_k).to_pandas()
        return [
            {
                "source": row.get("source", "Unknown"),
                "page": row.get("page", "N/A"),
                "text": row["text"],
            }
            for _, row in results.iterrows()
        ]

    def format_context(self, results: list[dict]) -> str:
        """Format search results into a text block for agent prompts."""
        return "\n\n---\n\n".join(
            f"Source: {r['source']} (Page {r['page']})\n{r['text']}"
            for r in results
        )

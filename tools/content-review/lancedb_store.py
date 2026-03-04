from __future__ import annotations
import lancedb
import pyarrow as pa
from pydantic import BaseModel
from openai import OpenAI


class SimilarPage(BaseModel):
    app: str
    filename: str
    score: float


class ContentStore:
    TABLE_NAME = "content"

    def __init__(self, db_path: str = ".lancedb", openai_client: OpenAI | None = None):
        self.db = lancedb.connect(db_path)
        self.client = openai_client
        self._ensure_table()

    def _ensure_table(self) -> None:
        if self.TABLE_NAME not in self.db.list_tables():
            schema = pa.schema([
                pa.field("app", pa.string()),
                pa.field("filename", pa.string()),
                pa.field("content_preview", pa.string()),
                pa.field("vector", pa.list_(pa.float32(), 1536)),
            ])
            self.db.create_table(self.TABLE_NAME, schema=schema)

    def _embed(self, text: str) -> list[float]:
        response = self.client.embeddings.create(
            model="text-embedding-3-small",
            input=text[:8000],
        )
        return response.data[0].embedding

    def upsert(self, app: str, filename: str, content: str) -> None:
        vector = self._embed(content)
        table = self.db.open_table(self.TABLE_NAME)
        try:
            table.delete(f"app = '{app}' AND filename = '{filename}'")
        except Exception:
            pass
        table.add([{
            "app": app,
            "filename": filename,
            "content_preview": content[:200],
            "vector": vector,
        }])

    def find_similar(
        self, app: str, filename: str, content: str, top_k: int = 3
    ) -> list[SimilarPage]:
        table = self.db.open_table(self.TABLE_NAME)
        row_count = table.count_rows()
        if row_count == 0:
            return []

        vector = self._embed(content)
        results = (
            table.search(vector)
            .where(f"NOT (app = '{app}' AND filename = '{filename}')")
            .limit(top_k)
            .to_list()
        )
        return [
            SimilarPage(app=r["app"], filename=r["filename"], score=float(r["_distance"]))
            for r in results
        ]

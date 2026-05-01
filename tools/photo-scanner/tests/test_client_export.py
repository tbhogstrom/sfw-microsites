"""Tests for client export catalog migrations, helpers, AI parser, zip helpers."""
import json
import sqlite3
import pytest
from pathlib import Path

from photo_scanner.catalog import Catalog


@pytest.fixture
def catalog(tmp_path):
    db = Catalog(tmp_path / "test.db")
    yield db
    db.close()


def test_photos_has_client_export_columns(catalog):
    """photos table has client_export_status and client_export_flags columns."""
    cols = {row[1] for row in catalog.db.execute("PRAGMA table_info(photos)")}
    assert "client_export_status" in cols
    assert "client_export_flags" in cols


def test_migration_adds_columns_to_existing_db(tmp_path):
    """Opening a Catalog against a DB created before these columns existed adds them."""
    db_path = tmp_path / "legacy.db"
    # Build a legacy schema by hand — full production shape minus the two new columns.
    # Must include every column the FTS triggers reference, otherwise the trigger
    # creation in _create_tables fails on this legacy DB.
    conn = sqlite3.connect(str(db_path))
    conn.executescript("""
        CREATE TABLE photos (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            uri TEXT NOT NULL,
            thumb_uri TEXT DEFAULT '',
            taken_at TEXT DEFAULT '',
            creator_name TEXT DEFAULT '',
            description TEXT DEFAULT '',
            triage_status TEXT,
            scene TEXT,
            service_types TEXT,
            phase TEXT,
            entities TEXT,
            marketing_score INTEGER,
            marketing_notes TEXT,
            before_after_potential INTEGER DEFAULT 0,
            damage_details TEXT
        );
    """)
    conn.commit()
    conn.close()

    cat = Catalog(db_path)
    cols = {row[1] for row in cat.db.execute("PRAGMA table_info(photos)")}
    assert "client_export_status" in cols
    assert "client_export_flags" in cols
    cat.close()

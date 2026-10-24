"""Data layer for querying the January 2026 Elexon SQLite dataset."""

import os
import sqlite3
from pathlib import Path
from typing import Optional

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "elexon_jan2026.db"


def get_db_path() -> Path:
    return DB_PATH


def get_db_connection() -> sqlite3.Connection:
    if not DB_PATH.exists():
        raise FileNotFoundError(f"Database not found at {DB_PATH}. Please run scripts/ingest.py.")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def is_db_ready() -> bool:
    if not DB_PATH.exists():
        return False
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM actual_wind")
        count = cursor.fetchone()[0]
        conn.close()
        return count > 0
    except Exception:
        return False

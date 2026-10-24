import sqlite3
import pytest
from datetime import date, datetime, timezone

from app.selection import SELECTION_SQL, parse_iso_utc


@pytest.fixture
def mock_db():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("""
        CREATE TABLE actual_wind (\n            startTime TEXT PRIMARY KEY,
            settlementDate TEXT NOT NULL,
            settlementPeriod INTEGER NOT NULL,
            generation REAL NOT NULL,
            publishTime TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE forecast_wind (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            startTime TEXT NOT NULL,
            publishTime TEXT NOT NULL,
            generation REAL NOT NULL
        )
    """)

    # Delivery day: 2026-01-05. Cutoff on D-1 (2026-01-04) at 09:00:00Z
    # Hour 00:00: SP 1 actual = 10000, SP 2 actual = 9000 -> Mean actual = 9500.0 MW
    conn.execute("INSERT INTO actual_wind VALUES ('2026-01-05T00:00:00Z', '2026-01-05', 1, 10000.0, '2026-01-05T00:30:00Z')")
    conn.execute("INSERT INTO actual_wind VALUES ('2026-01-05T00:30:00Z', '2026-01-05', 2, 9000.0, '2026-01-05T01:00:00Z')")
    conn.execute("INSERT INTO forecast_wind (startTime, publishTime, generation) VALUES ('2026-01-05T00:00:00Z', '2026-01-04T06:00:00Z', 10500.0)")
    conn.execute("INSERT INTO forecast_wind (startTime, publishTime, generation) VALUES ('2026-01-05T00:00:00Z', '2026-01-04T08:30:00Z', 11200.0)")  # LATEST before cutoff
    conn.execute("INSERT INTO forecast_wind (startTime, publishTime, generation) VALUES ('2026-01-05T00:00:00Z', '2026-01-04T10:00:00Z', 15000.0)")  # AFTER cutoff (must be ignored)

    # Hour 01:00: ONLY forecast is published after cutoff (09:15) -> must be MISSING
    conn.execute("INSERT INTO actual_wind VALUES ('2026-01-05T01:00:00Z', '2026-01-05', 3, 9200.0, '2026-01-05T01:30:00Z')")
    conn.execute("INSERT INTO actual_wind VALUES ('2026-01-05T01:30:00Z', '2026-01-05', 4, 8800.0, '2026-01-05T02:00:00Z')")
    conn.execute("INSERT INTO forecast_wind (startTime, publishTime, generation) VALUES ('2026-01-05T01:00:00Z', '2026-01-04T09:15:00Z', 9000.0)")

    # Hour 02:00: NO forecast ever published -> must be MISSING
    conn.execute("INSERT INTO actual_wind VALUES ('2026-01-05T02:00:00Z', '2026-01-05', 5, 8000.0, '2026-01-05T02:30:00Z')")
    conn.execute("INSERT INTO actual_wind VALUES ('2026-01-05T02:30:00Z', '2026-01-05', 6, 8200.0, '2026-01-05T03:00:00Z')")

    conn.commit()
    yield conn
    conn.close()


def test_selection_picks_latest_before_cutoff_and_aggregates_hourly(mock_db):
    cutoff_iso = "2026-01-04T09:00:00Z"
    delivery_date = "2026-01-05"

    rows = mock_db.execute(SELECTION_SQL, (cutoff_iso, delivery_date)).fetchall()
    assert len(rows) == 3

    # Hour 00:00: Mean actual = (10000 + 9000) / 2 = 9500.0, picks forecast 11200.0 at 08:30
    slot1 = rows[0]
    assert slot1["startTime"] == "2026-01-05T00:00:00Z"
    assert slot1["hour"] == 0
    assert slot1["actual_mw"] == 9500.0
    assert slot1["forecast_mw"] == 11200.0
    assert slot1["publishTime"] == "2026-01-04T08:30:00Z"
    assert slot1["forecast_mw"] - slot1["actual_mw"] == 1700.0


def test_selection_excludes_forecast_after_cutoff(mock_db):
    cutoff_iso = "2026-01-04T09:00:00Z"
    delivery_date = "2026-01-05"

    rows = mock_db.execute(SELECTION_SQL, (cutoff_iso, delivery_date)).fetchall()

    # Hour 01:00: Mean actual = (9200 + 8800) / 2 = 9000.0; forecast was after cutoff -> None
    slot2 = rows[1]
    assert slot2["startTime"] == "2026-01-05T01:00:00Z"
    assert slot2["hour"] == 1
    assert slot2["actual_mw"] == 9000.0
    assert slot2["forecast_mw"] is None
    assert slot2["publishTime"] is None


def test_selection_handles_completely_missing_forecast(mock_db):
    cutoff_iso = "2026-01-04T09:00:00Z"
    delivery_date = "2026-01-05"

    rows = mock_db.execute(SELECTION_SQL, (cutoff_iso, delivery_date)).fetchall()

    # Hour 02:00: no forecast at all -> None
    slot3 = rows[2]
    assert slot3["startTime"] == "2026-01-05T02:00:00Z"
    assert slot3["hour"] == 2
    assert slot3["actual_mw"] == 8100.0
    assert slot3["forecast_mw"] is None
    assert slot3["publishTime"] is None

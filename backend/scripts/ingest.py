"""
Elexon BMRS Ingestion Script for January 2026 Wind Forecast Evaluation.

Pulls:
1. FUELHH actual generation (fuelType == 'WIND') for delivery dates 2026-01-02 to 2026-02-01.
2. WINDFOR day-ahead and intra-day wind forecasts published between 2025-12-31 and 2026-02-01.

Stores records into SQLite database at backend/data/elexon_jan2026.db.
"""

import datetime
import json
import os
import sqlite3
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "elexon_jan2026.db"

ELEXON_BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1/datasets"
USER_AGENT = "WindForecastPortalIngest/1.0 (Day-Ahead Analytics)"


def get_db_connection():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    return conn


def init_db(conn):
    with conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS actual_wind (
                startTime TEXT PRIMARY KEY,
                settlementDate TEXT NOT NULL,
                settlementPeriod INTEGER NOT NULL,
                generation REAL NOT NULL,
                publishTime TEXT
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_actual_date ON actual_wind(settlementDate);")

        conn.execute("""
            CREATE TABLE IF NOT EXISTS forecast_wind (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                startTime TEXT NOT NULL,
                publishTime TEXT NOT NULL,
                generation REAL NOT NULL
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_forecast_start_pub ON forecast_wind(startTime, publishTime);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_forecast_pub ON forecast_wind(publishTime);")


def fetch_url(url, retries=3, delay=2):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(1, retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=45) as resp:
                content = resp.read().decode("utf-8")
                return json.loads(content)
        except Exception as e:
            print(f"  [Attempt {attempt}/{retries}] Error fetching {url}: {e}")
            if attempt == retries:
                raise
            time.sleep(delay * attempt)


def ingest_actuals(conn, start_date="2026-01-02", end_date="2026-02-01"):
    print(f"\n--- Ingesting FUELHH actual wind generation ({start_date} to {end_date}) ---")
    url = f"{ELEXON_BASE_URL}/FUELHH/stream?settlementDateFrom={start_date}&settlementDateTo={end_date}&fuelType=WIND"
    
    t0 = time.time()
    data = fetch_url(url)
    if isinstance(data, dict):
        data = data.get("data", [])
    
    wind_records = [
        (
            item["startTime"],
            item["settlementDate"],
            item["settlementPeriod"],
            float(item["generation"]),
            item.get("publishTime")
        )
        for item in data
        if (item.get("fuelType") == "WIND" or item.get("fuelType") is None) and item.get("startTime") and item.get("generation") is not None
    ]

    with conn:
        conn.executemany("""
            INSERT OR REPLACE INTO actual_wind (startTime, settlementDate, settlementPeriod, generation, publishTime)
            VALUES (?, ?, ?, ?, ?)
        """, wind_records)

    print(f"Successfully ingested {len(wind_records)} FUELHH wind actuals in {time.time()-t0:.2f}s")


def ingest_forecasts(conn, start_iso="2025-12-31T00:00:00Z", end_iso="2026-02-01T12:00:00Z"):
    print(f"\n--- Ingesting WINDFOR forecast records ({start_iso} to {end_iso}) ---")
    
    # We fetch in 3-day windows to prevent large payload timeouts
    start_dt = datetime.datetime.fromisoformat(start_iso.replace("Z", "+00:00"))
    end_dt = datetime.datetime.fromisoformat(end_iso.replace("Z", "+00:00"))
    window_delta = datetime.timedelta(days=3)

    curr_start = start_dt
    total_forecasts = 0
    t0 = time.time()

    while curr_start < end_dt:
        curr_end = min(curr_start + window_delta, end_dt)
        s_str = curr_start.strftime("%Y-%m-%dT%H:%M:%SZ")
        e_str = curr_end.strftime("%Y-%m-%dT%H:%M:%SZ")

        url = f"{ELEXON_BASE_URL}/WINDFOR/stream?publishDateTimeFrom={s_str}&publishDateTimeTo={e_str}"
        print(f"  Fetching WINDFOR: {s_str} -> {e_str}...")

        try:
            data = fetch_url(url)
            if isinstance(data, dict):
                data = data.get("data", [])

            records = [
                (
                    item["startTime"],
                    item["publishTime"],
                    float(item["generation"])
                )
                for item in data
                if item.get("startTime") and item.get("publishTime") and item.get("generation") is not None
            ]

            if records:
                with conn:
                    conn.executemany("""
                        INSERT INTO forecast_wind (startTime, publishTime, generation)
                        VALUES (?, ?, ?)
                    """, records)
                total_forecasts += len(records)
                print(f"    Inserted {len(records)} records (total: {total_forecasts})")
        except Exception as e:
            print(f"    Failed window {s_str} -> {e_str}: {e}")

        curr_start = curr_end

    print(f"Successfully ingested {total_forecasts} WINDFOR forecasts in {time.time()-t0:.2f}s")


def verify_ingestion(conn):
    print("\n--- Verifying Ingested Dataset ---")
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*), MIN(settlementDate), MAX(settlementDate), AVG(generation) FROM actual_wind")
    act_count, act_min, act_max, act_avg = cursor.fetchone()
    print(f"Actuals (FUELHH Wind):")
    print(f"  Total slots: {act_count}")
    print(f"  Date range: {act_min} to {act_max}")
    print(f"  Average wind: {act_avg:.1f} MW" if act_avg else "  Average wind: N/A")

    cursor.execute("SELECT COUNT(*), MIN(publishTime), MAX(publishTime), MIN(startTime), MAX(startTime) FROM forecast_wind")
    fc_count, fc_pub_min, fc_pub_max, fc_start_min, fc_start_max = cursor.fetchone()
    print(f"\nForecasts (WINDFOR):")
    print(f"  Total records: {fc_count}")
    print(f"  Publish range: {fc_pub_min} to {fc_pub_max}")
    print(f"  Target slot range: {fc_start_min} to {fc_start_max}")


def main():
    print(f"Starting Elexon Ingestion into: {DB_PATH}")
    conn = get_db_connection()
    init_db(conn)

    ingest_actuals(conn, start_date="2026-01-02", end_date="2026-02-01")
    ingest_forecasts(conn, start_iso="2025-12-31T00:00:00Z", end_iso="2026-02-01T12:00:00Z")
    verify_ingestion(conn)
    conn.close()
    print("\nIngestion completed successfully.")


if __name__ == "__main__":
    main()

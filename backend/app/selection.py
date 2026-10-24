"""Core Day-Ahead Forecast Selection Logic.

For each target hourly delivery slot T on delivery day D:
1. Decision is made on day D-1 before the day-ahead cutoff (default 09:00 UTC).
2. Select the latest WINDFOR forecast published at or before cutoff for that hour.
3. Average the two half-hourly actuals (FUELHH) in that hour to get the true hourly generation.
4. Error = forecast - actual.
"""

import math
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional

from app.data import get_db_connection
from app.schemas import ForecastSlot

SELECTION_SQL = """
WITH ranked_forecasts AS (
    SELECT 
        f.startTime,
        f.generation AS forecast_mw,
        f.publishTime,
        ROW_NUMBER() OVER (
            PARTITION BY f.startTime
            ORDER BY f.publishTime DESC
        ) AS rn
    FROM forecast_wind f
    WHERE f.publishTime <= ?
),
hourly_actuals AS (
    SELECT 
        (substr(startTime, 1, 14) || '00:00Z') AS startTime,
        settlementDate,
        CAST(strftime('%H', startTime) AS INTEGER) AS hour,
        ROUND(AVG(generation), 1) AS actual_mw
    FROM actual_wind
    WHERE settlementDate = ?
    GROUP BY (substr(startTime, 1, 14) || '00:00Z'), settlementDate, CAST(strftime('%H', startTime) AS INTEGER)
)
SELECT 
    ha.startTime,
    ha.settlementDate,
    ha.hour,
    ha.actual_mw,
    rf.forecast_mw,
    rf.publishTime
FROM hourly_actuals ha
LEFT JOIN ranked_forecasts rf 
    ON rf.startTime = ha.startTime AND rf.rn = 1
ORDER BY ha.startTime ASC
"""


def parse_iso_utc(ts_str: str) -> datetime:
    return datetime.fromisoformat(ts_str.replace("Z", "+00:00"))


def get_delivery_day_slots(
    delivery_date: date, cutoff_time: str = "09:00"
) -> List[ForecastSlot]:
    """
    Returns all 24 hourly delivery slots for a given delivery date, joining the true
    hourly actual generation with the latest forecast published prior to cutoff on D-1.
    """
    conn = get_db_connection()
    try:
        d_minus_1 = delivery_date - timedelta(days=1)
        # Normalize cutoff format e.g. "09:00" -> "09:00:00Z"
        time_part = cutoff_time.strip()
        if len(time_part.split(":")) == 2:
            time_part = f"{time_part}:00"
        cutoff_iso = f"{d_minus_1.isoformat()}T{time_part}Z"

        rows = conn.execute(
            SELECTION_SQL, (cutoff_iso, delivery_date.isoformat())
        ).fetchall()

        slots: List[ForecastSlot] = []
        for r in rows:
            start_dt = parse_iso_utc(r["startTime"])
            act = float(r["actual_mw"]) if r["actual_mw"] is not None else None
            fc = float(r["forecast_mw"]) if r["forecast_mw"] is not None else None
            pub_str = r["publishTime"]
            pub_dt = parse_iso_utc(pub_str) if pub_str else None

            err: Optional[float] = None
            abs_err: Optional[float] = None
            horizon: Optional[float] = None

            if fc is not None and act is not None:
                err = round(fc - act, 1)
                abs_err = round(abs(err), 1)

            if pub_dt and start_dt:
                delta_hrs = (start_dt - pub_dt).total_seconds() / 3600.0
                horizon = round(delta_hrs, 1)

            slots.append(
                ForecastSlot(
                    start_time=start_dt,
                    settlement_period=r["hour"] + 1,  # Hour index 1-24
                    actual_mw=act,
                    forecast_mw=fc,
                    publish_time=pub_dt,
                    horizon_hours=horizon,
                    error_mw=err,
                    abs_error_mw=abs_err,
                )
            )

        return slots
    finally:
        conn.close()


def get_delivery_range_slots(
    start_date: date, end_date: date, cutoff_time: str = "09:00"
) -> list[ForecastSlot]:
    """Returns slots for a date range by evaluating each delivery day."""
    all_slots: List[ForecastSlot] = []
    curr = start_date
    while curr <= end_date:
        day_slots = get_delivery_day_slots(curr, cutoff_time=cutoff_time)
        all_slots.extend(day_slots)
        curr += timedelta(days=1)
    return all_slots

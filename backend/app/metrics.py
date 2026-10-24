"""Metrics evaluation module for wind forecast accuracy."""

import math
from datetime import date
from typing import List, Optional
import numpy as np

from app.schemas import ForecastSlot, HorizonMetric, HourlyMetric, MetricsSummary


def calculate_metrics(
    slots: List[ForecastSlot],
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> MetricsSummary:
    """Calculates MAE, RMSE, bias, percentiles (P50, P90, P95), and directional ratios."""
    valid_slots = [
        s for s in slots
        if s.actual_mw is not None and s.forecast_mw is not None and s.error_mw is not None
    ]

    if not valid_slots:
        return MetricsSummary(
            start_date=start_date,
            end_date=end_date,
            mae=0.0,
            rmse=0.0,
            bias=0.0,
            mape=0.0,
            p50_absolute_error=0.0,
            p90_absolute_error=0.0,
            p95_absolute_error=0.0,
            under_forecast_pct=0.0,
            over_forecast_pct=0.0,
            sample_count=0,
        )

    errors = np.array([s.error_mw for s in valid_slots], dtype=float)
    abs_errors = np.abs(errors)
    actuals = np.array([s.actual_mw for s in valid_slots], dtype=float)

    mae = float(np.mean(abs_errors))
    rmse = float(np.sqrt(np.mean(errors ** 2)))
    bias = float(np.mean(errors))

    # Percentiles of absolute error
    p50 = float(np.percentile(abs_errors, 50))
    p90 = float(np.percentile(abs_errors, 90))
    p95 = float(np.percentile(abs_errors, 95))

    # Normalized MAE as % of mean generation
    mean_actual = float(np.mean(actuals))
    nmae = float((mae / mean_actual * 100)) if mean_actual > 0 else 0.0

    under_count = int(np.sum(errors < 0))
    over_count = int(np.sum(errors > 0))
    n = len(valid_slots)

    under_pct = round((under_count / n) * 100, 1)
    over_pct = round((over_count / n) * 100, 1)

    return MetricsSummary(
        start_date=start_date,
        end_date=end_date,
        mae=round(mae, 1),
        rmse=round(rmse, 1),
        bias=round(bias, 1),
        mape=round(nmae, 2),
        p50_absolute_error=round(p50, 1),
        p90_absolute_error=round(p90, 1),
        p95_absolute_error=round(p95, 1),
        under_forecast_pct=under_pct,
        over_forecast_pct=over_pct,
        sample_count=n,
    )


def calculate_hourly_metrics(slots: List[ForecastSlot]) -> List[HourlyMetric]:
    """Calculates error metrics grouped by hour of the delivery day (0-23 UTC)."""
    by_hour: dict[int, list[float]] = {h: [] for h in range(24)}

    for s in slots:
        if s.error_mw is not None and s.start_time:
            hour = s.start_time.hour
            by_hour[hour].append(s.error_mw)

    results: List[HourlyMetric] = []
    for h in range(24):
        err_list = by_hour[h]
        if not err_list:
            results.append(
                HourlyMetric(hour=h, mae=0.0, rmse=0.0, bias=0.0, p90_absolute_error=0.0, sample_count=0)
            )
            continue

        arr = np.array(err_list, dtype=float)
        abs_arr = np.abs(arr)
        mae = float(np.mean(abs_arr))
        rmse = float(np.sqrt(np.mean(arr ** 2)))
        bias = float(np.mean(arr))
        p90 = float(np.percentile(abs_arr, 90))

        results.append(
            HourlyMetric(
                hour=h,
                mae=round(mae, 1),
                rmse=round(rmse, 1),
                bias=round(bias, 1),
                p90_absolute_error=round(p90, 1),
                sample_count=len(err_list),
            )
        )

    return results


def calculate_horizon_metrics(slots: List[ForecastSlot]) -> List[HorizonMetric]:
    """Calculates error metrics grouped by forecast lead time horizon."""
    by_horizon: dict[float, list[float]] = {}

    for s in slots:
        if s.error_mw is not None and s.horizon_hours is not None:
            # Group into integer horizon hours
            bucket = round(s.horizon_hours)
            if bucket not in by_horizon:
                by_horizon[bucket] = []
            by_horizon[bucket].append(s.error_mw)

    sorted_horizons = sorted(by_horizon.keys())
    results: List[HorizonMetric] = []

    for h in sorted_horizons:
        err_list = by_horizon[h]
        arr = np.array(err_list, dtype=float)
        abs_arr = np.abs(arr)
        mae = float(np.mean(abs_arr))
        rmse = float(np.sqrt(np.mean(arr ** 2)))
        bias = float(np.mean(arr))
        p90 = float(np.percentile(abs_arr, 90))

        results.append(
            HorizonMetric(
                horizon_hours=float(h),
                mae=round(mae, 1),
                rmse=round(rmse, 1),
                bias=round(bias, 1),
                p90_absolute_error=round(p90, 1),
                sample_count=len(err_list),
            )
        )

    return results

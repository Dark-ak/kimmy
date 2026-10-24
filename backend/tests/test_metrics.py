import math
from datetime import datetime, timezone
import pytest

from app.metrics import calculate_metrics, calculate_hourly_metrics, calculate_horizon_metrics
from app.schemas import ForecastSlot


def make_slot(hour: int, actual: float, forecast: float, horizon_hours: float = 24.0) -> ForecastSlot:
    start_dt = datetime(2026, 1, 5, hour, 0, tzinfo=timezone.utc)
    err = forecast - actual
    return ForecastSlot(
        start_time=start_dt,
        settlement_period=hour * 2 + 1,
        actual_mw=actual,
        forecast_mw=forecast,
        publish_time=datetime(2026, 1, 4, 8, 0, tzinfo=timezone.utc),
        horizon_hours=horizon_hours,
        error_mw=err,
        abs_error_mw=abs(err),
    )


def test_metrics_hand_computed_values():
    # Errors: +100, -200, +300, -400
    # Abs: 100, 200, 300, 400
    # Mean actual: (2000 + 2000 + 2000 + 2000) / 4 = 2000
    slots = [
        make_slot(0, 2000.0, 2100.0), # err = +100
        make_slot(1, 2000.0, 1800.0), # err = -200
        make_slot(2, 2000.0, 2300.0), # err = +300
        make_slot(3, 2000.0, 1600.0), # err = -400
    ]

    metrics = calculate_metrics(slots)

    # MAE = (100 + 200 + 300 + 400) / 4 = 250.0
    assert metrics.mae == 250.0

    # Bias = (100 - 200 + 300 - 400) / 4 = -50.0
    assert metrics.bias == -50.0

    # RMSE = sqrt((100^2 + 200^2 + 300^2 + 400^2) / 4) = sqrt(75000) = 273.9
    assert round(metrics.rmse, 1) == 273.9

    # NMAE = 250 / 2000 * 100 = 12.5%
    assert metrics.mape == 12.5

    # Under vs Over counts
    assert metrics.under_forecast_pct == 50.0
    assert metrics.over_forecast_pct == 50.0
    assert metrics.sample_count == 4


def test_metrics_handles_empty_or_all_missing():
    empty_slots = [
        ForecastSlot(start_time=datetime(2026, 1, 5, 0, 0, tzinfo=timezone.utc), actual_mw=5000.0, forecast_mw=None),
    ]
    metrics = calculate_metrics(empty_slots)
    assert metrics.mae == 0.0
    assert metrics.sample_count == 0

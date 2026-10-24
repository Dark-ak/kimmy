from datetime import date
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from app.config import settings
from app.metrics import (
    calculate_horizon_metrics,
    calculate_hourly_metrics,
    calculate_metrics,
)
from app.schemas import HorizonMetric, HourlyMetric, MetricsSummary
from app.selection import get_delivery_day_slots, get_delivery_range_slots

router = APIRouter()


def _resolve_slots(
    start: Optional[date],
    end: Optional[date],
    cutoff_time: Optional[str],
):
    effective_cutoff = cutoff_time or settings.cutoff_time
    if start and end:
        if start > end:
            raise HTTPException(
                status_code=400, detail="Start date cannot be after end date"
            )
        return get_delivery_range_slots(start, end, cutoff_time=effective_cutoff)
    elif start:
        return get_delivery_day_slots(start, cutoff_time=effective_cutoff)
    else:
        # Default evaluate whole dataset range (Jan 2 to Feb 1, 2026)
        default_start = date.fromisoformat(settings.data_start_date)
        default_end = date.fromisoformat(settings.data_end_date)
        return get_delivery_range_slots(
            default_start, default_end, cutoff_time=effective_cutoff
        )


@router.get(
    "",
    response_model=MetricsSummary,
    summary="Aggregated forecast accuracy metrics",
)
async def get_metrics(
    start: Optional[date] = Query(
        default=None, description="Start delivery date for metrics evaluation"
    ),
    end: Optional[date] = Query(
        default=None, description="End delivery date for metrics evaluation"
    ),
    cutoff_time: Optional[str] = Query(
        default=None, description="Optional override cutoff time"
    ),
):
    """
    Calculates MAE, RMSE, bias, and percentile errors (P50, P90 safety margin, P95) for the range.
    """
    slots = _resolve_slots(start, end, cutoff_time)
    return calculate_metrics(slots, start_date=start, end_date=end)


@router.get(
    "/by-hour",
    response_model=List[HourlyMetric],
    summary="Error metrics grouped by hour of the day",
)
async def get_metrics_by_hour(
    start: Optional[date] = Query(default=None, description="Start delivery date"),
    end: Optional[date] = Query(default=None, description="End delivery date"),
    cutoff_time: Optional[str] = Query(
        default=None, description="Optional override cutoff time"
    ),
):
    """Returns error distribution across the 24 hours of delivery day."""
    slots = _resolve_slots(start, end, cutoff_time)
    return calculate_hourly_metrics(slots)


@router.get(
    "/by-horizon",
    response_model=List[HorizonMetric],
    summary="Error metrics grouped by forecast horizon lead time",
)
async def get_metrics_by_horizon(
    start: Optional[date] = Query(default=None, description="Start delivery date"),
    end: Optional[date] = Query(default=None, description="End delivery date"),
    cutoff_time: Optional[str] = Query(
        default=None, description="Optional override cutoff time"
    ),
):
    """Returns error metrics grouped by lead time (hours between publishTime and startTime)."""
    slots = _resolve_slots(start, end, cutoff_time)
    return calculate_horizon_metrics(slots)

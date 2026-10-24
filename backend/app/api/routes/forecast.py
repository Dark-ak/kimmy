from datetime import date
from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from app.config import settings
from app.schemas import ForecastRangeResponse, ForecastResponse
from app.selection import get_delivery_day_slots, get_delivery_range_slots

router = APIRouter()


@router.get(
    "",
    response_model=ForecastResponse,
    summary="Day-ahead forecast vs actual generation for a single delivery day",
)
async def get_forecast(
    delivery_date: date = Query(
        ...,
        description="Target delivery date (YYYY-MM-DD)",
        examples=["2026-01-15"],
    ),
    cutoff_time: Optional[str] = Query(
        default=None,
        description="Optional override cutoff time in HH:MM (defaults to configured cutoff)",
    ),
):
    """
    Returns latest wind generation forecast available before D-1 cutoff joined with
    actual generation for each delivery slot.
    """
    effective_cutoff = cutoff_time or settings.cutoff_time
    slots = get_delivery_day_slots(delivery_date, cutoff_time=effective_cutoff)
    missing_count = sum(1 for s in slots if s.forecast_mw is None)

    return ForecastResponse(
        delivery_date=delivery_date,
        cutoff_time=effective_cutoff,
        slots=slots,
        total_slots=len(slots),
        missing_slots=missing_count,
    )


@router.get(
    "/range",
    response_model=ForecastRangeResponse,
    summary="Day-ahead forecast vs actual generation for a date range",
)
async def get_forecast_range(
    start: date = Query(
        ...,
        description="Range start delivery date (YYYY-MM-DD)",
        examples=["2026-01-02"],
    ),
    end: date = Query(
        ...,
        description="Range end delivery date (YYYY-MM-DD)",
        examples=["2026-01-08"],
    ),
    cutoff_time: Optional[str] = Query(
        default=None,
        description="Optional override cutoff time in HH:MM",
    ),
):
    """
    Returns day-ahead forecast vs actual generation for all delivery slots in the date range.
    """
    if start > end:
        raise HTTPException(status_code=400, detail="Start date cannot be after end date")

    effective_cutoff = cutoff_time or settings.cutoff_time
    slots = get_delivery_range_slots(start, end, cutoff_time=effective_cutoff)

    return ForecastRangeResponse(
        start_date=start,
        end_date=end,
        cutoff_time=effective_cutoff,
        slots=slots,
        total_slots=len(slots),
    )

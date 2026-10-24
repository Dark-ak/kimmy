from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(default="ok", description="Liveness check status")
    timestamp: datetime = Field(description="Current server UTC timestamp")
    version: str = Field(description="API version")


class ConfigResponse(BaseModel):
    cutoff_time: str = Field(
        description="Configured day-ahead decision cutoff time (UK/UTC)"
    )
    timezone: str = Field(description="Data and cutoff timezone")
    data_start_date: str = Field(description="Earliest available delivery date")
    data_end_date: str = Field(description="Latest available delivery date")


class ForecastSlot(BaseModel):
    start_time: datetime = Field(description="Target delivery slot start time (UTC)")
    settlement_period: Optional[int] = Field(
        default=None, description="UK settlement period (1-48/50)"
    )
    forecast_mw: Optional[float] = Field(
        default=None, description="Forecasted wind generation in MW"
    )
    actual_mw: Optional[float] = Field(
        default=None, description="Actual wind generation in MW"
    )
    publish_time: Optional[datetime] = Field(
        default=None, description="Publication timestamp of the forecast used"
    )
    horizon_hours: Optional[float] = Field(
        default=None, description="Hours between publishTime and startTime"
    )
    error_mw: Optional[float] = Field(
        default=None, description="Error in MW: forecast - actual"
    )
    abs_error_mw: Optional[float] = Field(
        default=None, description="Absolute error in MW"
    )


class ForecastResponse(BaseModel):
    delivery_date: date = Field(description="Target delivery date")
    cutoff_time: str = Field(description="Cutoff time applied on D-1")
    slots: List[ForecastSlot] = Field(
        default_factory=list, description="Hourly forecast and delivery slots"
    )
    total_slots: int = Field(description="Total slots for the day")
    missing_slots: int = Field(description="Slots with missing forecast before cutoff")


class ForecastRangeResponse(BaseModel):
    start_date: date = Field(description="Range start delivery date")
    end_date: date = Field(description="Range end delivery date")
    cutoff_time: str = Field(description="Cutoff time applied on D-1")
    slots: List[ForecastSlot] = Field(
        default_factory=list, description="All delivery slots in the range"
    )
    total_slots: int = Field(description="Total slots in range")


class MetricsSummary(BaseModel):
    start_date: Optional[date] = Field(
        default=None, description="Metrics evaluation start date"
    )
    end_date: Optional[date] = Field(
        default=None, description="Metrics evaluation end date"
    )
    mae: float = Field(description="Mean Absolute Error (MW)")
    rmse: float = Field(description="Root Mean Squared Error (MW)")
    bias: float = Field(description="Bias / Mean Error (MW): mean(forecast - actual)")
    mape: Optional[float] = Field(
        default=None, description="Mean Absolute Percentage Error (%)"
    )
    p50_absolute_error: float = Field(
        description="50th percentile (Median) of absolute error (MW)"
    )
    p90_absolute_error: float = Field(
        description="90th percentile of absolute error (MW) - safety margin"
    )
    p95_absolute_error: float = Field(
        description="95th percentile of absolute error (MW)"
    )
    under_forecast_pct: float = Field(
        description="Percentage of slots under-forecasted (forecast < actual)"
    )
    over_forecast_pct: float = Field(
        description="Percentage of slots over-forecasted (forecast > actual)"
    )
    sample_count: int = Field(description="Number of valid evaluated delivery slots")


class HourlyMetric(BaseModel):
    hour: int = Field(description="Hour of day (0-23 UTC)")
    mae: float = Field(description="Mean Absolute Error for this hour (MW)")
    rmse: float = Field(description="Root Mean Squared Error for this hour (MW)")
    bias: float = Field(description="Bias for this hour (MW)")
    p90_absolute_error: float = Field(
        description="90th percentile of absolute error for this hour (MW)"
    )
    sample_count: int = Field(description="Number of slots evaluated for this hour")


class HorizonMetric(BaseModel):
    horizon_hours: float = Field(description="Lead time / forecast horizon in hours")
    mae: float = Field(description="Mean Absolute Error for this horizon (MW)")
    rmse: float = Field(description="Root Mean Squared Error for this horizon (MW)")
    bias: float = Field(description="Bias for this horizon (MW)")
    p90_absolute_error: float = Field(
        description="90th percentile of absolute error for this horizon (MW)"
    )
    sample_count: int = Field(description="Number of slots evaluated for this horizon")

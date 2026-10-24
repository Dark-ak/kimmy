import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    app_name: str = "Wind Forecast Portal API"
    app_version: str = "0.1.0"
    cutoff_time: str = os.getenv("CUTOFF_TIME", "09:00")
    timezone: str = os.getenv("TIMEZONE", "UTC")
    data_start_date: str = os.getenv("DATA_START_DATE", "2026-01-02")
    data_end_date: str = os.getenv("DATA_END_DATE", "2026-02-01")
    cors_origins: list[str] = ("*",)


settings = Settings()

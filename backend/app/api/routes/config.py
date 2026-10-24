from fastapi import APIRouter

from app.config import settings
from app.schemas import ConfigResponse

router = APIRouter()


@router.get(
    "/config",
    response_model=ConfigResponse,
    summary="Active configuration parameters",
)
async def get_config():
    """Returns cutoff time configuration and available data date range."""
    return ConfigResponse(
        cutoff_time=settings.cutoff_time,
        timezone=settings.timezone,
        data_start_date=settings.data_start_date,
        data_end_date=settings.data_end_date,
    )

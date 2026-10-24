from fastapi import APIRouter

from app.api.routes import config, forecast, health, metrics

api_router = APIRouter()

api_router.include_router(health.router, tags=["System"])
api_router.include_router(config.router, tags=["System"])
api_router.include_router(forecast.router, prefix="/forecast", tags=["Forecast"])
api_router.include_router(metrics.router, prefix="/metrics", tags=["Metrics"])

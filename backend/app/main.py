from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.config import settings

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="API for Day-Ahead Wind Forecast Selection and Error Analysis (GB Grid - Jan 2026)",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes under /api
app.include_router(api_router, prefix="/api")


@app.get("/", tags=["General"])
async def root():
    return {
        "message": "Welcome to the Wind Forecast Portal API",
        "docs": "/docs",
        "health": "/api/health",
        "config": "/api/config",
    }

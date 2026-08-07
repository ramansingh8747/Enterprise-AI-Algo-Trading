from fastapi import APIRouter, status
from app.core.config.settings import settings

router = APIRouter()


@router.get(
    "/health",
    status_code=status.HTTP_200_OK,
    summary="Application Health Check",
    description="Check the health of the application.",
)
async def health_check() -> dict[str, str]:
    """Returns the application health status."""
    return {
        "status": "healthy",
        "application": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }

from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.core.config.settings import settings
from app.api.api import api_router
from app.core.logging.logger import logger
from app.middleware.request_logger import RequestLoggerMiddleware
from app.exceptions.exception_handler import register_exception_handlers
from app.core.constants import API_V1_STR


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events."""
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    yield
    logger.info(f"Shutting down {settings.APP_NAME}")


# Initialize FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
    docs_url=f"{settings.API_PREFIX}/docs" if settings.DEBUG else None,
    redoc_url=f"{settings.API_PREFIX}/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

# Register Middleware
app.add_middleware(RequestLoggerMiddleware)

# Register Exception Handlers
register_exception_handlers(app)

# Include routers
app.include_router(api_router, prefix=settings.API_PREFIX)

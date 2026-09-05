from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config.settings import settings
from app.api.api import api_router
from app.core.logging.logger import logger
from app.middleware.request_logger import RequestLoggerMiddleware
from app.exceptions.exception_handler import register_exception_handlers
from app.core.constants import API_V1_STR
from app.database.session import SessionLocal
from app.dependencies.event_bus import get_event_bus
from app.dependencies.strategy import build_strategy_scheduler
from app.dependencies.portfolio_valuation import build_continuous_portfolio_valuation_service
from app.infrastructure.redis.redis_transport import RedisEventTransport
import app.database.models  # noqa: F401



@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle for trading runtime services."""
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")

    event_bus = get_event_bus()
    scheduler = None
    valuation_service = None
    runtime_db = None
    redis_transport = None

    try:
        if settings.REDIS_EVENT_BUS_ENABLED:
            redis_transport = RedisEventTransport(
                event_bus=event_bus,
                redis_client=None,
                enabled=True,
            )
            # Override the transport's default endpoint without exposing credentials.
            import redis.asyncio as aioredis
            redis_transport._client = aioredis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
            )
            if await redis_transport.connect():
                event_bus.set_redis_transport(redis_transport)
                await redis_transport.start_listening()

        # Continuous valuation is safe to start independently of automated strategy execution.
        valuation_service = build_continuous_portfolio_valuation_service(
            event_bus, settings.PORTFOLIO_VALUATION_REFRESH_INTERVAL_SECONDS
        )
        await valuation_service.start()
        app.state.continuous_portfolio_valuation = valuation_service

        if settings.STRATEGY_SCHEDULER_ENABLED:
            runtime_db = SessionLocal()
            scheduler = build_strategy_scheduler(runtime_db, event_bus)
            await scheduler.start()
            app.state.strategy_scheduler = scheduler
            logger.warning(
                "Automated strategy scheduler ENABLED; interval=%.2fs",
                settings.STRATEGY_SCHEDULER_INTERVAL_SECONDS,
            )
        else:
            logger.info("Automated strategy scheduler is disabled by configuration.")

        yield
    finally:
        if scheduler:
            await scheduler.stop()
        if valuation_service:
            await valuation_service.stop()
        if runtime_db:
            runtime_db.close()
        if redis_transport:
            await redis_transport.close()
        logger.info(f"Shutting down {settings.APP_NAME}")


# Initialize FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
    docs_url=f"{settings.API_PREFIX}/docs" if settings.DEBUG else None,
    redoc_url=f"{settings.API_PREFIX}/redoc" if settings.DEBUG else None,
    openapi_url=f"{settings.API_PREFIX}/openapi.json" if settings.DEBUG else None,
    lifespan=lifespan,
)

from app.middleware.request_logger import RequestLoggerMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.middleware.rate_limit import RateLimitMiddleware

# Register Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware, limit=100, window=60)
app.add_middleware(RequestLoggerMiddleware)


# Register Exception Handlers
register_exception_handlers(app)

# Include routers
app.include_router(api_router, prefix=settings.API_PREFIX)

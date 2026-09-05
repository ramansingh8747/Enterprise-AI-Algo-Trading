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
from app.dependencies.event_bus import get_event_bus, get_connection_manager
from app.dependencies.strategy import build_strategy_scheduler
from app.dependencies.portfolio_valuation import build_continuous_portfolio_valuation_service
from app.infrastructure.redis.redis_transport import RedisEventTransport
from app.services.broker_reconciliation_service import BrokerReconciliationService
from app.services.market_data.market_data_provider import MarketDataProvider
from app.services.market_data.live_market_data_manager import LiveMarketDataManager
import app.database.models  # noqa: F401



@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle for trading runtime services."""
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")

    event_bus = get_event_bus()
    market_data_provider = MarketDataProvider(event_publisher=event_bus)
    live_market_data_manager = LiveMarketDataManager(market_data_provider=market_data_provider)
    app.state.market_data_provider = market_data_provider
    app.state.live_market_data_manager = live_market_data_manager

    if settings.LIVE_DATA_FEED_ENABLED:
        logger.warning(
            "Live Market Data WebSocket Feed ENABLED; provider=%s",
            settings.LIVE_DATA_FEED_PROVIDER,
        )
    else:
        logger.info("Live Market Data WebSocket Feed is safely DISABLED by default (simulated/paper mode).")

    scheduler = None
    valuation_service = None
    runtime_db = None
    redis_transport = None
    app.state.redis_transport = None
    app.state.websocket_manager = get_connection_manager()
    reconciliation_service = None

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
                app.state.redis_transport = redis_transport
                await redis_transport.start_listening()

        # Continuous valuation is safe to start independently of automated strategy execution.
        valuation_service = build_continuous_portfolio_valuation_service(
            event_bus, settings.PORTFOLIO_VALUATION_REFRESH_INTERVAL_SECONDS
        )
        await valuation_service.start()
        app.state.continuous_portfolio_valuation = valuation_service

        if settings.BROKER_RECONCILIATION_ENABLED and settings.LIVE_TRADING_ENABLED:
            reconciliation_service = BrokerReconciliationService(
                settings.BROKER_RECONCILIATION_INTERVAL_SECONDS
            )
            await reconciliation_service.start()
            app.state.broker_reconciliation = reconciliation_service

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
        if reconciliation_service:
            await reconciliation_service.stop()
        if valuation_service:
            await valuation_service.stop()
        if runtime_db:
            runtime_db.close()
        if redis_transport:
            await redis_transport.close()
        app.state.redis_transport = None
        logger.info(f"Shutting down {settings.APP_NAME}")


from fastapi.responses import RedirectResponse

# Initialize FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
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
app.add_middleware(RateLimitMiddleware, limit=1200, window=60)
app.add_middleware(RequestLoggerMiddleware)


# Register Exception Handlers
register_exception_handlers(app)


@app.get("/", tags=["root"])
async def root():
    return {
        "status": "online",
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs_url": "/docs" if settings.DEBUG else None,
        "redoc_url": "/redoc" if settings.DEBUG else None,
        "openapi_url": "/openapi.json" if settings.DEBUG else None,
        "health_check": "/health",
    }


@app.get("/health", tags=["health"])
async def health():
    return {
        "status": "healthy",
        "application": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }


# Backwards compatibility aliases for /api/v1/docs, /api/v1/redoc, and /api/v1/openapi.json
@app.get(f"{settings.API_PREFIX}/docs", include_in_schema=False)
async def api_v1_docs():
    return RedirectResponse(url="/docs")


@app.get(f"{settings.API_PREFIX}/redoc", include_in_schema=False)
async def api_v1_redoc():
    return RedirectResponse(url="/redoc")


@app.get(f"{settings.API_PREFIX}/openapi.json", include_in_schema=False)
async def api_v1_openapi():
    return RedirectResponse(url="/openapi.json")


# Include routers
app.include_router(api_router, prefix=settings.API_PREFIX)

from fastapi import APIRouter
from app.api.v1.routes.health import router as health_router
from app.api.v1.routes.users import router as users_router
from app.api.v1.routes.brokers import router as brokers_router
from app.api.v1.routes.broker_sessions import router as broker_sessions_router
from app.api.v1.routes.broker_data import router as broker_data_router
from app.api.v1.routes.broker_orders import router as broker_orders_router
from app.api.v1.routes.paper_portfolios import router as paper_portfolios_router
from app.api.v1.routes.strategies import router as strategies_router
from app.api.v1.routes.websocket import router as websocket_router
from app.api.v1.routes.auth import router as auth_router
from app.api.v1.routes.risk import router as risk_router
from app.api.v1.routes.trading_journal import router as trading_journal_router
from app.api.v1.routes.watchlists import router as watchlists_router
from app.api.v1.routes.alerts import router as alerts_router
from app.api.v1.routes.search import router as search_router

api_router = APIRouter()

# Register routers
api_router.include_router(health_router, tags=["health"])
api_router.include_router(auth_router)
api_router.include_router(users_router, tags=["users"])
api_router.include_router(brokers_router, tags=["brokers"])
api_router.include_router(broker_sessions_router, tags=["broker_sessions"])
api_router.include_router(broker_data_router, tags=["broker_data"])
api_router.include_router(broker_orders_router, tags=["broker_orders"])
api_router.include_router(paper_portfolios_router, tags=["paper_portfolios"])
api_router.include_router(strategies_router, tags=["strategies"])
api_router.include_router(websocket_router, tags=["websocket"])
api_router.include_router(risk_router, prefix="/admin/risk", tags=["admin_risk"])
api_router.include_router(trading_journal_router, tags=["trading-journal"])
api_router.include_router(watchlists_router, tags=["watchlists"])
api_router.include_router(alerts_router, tags=["alerts"])
api_router.include_router(search_router, prefix="/search", tags=["search"])






from fastapi import APIRouter
from app.api.v1.routes.health import router as health_router
from app.api.v1.routes.users import router as users_router
from app.api.v1.routes.brokers import router as brokers_router
from app.api.v1.routes.broker_sessions import router as broker_sessions_router
from app.api.v1.routes.broker_data import router as broker_data_router
from app.api.v1.routes.broker_orders import router as broker_orders_router
from app.api.v1.routes.paper_portfolios import router as paper_portfolios_router
from app.api.v1.routes.paper_orders import router as paper_orders_router
from app.api.v1.routes.strategies import router as strategies_router
from app.api.v1.routes.strategy_imports import router as strategy_imports_router
from app.api.v1.routes.websocket import router as websocket_router
from app.api.v1.routes.auth import router as auth_router
from app.api.v1.routes.risk import router as risk_router
from app.api.v1.routes.admin import router as admin_router
from app.api.v1.routes.trading_journal import router as trading_journal_router
from app.api.v1.routes.watchlists import router as watchlists_router
from app.api.v1.routes.alerts import router as alerts_router
from app.api.v1.routes.search import router as search_router
from app.api.v1.routes.live_readiness import router as live_readiness_router
from app.api.v1.routes.live_activation import router as live_activation_router
from app.api.v1.routes.pre_live_operational import router as pre_live_operational_router
from app.api.v1.routes.admin_system_health import router as admin_system_health_router
from app.api.v1.routes.admin_overview import router as admin_overview_router
from app.api.v1.routes.admin_brokers import router as admin_brokers_router
from app.api.v1.routes.admin_strategies import router as admin_strategies_router
from app.api.v1.routes.admin_orders import router as admin_orders_router
from app.api.v1.routes.admin_positions import router as admin_positions_router
from app.api.v1.routes.admin_portfolios import router as admin_portfolios_router
from app.api.v1.routes.admin_live_gate import router as admin_live_gate_router
from app.api.v1.routes.admin_audit import router as admin_audit_router
from app.api.v1.routes.market_data import router as market_data_router
from app.api.v1.routes.frozen_paper_trading import router as frozen_paper_trading_router

api_router = APIRouter()

# Register routers
api_router.include_router(health_router, tags=["health"])
api_router.include_router(auth_router)
api_router.include_router(frozen_paper_trading_router, tags=["frozen-paper-trading"])
api_router.include_router(market_data_router, tags=["market-data"])
api_router.include_router(users_router, tags=["users"])
api_router.include_router(brokers_router, tags=["brokers"])
api_router.include_router(broker_sessions_router, tags=["broker_sessions"])
api_router.include_router(broker_data_router, tags=["broker_data"])
api_router.include_router(broker_orders_router, tags=["broker_orders"])
api_router.include_router(paper_portfolios_router, tags=["paper_portfolios"])
api_router.include_router(paper_orders_router, tags=["paper_orders"])
api_router.include_router(strategies_router, tags=["strategies"])
api_router.include_router(strategy_imports_router, tags=["strategy_imports"])
api_router.include_router(websocket_router, tags=["websocket"])
api_router.include_router(risk_router, prefix="/admin/risk", tags=["admin_risk"])
api_router.include_router(admin_router)
api_router.include_router(admin_positions_router)
api_router.include_router(admin_portfolios_router)
api_router.include_router(admin_live_gate_router)
api_router.include_router(admin_audit_router)
api_router.include_router(trading_journal_router, tags=["trading-journal"])
api_router.include_router(watchlists_router, tags=["watchlists"])
api_router.include_router(alerts_router, tags=["alerts"])
api_router.include_router(search_router, prefix="/search", tags=["search"])
api_router.include_router(live_readiness_router)
api_router.include_router(live_activation_router)
api_router.include_router(pre_live_operational_router)
api_router.include_router(admin_system_health_router)
api_router.include_router(admin_overview_router)
api_router.include_router(admin_brokers_router)
api_router.include_router(admin_strategies_router)
api_router.include_router(admin_orders_router)






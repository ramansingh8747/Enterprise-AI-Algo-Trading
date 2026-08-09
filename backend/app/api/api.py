from fastapi import APIRouter
from app.api.v1.routes.health import router as health_router
from app.api.v1.routes.users import router as users_router
from app.api.v1.routes.brokers import router as brokers_router
from app.api.v1.routes.broker_sessions import router as broker_sessions_router
from app.api.v1.routes.broker_data import router as broker_data_router
from app.api.v1.routes.broker_orders import router as broker_orders_router

from app.api.v1.routes.auth import router as auth_router

api_router = APIRouter()

# Register routers
api_router.include_router(health_router, tags=["health"])
api_router.include_router(auth_router)
api_router.include_router(users_router, tags=["users"])
api_router.include_router(brokers_router, tags=["brokers"])
api_router.include_router(broker_sessions_router, tags=["broker_sessions"])
api_router.include_router(broker_data_router, tags=["broker_data"])
api_router.include_router(broker_orders_router, tags=["broker_orders"])


from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config.settings import settings
from app.database.models.broker import Broker
from app.database.models.broker_order import BrokerOrderRecord
from app.database.models.broker_session import BrokerSession
from app.database.models.paper_portfolio import PaperPosition, PaperPortfolio
from app.database.models.strategy import StrategyInstance
from app.database.models.trading_risk_settings import TradingRiskSettings
from app.database.models.user import User, UserRole
from app.schemas.admin_overview import AdminOverviewMetrics, AdminOverviewResponse
from app.services.admin_system_health_service import AdminSystemHealthService


class AdminOverviewService:
    """Aggregate read-only platform metrics for the ADMIN overview screen."""

    OPEN_ORDER_STATUSES = {"OPEN", "PENDING", "TRIGGER_PENDING", "OPEN_PENDING"}
    RUNNING_STRATEGY_STATUS = "RUNNING"

    def __init__(self, db: Session, health_service: AdminSystemHealthService) -> None:
        self.db = db
        self.health_service = health_service

    def build(self) -> AdminOverviewResponse:
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        total_users = self.db.query(func.count(User.id)).scalar() or 0
        active_users = (
            self.db.query(func.count(User.id)).filter(User.is_active.is_(True)).scalar() or 0
        )
        admin_users = (
            self.db.query(func.count(User.id)).filter(User.role == UserRole.ADMIN).scalar() or 0
        )

        total_brokers = self.db.query(func.count(Broker.id)).scalar() or 0
        active_brokers = (
            self.db.query(func.count(Broker.id)).filter(Broker.is_active.is_(True)).scalar() or 0
        )
        connected_brokers = (
            self.db.query(func.count(func.distinct(BrokerSession.broker_id)))
            .join(Broker, Broker.id == BrokerSession.broker_id)
            .filter(Broker.is_active.is_(True), BrokerSession.expires_at > now)
            .scalar()
            or 0
        )

        total_orders = self.db.query(func.count(BrokerOrderRecord.id)).scalar() or 0
        open_orders = (
            self.db.query(func.count(BrokerOrderRecord.id))
            .filter(BrokerOrderRecord.status.in_(self.OPEN_ORDER_STATUSES))
            .scalar()
            or 0
        )
        today_orders = (
            self.db.query(func.count(BrokerOrderRecord.id))
            .filter(BrokerOrderRecord.created_at >= today_start)
            .scalar()
            or 0
        )

        total_strategies = self.db.query(func.count(StrategyInstance.id)).scalar() or 0
        running_strategies = (
            self.db.query(func.count(StrategyInstance.id))
            .filter(StrategyInstance.status == self.RUNNING_STRATEGY_STATUS)
            .scalar()
            or 0
        )

        paper_portfolios = (
            self.db.query(func.count(PaperPortfolio.id))
            .filter(PaperPortfolio.execution_mode == "PAPER")
            .scalar()
            or 0
        )
        open_paper_positions = (
            self.db.query(func.count(PaperPosition.id))
            .filter(PaperPosition.quantity != 0)
            .scalar()
            or 0
        )
        paper_realized_pnl = (
            self.db.query(func.coalesce(func.sum(PaperPosition.realized_pnl), 0))
            .scalar()
            or Decimal("0")
        )
        paper_unrealized_pnl = (
            self.db.query(func.coalesce(func.sum(PaperPosition.unrealized_pnl), 0))
            .scalar()
            or Decimal("0")
        )

        kill_switch_active = bool(
            self.db.query(TradingRiskSettings.id)
            .filter(TradingRiskSettings.kill_switch_active.is_(True))
            .first()
        )

        health = self.health_service.check()
        metrics = AdminOverviewMetrics(
            total_users=total_users,
            active_users=active_users,
            admin_users=admin_users,
            total_brokers=total_brokers,
            active_brokers=active_brokers,
            connected_brokers=connected_brokers,
            total_orders=total_orders,
            open_orders=open_orders,
            today_orders=today_orders,
            total_strategies=total_strategies,
            running_strategies=running_strategies,
            paper_portfolios=paper_portfolios,
            open_paper_positions=open_paper_positions,
            paper_realized_pnl=paper_realized_pnl,
            paper_unrealized_pnl=paper_unrealized_pnl,
            kill_switch_active=kill_switch_active,
        )

        return AdminOverviewResponse(
            generated_at=now,
            overall_status=health.overall_status,
            metrics=metrics,
            live_trading_enabled=settings.LIVE_TRADING_ENABLED,
            strategy_scheduler_enabled=settings.STRATEGY_SCHEDULER_ENABLED,
        )

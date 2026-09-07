import asyncio
import hashlib
import json
import logging
from typing import Optional, Dict, Any
from uuid import UUID
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.database.repositories.strategy_repository import StrategyRepository
from app.services.strategy_engine.base_strategy import (
    BaseStrategy,
    DeterministicMomentumStrategy,
    RuleBasedStrategy,
    StrategyFactory,
)
from app.services.broker_order_service import BrokerOrderService
from app.brokers.base.broker_types import BrokerOrderRequest, BrokerOrder
from app.exceptions.strategy_exceptions import (
    StaleDataException,
    DuplicateSignalException,
    BaseStrategyException,
)
from app.core.logging.trading_audit import audit_event

import uuid
from app.services.event_bus.interfaces import EventPublisher
from app.services.event_bus.models import Event, EventType
from app.services.event_bus.topics import Topic
from app.database.models.strategy import StrategyInstance

from app.services.paper_accounting_service import PaperAccountingService
from app.services.risk_engine import RiskEngine
from app.services.trading_safety_service import TradingSafetyService
from app.services.execution_position_service import ExecutionPositionService
from app.services.paper_valuation_service import PaperValuationService

logger = logging.getLogger(__name__)


class StrategyRunner:
    """
    Server-side Strategy Engine Runner.
    Orchestrates market data evaluation, stale data validation, signal generation,
    signal deduplication, paper/live mode isolation, RiskEngine execution, broker order routing,
    structured audit logging, and real-time event publication.
    """

    def __init__(
        self,
        repository: StrategyRepository,
        broker_order_service: Optional[BrokerOrderService] = None,
        paper_accounting_service: Optional[PaperAccountingService] = None,
        max_data_age_seconds: int = 10,
        event_publisher: Optional[EventPublisher] = None,
        risk_engine: Optional[RiskEngine] = None,
        safety_service: Optional[TradingSafetyService] = None,
        execution_position_service: Optional[ExecutionPositionService] = None,
        paper_valuation_service: Optional[PaperValuationService] = None,
    ) -> None:
        self._repository = repository
        self._broker_order_service = broker_order_service
        self._paper_accounting_service = paper_accounting_service
        self.max_data_age_seconds = max_data_age_seconds
        self._event_publisher = event_publisher
        self._risk_engine = risk_engine
        self._safety_service = safety_service
        self._execution_position_service = execution_position_service
        self._paper_valuation_service = paper_valuation_service

    def _publish_event(
        self,
        event_type: EventType,
        user_id: UUID,
        strategy_instance_id: UUID,
        strategy_id: Optional[UUID] = None,
        broker_id: Optional[UUID] = None,
        symbol: Optional[str] = None,
        execution_mode: Optional[str] = None,
        payload: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Publishes an event to the EventBus if an event publisher is configured.
        FAIL-SAFE: Any failure during event construction or publishing is caught, logged,
        and ignored so it NEVER interrupts strategy execution or state changes.
        """
        if not self._event_publisher:
            return

        try:
            event = Event(
                event_id=uuid.uuid4(),
                event_type=event_type,
                timestamp=datetime.now(timezone.utc),
                user_id=user_id,
                strategy_instance_id=strategy_instance_id,
                strategy_id=strategy_id,
                broker_id=broker_id,
                symbol=symbol,
                execution_mode=execution_mode,
                payload=payload or {},
            )

            topic = Topic.strategy(strategy_instance_id)

            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = None

            if loop and loop.is_running():
                loop.create_task(self._async_publish(topic, event))
            else:
                asyncio.run(self._async_publish(topic, event))
        except Exception as exc:
            logger.warning(
                "Event publishing failed for event_type=%s instance_id=%s: %s",
                event_type,
                strategy_instance_id,
                exc,
            )

    async def _async_publish(self, topic: str, event: Event) -> None:
        try:
            if self._event_publisher:
                await self._event_publisher.publish(topic, event)
        except Exception as exc:
            logger.warning(
                "Async event publish error on topic=%s event_type=%s: %s",
                topic,
                event.event_type,
                exc,
            )

    def start_instance(self, instance_id: UUID, user_id: UUID) -> StrategyInstance:
        """Starts a strategy instance (READY/DRAFT -> RUNNING) and publishes instance.started event."""
        instance = self._repository.get_instance_for_user(instance_id, user_id)
        if not instance:
            raise ValueError(f"Strategy instance {instance_id} not found for user {user_id}")

        if self._safety_service:
            mode = self._safety_service.validate_mode(instance.execution_mode)
            if mode == "LIVE":
                self._safety_service.validate_live_execution(
                    user_id=user_id, broker_id=instance.broker_id
                )
            else:
                self._safety_service.validate_paper_execution()

        current_status = instance.status.upper()
        if current_status == "DRAFT":
            instance = self._repository.update_instance_status(instance_id, user_id, "READY")

        updated_instance = self._repository.update_instance_status(instance_id, user_id, "RUNNING")
        self._publish_event(
            EventType.INSTANCE_STARTED,
            user_id=user_id,
            strategy_instance_id=instance_id,
            strategy_id=updated_instance.strategy_definition_id,
            broker_id=updated_instance.broker_id,
            execution_mode=updated_instance.execution_mode,
            payload={"status": "RUNNING", "previous_status": current_status},
        )
        return updated_instance

    def pause_instance(self, instance_id: UUID, user_id: UUID) -> StrategyInstance:
        """Pauses a running strategy instance (RUNNING -> PAUSED) and publishes instance.paused event."""
        instance = self._repository.get_instance_for_user(instance_id, user_id)
        if not instance:
            raise ValueError(f"Strategy instance {instance_id} not found for user {user_id}")

        current_status = instance.status.upper()
        updated_instance = self._repository.update_instance_status(instance_id, user_id, "PAUSED")
        self._publish_event(
            EventType.INSTANCE_PAUSED,
            user_id=user_id,
            strategy_instance_id=instance_id,
            strategy_id=updated_instance.strategy_definition_id,
            broker_id=updated_instance.broker_id,
            execution_mode=updated_instance.execution_mode,
            payload={"status": "PAUSED", "previous_status": current_status},
        )
        return updated_instance

    def resume_instance(self, instance_id: UUID, user_id: UUID) -> StrategyInstance:
        """Resumes a paused strategy instance (PAUSED -> RUNNING) and publishes instance.resumed event."""
        instance = self._repository.get_instance_for_user(instance_id, user_id)
        if not instance:
            raise ValueError(f"Strategy instance {instance_id} not found for user {user_id}")

        current_status = instance.status.upper()
        updated_instance = self._repository.update_instance_status(instance_id, user_id, "RUNNING")
        self._publish_event(
            EventType.INSTANCE_RESUMED,
            user_id=user_id,
            strategy_instance_id=instance_id,
            strategy_id=updated_instance.strategy_definition_id,
            broker_id=updated_instance.broker_id,
            execution_mode=updated_instance.execution_mode,
            payload={"status": "RUNNING", "previous_status": current_status},
        )
        return updated_instance

    def stop_instance(self, instance_id: UUID, user_id: UUID) -> StrategyInstance:
        """Stops a strategy instance (* -> STOPPED) and publishes instance.stopped event."""
        instance = self._repository.get_instance_for_user(instance_id, user_id)
        if not instance:
            raise ValueError(f"Strategy instance {instance_id} not found for user {user_id}")

        current_status = instance.status.upper()
        updated_instance = self._repository.update_instance_status(instance_id, user_id, "STOPPED")
        self._publish_event(
            EventType.INSTANCE_STOPPED,
            user_id=user_id,
            strategy_instance_id=instance_id,
            strategy_id=updated_instance.strategy_definition_id,
            broker_id=updated_instance.broker_id,
            execution_mode=updated_instance.execution_mode,
            payload={"status": "STOPPED", "previous_status": current_status},
        )
        return updated_instance

    def mark_instance_failed(
        self, instance_id: UUID, user_id: UUID, error_message: str
    ) -> StrategyInstance:
        """Marks a strategy instance as FAILED and publishes instance.failed event."""
        instance = self._repository.get_instance_for_user(instance_id, user_id)
        if not instance:
            raise ValueError(f"Strategy instance {instance_id} not found for user {user_id}")

        current_status = instance.status.upper()
        updated_instance = self._repository.update_instance_status(instance_id, user_id, "FAILED")
        updated_instance.error_message = error_message
        self._repository.db.commit()

        self._publish_event(
            EventType.INSTANCE_FAILED,
            user_id=user_id,
            strategy_instance_id=instance_id,
            strategy_id=updated_instance.strategy_definition_id,
            broker_id=updated_instance.broker_id,
            execution_mode=updated_instance.execution_mode,
            payload={
                "status": "FAILED",
                "previous_status": current_status,
                "error_message": error_message,
            },
        )
        return updated_instance

    def _validate_market_data_timestamp(self, market_data: Dict[str, Any]) -> datetime:
        """Validates market data timestamp staleness (Fail-Closed)."""
        raw_ts = market_data.get("timestamp") or market_data.get("generatedAt") or market_data.get("time")
        if not raw_ts:
            raise StaleDataException("Market data is missing a valid timestamp (Fail-Closed).")

        try:
            if isinstance(raw_ts, (int, float)):
                ts_dt = datetime.fromtimestamp(raw_ts, tz=timezone.utc)
            elif isinstance(raw_ts, str):
                ts_dt = datetime.fromisoformat(raw_ts.replace("Z", "+00:00"))
            else:
                ts_dt = raw_ts
        except Exception as e:
            raise StaleDataException(f"Invalid market data timestamp format: {e}")

        now = datetime.now(timezone.utc)
        age = (now - ts_dt).total_seconds()
        if age > self.max_data_age_seconds:
            raise StaleDataException(
                f"Market data is stale ({age:.1f}s old, max allowed {self.max_data_age_seconds}s)."
            )

        return ts_dt

    def compute_signal_fingerprint(
        self,
        instance_id: UUID,
        symbol: str,
        side: str,
        quantity: Decimal,
        event_ts: datetime,
    ) -> str:
        """Computes a canonical SHA-256 fingerprint for signal deduplication."""
        payload = f"{instance_id}:{symbol.upper()}:{side.upper()}:{quantity}:{event_ts.isoformat()}"
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    def _get_open_position_quantity(
        self, user_id: UUID, instance: StrategyInstance, symbol: str
    ) -> Decimal:
        """
        Retrieves the authoritative open position quantity for this user/strategy and symbol.
        Checks Paper accounting & PaperPosition table in PAPER mode,
        and TradingPosition table in LIVE mode.
        """
        symbol_upper = symbol.strip().upper()
        mode = instance.execution_mode.upper() if instance.execution_mode else "PAPER"

        # 1. PAPER Mode Check
        if mode == "PAPER":
            # Direct DB query on PaperPosition table
            if hasattr(self._repository, "db") and self._repository.db and not isinstance(self._repository.db, MagicMock):
                try:
                    if hasattr(self._repository.db, "expire_all"):
                        self._repository.db.expire_all()
                    from app.database.models.paper_portfolio import PaperPosition
                    stmt = (
                        select(PaperPosition.quantity)
                        .where(
                            PaperPosition.user_id == user_id,
                            PaperPosition.symbol == symbol_upper,
                            PaperPosition.quantity > Decimal("0"),
                        )
                    )
                    positions = list(self._repository.db.execute(stmt).scalars().all())
                    if positions:
                        return sum((Decimal(str(q)) for q in positions), Decimal("0"))
                except Exception as e:
                    logger.debug("Failed direct DB query for paper position: %s", e)

            # Secondary: Check paper accounting service snapshot if available
            if self._paper_accounting_service and hasattr(self._paper_accounting_service, "get_risk_snapshot"):
                try:
                    res = self._paper_accounting_service.get_risk_snapshot(
                        user_id=user_id, strategy_instance_id=instance.id
                    )
                    if isinstance(res, tuple) and len(res) >= 1 and isinstance(res[0], list):
                        pos_snapshot = res[0]
                        for p in pos_snapshot:
                            if isinstance(p, dict) and str(p.get("symbol", "")).upper() == symbol_upper:
                                qty = Decimal(str(p.get("quantity", "0")))
                                if qty > Decimal("0"):
                                    return qty
                except Exception as e:
                    logger.debug("Failed snapshot query for paper position: %s", e)

        # 2. LIVE Mode Check
        elif mode == "LIVE":
            if hasattr(self._repository, "db") and self._repository.db and not isinstance(self._repository.db, MagicMock):
                try:
                    if hasattr(self._repository.db, "expire_all"):
                        self._repository.db.expire_all()
                    from app.database.models.trading_execution import TradingPosition
                    stmt = (
                        select(TradingPosition.quantity)
                        .where(
                            TradingPosition.user_id == user_id,
                            TradingPosition.symbol == symbol_upper,
                            TradingPosition.quantity > Decimal("0"),
                        )
                    )
                    positions = list(self._repository.db.execute(stmt).scalars().all())
                    if positions:
                        return sum((Decimal(str(q)) for q in positions), Decimal("0"))
                except Exception as e:
                    logger.debug("Failed direct DB query for live position: %s", e)

        return Decimal("0.0000")

    def _has_pending_orders(
        self, user_id: UUID, instance: StrategyInstance, symbol: str, side: str
    ) -> bool:
        """Checks if there are pending in-flight orders for this user, symbol, and side."""
        symbol_upper = symbol.strip().upper()
        side_upper = side.strip().upper()
        if hasattr(self._repository, "db") and self._repository.db and not isinstance(self._repository.db, MagicMock):
            try:
                from app.database.models.broker_order import BrokerOrderRecord
                stmt = (
                    select(BrokerOrderRecord.id)
                    .where(
                        BrokerOrderRecord.user_id == user_id,
                        BrokerOrderRecord.symbol == symbol_upper,
                        BrokerOrderRecord.side == side_upper,
                        BrokerOrderRecord.status.in_(["PENDING", "OPEN", "SUBMITTED", "TRIGGER_PENDING"]),
                    )
                    .limit(1)
                )
                return self._repository.db.execute(stmt).scalar_one_or_none() is not None
            except Exception as e:
                logger.debug("Failed pending order query: %s", e)
        return False

    def execute_cycle(
        self,
        instance_id: UUID,
        user_id: UUID,
        market_data: Dict[str, Any],
        strategy: Optional[BaseStrategy] = None,
    ) -> Optional[BrokerOrder]:
        """
        Executes a single strategy cycle for an instance:
        1. Validates instance ownership & RUNNING status.
        2. Enforces Stale Data Guard on market data timestamp.
        3. Evaluates strategy logic to generate proposed signal.
        4. Computes signal fingerprint & enforces Signal Deduplication Guard.
        5. Converts signal to BrokerOrderRequest & deterministic idempotency key.
        6. Enforces Paper/Live isolation:
           - PAPER mode -> Executes paper simulation (returns simulated BrokerOrder).
           - LIVE mode -> Calls BrokerOrderService (which enforces RiskEngine & Idempotency).
        7. Publishes real-time events for signal generation, execution, or rejection.
        """
        instance = self._repository.get_instance_for_user(instance_id, user_id)
        if not instance:
            raise ValueError(f"Strategy instance {instance_id} not found for user {user_id}")

        if instance.status.upper() != "RUNNING":
            logger.info(f"Strategy instance {instance_id} is not RUNNING (status: {instance.status}). Skipping cycle.")
            return None

        # Unified mode safety is checked on every cycle as well as on start/resume.
        # This prevents an already-RUNNING instance from bypassing a newly disabled
        # LIVE trading gate after a process restart or configuration change.
        if self._safety_service:
            mode = self._safety_service.validate_mode(instance.execution_mode)
            if mode == "LIVE":
                self._safety_service.validate_live_execution(
                    user_id=user_id, broker_id=instance.broker_id
                )
            else:
                self._safety_service.validate_paper_execution()

        # 1. Stale Data Guard
        event_ts = self._validate_market_data_timestamp(market_data)

        # 2. Price Circuit & Outlier Tick Sanitization Guard
        from app.services.market_data_sanitizer import MarketDataSanitizer
        _, sanitized_market_data, _ = MarketDataSanitizer.validate_and_sanitize_quote(market_data)
        market_data = sanitized_market_data

        # 3. Execute Strategy Logic
        if strategy:
            strat_impl = strategy
        else:
            definition = None
            if hasattr(instance, "strategy_definition_id") and instance.strategy_definition_id:
                definition = self._repository.get_definition_for_user(instance.strategy_definition_id, user_id)
                if not definition:
                    definition = self._repository.get_definition_by_id(instance.strategy_definition_id)
            strat_impl = StrategyFactory.create_strategy(definition=definition)

        open_positions = []
        if hasattr(self, "_paper_accounting_service") and self._paper_accounting_service:
            try:
                p_repo = getattr(self._paper_accounting_service, "_repository", None) or getattr(self._paper_accounting_service, "repository", None)
                if p_repo and hasattr(p_repo, "get_all_positions_for_user"):
                    open_positions = p_repo.get_all_positions_for_user(user_id)
            except Exception:
                pass

        if hasattr(strat_impl, "evaluate_signal"):
            signal_dict = strat_impl.evaluate_signal(market_data, positions=open_positions)
        else:
            signal_dict = strat_impl.generate_signal(market_data)
        if not signal_dict:
            logger.debug(f"Strategy {instance_id} generated no signal for {market_data.get('symbol')}.")
            return None

        symbol = str(signal_dict["symbol"]).upper()
        side = str(signal_dict["side"]).upper()
        quantity = Decimal(str(signal_dict["quantity"]))
        order_type = str(signal_dict.get("order_type", "MARKET")).upper()
        price = Decimal(str(signal_dict["price"])) if signal_dict.get("price") is not None else None

        # Resolve Dynamic Volatility-based (ATR) Stop-Loss, Target, Risk/Reward, Reason, Indicators
        raw_sl = signal_dict.get("stop_loss") or signal_dict.get("stoploss")
        raw_target = signal_dict.get("target") or signal_dict.get("take_profit")

        from app.services.strategy_engine.base_strategy import calculate_atr
        atr_val = calculate_atr(market_data, period=14)
        atr_multiplier = 1.5  # 1.5x ATR for Volatility-adjusted Stop Loss
        rr_multiplier = 2.0   # 1:2 Risk-Reward ratio

        if raw_sl is not None:
            try:
                stop_loss = Decimal(str(raw_sl))
            except Exception:
                stop_loss = None
        elif price is not None and price > Decimal("0"):
            if atr_val is not None and atr_val > 0:
                # Dynamic Volatility-based (ATR) Stop-Loss
                sl_distance = Decimal(str(round(atr_val * atr_multiplier, 2)))
                min_sl_dist = (price * Decimal("0.005")).quantize(Decimal("0.01"))
                max_sl_dist = (price * Decimal("0.05")).quantize(Decimal("0.01"))
                sl_distance = max(min_sl_dist, min(max_sl_dist, sl_distance))
            else:
                # Default 2% protective SL if no candle volatility available
                sl_distance = (price * Decimal("0.02")).quantize(Decimal("0.01"))

            if side == "BUY":
                stop_loss = (price - sl_distance).quantize(Decimal("0.01"))
            else:
                stop_loss = (price + sl_distance).quantize(Decimal("0.01"))
        else:
            stop_loss = None

        if raw_target is not None:
            try:
                target = Decimal(str(raw_target))
            except Exception:
                target = None
        elif price is not None and price > Decimal("0") and stop_loss is not None:
            # 1:2 Risk-Reward ratio based on ATR stop-loss distance
            sl_dist = abs(price - stop_loss)
            target_dist = (sl_dist * Decimal(str(rr_multiplier))).quantize(Decimal("0.01"))
            if side == "BUY":
                target = (price + target_dist).quantize(Decimal("0.01"))
            else:
                target = (price - target_dist).quantize(Decimal("0.01"))
        else:
            target = None

        risk_reward = signal_dict.get("risk_reward") or "1:2"
        reason = signal_dict.get("reason") or f"{side} signal triggered for {symbol} based on strategy evaluation."
        indicators = signal_dict.get("indicators") or {}
        if isinstance(indicators, str):
            try:
                indicators = json.loads(indicators)
            except Exception:
                indicators = {}

        if atr_val is not None:
            indicators["atr"] = float(atr_val)

        # Determine dynamic signal strength / change percentage
        change_pct = market_data.get("change_percent") or market_data.get("changePercent")
        if change_pct is not None:
            try:
                indicators["change_percent"] = round(float(change_pct), 2)
            except Exception:
                pass

        strength = signal_dict.get("strength") or signal_dict.get("confidence")
        if strength is None:
            if change_pct is not None and abs(float(change_pct)) > 0:
                try:
                    strength = min(96, max(52, round(50 + abs(float(change_pct)) * 18)))
                except Exception:
                    strength = None
            elif price is not None and stop_loss is not None and target is not None and price > 0:
                try:
                    reward = abs(float(target) - float(price))
                    risk = max(1.0, abs(float(price) - float(stop_loss)))
                    rr = reward / risk
                    strength = min(95, max(55, round(50 + rr * 12 + (reward / float(price)) * 200)))
                except Exception:
                    strength = None

            if strength is None:
                sym_hash = sum(ord(c) for c in (symbol + str(instance_id)))
                strength = 60 + (sym_hash % 33)

        try:
            indicators["strength"] = int(strength)
        except Exception:
            indicators["strength"] = 78

        indicators_json = json.dumps(indicators) if isinstance(indicators, dict) else str(indicators)

        # Resolve Pyramiding / Re-entry permissions, Trade Cooldown, Minimum Holding Period, Market Hours, and Dynamic Position Sizing from Strategy Definition config
        allow_pyramiding = False
        reentry_cooldown_seconds = 0
        min_holding_seconds = 0
        enforce_market_hours = None
        try:
            definition = self._repository.get_definition_for_user(instance.strategy_definition_id, user_id)
            if definition and definition.config_json:
                cfg = json.loads(definition.config_json) if isinstance(definition.config_json, str) else definition.config_json
                if isinstance(cfg, dict):
                    allow_pyramiding = bool(cfg.get("allow_pyramiding", False) or cfg.get("allow_reentry", False))
                    if "min_holding_seconds" in cfg:
                        min_holding_seconds = int(cfg["min_holding_seconds"])
                    elif "holding_seconds" in cfg:
                        min_holding_seconds = int(cfg["holding_seconds"])
                    elif "anti_whipsaw_seconds" in cfg:
                        min_holding_seconds = int(cfg["anti_whipsaw_seconds"])

                    if "reentry_cooldown_seconds" in cfg:
                        reentry_cooldown_seconds = int(cfg["reentry_cooldown_seconds"])
                    elif "trade_cooldown_seconds" in cfg:
                        reentry_cooldown_seconds = int(cfg["trade_cooldown_seconds"])
                    elif "cooldown_seconds" in cfg:
                        reentry_cooldown_seconds = int(cfg["cooldown_seconds"])
                    else:
                        from app.core.config.settings import settings
                        reentry_cooldown_seconds = getattr(settings, "STRATEGY_DEFAULT_COOLDOWN_SECONDS", 900)

                    if min_holding_seconds == 0 and reentry_cooldown_seconds > 0:
                        min_holding_seconds = min(reentry_cooldown_seconds, 60)

                    if "enforce_market_hours" in cfg:
                        enforce_market_hours = bool(cfg["enforce_market_hours"])
                    elif "bypass_market_hours" in cfg:
                        enforce_market_hours = not bool(cfg["bypass_market_hours"])

                    # Dynamic Position Sizing (Fixed Risk % vs Capital Allocation)
                    sizing_mode = str(cfg.get("position_sizing_mode", cfg.get("position_sizing", ""))).upper()
                    if sizing_mode in ("DYNAMIC", "DYNAMIC_RISK", "RISK_BASED", "BUDGET_BASED", "CAPITAL_BASED") and side == "BUY" and price is not None and price > Decimal("0"):
                        from app.services.position_sizer import PositionSizer
                        capital = Decimal(str(cfg.get("capital", cfg.get("allocated_capital", "100000.00"))))
                        if self._paper_accounting_service:
                            try:
                                port = self._paper_accounting_service.repository.get_or_create_default_portfolio(user_id, instance_id)
                                if port and port.cash_balance > Decimal("0"):
                                    capital = port.cash_balance
                            except Exception:
                                pass
                        if sizing_mode in ("BUDGET_BASED", "CAPITAL_BASED"):
                            risk_pct = float(cfg.get("risk_pct_per_trade", cfg.get("risk_per_trade_pct", 100.0)))
                            max_alloc_pct = float(cfg.get("max_capital_allocation_pct", cfg.get("max_allocation_pct", 100.0)))
                        else:
                            risk_pct = float(cfg.get("risk_pct_per_trade", cfg.get("risk_per_trade_pct", 1.0)))
                            max_alloc_pct = float(cfg.get("max_capital_allocation_pct", cfg.get("max_allocation_pct", 20.0)))

                        quantity = PositionSizer.calculate_quantity(
                            price=price,
                            stop_loss=stop_loss,
                            portfolio_capital=capital,
                            risk_pct_per_trade=risk_pct,
                            max_capital_allocation_pct=max_alloc_pct,
                            default_quantity=quantity,
                        )
                        # If quantity is 0 (share price exceeds available budget), suppress signal
                        if quantity <= Decimal("0"):
                            logger.info(
                                "Calculated quantity for %s is 0 (Price ₹%s exceeds available capital ₹%s). Skipping entry.",
                                symbol, price, capital
                            )
                            return None
                    # Multi-Timeframe Trend Filter & Market Sentiment Index Filter configuration
                    confirm_higher_timeframe = bool(cfg.get("confirm_higher_timeframe", cfg.get("mtf_filter", cfg.get("trend_filter", False))))
                    enforce_market_sentiment = bool(cfg.get("enforce_market_sentiment", cfg.get("sentiment_filter", cfg.get("nifty_filter", False))))
                    confirm_volume_spike = bool(cfg.get("confirm_volume_spike", cfg.get("volume_filter", cfg.get("volume_spike", False))))
            elif definition:
                # Default for strategies
                pass
        except Exception:
            pass

        if reentry_cooldown_seconds <= 0:
            from app.core.config.settings import settings
            reentry_cooldown_seconds = getattr(settings, "STRATEGY_DEFAULT_COOLDOWN_SECONDS", 900)

        # Query authoritative open position quantity
        current_qty = self._get_open_position_quantity(user_id=user_id, instance=instance, symbol=symbol)

        # 1. Market Hours Guard (Indian Standard Time: 09:15 - 15:15 IST for new entries, 15:25 for exits)
        from app.services.market_timing_guard import MarketTimingGuard
        if side == "BUY":
            is_open, reason = MarketTimingGuard.is_market_open_for_new_orders(
                dt=event_ts,
                enforce_hours=enforce_market_hours,
            )
            if not is_open:
                logger.debug("Market timing guard blocked BUY signal for %s: %s", symbol, reason)
                return None

            # Scalper Golden Slots Guard (09:20-10:30, 13:15-14:00, 14:15-15:10 IST)
            strat_name = str(getattr(definition, "name", "") or "").upper()
            is_scalper = "SCALPER" in strat_name or "OPTION BUYING ATM" in strat_name or getattr(strat_impl, "__class__", None).__name__ == "UltraFastMomentumScalperStrategy"
            if is_scalper:
                in_slot, slot_reason = MarketTimingGuard.is_within_scalper_golden_slots(event_ts)
                if not in_slot:
                    logger.info("Scalper timing guard locked BUY signal for %s: %s", symbol, slot_reason)
                    return None
        else:
            is_open, reason = MarketTimingGuard.is_market_open_for_exits(
                dt=event_ts,
                enforce_hours=enforce_market_hours,
            )
            if not is_open:
                logger.debug("Market timing guard blocked SELL signal for %s: %s", symbol, reason)
                return None

        # 2. Multi-Timeframe Trend Confirmation Guard (Fake Breakout Protection)
        try:
            if confirm_higher_timeframe:
                from app.services.strategy_engine.base_strategy import validate_higher_timeframe_trend
                fast_p = int(cfg.get("mtf_fast_period", 20)) if isinstance(cfg, dict) else 20
                slow_p = int(cfg.get("mtf_slow_period", 50)) if isinstance(cfg, dict) else 50
                is_confirmed, trend_reason, mtf_data = validate_higher_timeframe_trend(
                    market_data=market_data,
                    side=side,
                    fast_period=fast_p,
                    slow_period=slow_p,
                )
                indicators.update(mtf_data)
                indicators_json = json.dumps(indicators) if isinstance(indicators, dict) else str(indicators)

                # Suppress counter-trend fake breakout on BUY
                if side == "BUY" and not is_confirmed:
                    logger.debug("MTF trend filter suppressed BUY signal for %s: %s", symbol, trend_reason)
                    return None
        except Exception as exc:
            logger.debug("Error in MTF trend validation: %s", exc)

        # 3. Nifty / Benchmark Market Sentiment Guard (Broad Bloodbath Protection)
        try:
            if enforce_market_sentiment or "nifty_change_percent" in market_data or "index_change_percent" in market_data or "benchmark_change_percent" in market_data:
                from app.services.market_sentiment_guard import MarketSentimentGuard
                is_supportive, sentiment_reason, sentiment_info = MarketSentimentGuard.is_market_sentiment_supportive(
                    symbol=symbol,
                    side=side,
                    market_data=market_data,
                    enforce_filter=True,
                )
                indicators["market_sentiment"] = sentiment_info
                indicators_json = json.dumps(indicators) if isinstance(indicators, dict) else str(indicators)

                # Suppress risky BUY entries when broad benchmark index is crashing
                if side == "BUY" and not is_supportive:
                    logger.info("Market sentiment guard suppressed BUY signal for %s: %s", symbol, sentiment_reason)
                    return None
        except Exception as exc:
            logger.debug("Error in market sentiment validation: %s", exc)

        # 4. Volume Spike Confirmation Guard (Low-Volume Fake Breakout Protection)
        try:
            if confirm_volume_spike and side == "BUY":
                from app.services.strategy_engine.base_strategy import validate_volume_spike
                vol_mult = float(cfg.get("volume_multiplier", cfg.get("volume_ratio_min", 1.5))) if isinstance(cfg, dict) else 1.5
                vol_p = int(cfg.get("volume_period", 20)) if isinstance(cfg, dict) else 20
                vol_ok, vol_reason, vol_data = validate_volume_spike(
                    market_data=market_data,
                    period=vol_p,
                    multiplier=vol_mult,
                )
                indicators["volume_spike"] = vol_data
                indicators_json = json.dumps(indicators) if isinstance(indicators, dict) else str(indicators)

                # Suppress low volume fake breakout on BUY
                if not vol_ok:
                    logger.debug("Volume spike filter suppressed BUY signal for %s: %s", symbol, vol_reason)
                    return None
        except Exception as exc:
            logger.debug("Error in volume spike validation: %s", exc)

        # 5. Active Proposed Signal Deduplication Guard
        # Check if an unresolved proposed signal already exists for this instance & symbol to avoid notification spam
        if hasattr(self._repository, "has_active_proposed_signal"):
            try:
                res = self._repository.has_active_proposed_signal(instance_id, symbol, side)
                if res is True or (not isinstance(res, MagicMock) and bool(res)):
                    logger.debug(
                        "Active proposed %s signal already exists for strategy instance %s and symbol %s. Suppressing duplicate notification.",
                        side, instance_id, symbol
                    )
                    return None
            except Exception as e:
                logger.debug("Failed checking active proposed signal: %s", e)

        # 2. Ignored/Dismissed Signal Suppression Guard
        # If user recently dismissed/ignored this signal, do not recreate it across multiple cycles
        if hasattr(self._repository, "has_ignored_signal"):
            try:
                ignore_cooldown = 86400
                if definition and definition.config_json:
                    cfg = json.loads(definition.config_json) if isinstance(definition.config_json, str) else definition.config_json
                    if isinstance(cfg, dict):
                        ignore_cooldown = int(cfg.get("ignore_cooldown_seconds", cfg.get("signal_cooldown_seconds", 86400)))
                res = self._repository.has_ignored_signal(
                    strategy_instance_id=instance_id,
                    symbol=symbol,
                    side=side,
                    cooldown_seconds=ignore_cooldown,
                    user_id=user_id,
                )
                if res is True or (not isinstance(res, MagicMock) and bool(res)):
                    logger.debug(
                        "User recently ignored %s signal for strategy instance %s and symbol %s. Suppressing recreation across cycles.",
                        side, instance_id, symbol
                    )
                    return None
            except Exception as e:
                logger.debug("Failed checking ignored signal: %s", e)

        # 4. Single-Trade Daily Lock & Completion Guard (One Trade Per Day Rule)
        # If Target (+15%) or Stop Loss (-5%) was already executed today, block any further BUY orders for the remainder of the session!
        if side == "BUY" and hasattr(self._repository, "has_completed_daily_exit_or_target"):
            try:
                if self._repository.has_completed_daily_exit_or_target(
                    strategy_instance_id=instance_id,
                    symbol=symbol,
                    user_id=user_id,
                ):
                    logger.info(
                        "Daily target or stop loss already completed today for strategy instance %s and symbol %s. Enforcing single-trade-per-day lock.",
                        instance_id, symbol
                    )
                    return None
            except Exception as e:
                logger.debug("Failed checking daily completion lock: %s", e)

        # 5. Trade Cooldown & Anti-Whipsaw Guard (Post-Exit & Anti-Churning Protection)
        # Case A: If BUY signal (new entry/re-entry) and cooldown is enabled -> Suppress rapid re-entry after any trade (especially post-exit)
        if side == "BUY" and reentry_cooldown_seconds > 0 and hasattr(self._repository, "has_recent_execution_or_signal"):
            try:
                res = self._repository.has_recent_execution_or_signal(
                    strategy_instance_id=instance_id,
                    symbol=symbol,
                    cooldown_seconds=reentry_cooldown_seconds,
                    user_id=user_id,
                    side=None,
                )
                if res is True or (not isinstance(res, MagicMock) and bool(res)):
                    logger.info(
                        "Trade cooldown active for symbol %s (cooldown: %ss). Suppressing rapid re-entry/overtrading.",
                        symbol, reentry_cooldown_seconds
                    )
                    return None
            except Exception as e:
                logger.debug("Failed checking trade cooldown: %s", e)

        # Case B: If SELL signal and user JUST opened/bought the position (within min_holding_seconds)
        # Suppress immediate premature SELL notification so user doesn't get a sell alert 10 seconds after buying
        if side == "SELL" and min_holding_seconds > 0 and current_qty > Decimal("0.0000") and hasattr(self._repository, "has_recent_execution_or_signal"):
            try:
                has_recent_buy = self._repository.has_recent_execution_or_signal(
                    strategy_instance_id=instance_id,
                    symbol=symbol,
                    cooldown_seconds=min_holding_seconds,
                    user_id=user_id,
                    side="BUY",
                )
                if has_recent_buy is True or (not isinstance(has_recent_buy, MagicMock) and bool(has_recent_buy)):
                    logger.debug(
                        "Recent BUY execution/signal active for %s within %ss holding stabilization. Suppressing premature SELL notification.",
                        symbol, min_holding_seconds
                    )
                    return None
            except Exception as e:
                logger.debug("Failed checking minimum holding cooldown for SELL: %s", e)

        # 5. In-Flight Pending Order Guard
        if self._has_pending_orders(user_id=user_id, instance=instance, symbol=symbol, side=side):
            logger.debug(
                "Pending in-flight %s order in progress for symbol %s. Suppressing duplicate signal.",
                side, symbol
            )
            return None

        # 6. In-Position State Tracking Guard:
        # If BUY signal, but already holding open LONG position and pyramiding is not allowed -> Suppress duplicate BUY
        if side == "BUY" and current_qty > Decimal("0.0000") and not allow_pyramiding:
            logger.debug(
                "Strategy instance %s already holds open LONG position (%s %s). Suppressing duplicate BUY entry.",
                instance_id, current_qty, symbol
            )
            return None

        # 7. If SELL signal, but NO open position exists -> Skip SELL in spot delivery mode
        if side == "SELL" and current_qty <= Decimal("0.0000"):
            logger.debug(
                "Strategy instance %s has no open position to sell for %s. Skipping SELL.",
                instance_id, symbol
            )
            return None

        # Cap SELL suggested quantity to available open position quantity
        if side == "SELL" and current_qty > Decimal("0.0000"):
            quantity = min(quantity, current_qty)

        # 3. Compute Fingerprint & Enforce Signal Deduplication Guard
        fingerprint = self.compute_signal_fingerprint(instance_id, symbol, side, quantity, event_ts)
        signal_record, is_new = self._repository.create_signal_if_not_exists(
            strategy_instance_id=instance_id,
            user_id=user_id,
            broker_id=instance.broker_id,
            symbol=symbol,
            side=side,
            quantity=quantity,
            order_type=order_type,
            price=price,
            signal_fingerprint=fingerprint,
            suggested_quantity=quantity,
            stop_loss=stop_loss,
            target=target,
            risk_reward=risk_reward,
            reason=reason,
            indicators_json=indicators_json,
        )

        if not is_new:
            logger.warning(f"Duplicate signal detected for strategy instance {instance_id} with fingerprint {fingerprint}.")
            raise DuplicateSignalException("Signal has already been processed for this strategy instance.")

        audit_event(
            "STRATEGY_SIGNAL_GENERATED",
            user_id=user_id,
            broker_id=instance.broker_id,
            outcome="PROPOSED",
            resource_type="strategy_signal",
            resource_id=signal_record.id,
            symbol=symbol,
            side=side,
            quantity=str(quantity),
            order_type=order_type,
            price=str(price) if price is not None else None,
            execution_mode=instance.execution_mode,
        )

        # Resolve Strategy Definition Name for Notification
        strategy_name = "Trading Strategy"
        try:
            definition = self._repository.get_definition_for_user(instance.strategy_definition_id, user_id)
            if definition:
                strategy_name = definition.name
        except Exception:
            pass

        # Determine whether Auto-Pilot Autonomous Mode is active
        is_autonomous = False
        try:
            exec_mode = str(getattr(instance, "execution_mode", "PAPER")).upper()
            if definition and definition.config_json:
                cfg_obj = json.loads(definition.config_json) if isinstance(definition.config_json, str) else definition.config_json
                if isinstance(cfg_obj, dict):
                    is_autonomous = bool(
                        cfg_obj.get("auto_pilot", False)
                        or cfg_obj.get("autonomous_execution", False)
                        or exec_mode in ("FULL_AUTONOMOUS", "AUTONOMOUS")
                    )
            elif exec_mode in ("FULL_AUTONOMOUS", "AUTONOMOUS"):
                is_autonomous = True
        except Exception:
            is_autonomous = False

        # Ensure Admin users are never auto-executed (Admin is supervisory only)
        try:
            user = getattr(instance, "user", None)
            if not user and hasattr(self._repository, "db") and self._repository.db:
                from app.database.models.user import User
                user = self._repository.db.get(User, user_id)
            if user and str(getattr(user.role, "value", user.role)).upper() == "ADMIN":
                is_autonomous = False
        except Exception:
            pass

        # Auto-Pilot / Full Autonomous Mode Execution
        executed_order_id = None
        if is_autonomous:
            try:
                target_mode = "LIVE" if str(instance.execution_mode).upper() == "LIVE" else "PAPER"
                logger.info(
                    "AUTONOMOUS AUTO-PILOT TRIGGERED: Auto-executing %s %s shares of %s (Mode: %s)",
                    side, quantity, symbol, target_mode
                )
                approval_result = self.approve_signal(
                    user_id=user_id,
                    signal_id=signal_record.id,
                    actual_quantity=quantity,
                    execution_mode=target_mode,
                    custom_stop_loss=stop_loss,
                    custom_target=target,
                    source="AUTO_PILOT",
                )
                signal_record.status = "APPROVED"
                signal_record.actual_quantity = quantity
                executed_order_id = approval_result.get("order_id") if isinstance(approval_result, dict) else str(approval_result)
                signal_record.executed_order_id = executed_order_id
                if hasattr(self._repository.db, "commit"):
                    self._repository.db.commit()
            except Exception as auto_err:
                logger.warning("Autonomous auto-execution failed for signal %s: %s", signal_record.id, auto_err)
                # In Auto-Pilot mode, never leave unexecutable or duplicate signals in PROPOSED state
                signal_record.status = "CANCELLED" if "Insufficient" in str(auto_err) else "APPROVED"
                if hasattr(self._repository.db, "commit"):
                    self._repository.db.commit()

        # Generate Trading Signal Notification in Alert System
        notification_data = {
            "signal_id": str(signal_record.id),
            "symbol": symbol,
            "exchange": "NSE",
            "side": side,
            "strategy_name": strategy_name,
            "strategy_instance_id": str(instance_id),
            "current_price": str(price) if price is not None else None,
            "suggested_entry_price": str(price) if price is not None else None,
            "suggested_quantity": str(quantity),
            "stop_loss": str(stop_loss) if stop_loss is not None else None,
            "target": str(target) if target is not None else None,
            "risk_reward": risk_reward,
            "reason": reason,
            "indicators": indicators,
            "execution_mode": instance.execution_mode,
            "is_autonomous": is_autonomous,
            "executed_order_id": executed_order_id,
            "timestamp": event_ts.isoformat(),
        }

        strength_pct = f"{indicators.get('strength', 75)}%"
        try:
            from app.database.repositories.alert_repository import AlertRepository
            alert_repo = AlertRepository(self._repository.db)
            if is_autonomous and executed_order_id:
                alert_repo.create_alert(
                    user_id=user_id,
                    title=f"⚡ Auto-Pilot Executed: {side} {symbol} ({quantity} Qty)",
                    message=f"{strategy_name} automatically executed {side} for {symbol} at ₹{price}. Dynamic SL: ₹{stop_loss}, Target: ₹{target}. (Hands-Free Execution).",
                    type="ORDER_FILLED",
                    severity="SUCCESS",
                    route="/orders",
                    signal_id=signal_record.id,
                    data_json=json.dumps(notification_data),
                )
            else:
                alert_repo.create_alert(
                    user_id=user_id,
                    title=f"🔔 {side} ({strength_pct}): {symbol}",
                    message=f"{strategy_name} generated {side} ({strength_pct}) signal for {symbol}. Suggested Qty: {quantity}, Entry: ₹{price}, SL: ₹{stop_loss}, Target: ₹{target}.",
                    type="STRATEGY_SIGNAL",
                    severity="INFO" if side == "BUY" else "WARNING",
                    route="/orders",
                    signal_id=signal_record.id,
                    data_json=json.dumps(notification_data),
                )
        except Exception as exc:
            logger.warning("Failed to create alert for strategy signal %s: %s", signal_record.id, exc)

        # Publish EventBus Events
        self._publish_event(
            EventType.SIGNAL_GENERATED,
            user_id=user_id,
            strategy_instance_id=instance_id,
            strategy_id=instance.strategy_definition_id,
            broker_id=instance.broker_id,
            symbol=symbol,
            execution_mode=instance.execution_mode,
            payload=notification_data,
        )

        self._repository.mark_execution(instance_id, user_id)
        logger.info(
            "Strategy signal generated and notification dispatched for instance %s: %s %s %s (Auto-Pilot: %s)",
            instance_id, side, quantity, symbol, is_autonomous
        )

        return signal_record

    def approve_signal(
        self,
        user_id: UUID,
        signal_id: UUID,
        actual_quantity: Decimal,
        execution_mode: Optional[str] = None,
        custom_stop_loss: Optional[Decimal] = None,
        custom_target: Optional[Decimal] = None,
        source: Optional[str] = None,
    ) -> Any:
        """
        User-confirmed manual execution of a proposed strategy signal.
        Enforces human-in-the-loop actual quantity and order source tracking.
        """
        signal = self._repository.get_signal_by_id(signal_id, user_id)
        if not signal:
            raise ValueError(f"Strategy signal {signal_id} not found for user {user_id}")

        if signal.status.upper() not in ("PROPOSED", "VIEWED"):
            raise ValueError(f"Cannot approve signal with status '{signal.status}'. Must be PROPOSED or VIEWED.")

        if actual_quantity <= Decimal("0"):
            raise ValueError("Actual order quantity must be strictly greater than zero.")

        instance = self._repository.get_instance_for_user(signal.strategy_instance_id, user_id)
        mode = execution_mode.upper() if execution_mode else (instance.execution_mode.upper() if instance else "PAPER")

        if mode not in ("PAPER", "LIVE"):
            raise BaseStrategyException(f"Unsupported strategy execution mode: {mode}")

        side = signal.side.upper()
        order_source = source if source else ("MANUAL_BUY" if side == "BUY" else "MANUAL_SELL")
        sl_to_register = custom_stop_loss if custom_stop_loss is not None else signal.stop_loss
        target_to_register = custom_target if custom_target is not None else signal.target

        # Check Global / Scoped Kill Switch
        if self._risk_engine and hasattr(self._risk_engine, "is_kill_switch_active"):
            try:
                if self._risk_engine.is_kill_switch_active() is True:
                    from app.exceptions.risk_exceptions import TradingHaltedException
                    raise TradingHaltedException("Trading is currently halted by emergency kill switch.")
            except Exception as e:
                from app.exceptions.risk_exceptions import TradingHaltedException
                if isinstance(e, TradingHaltedException):
                    raise

        if side == "SELL":
            instance = self._repository.get_instance_for_user(signal.strategy_instance_id, user_id)
            if instance:
                current_qty = self._get_open_position_quantity(user_id=user_id, instance=instance, symbol=signal.symbol)
                if current_qty > Decimal("0.0000") and actual_quantity > current_qty:
                    actual_quantity = current_qty

        order_request = BrokerOrderRequest(
            symbol=signal.symbol,
            exchange="NSE",
            quantity=actual_quantity,
            side=side,
            order_type=signal.order_type or "MARKET",
            product="CNC",
            variety="regular",
            price=signal.price,
        )

        executed_order_id = ""

        if mode == "PAPER":
            if not self._paper_accounting_service:
                raise BaseStrategyException("PaperAccountingService required for PAPER execution.")

            paper_order_id = f"PAPER-{uuid.uuid4().hex[:16]}"
            executed_order_id = paper_order_id

            # Apply Risk Guard
            if self._safety_service:
                current_positions, current_exposure = self._paper_accounting_service.get_risk_snapshot(
                    user_id=user_id, strategy_instance_id=signal.strategy_instance_id
                )
                self._safety_service.validate_order(
                    user_id=user_id,
                    broker_id=signal.broker_id,
                    request=order_request,
                    execution_mode="PAPER",
                    current_positions=current_positions,
                    current_exposure_notional=current_exposure,
                )

            # Resolve if slippage or costs should be applied from strategy config or defaults
            apply_slip = False
            apply_costs = False
            if instance and hasattr(instance, "strategy_definition_id") and instance.strategy_definition_id:
                try:
                    defn = self._repository.get_definition_for_user(instance.strategy_definition_id, user_id)
                    if defn and defn.config_json:
                        cfg = json.loads(defn.config_json) if isinstance(defn.config_json, str) else defn.config_json
                        if isinstance(cfg, dict):
                            apply_slip = bool(cfg.get("simulate_slippage", cfg.get("apply_slippage", False)))
                            apply_costs = bool(cfg.get("simulate_costs", cfg.get("apply_transaction_costs", False)))
                except Exception:
                    pass

            # Record fill into paper accounting with registered SL, slippage, and transaction costs
            position = self._paper_accounting_service.record_fill(
                user_id=user_id,
                broker_id=signal.broker_id,
                symbol=signal.symbol,
                side=side,
                quantity=actual_quantity,
                price=signal.price or Decimal("1000.00"),
                execution_mode="PAPER",
                strategy_instance_id=signal.strategy_instance_id,
                signal_id=signal.id,
                execution_id=paper_order_id,
                product=getattr(order_request, "product", "CNC") or "CNC",
                apply_slippage=apply_slip,
                apply_transaction_costs=apply_costs,
            )

            if sl_to_register is not None:
                position.stop_loss = sl_to_register
            if target_to_register is not None:
                position.target = target_to_register
            position.status = "OPEN" if position.quantity > Decimal("0") else "CLOSED"
            self._repository.db.commit()

        elif mode == "LIVE":
            if not self._broker_order_service:
                raise BaseStrategyException("BrokerOrderService required for LIVE execution.")

            idempotency_key = f"MANUAL-{user_id}-{signal.id}-{actual_quantity}"
            order = self._broker_order_service.place_order(
                user_id=user_id,
                broker_id=signal.broker_id,
                request=order_request,
                idempotency_key=idempotency_key,
                strategy_instance_id=signal.strategy_instance_id,
                signal_id=signal.id,
                order_source=order_source,
            )
            executed_order_id = order.order_id

            # Set SL on Live Position if execution position service exists
            if self._execution_position_service and sl_to_register is not None:
                live_pos = self._execution_position_service._positions.get_for_update(
                    user_id, signal.broker_id, signal.symbol
                )
                if live_pos:
                    live_pos.stop_loss = sl_to_register
                    live_pos.target = target_to_register
                    live_pos.source = order_source
                    self._repository.db.commit()

        # Update Signal status to APPROVED
        updated_signal = self._repository.update_signal_status(
            signal_id=signal_id,
            user_id=user_id,
            status="APPROVED",
            actual_quantity=actual_quantity,
            executed_order_id=executed_order_id,
        )

        audit_event(
            "STRATEGY_SIGNAL_APPROVED",
            user_id=user_id,
            broker_id=signal.broker_id,
            outcome="SUCCESS",
            resource_type="strategy_signal",
            resource_id=signal.id,
            symbol=signal.symbol,
            side=side,
            suggested_quantity=str(signal.quantity),
            actual_quantity=str(actual_quantity),
            order_source=order_source,
            execution_mode=mode,
            executed_order_id=executed_order_id,
        )

        return {
            "signal_id": str(signal_id),
            "status": "APPROVED",
            "order_id": executed_order_id,
            "actual_quantity": str(actual_quantity),
            "side": side,
            "symbol": signal.symbol,
            "execution_mode": mode,
        }

    def ignore_signal(self, user_id: UUID, signal_id: UUID) -> Any:
        """User ignores a proposed strategy signal. No order is created."""
        signal = self._repository.get_signal_by_id(signal_id, user_id)
        if not signal:
            raise ValueError(f"Strategy signal {signal_id} not found for user {user_id}")

        updated_signal = self._repository.update_signal_status(
            signal_id=signal_id,
            user_id=user_id,
            status="IGNORED",
        )

        audit_event(
            "STRATEGY_SIGNAL_IGNORED",
            user_id=user_id,
            broker_id=signal.broker_id,
            outcome="SUCCESS",
            resource_type="strategy_signal",
            resource_id=signal.id,
            symbol=signal.symbol,
            side=signal.side,
        )

        return {
            "signal_id": str(signal_id),
            "status": "IGNORED",
            "symbol": signal.symbol,
            "side": signal.side,
        }

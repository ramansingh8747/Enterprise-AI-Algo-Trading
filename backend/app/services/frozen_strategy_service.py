import copy
import hashlib
import json
import logging
import os
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class FrozenStrategyImmutableError(Exception):
    """Raised when attempting to modify, mutate, or overwrite an existing frozen strategy version."""
    pass


class FrozenStrategyValidationError(Exception):
    """Raised when required parameters in a frozen configuration are missing or invalid."""
    pass


@dataclass(frozen=True)
class FrozenStrategyConfig:
    """
    Immutable specification of a validated strategy configuration frozen from WFA research.

    Guarantees:
    - Immutable (frozen=True)
    - Deterministic SHA-256 configuration hash
    - Decoupled from mutable live strategy database rows
    - Explicit execution_mode = 'PAPER' (cannot invoke live broker execution)
    """
    version_id: str  # e.g. "COALINDIA_WFA_FROZEN_v1"
    strategy_id: str  # e.g. "STRAT_25"
    strategy_name: str  # e.g. "Strategy 25 (COALINDIA) [WFA Frozen]"
    symbol: str  # "COALINDIA"
    status: str  # "FROZEN"
    
    # Core Strategy Parameters
    buy_threshold: float
    stop_loss: float
    target: float
    quantity: int
    side: str
    
    # Regime Filters
    use_trend_filter: bool
    change_percent_threshold: float
    use_volatility_filter: bool
    max_adverse_volatility: float
    
    # Position Sizing & Capital
    allocated_capital: Decimal
    position_sizing_rule: str  # "AFFORDABLE_QUANTITY_CAPPED"
    
    # Execution & Risk Rules
    execution_mode: str  # Strictly "PAPER" / "VIRTUAL"
    same_candle_ambiguity_rule: str  # "SL_FIRST" (Conservative)
    slippage_model: str  # "DYNAMIC_VOLATILITY_0.05_0.10"
    transaction_cost_model: str  # "INDIAN_EQUITY_CNC_STT_STAMP_GST"
    
    # Research Provenance & Audit Metadata
    source_research_version: str  # "WFA_ROLLING_MULTI_WINDOW_v1"
    optimization_windows_evaluated: int
    wfa_oos_trades_count: int
    wfa_oos_win_rate_pct: float
    wfa_oos_profit_factor: float
    wfa_oos_net_pnl: Decimal
    holdout_trades_count: int
    holdout_win_rate_pct: float
    holdout_profit_factor: float
    holdout_net_pnl: Decimal
    created_at_utc: str
    config_hash: str = ""

    def to_dict(self) -> Dict[str, Any]:
        """Converts config to JSON-serializable dictionary."""
        d = asdict(self)
        d["allocated_capital"] = str(self.allocated_capital)
        d["wfa_oos_net_pnl"] = str(self.wfa_oos_net_pnl)
        d["holdout_net_pnl"] = str(self.holdout_net_pnl)
        return d

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "FrozenStrategyConfig":
        """Reconstructs FrozenStrategyConfig from dictionary with validation."""
        d = dict(data)
        # Ensure Decimals
        d["allocated_capital"] = Decimal(str(d["allocated_capital"]))
        d["wfa_oos_net_pnl"] = Decimal(str(d["wfa_oos_net_pnl"]))
        d["holdout_net_pnl"] = Decimal(str(d["holdout_net_pnl"]))
        return cls(**d)


class FrozenStrategyService:
    """
    Registry and persistence service for immutable Frozen Strategy Configurations.

    Safety:
    - Never mutates existing versions.
    - Prevents paper trading from reading mutable live database parameters.
    - Blocks live broker execution from paper configs.
    """

    DEFAULT_STORAGE_DIR = Path(__file__).resolve().parent.parent / "research_artifacts" / "frozen_strategies"

    def __init__(self, storage_dir: Optional[Path] = None) -> None:
        self.storage_dir = storage_dir or self.DEFAULT_STORAGE_DIR
        self._in_memory_registry: Dict[str, FrozenStrategyConfig] = {}
        self._initialize_storage()
        self._register_default_coalindia_v1()

    def _initialize_storage(self) -> None:
        try:
            self.storage_dir.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            logger.warning("Could not create frozen strategy storage directory %s: %s", self.storage_dir, e)

    @staticmethod
    def compute_config_hash(config_data: Dict[str, Any]) -> str:
        """Computes deterministic SHA-256 hash of core trading and risk parameters."""
        core_keys = [
            "strategy_id", "symbol", "buy_threshold", "stop_loss", "target", "quantity",
            "use_trend_filter", "change_percent_threshold", "use_volatility_filter",
            "max_adverse_volatility", "allocated_capital", "position_sizing_rule",
            "same_candle_ambiguity_rule", "slippage_model", "transaction_cost_model"
        ]
        subset = {k: str(config_data.get(k)) for k in core_keys}
        serialized = json.dumps(subset, sort_keys=True)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()[:16]

    def _register_default_coalindia_v1(self) -> None:
        """Registers the verified frozen WFA v1 configuration for Strategy 25 (COALINDIA)."""
        v1_id = "COALINDIA_WFA_FROZEN_v1"
        if v1_id in self._in_memory_registry:
            return

        cfg_dict = {
            "version_id": v1_id,
            "strategy_id": "STRAT_25",
            "strategy_name": "Strategy 25 (COALINDIA) [WFA Frozen]",
            "symbol": "COALINDIA",
            "status": "FROZEN",
            "buy_threshold": 390.78,  # Base 390.0 * 1.002
            "stop_loss": 382.20,      # Base 390.0 * 0.980 (-2.0%)
            "target": 403.65,         # Base 390.0 * 1.035 (+3.5%)
            "quantity": 50,
            "side": "DYNAMIC",
            "use_trend_filter": True,
            "change_percent_threshold": 0.2,
            "use_volatility_filter": True,
            "max_adverse_volatility": 3.5,
            "allocated_capital": Decimal("22727.27"),
            "position_sizing_rule": "AFFORDABLE_QUANTITY_CAPPED",
            "execution_mode": "PAPER",
            "same_candle_ambiguity_rule": "SL_FIRST",
            "slippage_model": "DYNAMIC_VOLATILITY_0.05_0.10",
            "transaction_cost_model": "INDIAN_EQUITY_CNC_STT_STAMP_GST",
            "source_research_version": "WFA_ROLLING_MULTI_WINDOW_v1",
            "optimization_windows_evaluated": 4,
            "wfa_oos_trades_count": 31,
            "wfa_oos_win_rate_pct": 67.7,
            "wfa_oos_profit_factor": 2.16,
            "wfa_oos_net_pnl": Decimal("1625.09"),
            "holdout_trades_count": 4,
            "holdout_win_rate_pct": 75.0,
            "holdout_profit_factor": 416.50,
            "holdout_net_pnl": Decimal("1894.35"),
            "created_at_utc": "2026-08-19T00:05:00Z",
        }
        cfg_dict["config_hash"] = self.compute_config_hash(cfg_dict)
        frozen_config = FrozenStrategyConfig.from_dict(cfg_dict)
        self.save_frozen_strategy(frozen_config)

    def save_frozen_strategy(self, config: FrozenStrategyConfig) -> None:
        """
        Saves a frozen configuration.
        Raises FrozenStrategyImmutableError if attempting to mutate an existing version.
        """
        if not config.version_id:
            raise FrozenStrategyValidationError("version_id is required for frozen configuration.")
        if config.execution_mode.upper() != "PAPER":
            raise FrozenStrategyValidationError("execution_mode for frozen research strategy must be 'PAPER'.")

        # Immutability Check: Do not allow changing an existing version
        computed_hash = self.compute_config_hash(config.to_dict())
        if config.version_id in self._in_memory_registry:
            existing = self._in_memory_registry[config.version_id]
            if existing.config_hash != computed_hash or existing != config:
                raise FrozenStrategyImmutableError(
                    f"Frozen version '{config.version_id}' is immutable. Create a new version (e.g. v2) to update parameters."
                )

        self._in_memory_registry[config.version_id] = config

        # Persist to disk
        try:
            file_path = self.storage_dir / f"{config.version_id}.json"
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(config.to_dict(), f, indent=2)
        except Exception as e:
            logger.debug("Could not write frozen strategy to disk (%s): %s", self.storage_dir, e)

    def get_frozen_strategy(self, version_id: str) -> FrozenStrategyConfig:
        """
        Retrieves a frozen configuration by version_id.
        Raises KeyError if version does not exist.
        """
        if version_id in self._in_memory_registry:
            return self._in_memory_registry[version_id]

        # Check disk
        file_path = self.storage_dir / f"{version_id}.json"
        if file_path.exists():
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                config = FrozenStrategyConfig.from_dict(data)
                self._in_memory_registry[version_id] = config
                return config

        raise KeyError(f"Frozen strategy configuration '{version_id}' not found.")

    def list_frozen_strategies(self) -> List[FrozenStrategyConfig]:
        """Lists all registered frozen strategy configurations."""
        return list(self._in_memory_registry.values())

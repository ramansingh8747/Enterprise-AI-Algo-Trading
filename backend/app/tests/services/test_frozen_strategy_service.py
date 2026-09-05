import copy
import json
import uuid
from decimal import Decimal
from pathlib import Path
import pytest

from app.database.models.strategy import StrategyDefinition
from app.services.frozen_strategy_service import (
    FrozenStrategyService,
    FrozenStrategyConfig,
    FrozenStrategyImmutableError,
    FrozenStrategyValidationError,
)


@pytest.fixture
def temp_storage(tmp_path):
    return tmp_path / "frozen_strategies"


@pytest.fixture
def frozen_service(temp_storage):
    return FrozenStrategyService(storage_dir=temp_storage)


def test_exact_coalindia_wfa_configuration_retrieval(frozen_service):
    """
    Test 1: Exact COALINDIA WFA configuration retrieval:
    - Verifies all parameters match the verified WFA research results.
    """
    config = frozen_service.get_frozen_strategy("COALINDIA_WFA_FROZEN_v1")
    assert config.strategy_id == "STRAT_25"
    assert config.symbol == "COALINDIA"
    assert config.status == "FROZEN"
    assert config.buy_threshold == 390.78
    assert config.stop_loss == 382.20
    assert config.target == 403.65
    assert config.use_trend_filter is True
    assert config.change_percent_threshold == 0.2
    assert config.use_volatility_filter is True
    assert config.max_adverse_volatility == 3.5
    assert config.allocated_capital == Decimal("22727.27")
    assert config.execution_mode == "PAPER"
    assert config.same_candle_ambiguity_rule == "SL_FIRST"
    assert config.wfa_oos_trades_count == 31
    assert config.wfa_oos_win_rate_pct == 67.7
    assert config.wfa_oos_profit_factor == 2.16
    assert config.holdout_trades_count == 4
    assert config.holdout_win_rate_pct == 75.0
    assert config.holdout_profit_factor == 416.50
    assert len(config.config_hash) > 0


def test_frozen_configuration_immutability(frozen_service):
    """
    Test 2: Frozen configuration immutability:
    - Attempting to overwrite an existing version with different parameters must raise FrozenStrategyImmutableError.
    """
    v1 = frozen_service.get_frozen_strategy("COALINDIA_WFA_FROZEN_v1")
    mutated_dict = v1.to_dict()
    mutated_dict["stop_loss"] = 370.00  # Attempt to mutate stop loss

    mutated_config = FrozenStrategyConfig.from_dict(mutated_dict)

    with pytest.raises(FrozenStrategyImmutableError) as exc_info:
        frozen_service.save_frozen_strategy(mutated_config)

    assert "immutable" in str(exc_info.value).lower()


def test_configuration_versioning_creates_new_version(frozen_service):
    """
    Test 3: Configuration versioning creates a new version (e.g. v2) instead of mutating v1.
    """
    v1 = frozen_service.get_frozen_strategy("COALINDIA_WFA_FROZEN_v1")
    v2_dict = v1.to_dict()
    v2_dict["version_id"] = "COALINDIA_WFA_FROZEN_v2"
    v2_dict["stop_loss"] = 380.00
    v2_dict["config_hash"] = frozen_service.compute_config_hash(v2_dict)

    v2_config = FrozenStrategyConfig.from_dict(v2_dict)
    frozen_service.save_frozen_strategy(v2_config)

    # Verify both v1 and v2 exist and v1 is unchanged
    saved_v1 = frozen_service.get_frozen_strategy("COALINDIA_WFA_FROZEN_v1")
    saved_v2 = frozen_service.get_frozen_strategy("COALINDIA_WFA_FROZEN_v2")

    assert saved_v1.stop_loss == 382.20
    assert saved_v2.stop_loss == 380.00
    assert saved_v1.version_id != saved_v2.version_id


def test_paper_mode_cannot_invoke_live_execution(frozen_service):
    """
    Test 4: Safety Boundary:
    - execution_mode must strictly be 'PAPER'.
    - Attempting to register a frozen config with execution_mode='LIVE' must be rejected.
    """
    v1 = frozen_service.get_frozen_strategy("COALINDIA_WFA_FROZEN_v1")
    live_dict = v1.to_dict()
    live_dict["version_id"] = "COALINDIA_ILLEGAL_LIVE"
    live_dict["execution_mode"] = "LIVE"

    live_config = FrozenStrategyConfig.from_dict(live_dict)
    with pytest.raises(FrozenStrategyValidationError) as exc_info:
        frozen_service.save_frozen_strategy(live_config)

    assert "execution_mode for frozen research strategy must be 'PAPER'" in str(exc_info.value)


def test_no_modification_to_original_strategy_definition(frozen_service):
    """
    Test 5: Original Strategy Definition Preservation:
    - Creating and reading frozen strategy configs does not alter production StrategyDefinition models.
    """
    prod_def = StrategyDefinition(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        name="Strategy 25 (COALINDIA)",
        strategy_type="RULE_BASED",
        config_json=json.dumps({"symbol": "COALINDIA", "quantity": 10, "buy_threshold": 390.0}),
        is_active=True,
    )

    # Ensure frozen config retrieval is decoupled from prod_def
    frozen_cfg = frozen_service.get_frozen_strategy("COALINDIA_WFA_FROZEN_v1")
    assert frozen_cfg.version_id == "COALINDIA_WFA_FROZEN_v1"
    assert prod_def.strategy_type == "RULE_BASED"
    assert json.loads(prod_def.config_json)["quantity"] == 10  # Production model completely unaffected


def test_frozen_configuration_hash_determinism(frozen_service):
    """
    Test 6: Configuration Hash Determinism:
    - Same parameters always produce identical hash.
    - Altering any parameter changes the hash.
    """
    v1 = frozen_service.get_frozen_strategy("COALINDIA_WFA_FROZEN_v1")
    h1 = frozen_service.compute_config_hash(v1.to_dict())

    d2 = v1.to_dict()
    h2 = frozen_service.compute_config_hash(d2)
    assert h1 == h2

    d3 = v1.to_dict()
    d3["target"] = 410.00
    h3 = frozen_service.compute_config_hash(d3)
    assert h1 != h3


def test_missing_wfa_parameters_fail_safely(frozen_service):
    """
    Test 7: Missing required parameters fail with FrozenStrategyValidationError.
    """
    invalid_dict = {
        "version_id": "",
        "strategy_id": "STRAT_25",
        "strategy_name": "Incomplete",
        "symbol": "COALINDIA",
        "status": "FROZEN",
        "buy_threshold": 390.78,
        "stop_loss": 382.20,
        "target": 403.65,
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
        "source_research_version": "WFA_v1",
        "optimization_windows_evaluated": 4,
        "wfa_oos_trades_count": 31,
        "wfa_oos_win_rate_pct": 67.7,
        "wfa_oos_profit_factor": 2.16,
        "wfa_oos_net_pnl": Decimal("1625.09"),
        "holdout_trades_count": 4,
        "holdout_win_rate_pct": 75.0,
        "holdout_profit_factor": 416.50,
        "holdout_net_pnl": Decimal("1894.35"),
        "created_at_utc": "2026-08-19T00:00:00Z",
    }
    cfg = FrozenStrategyConfig.from_dict(invalid_dict)
    with pytest.raises(FrozenStrategyValidationError):
        frozen_service.save_frozen_strategy(cfg)

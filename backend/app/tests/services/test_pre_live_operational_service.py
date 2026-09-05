from unittest.mock import MagicMock

from app.services.pre_live_operational_service import PreLiveOperationalService


def test_simulated_failure_drills_are_read_only_and_complete():
    service = PreLiveOperationalService(MagicMock(), MagicMock())
    checks = service._simulated_failure_drills()

    assert len(checks) == 10
    assert all(check.status == "PASS" for check in checks)
    assert all(check.mode == "SIMULATED_DRILL" for check in checks)
    assert all(check.details["simulated"] is True for check in checks)
    assert all(check.details["order_execution_attempted"] is False for check in checks)


def test_static_configuration_checks_keep_live_disabled_by_default(monkeypatch):
    service = PreLiveOperationalService(MagicMock(), MagicMock())
    monkeypatch.setattr("app.services.pre_live_operational_service.settings.LIVE_TRADING_ENABLED", False)
    monkeypatch.setattr("app.services.pre_live_operational_service.settings.STRATEGY_SCHEDULER_ENABLED", False)
    monkeypatch.setattr("app.services.pre_live_operational_service.settings.AUDIT_LOG_ENABLED", True)
    monkeypatch.setattr("app.services.pre_live_operational_service.settings.BROKER_RECONCILIATION_ENABLED", True)

    db = MagicMock()
    db.execute.return_value.first.return_value = None
    db.execute.return_value.scalar_one_or_none.return_value = MagicMock()
    service.db = db

    checks = service._static_checks(MagicMock(), MagicMock())
    by_name = {check.name: check for check in checks}

    assert by_name["live_activation_default"].status == "PASS"
    assert by_name["scheduler_preflight"].status == "PASS"
    assert by_name["audit_logging"].status == "PASS"
    assert by_name["reconciliation_runtime"].status == "PASS"
    assert by_name["trading_runtime_components"].status == "PASS"

from app.services.admin_live_gate_service import AdminLiveGateService


def test_live_gate_service_exists_and_safe_defaults_are_documented():
    assert AdminLiveGateService.__doc__
    assert "never enables LIVE trading" in AdminLiveGateService.__doc__

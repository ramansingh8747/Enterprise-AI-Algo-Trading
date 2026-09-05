import os
from unittest.mock import patch, MagicMock
import pytest

from app.database.session import SessionLocal
from app.database.repositories.user_repository import UserRepository
from app.services.authentication_service import AuthenticationService
from app.services.sms.base_provider import ISmsProvider
from app.services.sms.callmebot_provider import CallMeBotSmsProvider
from app.services.sms.mock_provider import MockSmsProvider
from app.services.sms.sms_factory import SmsFactory
from app.schemas.auth import SendOTPRequest, VerifyOTPRequest
from app.exceptions.auth_exceptions import InvalidCredentialsException


class DummyAuthRepo:
    def store_refresh_token(self, u_id, r_tok): pass
    def revoke_refresh_token(self, r_tok): pass


def test_mock_sms_provider():
    provider = MockSmsProvider()
    assert isinstance(provider, ISmsProvider)
    assert provider.send_otp_message("8757433778", "123456") is True


def test_callmebot_unauthorized_number_skipped():
    provider = CallMeBotSmsProvider()
    with patch.dict(os.environ, {"ALLOWED_WHATSAPP_TEST_NUMBERS": "7004122504,8757433778"}):
        # 9999999999 is NOT in whitelist -> MUST be skipped
        assert provider.send_otp_message("9999999999", "123456") is False


def test_callmebot_missing_api_key():
    provider = CallMeBotSmsProvider()
    with patch.dict(os.environ, {
        "ALLOWED_WHATSAPP_TEST_NUMBERS": "8757433778",
        "CALLMEBOT_API_KEY_8757433778": "",
        "WHATSAPP_CALLMEBOT_API_KEY": ""
    }):
        assert provider.send_otp_message("8757433778", "123456") is False


@patch("httpx.get")
def test_callmebot_successful_http_dispatch(mock_get):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_get.return_value = mock_resp

    provider = CallMeBotSmsProvider()
    with patch.dict(os.environ, {
        "ALLOWED_WHATSAPP_TEST_NUMBERS": "8757433778",
        "CALLMEBOT_API_KEY_8757433778": "test_key_123"
    }):
        result = provider.send_otp_message("8757433778", "654321")
        assert result is True
        assert mock_get.called
        call_url = mock_get.call_args[0][0]
        assert "phone=918757433778" in call_url
        assert "apikey=test_key_123" in call_url


@patch("httpx.get")
def test_callmebot_http_failure_handled(mock_get):
    mock_resp = MagicMock()
    mock_resp.status_code = 500
    mock_get.return_value = mock_resp

    provider = CallMeBotSmsProvider()
    with patch.dict(os.environ, {
        "ALLOWED_WHATSAPP_TEST_NUMBERS": "8757433778",
        "CALLMEBOT_API_KEY_8757433778": "test_key_123"
    }):
        result = provider.send_otp_message("8757433778", "654321")
        assert result is False


def test_sms_factory_selection():
    with patch.dict(os.environ, {"SMS_PROVIDER": "mock"}):
        prov_mock = SmsFactory.get_provider()
        assert isinstance(prov_mock, MockSmsProvider)

    with patch.dict(os.environ, {"SMS_PROVIDER": "callmebot"}):
        prov_cmb = SmsFactory.get_provider()
        assert isinstance(prov_cmb, CallMeBotSmsProvider)


@patch("httpx.get")
def test_end_to_end_otp_flow_for_test_numbers(mock_get):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_get.return_value = mock_resp

    db = SessionLocal()
    user_repo = UserRepository(db)
    service = AuthenticationService(user_repo, DummyAuthRepo())

    test_numbers = ["8757433778", "7004122504"]

    with patch.dict(os.environ, {
        "SMS_PROVIDER": "callmebot",
        "ALLOWED_WHATSAPP_TEST_NUMBERS": "7004122504,8757433778",
        "CALLMEBOT_API_KEY_8757433778": "key_trader",
        "CALLMEBOT_API_KEY_7004122504": "key_admin"
    }):
        for num in test_numbers:
            # 1. Send OTP
            send_res = service.send_otp(SendOTPRequest(phone_number=num))
            assert send_res.status == "success"
            assert len(send_res.otp_code) == 6

            # 2. Verify OTP
            verify_res = service.verify_otp(VerifyOTPRequest(phone_number=num, otp_code=send_res.otp_code))
            assert verify_res.user.phone_number == num
            assert bool(verify_res.access_token) is True


def test_invalid_otp_verification_fails():
    db = SessionLocal()
    user_repo = UserRepository(db)
    service = AuthenticationService(user_repo, DummyAuthRepo())

    with patch.dict(os.environ, {"SMS_PROVIDER": "mock"}):
        send_res = service.send_otp(SendOTPRequest(phone_number="8757433778"))
        with pytest.raises(InvalidCredentialsException):
            service.verify_otp(VerifyOTPRequest(phone_number="8757433778", otp_code="000000"))

import os
from unittest.mock import patch, MagicMock

from app.services.sms.fast2sms_provider import Fast2SmsProvider
from app.services.sms.sms_factory import SmsFactory


def test_fast2sms_missing_api_key():
    provider = Fast2SmsProvider()
    with patch.dict(os.environ, {"FAST2SMS_API_KEY": ""}):
        assert provider.send_otp_message("8757433778", "123456") is False


@patch("httpx.post")
def test_fast2sms_successful_otp_route_dispatch(mock_post):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"return": True, "request_id": "test_req_123", "message": ["SMS sent successfully."]}
    mock_post.return_value = mock_resp

    provider = Fast2SmsProvider()
    with patch.dict(os.environ, {"FAST2SMS_API_KEY": "fast2sms_test_key"}):
        result = provider.send_otp_message("8757433778", "654321")
        assert result is True
        assert mock_post.called
        headers = mock_post.call_args[1]["headers"]
        assert headers["authorization"] == "fast2sms_test_key"


@patch("httpx.post")
def test_fast2sms_quick_route_fallback(mock_post):
    # First response fails for 'otp' route, second response succeeds for 'q' route
    mock_resp_fail = MagicMock()
    mock_resp_fail.status_code = 400
    mock_resp_fail.json.return_value = {"return": False, "message": "OTP route requires template"}

    mock_resp_success = MagicMock()
    mock_resp_success.status_code = 200
    mock_resp_success.json.return_value = {"return": True, "request_id": "quick_req_456"}

    mock_post.side_effect = [mock_resp_fail, mock_resp_success]

    provider = Fast2SmsProvider()
    with patch.dict(os.environ, {"FAST2SMS_API_KEY": "fast2sms_test_key"}):
        result = provider.send_otp_message("8757433778", "999888")
        assert result is True
        assert mock_post.call_count == 2


def test_sms_factory_selects_fast2sms():
    with patch.dict(os.environ, {"SMS_PROVIDER": "fast2sms"}):
        prov = SmsFactory.get_provider()
        assert prov.__class__.__name__ == "Fast2SmsProvider"

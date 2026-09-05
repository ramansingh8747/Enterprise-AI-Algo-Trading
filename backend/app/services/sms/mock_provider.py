from app.core.logging.logger import logger
from app.services.sms.base_provider import ISmsProvider


class MockSmsProvider(ISmsProvider):
    """
    Development Fallback SMS Provider.
    Simulates OTP delivery for local testing without calling external APIs.
    """

    def send_otp_message(self, phone_number: str, otp_code: str) -> bool:
        logger.info("[MockSmsProvider] OTP generated | phone=+91-{} | otp={}", phone_number, otp_code)
        return True

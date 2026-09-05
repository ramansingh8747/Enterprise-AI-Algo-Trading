import os

from app.core.logging.logger import logger
from app.services.sms.base_provider import ISmsProvider
from app.services.sms.callmebot_provider import CallMeBotSmsProvider
from app.services.sms.fast2sms_provider import Fast2SmsProvider
from app.services.sms.mock_provider import MockSmsProvider


class SmsFactory:
    """
    Factory for selecting and instantiating the configured SMS / WhatsApp OTP provider.
    """

    @staticmethod
    def get_provider() -> ISmsProvider:
        provider_name = os.getenv("SMS_PROVIDER", "fast2sms").strip().lower()

        if provider_name == "mock":
            logger.info("[SmsFactory] Selected provider: MockSmsProvider")
            return MockSmsProvider()

        if provider_name == "fast2sms":
            logger.info("[SmsFactory] Selected provider: Fast2SmsProvider")
            return Fast2SmsProvider()

        if provider_name == "callmebot":
            logger.info("[SmsFactory] Selected provider: CallMeBotSmsProvider")
            return CallMeBotSmsProvider()

        logger.warning(
            "[SmsFactory] Unknown SMS_PROVIDER '{}'. Defaulting to Fast2SmsProvider.",
            provider_name,
        )
        return Fast2SmsProvider()

import os
from urllib.parse import quote
import httpx

from app.core.logging.logger import logger
from app.services.sms.base_provider import ISmsProvider


class CallMeBotSmsProvider(ISmsProvider):
    """
    CallMeBot WhatsApp OTP Provider Adapter.
    Dispatches 6-digit WhatsApp OTP messages to authorized whitelisted test numbers.
    """

    def _get_allowed_numbers(self) -> set[str]:
        raw = os.getenv("ALLOWED_WHATSAPP_TEST_NUMBERS", "7004122504,8757433778")
        return {num.strip().replace("+91", "").replace("91", "")[-10:] for num in raw.split(",") if num.strip()}

    def _get_api_key_for_phone(self, phone: str) -> str | None:
        # Check phone-specific env key first (e.g. CALLMEBOT_API_KEY_8757433778)
        phone_clean = phone[-10:]
        key = os.getenv(f"CALLMEBOT_API_KEY_{phone_clean}")
        if key:
            return key.strip()
        # Fallback to general CallMeBot key if specified
        general_key = os.getenv("WHATSAPP_CALLMEBOT_API_KEY")
        if general_key:
            return general_key.strip()
        return None

    def send_otp_message(self, phone_number: str, otp_code: str) -> bool:
        clean_phone = phone_number.strip().replace("+91", "").replace("91", "")[-10:]
        allowed_numbers = self._get_allowed_numbers()

        if clean_phone not in allowed_numbers:
            logger.warning(
                "[CallMeBotSmsProvider] Phone number +91-{} is not in ALLOWED_WHATSAPP_TEST_NUMBERS whitelist. Skipping CallMeBot API dispatch.",
                clean_phone,
            )
            return False

        api_key = self._get_api_key_for_phone(clean_phone)
        if not api_key:
            logger.error(
                "[CallMeBotSmsProvider] Missing CallMeBot API Key for phone +91-{}. Set CALLMEBOT_API_KEY_{} in .env.",
                clean_phone,
                clean_phone,
            )
            return False

        message = (
            f"⚡ AntigravityAlgo Terminal\n\n"
            f"Your 6-digit WhatsApp OTP verification code is: *{otp_code}*\n\n"
            f"Valid for 5 minutes. Do not share it with anyone."
        )
        encoded_text = quote(message)

        # CallMeBot API endpoint
        url = f"https://api.callmebot.com/whatsapp.php?phone=91{clean_phone}&text={encoded_text}&apikey={api_key}"

        try:
            response = httpx.get(url, timeout=5.0)
            if response.status_code == 200:
                logger.info(
                    "[CallMeBotSmsProvider] WhatsApp OTP successfully dispatched to +91-{} via CallMeBot API.",
                    clean_phone,
                )
                return True
            else:
                logger.error(
                    "[CallMeBotSmsProvider] CallMeBot API returned HTTP failure status {} for +91-{}",
                    response.status_code,
                    clean_phone,
                )
                return False
        except Exception as exc:
            logger.error(
                "[CallMeBotSmsProvider] Network/HTTP error during CallMeBot WhatsApp dispatch for +91-{}: {}",
                clean_phone,
                str(exc),
            )
            return False

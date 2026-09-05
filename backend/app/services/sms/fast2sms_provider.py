import os
import httpx

from app.core.logging.logger import logger
from app.services.sms.base_provider import ISmsProvider


class Fast2SmsProvider(ISmsProvider):
    """
    Fast2SMS Indian Transactional & OTP SMS Provider Adapter.
    Delivers 6-digit OTP codes directly to mobile phone SIM card SMS inboxes via Fast2SMS API.
    """

    def _get_api_key(self) -> str | None:
        key = os.getenv("FAST2SMS_API_KEY")
        if not key:
            try:
                from dotenv import load_dotenv
                load_dotenv()
                key = os.getenv("FAST2SMS_API_KEY")
            except Exception:
                pass
        return key.strip() if key else None

    def send_otp_message(self, phone_number: str, otp_code: str) -> bool:
        clean_phone = phone_number.strip().replace("+91", "").replace("91", "")[-10:]
        api_key = self._get_api_key()

        if not api_key:
            logger.error(
                "[Fast2SmsProvider] Missing FAST2SMS_API_KEY in .env. Please set FAST2SMS_API_KEY to send real SMS."
            )
            return False

        # Fast2SMS Bulk V2 API Endpoint
        url = "https://www.fast2sms.com/dev/bulkV2"
        headers = {
            "authorization": api_key,
            "Content-Type": "application/json",
        }

        payload = {
            "route": "otp",
            "variables_values": otp_code,
            "numbers": clean_phone,
        }

        try:
            response = httpx.post(url, json=payload, headers=headers, timeout=5.0)
            res_data = response.json() if response.status_code == 200 else {}

            if response.status_code == 200 and res_data.get("return") is True:
                logger.info(
                    "[Fast2SmsProvider] Fast2SMS OTP successfully dispatched to mobile +91-{} | ReqID={}",
                    clean_phone,
                    res_data.get("request_id", "N/A"),
                )
                return True
            else:
                # Retry via GET method with route=q (Quick SMS)
                msg_text = f"Your AntigravityAlgo Terminal OTP code is {otp_code}. Valid for 5 minutes."
                get_url = f"https://www.fast2sms.com/dev/bulkV2?authorization={api_key}&route=q&message={msg_text}&language=english&flash=0&numbers={clean_phone}"
                retry_resp = httpx.get(get_url, timeout=5.0)
                retry_data = retry_resp.json() if retry_resp.status_code == 200 else {}

                if retry_resp.status_code == 200 and retry_data.get("return") is True:
                    logger.info(
                        "[Fast2SmsProvider] Fast2SMS Quick SMS OTP dispatched to mobile +91-{} | ReqID={}",
                        clean_phone,
                        retry_data.get("request_id", "N/A"),
                    )
                    return True

                logger.error(
                    "[Fast2SmsProvider] Fast2SMS API response for +91-{}: {}",
                    clean_phone,
                    retry_data.get("message") or res_data.get("message") or response.text,
                )
                return False

        except Exception as exc:
            logger.error(
                "[Fast2SmsProvider] Network/HTTP error during Fast2SMS dispatch to +91-{}: {}",
                clean_phone,
                str(exc),
            )
            return False

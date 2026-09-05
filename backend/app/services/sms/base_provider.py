from abc import ABC, abstractmethod


class ISmsProvider(ABC):
    """
    Abstract Base Class / Interface for OTP Messaging Providers (CallMeBot, Fast2SMS, Mock).
    """

    @abstractmethod
    def send_otp_message(self, phone_number: str, otp_code: str) -> bool:
        """
        Dispatches a 6-digit OTP code to the requested mobile phone number.

        Args:
            phone_number: 10-digit Indian mobile number string.
            otp_code: 6-digit cryptographic OTP code string.

        Returns:
            True if messaging dispatch succeeded, False otherwise.
        """
        pass

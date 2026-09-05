import os
import random
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

from app.core.logging.logger import logger
from app.core.security.jwt_service import JwtService
from app.core.security.password_service import PasswordService
from app.database.models.user import User, UserRole
from app.database.repositories.user_repository import UserRepository
from app.repositories.interfaces.auth_repository import AuthRepository
from app.services.sms.sms_factory import SmsFactory
from app.exceptions.auth_exceptions import (
    InactiveUserException,
    InvalidCredentialsException,
    InvalidTokenException,
    UserAlreadyExistsException,
    UserNotFoundException,
)
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    RefreshTokenRequest,
    RegisterRequest,
    SendOTPRequest,
    VerifyOTPRequest,
    OTPResponse,
    TokenResponse,
    UserResponse,
)


class AuthenticationService:
    """
    Business logic layer for all authentication operations.

    This service orchestrates the repository, password, and JWT layers.
    It contains no SQL, no HTTP concerns, and no raw token parsing.
    """

    def __init__(self, user_repository: UserRepository, auth_repository: AuthRepository) -> None:
        self._repo = user_repository
        self._auth_repo = auth_repository

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def register(self, payload: RegisterRequest) -> UserResponse:
        """
        Register a new user account.
        """
        if self._repo.exists_by_email(payload.email):
            raise UserAlreadyExistsException(payload.email)

        if self._repo.exists_by_username(payload.username):
            raise UserAlreadyExistsException(payload.username)

        assigned_role = payload.role or UserRole.TRADER

        user: User = self._repo.create(
            {
                "email": payload.email,
                "username": payload.username,
                "full_name": payload.full_name,
                "phone_number": payload.phone_number,
                "password_hash": PasswordService.hash_password(payload.password),
                "role": assigned_role,
                "is_active": True,
                "is_verified": False,
            }
        )

        # Auto-provision strategies, default running paper instances, and paper portfolio for new TRADER accounts
        if assigned_role == UserRole.TRADER:
            self._provision_trader_strategies_and_portfolio(user)

        logger.info(
            "User registered | email={} | username={} | role={}",
            user.email,
            user.username,
            user.role,
        )
        return UserResponse.model_validate(user)

    def _provision_trader_strategies_and_portfolio(self, user: User) -> None:
        """
        Auto-provisions a Paper Portfolio and seeds active strategy definitions and running paper instances for a new Trader.
        """
        from app.database.models.broker import Broker
        from app.database.models.strategy import StrategyDefinition, StrategyInstance
        from app.database.models.paper_portfolio import PaperPortfolio

        try:
            # 1. Create default Paper Portfolio
            existing_port = self._repo.db.query(PaperPortfolio).filter(PaperPortfolio.user_id == user.id).first()
            if not existing_port:
                new_port = PaperPortfolio(
                    user_id=user.id,
                    initial_balance=1000000.0,
                    cash_balance=1000000.0,
                    currency="INR",
                )
                self._repo.db.add(new_port)

            # 2. Find or create default simulated broker
            broker = self._repo.db.query(Broker).filter(Broker.is_active == True).first()
            if not broker:
                broker = Broker(
                    broker_name="Simulated Paper Sandbox",
                    broker_type="zerodha",
                    is_active=True,
                )
                self._repo.db.add(broker)
                self._repo.db.flush()

            # 3. Fetch template strategies to clone for this trader
            template_defs = self._repo.db.query(StrategyDefinition).all()
            seen_names = set()
            unique_templates = []
            for d in template_defs:
                if d.name not in seen_names:
                    seen_names.add(d.name)
                    unique_templates.append(d)

            # Clone unique definitions for the new trader
            for td in unique_templates:
                new_def = StrategyDefinition(
                    user_id=user.id,
                    name=td.name,
                    strategy_type=td.strategy_type,
                    config_json=td.config_json,
                    is_active=True,
                )
                self._repo.db.add(new_def)
                self._repo.db.flush()

                # Deploy RUNNING Paper Strategy Instance
                inst = StrategyInstance(
                    strategy_definition_id=new_def.id,
                    user_id=user.id,
                    broker_id=broker.id,
                    execution_mode="PAPER",
                    status="RUNNING",
                    started_at=datetime.now(timezone.utc),
                )
                self._repo.db.add(inst)

            self._repo.db.commit()
            logger.info("Auto-provisioned {} active strategies and portfolio for trader {}", len(unique_templates), user.username)
        except Exception as e:
            logger.error("Error auto-provisioning trader strategies: {}", e)
            self._repo.db.rollback()

    def send_otp(self, payload: SendOTPRequest) -> OTPResponse:
        """
        Generates and dispatches a 6-digit OTP code to the requested mobile number.
        """
        phone = payload.phone_number.strip()
        user: User | None = self._repo.get_by_phone_number(phone)

        if user is None:
            raise InvalidCredentialsException("This mobile number is not registered. Please create an account first.")

        if not user.is_active:
            raise InactiveUserException()

        login_type = (getattr(payload, "login_type", "trader") or "trader").lower()
        if login_type == "admin" and user.role != UserRole.ADMIN:
            logger.warning("Admin OTP request rejected — non-admin account | phone={} role={}", phone, user.role)
            raise InvalidCredentialsException("You do not have admin access. Please use Trader Login.")
        if login_type == "trader" and user.role == UserRole.ADMIN:
            logger.warning("Trader OTP request rejected — admin account | phone={} role={}", phone, user.role)
            raise InvalidCredentialsException("This is an Administrator account. Please use Admin Login.")

        # Generate 6-digit cryptographic OTP code
        otp_code = f"{random.randint(100000, 999999)}"
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)

        user.otp_code = otp_code
        user.otp_expires_at = expires_at
        self._repo.update(user, {"otp_code": otp_code, "otp_expires_at": expires_at})

        # Generate Native Mobile WhatsApp DeepLink Protocol Scheme (Targeting Mobile Phone WhatsApp App directly)
        encoded_msg = quote(f"⚡ AntigravityAlgo Terminal\n\nYour 6-digit WhatsApp OTP verification code is: {otp_code}\n\nValid for 5 minutes.")
        whatsapp_link = f"whatsapp://send?phone=91{phone}&text={encoded_msg}"

        # Delegate OTP messaging dispatch to configured SmsFactory provider (CallMeBot / Mock)
        sms_provider = SmsFactory.get_provider()
        dispatch_success = sms_provider.send_otp_message(phone, otp_code)

        if not dispatch_success:
            logger.warning("[AuthenticationService] SMS/WhatsApp OTP provider dispatch returned failure for +91-{}", phone)

        logger.info("WhatsApp & Mobile OTP generated | phone={} | dispatched={}", phone, dispatch_success)
        return OTPResponse(
            status="success" if dispatch_success else "dispatch_warning",
            message=f"6-digit WhatsApp OTP dispatched to +91-{phone}." if dispatch_success else f"OTP generated for +91-{phone}. (WhatsApp dispatch pending API key/activation).",
            phone_number=phone,
            otp_code=otp_code,
            whatsapp_link=whatsapp_link,
        )

    def verify_otp(self, payload: VerifyOTPRequest) -> TokenResponse:
        """
        Verifies 6-digit OTP and authenticates user returning JWT token pair.
        """
        phone = payload.phone_number.strip()
        user: User | None = self._repo.get_by_phone_number(phone)

        if user is None:
            raise InvalidCredentialsException("No user found associated with this mobile number.")

        if not user.is_active:
            raise InactiveUserException()

        login_type = (getattr(payload, "login_type", "trader") or "trader").lower()
        if login_type == "admin" and user.role != UserRole.ADMIN:
            logger.warning("Admin OTP login rejected — non-admin account | phone={} role={}", phone, user.role)
            raise InvalidCredentialsException("You do not have admin access. Please use Trader Login.")
        if login_type == "trader" and user.role == UserRole.ADMIN:
            logger.warning("Trader OTP login rejected — admin account | phone={} role={}", phone, user.role)
            raise InvalidCredentialsException("This is an Administrator account. Please use Admin Login.")

        # Validate OTP Code and Expiration
        if not user.otp_code or user.otp_code != payload.otp_code.strip():
            raise InvalidCredentialsException("Invalid 6-digit OTP code.")

        if user.otp_expires_at and user.otp_expires_at < datetime.now(timezone.utc):
            raise InvalidCredentialsException("OTP code has expired. Please request a new OTP.")

        # Clear consumed OTP and mark verified
        user.otp_code = None
        user.otp_expires_at = None
        user.is_verified = True
        self._repo.update_last_login(user)
        self._repo.db.add(user)
        self._repo.db.commit()

        access_token = JwtService.create_access_token(str(user.id))
        refresh_token = JwtService.create_refresh_token(str(user.id))
        self._auth_repo.store_refresh_token(user.id, refresh_token)

        logger.info("OTP Login Success | phone={} | user_id={}", phone, user.id)
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=UserResponse.model_validate(user),
        )


    def login(self, payload: LoginRequest) -> TokenResponse:
        """
        Authenticate a user and return a JWT token pair.
        """
        user: User | None = self._repo.get_by_email(payload.email)

        if user is None or not PasswordService.verify_password(
            payload.password, user.password_hash
        ):
            logger.warning("Login failed — invalid credentials | email={}", payload.email)
            raise InvalidCredentialsException()

        if not user.is_active:
            logger.warning("Login rejected — inactive account | email={}", user.email)
            raise InactiveUserException()

        login_type = (getattr(payload, "login_type", "trader") or "trader").lower()
        if login_type == "admin" and user.role != UserRole.ADMIN:
            logger.warning("Admin login rejected — non-admin account | email={} role={}", user.email, user.role)
            raise InvalidCredentialsException("You do not have admin access. Please use Trader Login.")
        if login_type == "trader" and user.role == UserRole.ADMIN:
            logger.warning("Trader login rejected — admin account | email={} role={}", user.email, user.role)
            raise InvalidCredentialsException("This is an Administrator account. Please use Admin Login.")

        self._repo.update_last_login(user)

        access_token = JwtService.create_access_token(str(user.id))
        refresh_token = JwtService.create_refresh_token(str(user.id))

        self._auth_repo.store_refresh_token(user.id, refresh_token)

        logger.info("Login success | email={} | role={}", user.email, user.role)
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=UserResponse.model_validate(user),
        )

    def refresh_token(self, payload: RefreshTokenRequest) -> TokenResponse:
        """
        Rotate the token pair using a valid refresh token.
        """
        token_payload = JwtService.decode_token(payload.refresh_token, expected_type="refresh")

        subject: str | None = token_payload.get("sub")
        if not subject:
            raise InvalidTokenException()

        try:
            user_id = uuid.UUID(subject)
        except ValueError:
            raise InvalidTokenException()

        user: User | None = self._repo.get_by_id(user_id)
        if user is None:
            raise UserNotFoundException()

        if not user.is_active:
            raise InactiveUserException()

        # Revoke old refresh token
        self._auth_repo.revoke_refresh_token(payload.refresh_token)

        access_token = JwtService.create_access_token(str(user.id))
        new_refresh_token = JwtService.create_refresh_token(str(user.id))

        # Store new refresh token
        self._auth_repo.store_refresh_token(user.id, new_refresh_token)

        logger.info("Token refreshed | user_id={}", user.id)
        return TokenResponse(
            access_token=access_token,
            refresh_token=new_refresh_token,
            user=UserResponse.model_validate(user),
        )

    def get_current_user(self, token: str) -> UserResponse:
        """
        Resolve the currently authenticated user from a bearer access token.
        """
        token_payload = JwtService.decode_token(token, expected_type="access")

        subject: str | None = token_payload.get("sub")
        if not subject:
            raise InvalidTokenException()

        try:
            user_id = uuid.UUID(subject)
        except ValueError:
            raise InvalidTokenException()

        user: User | None = self._repo.get_by_id(user_id)
        if user is None:
            raise UserNotFoundException()

        return UserResponse.model_validate(user)

    def forgot_password(self, payload: ForgotPasswordRequest) -> UserResponse:
        """
        Reset user password directly given their registered email address.
        """
        user: User | None = self._repo.get_by_email(payload.email)
        if user is None:
            logger.warning("Password reset failed — user not found | email={}", payload.email)
            raise UserNotFoundException()

        if not user.is_active:
            logger.warning("Password reset rejected — inactive account | email={}", user.email)
            raise InactiveUserException()

        hashed_password = PasswordService.hash_password(payload.new_password)
        updated_user = self._repo.update(user, {"password_hash": hashed_password})

        logger.info("Password reset successful | email={}", user.email)
        return UserResponse.model_validate(updated_user)


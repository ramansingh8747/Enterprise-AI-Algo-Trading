from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.core.response import success_response
from app.dependencies.auth import get_authentication_service, get_current_active_user
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
from app.services.authentication_service import AuthenticationService
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    response_model=None,
    summary="Register a new user account",
    description=(
        "Create a new platform user. Email and username must be unique. "
        "Password requires a minimum length, at least one uppercase letter, and one digit."
    ),
)
def register(
    payload: RegisterRequest,
    service: Annotated[AuthenticationService, Depends(get_authentication_service)],
) -> JSONResponse:
    """Register endpoint — returns the created user profile (no tokens)."""
    user: UserResponse = service.register(payload)
    return success_response(
        message="Account created successfully.",
        data=user.model_dump(mode="json"),
        status_code=status.HTTP_201_CREATED,
    )


@router.post(
    "/login",
    status_code=status.HTTP_200_OK,
    response_model=None,
    summary="Authenticate and obtain JWT tokens",
    description="Validate credentials and return an access/refresh token pair.",
)
def login(
    payload: LoginRequest,
    service: Annotated[AuthenticationService, Depends(get_authentication_service)],
) -> JSONResponse:
    """Login endpoint — returns token pair and user profile on success."""
    tokens: TokenResponse = service.login(payload)
    return success_response(
        message="Login successful.",
        data=tokens.model_dump(mode="json"),
    )


@router.post(
    "/refresh",
    status_code=status.HTTP_200_OK,
    response_model=None,
    summary="Rotate the JWT token pair",
    description=(
        "Exchange a valid refresh token for a new access token and a rotated refresh token."
    ),
)
def refresh_token(
    payload: RefreshTokenRequest,
    service: Annotated[AuthenticationService, Depends(get_authentication_service)],
) -> JSONResponse:
    """Refresh endpoint — rotates both access and refresh tokens."""
    tokens: TokenResponse = service.refresh_token(payload)
    return success_response(
        message="Token refreshed successfully.",
        data=tokens.model_dump(mode="json"),
    )


@router.get(
    "/me",
    status_code=status.HTTP_200_OK,
    response_model=None,
    summary="Retrieve the authenticated user's profile",
    description="Returns the public profile of the currently authenticated user.",
)
def get_me(
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> JSONResponse:
    """Me endpoint — returns the currently authenticated user's profile."""
    return success_response(
        message="User profile retrieved.",
        data=current_user.model_dump(mode="json"),
    )


@router.post(
    "/forgot-password",
    status_code=status.HTTP_200_OK,
    response_model=None,
    summary="Reset account password directly",
    description="Reset a user account password using their registered email.",
)
def forgot_password(
    payload: ForgotPasswordRequest,
    service: Annotated[AuthenticationService, Depends(get_authentication_service)],
) -> JSONResponse:
    """Forgot password endpoint — resets password for the given email."""
    user: UserResponse = service.forgot_password(payload)
    return success_response(
        message="Password has been reset successfully. You can now login with your new password.",
        data=user.model_dump(mode="json"),
        status_code=status.HTTP_200_OK,
    )


@router.post(
    "/send-otp",
    status_code=status.HTTP_200_OK,
    response_model=None,
    summary="Dispatch 6-digit OTP code to Indian mobile number (+91)",
    description="Generates short-lived 6-digit OTP code and dispatches via SMS.",
)
def send_otp(
    payload: SendOTPRequest,
    service: Annotated[AuthenticationService, Depends(get_authentication_service)],
) -> JSONResponse:
    """Send OTP endpoint — dispatches 6-digit OTP code."""
    res: OTPResponse = service.send_otp(payload)
    return success_response(
        message=res.message,
        data=res.model_dump(mode="json"),
        status_code=status.HTTP_200_OK,
    )


@router.post(
    "/verify-otp",
    status_code=status.HTTP_200_OK,
    response_model=None,
    summary="Verify 6-digit OTP code and obtain JWT authentication tokens",
    description="Authenticates mobile subscriber using 6-digit OTP code.",
)
def verify_otp(
    payload: VerifyOTPRequest,
    service: Annotated[AuthenticationService, Depends(get_authentication_service)],
) -> JSONResponse:
    """Verify OTP endpoint — validates 6-digit OTP and returns JWT tokens."""
    tokens: TokenResponse = service.verify_otp(payload)
    return success_response(
        message="Mobile OTP Authentication Successful.",
        data=tokens.model_dump(mode="json"),
        status_code=status.HTTP_200_OK,
    )



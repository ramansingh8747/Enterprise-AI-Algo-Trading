from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from app.core.security import decode_token

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login"
)

def get_token(
    token: str = Depends(oauth2_scheme),
) -> str:
    return token

def get_current_payload(
    token: str = Depends(get_token),
) -> dict:
    return decode_token(token)

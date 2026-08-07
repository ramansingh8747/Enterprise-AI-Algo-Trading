from typing import Any, Optional
from fastapi.responses import JSONResponse

def create_response(
    success: bool, message: str, data: Any = None, status_code: int = 200
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "success": success,
            "message": message,
            "data": data,
        },
    )

def success_response(
    message: str = "Request successful", data: Any = None, status_code: int = 200
) -> JSONResponse:
    return create_response(True, message, data, status_code)

def error_response(
    message: str = "An error occurred", data: Any = None, status_code: int = 400
) -> JSONResponse:
    return create_response(False, message, data, status_code)

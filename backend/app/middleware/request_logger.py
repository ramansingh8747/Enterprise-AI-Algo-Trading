import time
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.logging.logger import logger

class RequestLoggerMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        # Process the request
        response = await call_next(request)
        
        process_time = time.time() - start_time
        
        # Log the request details
        logger.info(
            f"{request.method} {request.url.path} - "
            f"Status: {response.status_code} - "
            f"Time: {process_time:.4f}s"
        )
        
        # Optionally add process time to response headers
        response.headers["X-Process-Time"] = str(process_time)
        
        return response

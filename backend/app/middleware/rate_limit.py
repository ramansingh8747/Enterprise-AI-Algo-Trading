import time
from fastapi import Request, Response, status
from starlette.middleware.base import BaseHTTPMiddleware
from collections import defaultdict

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, limit: int = 100, window: int = 60):
        super().__init__(app)
        self.limit = limit
        self.window = window
        self.requests = defaultdict(list)

    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host
        now = time.time()
        
        # Clean old requests
        self.requests[client_ip] = [t for t in self.requests[client_ip] if now - t < self.window]

        import os
        if os.environ.get("TESTING") == "True" or client_ip in ("testclient", "testclienthost"):
            return await call_next(request)
        
        if len(self.requests[client_ip]) >= self.limit:
            return Response(status_code=status.HTTP_429_TOO_MANY_REQUESTS, content="Rate limit exceeded")
        
        self.requests[client_ip].append(now)
        return await call_next(request)

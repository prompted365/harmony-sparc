"""
Middleware for the EESystem Content Curation Platform
"""
import time
import json
from typing import Callable, Dict, Any
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse
from starlette.status import HTTP_429_TOO_MANY_REQUESTS, HTTP_500_INTERNAL_SERVER_ERROR
import structlog
from prometheus_client import Counter, Histogram, Gauge
import redis
from .config import settings
from .exceptions import RateLimitError

logger = structlog.get_logger(__name__)

# Prometheus metrics
REQUEST_COUNT = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status_code']
)

REQUEST_DURATION = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration',
    ['method', 'endpoint']
)

ACTIVE_REQUESTS = Gauge(
    'http_requests_active',
    'Active HTTP requests'
)

# Redis client for rate limiting
redis_client = None

try:
    redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
except Exception as e:
    logger.warning(f"Failed to connect to Redis: {e}")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log all incoming requests"""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()
        
        # Log incoming request
        logger.info(
            "Incoming request",
            method=request.method,
            url=str(request.url),
            client_ip=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
        
        # Process request
        ACTIVE_REQUESTS.inc()
        try:
            response = await call_next(request)
        except Exception as e:
            logger.error(
                "Request processing error",
                method=request.method,
                url=str(request.url),
                error=str(e),
                exc_info=True
            )
            raise
        finally:
            ACTIVE_REQUESTS.dec()
        
        # Log response
        process_time = time.time() - start_time
        logger.info(
            "Request completed",
            method=request.method,
            url=str(request.url),
            status_code=response.status_code,
            process_time=process_time,
        )
        
        # Record metrics
        REQUEST_COUNT.labels(
            method=request.method,
            endpoint=request.url.path,
            status_code=response.status_code
        ).inc()
        
        REQUEST_DURATION.labels(
            method=request.method,
            endpoint=request.url.path
        ).observe(process_time)
        
        # Add response headers
        response.headers["X-Process-Time"] = str(process_time)
        
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to responses"""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        
        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = "default-src 'self'"
        
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware"""
    
    def __init__(self, app, requests_per_minute: int = None, window_seconds: int = None):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute or settings.RATE_LIMIT_REQUESTS
        self.window_seconds = window_seconds or settings.RATE_LIMIT_WINDOW
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip rate limiting for health checks and metrics
        if request.url.path in ["/health", "/metrics", "/api/v1/health"]:
            return await call_next(request)
        
        # Get client identifier
        client_id = self._get_client_id(request)
        
        # Check rate limit
        if await self._is_rate_limited(client_id):
            return JSONResponse(
                status_code=HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "error": {
                        "code": "RATE_LIMIT_EXCEEDED",
                        "message": f"Rate limit exceeded. Maximum {self.requests_per_minute} requests per {self.window_seconds} seconds."
                    }
                }
            )
        
        # Record request
        await self._record_request(client_id)
        
        return await call_next(request)
    
    def _get_client_id(self, request: Request) -> str:
        """Get client identifier for rate limiting"""
        # Try to get user ID from JWT token
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            # TODO: Extract user ID from JWT token
            pass
        
        # Fall back to IP address
        client_ip = request.client.host if request.client else "unknown"
        return f"ip:{client_ip}"
    
    async def _is_rate_limited(self, client_id: str) -> bool:
        """Check if client is rate limited"""
        if not redis_client:
            return False
        
        try:
            key = f"rate_limit:{client_id}"
            current_requests = await redis_client.get(key)
            
            if current_requests is None:
                return False
            
            return int(current_requests) >= self.requests_per_minute
        except Exception as e:
            logger.error(f"Rate limit check failed: {e}")
            return False
    
    async def _record_request(self, client_id: str):
        """Record a request for rate limiting"""
        if not redis_client:
            return
        
        try:
            key = f"rate_limit:{client_id}"
            pipe = redis_client.pipeline()
            pipe.incr(key)
            pipe.expire(key, self.window_seconds)
            await pipe.execute()
        except Exception as e:
            logger.error(f"Failed to record request for rate limiting: {e}")


class ErrorHandlerMiddleware(BaseHTTPMiddleware):
    """Global error handling middleware"""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        try:
            return await call_next(request)
        except Exception as e:
            logger.error(
                "Unhandled exception",
                method=request.method,
                url=str(request.url),
                error=str(e),
                exc_info=True
            )
            
            # Return generic error response
            return JSONResponse(
                status_code=HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "error": {
                        "code": "INTERNAL_SERVER_ERROR",
                        "message": "An internal server error occurred"
                    }
                }
            )


class ContentTypeMiddleware(BaseHTTPMiddleware):
    """Ensure proper content type handling"""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        
        # Ensure JSON responses have correct content type
        if hasattr(response, 'media_type') and response.media_type is None:
            if request.url.path.startswith('/api/'):
                response.media_type = "application/json"
        
        return response


class CacheControlMiddleware(BaseHTTPMiddleware):
    """Add cache control headers"""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        
        # Add cache control headers based on endpoint
        if request.url.path.startswith('/api/'):
            if request.method == 'GET':
                # Cache GET requests for 5 minutes
                response.headers["Cache-Control"] = "public, max-age=300"
            else:
                # Don't cache non-GET requests
                response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        
        return response


# Utility functions
async def get_client_ip(request: Request) -> str:
    """Get client IP address"""
    # Check for forwarded headers
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    
    # Fall back to client host
    return request.client.host if request.client else "unknown"


async def get_user_agent(request: Request) -> str:
    """Get user agent"""
    return request.headers.get("User-Agent", "unknown")


async def is_bot_request(request: Request) -> bool:
    """Check if request is from a bot"""
    user_agent = await get_user_agent(request)
    bot_patterns = [
        "bot", "crawler", "spider", "scraper", "curl", "wget", "python-requests"
    ]
    return any(pattern in user_agent.lower() for pattern in bot_patterns)
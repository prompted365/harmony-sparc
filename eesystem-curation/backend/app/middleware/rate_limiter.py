"""
Rate limiting middleware
"""
import time
from typing import Dict, Optional
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
import redis.asyncio as redis
from app.config.settings import settings
import logging
import hashlib
import json

logger = logging.getLogger(__name__)


class RateLimiter:
    """Rate limiter using Redis"""
    
    def __init__(self, redis_url: str = None):
        self.redis_url = redis_url or settings.REDIS_URL
        self.redis_client: Optional[redis.Redis] = None
    
    async def init_redis(self):
        """Initialize Redis connection"""
        try:
            self.redis_client = redis.from_url(self.redis_url)
            await self.redis_client.ping()
            logger.info("Redis connection established for rate limiting")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            self.redis_client = None
    
    async def close_redis(self):
        """Close Redis connection"""
        if self.redis_client:
            await self.redis_client.close()
    
    def get_client_id(self, request: Request) -> str:
        """Get client identifier for rate limiting"""
        # Try to get user ID from token
        auth_header = request.headers.get("authorization")
        if auth_header:
            try:
                from app.services.auth import auth_service
                token = auth_header.replace("Bearer ", "")
                payload = auth_service.verify_token(token)
                user_id = payload.get("sub")
                if user_id:
                    return f"user:{user_id}"
            except:
                pass
        
        # Fall back to IP address
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
        else:
            client_ip = request.client.host if request.client else "unknown"
        
        return f"ip:{client_ip}"
    
    def get_rate_limit_key(self, client_id: str, endpoint: str, window: int) -> str:
        """Generate rate limit key"""
        current_window = int(time.time()) // window
        return f"rate_limit:{client_id}:{endpoint}:{current_window}"
    
    async def is_rate_limited(
        self, 
        client_id: str, 
        endpoint: str, 
        limit: int, 
        window: int
    ) -> tuple[bool, Dict[str, int]]:
        """Check if client is rate limited"""
        if not self.redis_client:
            # If Redis is not available, allow all requests
            return False, {"remaining": limit, "reset": int(time.time()) + window}
        
        try:
            key = self.get_rate_limit_key(client_id, endpoint, window)
            
            # Get current count
            current_count = await self.redis_client.get(key)
            current_count = int(current_count) if current_count else 0
            
            # Calculate reset time
            current_window = int(time.time()) // window
            reset_time = (current_window + 1) * window
            
            if current_count >= limit:
                return True, {
                    "remaining": 0,
                    "reset": reset_time,
                    "retry_after": reset_time - int(time.time())
                }
            
            # Increment counter
            pipe = self.redis_client.pipeline()
            pipe.incr(key)
            pipe.expire(key, window)
            await pipe.execute()
            
            remaining = max(0, limit - current_count - 1)
            
            return False, {
                "remaining": remaining,
                "reset": reset_time
            }
            
        except Exception as e:
            logger.error(f"Rate limiting error: {e}")
            # If there's an error, allow the request
            return False, {"remaining": limit, "reset": int(time.time()) + window}


# Global rate limiter instance
rate_limiter = RateLimiter()


class RateLimitMiddleware:
    """Rate limiting middleware"""
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        request = Request(scope, receive)
        
        # Get rate limit configuration for the endpoint
        path = request.url.path
        method = request.method
        
        rate_config = self.get_rate_config(path, method)
        if not rate_config:
            await self.app(scope, receive, send)
            return
        
        client_id = rate_limiter.get_client_id(request)
        endpoint = f"{method}:{path}"
        
        is_limited, limit_info = await rate_limiter.is_rate_limited(
            client_id, 
            endpoint, 
            rate_config["limit"], 
            rate_config["window"]
        )
        
        if is_limited:
            response = JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "error": "Rate limit exceeded",
                    "message": f"Too many requests. Limit: {rate_config['limit']} per {rate_config['window']} seconds",
                    "retry_after": limit_info.get("retry_after", 60)
                },
                headers={
                    "X-RateLimit-Limit": str(rate_config["limit"]),
                    "X-RateLimit-Remaining": str(limit_info["remaining"]),
                    "X-RateLimit-Reset": str(limit_info["reset"]),
                    "Retry-After": str(limit_info.get("retry_after", 60))
                }
            )
            await response(scope, receive, send)
            return
        
        # Add rate limit headers to response
        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                headers = dict(message.get("headers", []))
                headers[b"x-ratelimit-limit"] = str(rate_config["limit"]).encode()
                headers[b"x-ratelimit-remaining"] = str(limit_info["remaining"]).encode()
                headers[b"x-ratelimit-reset"] = str(limit_info["reset"]).encode()
                message["headers"] = list(headers.items())
            await send(message)
        
        await self.app(scope, receive, send_wrapper)
    
    def get_rate_config(self, path: str, method: str) -> Optional[Dict[str, int]]:
        """Get rate limiting configuration for endpoint"""
        # Define rate limits for different endpoints
        rate_configs = {
            # Settings endpoints - more restrictive for writes
            "POST:/api/v1/settings": {"limit": 10, "window": 60},  # 10 per minute
            "PUT:/api/v1/settings": {"limit": 20, "window": 60},   # 20 per minute
            "DELETE:/api/v1/settings": {"limit": 5, "window": 60}, # 5 per minute
            "GET:/api/v1/settings": {"limit": 100, "window": 60},  # 100 per minute
            
            # Environment variables - very restrictive
            "POST:/api/v1/settings/environment": {"limit": 5, "window": 60},
            "PUT:/api/v1/settings/environment": {"limit": 10, "window": 60},
            "DELETE:/api/v1/settings/environment": {"limit": 3, "window": 60},
            
            # Database connections - very restrictive
            "POST:/api/v1/settings/database": {"limit": 3, "window": 60},
            "PUT:/api/v1/settings/database": {"limit": 5, "window": 60},
            
            # Connection testing - moderate limits
            "POST:/api/v1/settings/database/test": {"limit": 10, "window": 60},
            
            # System health - more permissive
            "GET:/api/v1/health": {"limit": 200, "window": 60},
            "GET:/api/v1/settings/status": {"limit": 100, "window": 60},
            
            # Auth endpoints
            "POST:/api/v1/auth/login": {"limit": 5, "window": 300},  # 5 per 5 minutes
            "POST:/api/v1/auth/logout": {"limit": 10, "window": 60},
        }
        
        endpoint = f"{method}:{path}"
        
        # Check for exact match
        if endpoint in rate_configs:
            return rate_configs[endpoint]
        
        # Check for path patterns
        for pattern, config in rate_configs.items():
            if self.matches_pattern(endpoint, pattern):
                return config
        
        # Default rate limit for unspecified endpoints
        if method in ["POST", "PUT", "DELETE", "PATCH"]:
            return {"limit": 30, "window": 60}  # 30 per minute for writes
        else:
            return {"limit": 120, "window": 60}  # 120 per minute for reads
    
    def matches_pattern(self, endpoint: str, pattern: str) -> bool:
        """Check if endpoint matches a pattern"""
        # Simple pattern matching - can be enhanced with regex
        if "*" in pattern:
            pattern_parts = pattern.split("*")
            if len(pattern_parts) == 2:
                return endpoint.startswith(pattern_parts[0]) and endpoint.endswith(pattern_parts[1])
        
        return endpoint == pattern


# Decorator for manual rate limiting
def rate_limit(limit: int, window: int = 60):
    """Decorator for endpoint-specific rate limiting"""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # Get request from args (usually second argument after self)
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            
            if request:
                client_id = rate_limiter.get_client_id(request)
                endpoint = f"{request.method}:{request.url.path}"
                
                is_limited, limit_info = await rate_limiter.is_rate_limited(
                    client_id, endpoint, limit, window
                )
                
                if is_limited:
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail={
                            "error": "Rate limit exceeded",
                            "retry_after": limit_info.get("retry_after", 60)
                        },
                        headers={
                            "Retry-After": str(limit_info.get("retry_after", 60))
                        }
                    )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator
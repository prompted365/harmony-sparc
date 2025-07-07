"""
Authentication middleware for FastAPI
"""
from fastapi import HTTPException, status, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, Dict, Any
from app.auth.services.auth_service import AuthService
from app.auth.models.user import UserInDB, UserRole
from app.core.database import get_db
from app.core.logging import get_logger
import time

logger = get_logger(__name__)

# Security scheme
security = HTTPBearer(auto_error=False)

class AuthMiddleware:
    def __init__(self):
        self.rate_limits = {}  # Simple in-memory rate limiting
        
    async def get_current_user(
        self,
        credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
        db: AsyncSession = Depends(get_db)
    ) -> Optional[UserInDB]:
        """Get current authenticated user"""
        if not credentials:
            return None
            
        try:
            auth_service = AuthService(db)
            payload = auth_service.verify_token(credentials.credentials)
            
            if not payload:
                return None
                
            user = await auth_service.get_user_by_id(payload["sub"])
            if not user or not user.is_active:
                return None
                
            return user
            
        except Exception as e:
            logger.error(f"Error getting current user: {str(e)}")
            return None
    
    async def require_authentication(
        self,
        credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
        db: AsyncSession = Depends(get_db)
    ) -> UserInDB:
        """Require authenticated user"""
        user = await self.get_current_user(credentials, db)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        return user
    
    def require_role(self, required_role: UserRole):
        """Require specific role"""
        async def role_dependency(
            user: UserInDB = Depends(self.require_authentication)
        ) -> UserInDB:
            # Admin can access everything
            if user.role == UserRole.ADMIN:
                return user
                
            # Check specific role
            if user.role != required_role:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Insufficient permissions. Required role: {required_role.value}"
                )
                
            return user
            
        return role_dependency
    
    def require_permission(self, resource: str, action: str):
        """Require specific permission"""
        async def permission_dependency(
            user: UserInDB = Depends(self.require_authentication)
        ) -> UserInDB:
            # Admin has all permissions
            if user.role == UserRole.ADMIN:
                return user
                
            # Check specific permission
            has_permission = any(
                (p.resource == resource or p.resource == "*") and 
                (p.action == action or p.action == "*")
                for p in user.permissions
            )
            
            if not has_permission:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Insufficient permissions. Required: {action} on {resource}"
                )
                
            return user
            
        return permission_dependency
    
    async def rate_limit(
        self,
        request: Request,
        max_requests: int = 100,
        window_seconds: int = 3600  # 1 hour
    ):
        """Simple rate limiting"""
        client_ip = request.client.host
        current_time = time.time()
        window_start = current_time - window_seconds
        
        # Clean old entries
        if client_ip in self.rate_limits:
            self.rate_limits[client_ip] = [
                timestamp for timestamp in self.rate_limits[client_ip]
                if timestamp > window_start
            ]
        else:
            self.rate_limits[client_ip] = []
        
        # Check limit
        if len(self.rate_limits[client_ip]) >= max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded"
            )
        
        # Add current request
        self.rate_limits[client_ip].append(current_time)
    
    async def csrf_protection(self, request: Request):
        """CSRF protection middleware"""
        # Skip CSRF for safe methods
        if request.method in ["GET", "HEAD", "OPTIONS"]:
            return
            
        # Check CSRF token
        csrf_token = request.headers.get("X-CSRF-Token")
        if not csrf_token:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="CSRF token missing"
            )
        
        # Validate CSRF token (implement proper validation)
        # This is a simple example - use proper CSRF token validation
        if not self._validate_csrf_token(csrf_token):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid CSRF token"
            )
    
    def _validate_csrf_token(self, token: str) -> bool:
        """Validate CSRF token (implement proper validation)"""
        # This is a placeholder - implement proper CSRF validation
        return len(token) > 10

# Global middleware instance
auth_middleware = AuthMiddleware()

# Dependency functions for easy use
async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> Optional[UserInDB]:
    """Get current user dependency"""
    return await auth_middleware.get_current_user(credentials, db)

async def require_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> UserInDB:
    """Require authenticated user dependency"""
    return await auth_middleware.require_authentication(credentials, db)

def require_admin():
    """Require admin role dependency"""
    return auth_middleware.require_role(UserRole.ADMIN)

def require_editor():
    """Require editor role dependency"""
    return auth_middleware.require_role(UserRole.EDITOR)

def require_permission(resource: str, action: str):
    """Require permission dependency"""
    return auth_middleware.require_permission(resource, action)

async def rate_limit_auth(request: Request):
    """Rate limit for auth endpoints"""
    return await auth_middleware.rate_limit(request, max_requests=10, window_seconds=900)  # 10 requests per 15 minutes

async def rate_limit_api(request: Request):
    """Rate limit for API endpoints"""
    return await auth_middleware.rate_limit(request, max_requests=1000, window_seconds=3600)  # 1000 requests per hour

async def csrf_protect(request: Request):
    """CSRF protection dependency"""
    return await auth_middleware.csrf_protection(request)
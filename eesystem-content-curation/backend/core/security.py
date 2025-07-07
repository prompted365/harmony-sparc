"""
Security utilities for authentication and authorization
"""
import os
import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import structlog

from .config import settings
from .exceptions import AuthenticationError, AuthorizationError

logger = structlog.get_logger(__name__)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT token scheme
security = HTTPBearer()

# User roles
class UserRole:
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"
    AGENT = "agent"  # For AI agents

# Permissions
class Permission:
    READ_CONTENT = "read:content"
    WRITE_CONTENT = "write:content"
    DELETE_CONTENT = "delete:content"
    MANAGE_USERS = "manage:users"
    MANAGE_BRAND = "manage:brand"
    PUBLISH_CONTENT = "publish:content"
    MANAGE_AGENTS = "manage:agents"
    VIEW_ANALYTICS = "view:analytics"
    MANAGE_SYSTEM = "manage:system"

# Role permissions mapping
ROLE_PERMISSIONS = {
    UserRole.ADMIN: [
        Permission.READ_CONTENT,
        Permission.WRITE_CONTENT,
        Permission.DELETE_CONTENT,
        Permission.MANAGE_USERS,
        Permission.MANAGE_BRAND,
        Permission.PUBLISH_CONTENT,
        Permission.MANAGE_AGENTS,
        Permission.VIEW_ANALYTICS,
        Permission.MANAGE_SYSTEM,
    ],
    UserRole.EDITOR: [
        Permission.READ_CONTENT,
        Permission.WRITE_CONTENT,
        Permission.DELETE_CONTENT,
        Permission.PUBLISH_CONTENT,
        Permission.VIEW_ANALYTICS,
    ],
    UserRole.VIEWER: [
        Permission.READ_CONTENT,
        Permission.VIEW_ANALYTICS,
    ],
    UserRole.AGENT: [
        Permission.READ_CONTENT,
        Permission.WRITE_CONTENT,
    ],
}


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Get password hash"""
    return pwd_context.hash(password)


def generate_secure_token(length: int = 32) -> str:
    """Generate a secure random token"""
    return secrets.token_urlsafe(length)


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    
    return encoded_jwt


def verify_token(token: str) -> Dict[str, Any]:
    """Verify JWT token and return payload"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError as e:
        logger.error(f"JWT verification failed: {e}")
        raise AuthenticationError("Invalid token")


def get_current_user_payload(credentials: HTTPAuthorizationCredentials = Security(security)) -> Dict[str, Any]:
    """Get current user payload from JWT token"""
    token = credentials.credentials
    payload = verify_token(token)
    
    # Check if token is expired
    exp = payload.get("exp")
    if exp and datetime.utcfromtimestamp(exp) < datetime.utcnow():
        raise AuthenticationError("Token expired")
    
    return payload


def check_permission(user_payload: Dict[str, Any], required_permission: str) -> bool:
    """Check if user has required permission"""
    user_role = user_payload.get("role")
    if not user_role:
        return False
    
    user_permissions = ROLE_PERMISSIONS.get(user_role, [])
    return required_permission in user_permissions


def require_permission(permission: str):
    """Decorator to require specific permission"""
    def decorator(user_payload: Dict[str, Any] = Depends(get_current_user_payload)):
        if not check_permission(user_payload, permission):
            raise AuthorizationError(f"Permission required: {permission}")
        return user_payload
    return decorator


def require_role(role: str):
    """Decorator to require specific role"""
    def decorator(user_payload: Dict[str, Any] = Depends(get_current_user_payload)):
        user_role = user_payload.get("role")
        if user_role != role:
            raise AuthorizationError(f"Role required: {role}")
        return user_payload
    return decorator


def require_admin():
    """Decorator to require admin role"""
    return require_role(UserRole.ADMIN)


def require_editor():
    """Decorator to require editor role or higher"""
    def decorator(user_payload: Dict[str, Any] = Depends(get_current_user_payload)):
        user_role = user_payload.get("role")
        if user_role not in [UserRole.ADMIN, UserRole.EDITOR]:
            raise AuthorizationError("Editor role or higher required")
        return user_payload
    return decorator


def get_optional_user(credentials: Optional[HTTPAuthorizationCredentials] = Security(security)) -> Optional[Dict[str, Any]]:
    """Get user payload if token is provided (optional authentication)"""
    if not credentials:
        return None
    
    try:
        return get_current_user_payload(credentials)
    except (AuthenticationError, AuthorizationError):
        return None


def create_api_key(user_id: str, name: str, permissions: list = None) -> str:
    """Create API key for programmatic access"""
    payload = {
        "user_id": user_id,
        "type": "api_key",
        "name": name,
        "permissions": permissions or [],
        "created_at": datetime.utcnow().isoformat(),
    }
    
    # API keys don't expire by default
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_api_key(api_key: str) -> Dict[str, Any]:
    """Verify API key"""
    try:
        payload = jwt.decode(api_key, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        
        if payload.get("type") != "api_key":
            raise AuthenticationError("Invalid API key")
        
        return payload
    except JWTError:
        raise AuthenticationError("Invalid API key")


def sanitize_user_data(user_data: Dict[str, Any]) -> Dict[str, Any]:
    """Sanitize user data for API responses"""
    sensitive_fields = ["password", "password_hash", "secret_key", "api_key"]
    
    sanitized = {}
    for key, value in user_data.items():
        if key.lower() not in sensitive_fields:
            sanitized[key] = value
    
    return sanitized


def validate_password_strength(password: str) -> bool:
    """Validate password strength"""
    if len(password) < 8:
        return False
    
    has_upper = any(c.isupper() for c in password)
    has_lower = any(c.islower() for c in password)
    has_digit = any(c.isdigit() for c in password)
    has_special = any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password)
    
    return has_upper and has_lower and has_digit and has_special


def rate_limit_key(user_id: str, action: str) -> str:
    """Generate rate limit key"""
    return f"rate_limit:{user_id}:{action}"


def generate_csrf_token() -> str:
    """Generate CSRF token"""
    return secrets.token_urlsafe(32)


def verify_csrf_token(token: str, expected_token: str) -> bool:
    """Verify CSRF token"""
    return secrets.compare_digest(token, expected_token)


# IP whitelist/blacklist utilities
def is_ip_allowed(ip: str, whitelist: list = None, blacklist: list = None) -> bool:
    """Check if IP is allowed"""
    if blacklist and ip in blacklist:
        return False
    
    if whitelist and ip not in whitelist:
        return False
    
    return True


def mask_sensitive_data(data: str, mask_char: str = "*", visible_chars: int = 4) -> str:
    """Mask sensitive data for logging"""
    if len(data) <= visible_chars * 2:
        return mask_char * len(data)
    
    return data[:visible_chars] + mask_char * (len(data) - visible_chars * 2) + data[-visible_chars:]


# Session management
class SessionManager:
    """Session management utilities"""
    
    def __init__(self, redis_client=None):
        self.redis_client = redis_client
    
    async def create_session(self, user_id: str, session_data: Dict[str, Any]) -> str:
        """Create user session"""
        session_id = generate_secure_token()
        
        if self.redis_client:
            session_key = f"session:{session_id}"
            await self.redis_client.setex(
                session_key,
                3600 * 24 * 7,  # 7 days
                json.dumps({
                    "user_id": user_id,
                    "created_at": datetime.utcnow().isoformat(),
                    **session_data
                })
            )
        
        return session_id
    
    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session data"""
        if not self.redis_client:
            return None
        
        session_key = f"session:{session_id}"
        session_data = await self.redis_client.get(session_key)
        
        if session_data:
            return json.loads(session_data)
        
        return None
    
    async def delete_session(self, session_id: str) -> bool:
        """Delete session"""
        if not self.redis_client:
            return False
        
        session_key = f"session:{session_id}"
        return await self.redis_client.delete(session_key) > 0
    
    async def refresh_session(self, session_id: str) -> bool:
        """Refresh session expiration"""
        if not self.redis_client:
            return False
        
        session_key = f"session:{session_id}"
        return await self.redis_client.expire(session_key, 3600 * 24 * 7) > 0
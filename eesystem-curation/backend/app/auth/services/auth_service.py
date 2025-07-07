"""
Authentication service with JWT token management
"""
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from jose import JWTError, jwt
from passlib.context import CryptContext
from passlib.exc import InvalidTokenError
from sqlalchemy.ext.asyncio import AsyncSession
from app.auth.models.user import (
    UserCreate, UserInDB, UserResponse, UserSession, AuditLog,
    LoginRequest, PasswordChangeRequest, PasswordResetConfirm,
    UserPreferences, SecuritySettings, UserRole
)
from app.core.logging import get_logger
import smtplib
from email.mime.text import MimeText
from email.mime.multipart import MimeMultipart
import os

logger = get_logger(__name__)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-super-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.security_settings = SecuritySettings()
        
    async def create_user(self, user_data: UserCreate) -> UserInDB:
        """Create a new user"""
        try:
            # Check if user already exists
            existing_user = await self.get_user_by_email(user_data.email)
            if existing_user:
                raise ValueError("User with this email already exists")
            
            # Hash password
            password_hash = self.hash_password(user_data.password)
            
            # Create user
            user = UserInDB(
                name=user_data.name,
                email=user_data.email,
                role=user_data.role,
                password_hash=password_hash,
                preferences=user_data.preferences
            )
            
            # Generate email verification token if required
            if self.security_settings.require_email_verification:
                user.email_verification_token = self.generate_secure_token()
                user.email_verification_expires = datetime.utcnow() + timedelta(hours=24)
            else:
                user.is_email_verified = True
            
            # Set default permissions based on role
            user.permissions = await self.get_default_permissions(user_data.role)
            
            # Save to database (mock implementation)
            await self.save_user(user)
            
            # Send verification email if required
            if self.security_settings.require_email_verification:
                await self.send_verification_email(user)
            
            logger.info(f"User created successfully: {user.email}")
            return user
            
        except Exception as e:
            logger.error(f"Error creating user: {str(e)}")
            raise
    
    async def authenticate_user(self, login_data: LoginRequest) -> Optional[UserInDB]:
        """Authenticate user with email and password"""
        try:
            user = await self.get_user_by_email(login_data.email)
            if not user:
                return None
            
            # Check if account is locked
            if user.is_locked and user.locked_until and datetime.utcnow() < user.locked_until:
                raise ValueError(f"Account is locked until {user.locked_until}")
            
            # Verify password
            if not self.verify_password(login_data.password, user.password_hash):
                # Increment failed login attempts
                user.failed_login_attempts += 1
                
                # Lock account if max attempts reached
                if user.failed_login_attempts >= self.security_settings.max_login_attempts:
                    user.is_locked = True
                    user.locked_until = datetime.utcnow() + timedelta(
                        seconds=self.security_settings.lockout_duration
                    )
                    logger.warning(f"Account locked for user: {user.email}")
                
                await self.save_user(user)
                return None
            
            # Check if email is verified
            if self.security_settings.require_email_verification and not user.is_email_verified:
                raise ValueError("Email not verified")
            
            # Check if account is active
            if not user.is_active:
                raise ValueError("Account is deactivated")
            
            # Reset failed login attempts on successful login
            user.failed_login_attempts = 0
            user.is_locked = False
            user.locked_until = None
            user.last_login_at = datetime.utcnow()
            
            await self.save_user(user)
            
            logger.info(f"User authenticated successfully: {user.email}")
            return user
            
        except Exception as e:
            logger.error(f"Authentication error: {str(e)}")
            raise
    
    def create_access_token(self, user: UserInDB) -> str:
        """Create JWT access token"""
        try:
            expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
            payload = {
                "sub": user.id,
                "email": user.email,
                "role": user.role.value,
                "permissions": [
                    {"resource": p.resource, "action": p.action} 
                    for p in user.permissions
                ],
                "exp": expire,
                "iat": datetime.utcnow(),
                "type": "access"
            }
            
            return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
            
        except Exception as e:
            logger.error(f"Error creating access token: {str(e)}")
            raise
    
    def create_refresh_token(self, user: UserInDB) -> str:
        """Create JWT refresh token"""
        try:
            expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
            payload = {
                "sub": user.id,
                "type": "refresh",
                "exp": expire,
                "iat": datetime.utcnow()
            }
            
            return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
            
        except Exception as e:
            logger.error(f"Error creating refresh token: {str(e)}")
            raise
    
    def verify_token(self, token: str, token_type: str = "access") -> Optional[Dict[str, Any]]:
        """Verify JWT token"""
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            
            if payload.get("type") != token_type:
                return None
                
            return payload
            
        except JWTError as e:
            logger.warning(f"Token verification failed: {str(e)}")
            return None
    
    async def refresh_access_token(self, refresh_token: str) -> Optional[Dict[str, str]]:
        """Refresh access token using refresh token"""
        try:
            payload = self.verify_token(refresh_token, "refresh")
            if not payload:
                return None
            
            user = await self.get_user_by_id(payload["sub"])
            if not user or not user.is_active:
                return None
            
            # Create new tokens
            new_access_token = self.create_access_token(user)
            new_refresh_token = self.create_refresh_token(user)
            
            return {
                "access_token": new_access_token,
                "refresh_token": new_refresh_token,
                "expires_at": (
                    datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
                ).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Token refresh error: {str(e)}")
            return None
    
    async def change_password(self, user: UserInDB, password_data: PasswordChangeRequest) -> bool:
        """Change user password"""
        try:
            # Verify current password
            if not self.verify_password(password_data.current_password, user.password_hash):
                raise ValueError("Current password is incorrect")
            
            # Check password strength if required
            if self.security_settings.enforce_strong_passwords:
                if not self.is_strong_password(password_data.new_password):
                    raise ValueError("Password does not meet strength requirements")
            
            # Check password reuse if not allowed
            if not self.security_settings.allow_password_reuse:
                if self.verify_password(password_data.new_password, user.password_hash):
                    raise ValueError("Cannot reuse current password")
            
            # Hash new password
            user.password_hash = self.hash_password(password_data.new_password)
            user.updated_at = datetime.utcnow()
            
            await self.save_user(user)
            
            logger.info(f"Password changed for user: {user.email}")
            return True
            
        except Exception as e:
            logger.error(f"Password change error: {str(e)}")
            raise
    
    async def request_password_reset(self, email: str) -> bool:
        """Request password reset"""
        try:
            user = await self.get_user_by_email(email)
            if not user:
                # Don't reveal if email exists
                return True
            
            # Generate reset token
            user.password_reset_token = self.generate_secure_token()
            user.password_reset_expires = datetime.utcnow() + timedelta(hours=1)
            
            await self.save_user(user)
            
            # Send reset email
            await self.send_password_reset_email(user)
            
            logger.info(f"Password reset requested for: {email}")
            return True
            
        except Exception as e:
            logger.error(f"Password reset request error: {str(e)}")
            return False
    
    async def confirm_password_reset(self, reset_data: PasswordResetConfirm) -> bool:
        """Confirm password reset with token"""
        try:
            user = await self.get_user_by_reset_token(reset_data.token)
            if not user:
                raise ValueError("Invalid or expired reset token")
            
            # Check token expiry
            if user.password_reset_expires and datetime.utcnow() > user.password_reset_expires:
                raise ValueError("Reset token has expired")
            
            # Check password strength if required
            if self.security_settings.enforce_strong_passwords:
                if not self.is_strong_password(reset_data.new_password):
                    raise ValueError("Password does not meet strength requirements")
            
            # Hash new password
            user.password_hash = self.hash_password(reset_data.new_password)
            user.password_reset_token = None
            user.password_reset_expires = None
            user.updated_at = datetime.utcnow()
            
            # Reset failed login attempts
            user.failed_login_attempts = 0
            user.is_locked = False
            user.locked_until = None
            
            await self.save_user(user)
            
            logger.info(f"Password reset confirmed for user: {user.email}")
            return True
            
        except Exception as e:
            logger.error(f"Password reset confirmation error: {str(e)}")
            raise
    
    async def verify_email(self, token: str) -> bool:
        """Verify email with token"""
        try:
            user = await self.get_user_by_verification_token(token)
            if not user:
                raise ValueError("Invalid verification token")
            
            # Check token expiry
            if user.email_verification_expires and datetime.utcnow() > user.email_verification_expires:
                raise ValueError("Verification token has expired")
            
            user.is_email_verified = True
            user.email_verification_token = None
            user.email_verification_expires = None
            user.updated_at = datetime.utcnow()
            
            await self.save_user(user)
            
            logger.info(f"Email verified for user: {user.email}")
            return True
            
        except Exception as e:
            logger.error(f"Email verification error: {str(e)}")
            raise
    
    async def create_session(self, user: UserInDB, request_info: Dict[str, str]) -> UserSession:
        """Create user session"""
        try:
            session = UserSession(
                user_id=user.id,
                device_info=request_info.get("device_info", "Unknown"),
                ip_address=request_info.get("ip_address", "Unknown"),
                user_agent=request_info.get("user_agent", "Unknown"),
                expires_at=datetime.utcnow() + timedelta(
                    seconds=self.security_settings.session_timeout
                )
            )
            
            await self.save_session(session)
            
            logger.info(f"Session created for user: {user.email}")
            return session
            
        except Exception as e:
            logger.error(f"Session creation error: {str(e)}")
            raise
    
    async def log_audit_event(self, user_id: str, action: str, resource: str, 
                            details: Dict[str, Any], request_info: Dict[str, str]) -> None:
        """Log audit event"""
        try:
            audit_log = AuditLog(
                user_id=user_id,
                action=action,
                resource=resource,
                details=details,
                ip_address=request_info.get("ip_address", "Unknown"),
                user_agent=request_info.get("user_agent", "Unknown")
            )
            
            await self.save_audit_log(audit_log)
            
        except Exception as e:
            logger.error(f"Audit logging error: {str(e)}")
    
    def hash_password(self, password: str) -> str:
        """Hash password"""
        return pwd_context.hash(password)
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify password"""
        return pwd_context.verify(plain_password, hashed_password)
    
    def generate_secure_token(self) -> str:
        """Generate secure random token"""
        return secrets.token_urlsafe(32)
    
    def is_strong_password(self, password: str) -> bool:
        """Check if password meets strength requirements"""
        if len(password) < 8:
            return False
        
        has_upper = any(c.isupper() for c in password)
        has_lower = any(c.islower() for c in password)
        has_digit = any(c.isdigit() for c in password)
        has_special = any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password)
        
        return has_upper and has_lower and has_digit and has_special
    
    async def get_default_permissions(self, role: UserRole) -> List:
        """Get default permissions for role"""
        # This would typically come from a database
        permissions_map = {
            UserRole.ADMIN: [
                {"resource": "*", "action": "*"},
            ],
            UserRole.EDITOR: [
                {"resource": "content", "action": "create"},
                {"resource": "content", "action": "read"},
                {"resource": "content", "action": "update"},
                {"resource": "content", "action": "delete"},
                {"resource": "brand", "action": "read"},
                {"resource": "brand", "action": "update"},
            ],
            UserRole.VIEWER: [
                {"resource": "content", "action": "read"},
                {"resource": "brand", "action": "read"},
            ]
        }
        
        return permissions_map.get(role, [])
    
    # Mock database operations (replace with actual database implementation)
    async def get_user_by_email(self, email: str) -> Optional[UserInDB]:
        """Get user by email (mock implementation)"""
        # This would query the actual database
        return None
    
    async def get_user_by_id(self, user_id: str) -> Optional[UserInDB]:
        """Get user by ID (mock implementation)"""
        # This would query the actual database
        return None
    
    async def get_user_by_reset_token(self, token: str) -> Optional[UserInDB]:
        """Get user by reset token (mock implementation)"""
        # This would query the actual database
        return None
    
    async def get_user_by_verification_token(self, token: str) -> Optional[UserInDB]:
        """Get user by verification token (mock implementation)"""
        # This would query the actual database
        return None
    
    async def save_user(self, user: UserInDB) -> None:
        """Save user (mock implementation)"""
        # This would save to the actual database
        pass
    
    async def save_session(self, session: UserSession) -> None:
        """Save session (mock implementation)"""
        # This would save to the actual database
        pass
    
    async def save_audit_log(self, audit_log: AuditLog) -> None:
        """Save audit log (mock implementation)"""
        # This would save to the actual database
        pass
    
    async def send_verification_email(self, user: UserInDB) -> None:
        """Send email verification (mock implementation)"""
        # This would send an actual email
        logger.info(f"Verification email would be sent to: {user.email}")
    
    async def send_password_reset_email(self, user: UserInDB) -> None:
        """Send password reset email (mock implementation)"""
        # This would send an actual email
        logger.info(f"Password reset email would be sent to: {user.email}")
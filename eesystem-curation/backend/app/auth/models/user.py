"""
User models for authentication
"""
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, Field, validator
from enum import Enum
import uuid

class UserRole(str, Enum):
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"

class UserPreferences(BaseModel):
    theme: str = Field(default="system", regex="^(light|dark|system)$")
    notifications: bool = True
    auto_save: bool = True
    default_content_type: str = "article"
    timezone: str = "UTC"
    language: str = "en"

class Permission(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    resource: str
    action: str = Field(regex="^(create|read|update|delete|execute)$")
    condition: Optional[str] = None

class UserBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    role: UserRole = UserRole.VIEWER
    is_email_verified: bool = False
    preferences: UserPreferences = Field(default_factory=UserPreferences)
    permissions: List[Permission] = Field(default_factory=list)

class UserCreate(UserBase):
    password: str = Field(..., min_length=8)
    confirm_password: str
    accept_terms: bool = True

    @validator('confirm_password')
    def passwords_match(cls, v, values):
        if 'password' in values and v != values['password']:
            raise ValueError('Passwords do not match')
        return v

    @validator('accept_terms')
    def terms_accepted(cls, v):
        if not v:
            raise ValueError('Terms must be accepted')
        return v

class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None
    is_email_verified: Optional[bool] = None
    preferences: Optional[UserPreferences] = None
    permissions: Optional[List[Permission]] = None

class UserInDB(UserBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    password_hash: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_login_at: Optional[datetime] = None
    is_active: bool = True
    is_locked: bool = False
    failed_login_attempts: int = 0
    locked_until: Optional[datetime] = None
    email_verification_token: Optional[str] = None
    email_verification_expires: Optional[datetime] = None
    password_reset_token: Optional[str] = None
    password_reset_expires: Optional[datetime] = None
    two_factor_secret: Optional[str] = None
    two_factor_enabled: bool = False
    avatar_url: Optional[str] = None

    class Config:
        orm_mode = True

class UserResponse(UserBase):
    id: str
    created_at: datetime
    updated_at: datetime
    last_login_at: Optional[datetime]
    avatar_url: Optional[str]

    class Config:
        orm_mode = True

class UserSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    device_info: str
    ip_address: str
    user_agent: str
    is_active: bool = True
    last_activity: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        orm_mode = True

class AuditLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    action: str
    resource: str
    details: Dict[str, Any] = Field(default_factory=dict)
    ip_address: str
    user_agent: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        orm_mode = True

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    remember_me: bool = False

class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_at: datetime
    user: UserResponse

class TokenRefreshRequest(BaseModel):
    refresh_token: str

class TokenRefreshResponse(BaseModel):
    access_token: str
    refresh_token: str
    expires_at: datetime

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)
    confirm_password: str

    @validator('confirm_password')
    def passwords_match(cls, v, values):
        if 'new_password' in values and v != values['new_password']:
            raise ValueError('Passwords do not match')
        return v

class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)
    confirm_password: str

    @validator('confirm_password')
    def passwords_match(cls, v, values):
        if 'new_password' in values and v != values['new_password']:
            raise ValueError('Passwords do not match')
        return v

class EmailVerificationRequest(BaseModel):
    token: str

class PreferencesUpdateRequest(BaseModel):
    theme: Optional[str] = Field(None, regex="^(light|dark|system)$")
    notifications: Optional[bool] = None
    auto_save: Optional[bool] = None
    default_content_type: Optional[str] = None
    timezone: Optional[str] = None
    language: Optional[str] = None

class SecuritySettings(BaseModel):
    require_email_verification: bool = True
    enforce_strong_passwords: bool = True
    enable_two_factor_auth: bool = False
    session_timeout: int = 24 * 60 * 60  # 24 hours in seconds
    max_login_attempts: int = 5
    lockout_duration: int = 15 * 60  # 15 minutes in seconds
    password_expiry_days: int = 90
    allow_password_reuse: bool = False
    max_sessions_per_user: int = 5

class PermissionCheck(BaseModel):
    resource: str
    action: str

class PermissionResponse(BaseModel):
    allowed: bool
    reason: Optional[str] = None

class SessionListResponse(BaseModel):
    sessions: List[UserSession]
    total: int

class AuditLogListResponse(BaseModel):
    logs: List[AuditLog]
    total: int

class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
    version: str = "1.0.0"
    services: Dict[str, str] = Field(default_factory=dict)
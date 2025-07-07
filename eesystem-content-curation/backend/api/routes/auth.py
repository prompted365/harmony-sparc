"""
Authentication API routes
"""
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
import structlog

from core.database import get_db
from core.security import (
    verify_password, get_password_hash, create_access_token,
    get_current_user_payload, UserRole, sanitize_user_data
)
from core.exceptions import AuthenticationError, ValidationError
from models.user import User, UserPreferences

logger = structlog.get_logger(__name__)

router = APIRouter()


# Request/Response models
class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[str] = UserRole.VIEWER


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    first_name: Optional[str]
    last_name: Optional[str]
    role: str
    is_active: bool
    is_verified: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    expires_in: int
    user: UserResponse


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


@router.post("/auth/register", response_model=UserResponse)
async def register(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db)
) -> UserResponse:
    """
    Register a new user
    """
    try:
        # Check if user already exists
        result = await db.execute(
            select(User).where((User.email == user_data.email) | (User.username == user_data.username))
        )
        existing_user = result.scalar_one_or_none()
        
        if existing_user:
            if existing_user.email == user_data.email:
                raise ValidationError("Email already registered")
            else:
                raise ValidationError("Username already taken")
        
        # Create new user
        password_hash = get_password_hash(user_data.password)
        
        new_user = User(
            email=user_data.email,
            username=user_data.username,
            password_hash=password_hash,
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            role=user_data.role
        )
        
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        
        # Create default preferences
        preferences = UserPreferences(user_id=new_user.id)
        db.add(preferences)
        await db.commit()
        
        logger.info(f"User registered: {new_user.email}")
        
        return UserResponse.from_orm(new_user)
        
    except Exception as e:
        await db.rollback()
        logger.error(f"User registration failed: {e}")
        raise


@router.post("/auth/login", response_model=TokenResponse)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
) -> TokenResponse:
    """
    User login
    """
    try:
        # Find user by email or username
        result = await db.execute(
            select(User).where(
                (User.email == form_data.username) | (User.username == form_data.username)
            )
        )
        user = result.scalar_one_or_none()
        
        if not user or not verify_password(form_data.password, user.password_hash):
            raise AuthenticationError("Invalid credentials")
        
        if not user.is_active:
            raise AuthenticationError("Account is disabled")
        
        # Create access token
        token_data = {
            "sub": str(user.id),
            "email": user.email,
            "username": user.username,
            "role": user.role
        }
        
        access_token = create_access_token(token_data)
        
        # Update last login
        user.last_login = datetime.utcnow()
        await db.commit()
        
        logger.info(f"User logged in: {user.email}")
        
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=30 * 24 * 60 * 60,  # 30 days in seconds
            user=UserResponse.from_orm(user)
        )
        
    except Exception as e:
        logger.error(f"Login failed: {e}")
        raise


@router.get("/auth/me", response_model=UserResponse)
async def get_current_user(
    current_user: Dict[str, Any] = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
) -> UserResponse:
    """
    Get current user information
    """
    try:
        user_id = int(current_user["sub"])
        
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if not user:
            raise AuthenticationError("User not found")
        
        return UserResponse.from_orm(user)
        
    except Exception as e:
        logger.error(f"Get current user failed: {e}")
        raise


@router.post("/auth/change-password")
async def change_password(
    password_data: PasswordChange,
    current_user: Dict[str, Any] = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, str]:
    """
    Change user password
    """
    try:
        user_id = int(current_user["sub"])
        
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if not user:
            raise AuthenticationError("User not found")
        
        # Verify current password
        if not verify_password(password_data.current_password, user.password_hash):
            raise AuthenticationError("Current password is incorrect")
        
        # Update password
        user.password_hash = get_password_hash(password_data.new_password)
        await db.commit()
        
        logger.info(f"Password changed for user: {user.email}")
        
        return {"message": "Password changed successfully"}
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Password change failed: {e}")
        raise


@router.post("/auth/logout")
async def logout(
    current_user: Dict[str, Any] = Depends(get_current_user_payload)
) -> Dict[str, str]:
    """
    User logout (for session management)
    """
    try:
        user_id = current_user["sub"]
        logger.info(f"User logged out: {user_id}")
        
        # In a real implementation, you might want to:
        # - Invalidate the token in a blacklist
        # - Clear session data
        # - Update last activity timestamp
        
        return {"message": "Logged out successfully"}
        
    except Exception as e:
        logger.error(f"Logout failed: {e}")
        raise


@router.post("/auth/refresh-token", response_model=TokenResponse)
async def refresh_token(
    current_user: Dict[str, Any] = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
) -> TokenResponse:
    """
    Refresh access token
    """
    try:
        user_id = int(current_user["sub"])
        
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if not user or not user.is_active:
            raise AuthenticationError("User not found or inactive")
        
        # Create new access token
        token_data = {
            "sub": str(user.id),
            "email": user.email,
            "username": user.username,
            "role": user.role
        }
        
        access_token = create_access_token(token_data)
        
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=30 * 24 * 60 * 60,  # 30 days in seconds
            user=UserResponse.from_orm(user)
        )
        
    except Exception as e:
        logger.error(f"Token refresh failed: {e}")
        raise
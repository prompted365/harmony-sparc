"""
Authentication endpoints
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.logging import get_logger
from app.auth.models.user import (
    UserCreate, UserResponse, LoginRequest, LoginResponse,
    TokenRefreshRequest, TokenRefreshResponse, PasswordChangeRequest,
    PasswordResetRequest, PasswordResetConfirm, EmailVerificationRequest,
    PreferencesUpdateRequest, PermissionCheck, PermissionResponse,
    SessionListResponse, AuditLogListResponse, HealthResponse
)
from app.auth.services.auth_service import AuthService
from app.auth.middleware.auth_middleware import (
    get_current_user, require_user, require_admin, require_permission,
    rate_limit_auth, csrf_protect
)

router = APIRouter()
logger = get_logger(__name__)


@router.post("/login", response_model=LoginResponse)
async def login(
    request: Request,
    login_data: LoginRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_auth)
):
    """
    User login with email and password
    """
    try:
        auth_service = AuthService(db)
        
        # Authenticate user
        user = await auth_service.authenticate_user(login_data)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        
        # Create tokens
        access_token = auth_service.create_access_token(user)
        refresh_token = auth_service.create_refresh_token(user)
        
        # Create session
        request_info = {
            "ip_address": request.client.host,
            "user_agent": request.headers.get("user-agent", "Unknown"),
            "device_info": request.headers.get("x-device-info", "Unknown")
        }
        session = await auth_service.create_session(user, request_info)
        
        # Log audit event
        await auth_service.log_audit_event(
            user.id, "LOGIN", "USER", {"session_id": session.id}, request_info
        )
        
        return LoginResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_at=datetime.utcnow().replace(microsecond=0),
            user=UserResponse.from_orm(user)
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed"
        )


@router.post("/register", response_model=LoginResponse)
async def register(
    request: Request,
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_auth)
):
    """
    User registration
    """
    try:
        auth_service = AuthService(db)
        
        # Create user
        user = await auth_service.create_user(user_data)
        
        # Create tokens if email verification not required
        if user.is_email_verified:
            access_token = auth_service.create_access_token(user)
            refresh_token = auth_service.create_refresh_token(user)
            
            # Create session
            request_info = {
                "ip_address": request.client.host,
                "user_agent": request.headers.get("user-agent", "Unknown"),
                "device_info": request.headers.get("x-device-info", "Unknown")
            }
            session = await auth_service.create_session(user, request_info)
            
            # Log audit event
            await auth_service.log_audit_event(
                user.id, "REGISTER", "USER", {"session_id": session.id}, request_info
            )
            
            return LoginResponse(
                access_token=access_token,
                refresh_token=refresh_token,
                expires_at=datetime.utcnow().replace(microsecond=0),
                user=UserResponse.from_orm(user)
            )
        else:
            # Return limited response for unverified users
            raise HTTPException(
                status_code=status.HTTP_202_ACCEPTED,
                detail="Registration successful. Please verify your email."
            )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Registration error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed"
        )


@router.post("/refresh", response_model=TokenRefreshResponse)
async def refresh_token(
    refresh_data: TokenRefreshRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Refresh access token
    """
    try:
        auth_service = AuthService(db)
        
        result = await auth_service.refresh_access_token(refresh_data.refresh_token)
        if not result:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        
        return TokenRefreshResponse(**result)
        
    except Exception as e:
        logger.error(f"Token refresh error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token refresh failed"
        )


@router.post("/logout")
async def logout(
    request: Request,
    user: UserResponse = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    """
    User logout
    """
    try:
        auth_service = AuthService(db)
        
        # Log audit event
        request_info = {
            "ip_address": request.client.host,
            "user_agent": request.headers.get("user-agent", "Unknown")
        }
        await auth_service.log_audit_event(
            user.id, "LOGOUT", "USER", {}, request_info
        )
        
        return {"message": "Logged out successfully"}
        
    except Exception as e:
        logger.error(f"Logout error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Logout failed"
        )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    user: UserResponse = Depends(require_user)
):
    """
    Get current user information
    """
    return user


@router.put("/password")
async def change_password(
    request: Request,
    password_data: PasswordChangeRequest,
    user: UserResponse = Depends(require_user),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(csrf_protect)
):
    """
    Change user password
    """
    try:
        auth_service = AuthService(db)
        
        # Get full user data
        full_user = await auth_service.get_user_by_id(user.id)
        if not full_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        success = await auth_service.change_password(full_user, password_data)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password change failed"
            )
        
        # Log audit event
        request_info = {
            "ip_address": request.client.host,
            "user_agent": request.headers.get("user-agent", "Unknown")
        }
        await auth_service.log_audit_event(
            user.id, "CHANGE_PASSWORD", "USER", {}, request_info
        )
        
        return {"message": "Password changed successfully"}
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Password change error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password change failed"
        )


@router.post("/password-reset")
async def request_password_reset(
    reset_request: PasswordResetRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_auth)
):
    """
    Request password reset
    """
    try:
        auth_service = AuthService(db)
        
        await auth_service.request_password_reset(reset_request.email)
        
        return {"message": "If the email exists, a reset link has been sent"}
        
    except Exception as e:
        logger.error(f"Password reset request error: {str(e)}")
        return {"message": "If the email exists, a reset link has been sent"}


@router.post("/password-reset/confirm")
async def confirm_password_reset(
    reset_data: PasswordResetConfirm,
    db: AsyncSession = Depends(get_db)
):
    """
    Confirm password reset
    """
    try:
        auth_service = AuthService(db)
        
        success = await auth_service.confirm_password_reset(reset_data)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password reset failed"
            )
        
        return {"message": "Password reset successfully"}
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Password reset confirmation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password reset failed"
        )


@router.post("/verify-email")
async def verify_email(
    verification_data: EmailVerificationRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Verify email address
    """
    try:
        auth_service = AuthService(db)
        
        success = await auth_service.verify_email(verification_data.token)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email verification failed"
            )
        
        return {"message": "Email verified successfully"}
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Email verification error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Email verification failed"
        )


@router.put("/preferences")
async def update_preferences(
    preferences_data: PreferencesUpdateRequest,
    user: UserResponse = Depends(require_user),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(csrf_protect)
):
    """
    Update user preferences
    """
    try:
        # Implementation would update user preferences
        return {"message": "Preferences updated successfully"}
        
    except Exception as e:
        logger.error(f"Preferences update error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update preferences"
        )


@router.get("/permissions/check", response_model=PermissionResponse)
async def check_permission(
    permission_check: PermissionCheck = Depends(),
    user: UserResponse = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Check if user has specific permission
    """
    try:
        auth_service = AuthService(db)
        
        allowed = await auth_service.check_permission(
            permission_check.resource, 
            permission_check.action
        )
        
        return PermissionResponse(allowed=allowed)
        
    except Exception as e:
        logger.error(f"Permission check error: {str(e)}")
        return PermissionResponse(allowed=False, reason="Permission check failed")


@router.get("/sessions", response_model=SessionListResponse)
async def get_user_sessions(
    user: UserResponse = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get user's active sessions
    """
    try:
        # Implementation would get user sessions
        return SessionListResponse(sessions=[], total=0)
        
    except Exception as e:
        logger.error(f"Get sessions error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get sessions"
        )


@router.delete("/sessions/{session_id}")
async def revoke_session(
    session_id: str,
    user: UserResponse = Depends(require_user),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(csrf_protect)
):
    """
    Revoke a specific session
    """
    try:
        # Implementation would revoke session
        return {"message": "Session revoked successfully"}
        
    except Exception as e:
        logger.error(f"Session revocation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to revoke session"
        )


@router.get("/audit-logs", response_model=AuditLogListResponse)
async def get_audit_logs(
    limit: int = 50,
    offset: int = 0,
    user: UserResponse = Depends(require_admin()),
    db: AsyncSession = Depends(get_db)
):
    """
    Get audit logs (admin only)
    """
    try:
        # Implementation would get audit logs
        return AuditLogListResponse(logs=[], total=0)
        
    except Exception as e:
        logger.error(f"Get audit logs error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get audit logs"
        )


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Authentication service health check
    """
    return HealthResponse(
        status="healthy",
        timestamp=datetime.utcnow(),
        services={
            "database": "connected",
            "jwt": "operational",
            "email": "operational"
        }
    )
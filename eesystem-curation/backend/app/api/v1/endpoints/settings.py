"""
Settings API endpoints
"""
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.services.auth import (
    get_current_user, require_admin, require_settings_read, 
    require_settings_write, require_settings_admin
)
from app.services.settings import SettingsService, EnvironmentVariableService, DatabaseConnectionService
from app.models.settings import Setting, EnvironmentVariable, DatabaseConnection
from app.services.validation import validate_setting_value, validate_database_connection, validate_environment_variable
from app.schemas.settings import (
    SettingCreate, SettingUpdate, SettingResponse, SettingHistoryResponse,
    EnvironmentVariableCreate, EnvironmentVariableUpdate, EnvironmentVariableResponse,
    SystemConfigurationCreate, SystemConfigurationUpdate, SystemConfigurationResponse,
    DatabaseConnectionCreate, DatabaseConnectionUpdate, DatabaseConnectionResponse,
    ConnectionTestRequest, ConnectionTestResponse, ValidationRequest, ValidationResponse,
    BulkSettingsRequest, BulkSettingsResponse, SystemStatusResponse, HealthCheckResponse
)
from app.middleware.rate_limiter import rate_limit
from datetime import datetime
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/", response_model=List[SettingResponse])
async def get_settings(
    category: Optional[str] = Query(None, description="Filter by category"),
    scope: Optional[str] = Query(None, description="Filter by scope"),
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    brand_id: Optional[str] = Query(None, description="Filter by brand ID"),
    include_sensitive: bool = Query(False, description="Include sensitive settings"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_settings_read)
):
    """Get settings with optional filtering"""
    try:
        service = SettingsService(db)
        
        # Only admins can view sensitive settings
        if include_sensitive and current_user.get("role") != "admin":
            include_sensitive = False
        
        # Regular users can only see their own user-specific settings
        if current_user.get("role") not in ["admin", "editor"]:
            user_id = current_user.get("user_id")
        
        settings = await service.get_settings(
            category=category,
            scope=scope,
            user_id=user_id,
            brand_id=brand_id,
            include_sensitive=include_sensitive
        )
        
        return settings
    
    except Exception as e:
        logger.error(f"Failed to get settings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve settings"
        )


@router.get("/{setting_id}", response_model=SettingResponse)
async def get_setting(
    setting_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_settings_read)
):
    """Get a specific setting by ID"""
    try:
        service = SettingsService(db)
        setting = await service.db.get(Setting, setting_id)
        
        if not setting:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Setting not found"
            )
        
        # Check access permissions
        if setting.is_sensitive and current_user.get("role") != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to view sensitive setting"
            )
        
        if (setting.user_id and setting.user_id != current_user.get("user_id") 
            and current_user.get("role") not in ["admin", "editor"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot access other user's settings"
            )
        
        return setting
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get setting {setting_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve setting"
        )


@router.post("/", response_model=SettingResponse)
@rate_limit(limit=10, window=60)
async def create_setting(
    setting_data: SettingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_settings_write)
):
    """Create a new setting"""
    try:
        service = SettingsService(db)
        
        # Validate permissions
        if setting_data.scope == "global" and current_user.get("role") != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins can create global settings"
            )
        
        if setting_data.is_sensitive and current_user.get("role") != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins can create sensitive settings"
            )
        
        # For user-specific settings, ensure user_id matches current user (unless admin)
        if setting_data.scope == "user_specific":
            if current_user.get("role") not in ["admin", "editor"]:
                setting_data.user_id = current_user.get("user_id")
            elif not setting_data.user_id:
                setting_data.user_id = current_user.get("user_id")
        
        setting = await service.create_setting(setting_data, current_user.get("user_id"))
        return setting
    
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to create setting: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create setting"
        )


@router.put("/{setting_id}", response_model=SettingResponse)
@rate_limit(limit=20, window=60)
async def update_setting(
    setting_id: str,
    setting_data: SettingUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_settings_write)
):
    """Update an existing setting"""
    try:
        service = SettingsService(db)
        
        # Get existing setting to check permissions
        existing_setting = await service.db.get(Setting, setting_id)
        if not existing_setting:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Setting not found"
            )
        
        # Check permissions
        if existing_setting.scope == "global" and current_user.get("role") != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins can modify global settings"
            )
        
        if existing_setting.is_sensitive and current_user.get("role") != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins can modify sensitive settings"
            )
        
        if (existing_setting.user_id and existing_setting.user_id != current_user.get("user_id") 
            and current_user.get("role") not in ["admin", "editor"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot modify other user's settings"
            )
        
        setting = await service.update_setting(
            setting_id, setting_data, current_user.get("user_id")
        )
        return setting
    
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to update setting {setting_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update setting"
        )


@router.delete("/{setting_id}")
@rate_limit(limit=5, window=60)
async def delete_setting(
    setting_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_settings_admin)
):
    """Delete a setting (admin only)"""
    try:
        service = SettingsService(db)
        
        # Get existing setting to check if it's required
        existing_setting = await service.db.get(Setting, setting_id)
        if not existing_setting:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Setting not found"
            )
        
        if existing_setting.is_required:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete required setting"
            )
        
        success = await service.delete_setting(setting_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Setting not found"
            )
        
        return {"message": "Setting deleted successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete setting {setting_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete setting"
        )


@router.get("/{setting_id}/history", response_model=List[SettingHistoryResponse])
async def get_setting_history(
    setting_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_settings_read)
):
    """Get history for a setting"""
    try:
        service = SettingsService(db)
        
        # Check if setting exists and user has access
        setting = await service.db.get(Setting, setting_id)
        if not setting:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Setting not found"
            )
        
        if (setting.user_id and setting.user_id != current_user.get("user_id") 
            and current_user.get("role") not in ["admin", "editor"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot access other user's setting history"
            )
        
        history = await service.get_setting_history(setting_id)
        return history
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get setting history {setting_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve setting history"
        )


@router.post("/bulk", response_model=BulkSettingsResponse)
@rate_limit(limit=3, window=60)
async def create_bulk_settings(
    request_data: BulkSettingsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_settings_admin)
):
    """Create multiple settings (admin only)"""
    try:
        service = SettingsService(db)
        
        settings = await service.bulk_create_settings(
            request_data.settings, current_user.get("user_id")
        )
        
        return BulkSettingsResponse(created=settings)
    
    except Exception as e:
        logger.error(f"Failed to create bulk settings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create bulk settings"
        )


@router.post("/validate", response_model=ValidationResponse)
async def validate_setting(
    validation_data: ValidationRequest,
    current_user: dict = Depends(require_settings_read)
):
    """Validate a setting value against rules"""
    try:
        is_valid, errors = validate_setting_value(
            validation_data.value, validation_data.validation_rules
        )
        
        return ValidationResponse(is_valid=is_valid, errors=errors)
    
    except Exception as e:
        logger.error(f"Failed to validate setting: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to validate setting"
        )


# Environment Variables endpoints
@router.get("/environment", response_model=List[EnvironmentVariableResponse])
async def get_environment_variables(
    category: Optional[str] = Query(None),
    environment: Optional[str] = Query(None),
    include_sensitive: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """Get environment variables (admin only)"""
    try:
        service = EnvironmentVariableService(db)
        
        env_vars = await service.get_env_variables(
            category=category,
            environment=environment,
            include_sensitive=include_sensitive
        )
        
        return env_vars
    
    except Exception as e:
        logger.error(f"Failed to get environment variables: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve environment variables"
        )


@router.post("/environment", response_model=EnvironmentVariableResponse)
@rate_limit(limit=5, window=60)
async def create_environment_variable(
    env_data: EnvironmentVariableCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """Create environment variable (admin only)"""
    try:
        # Validate environment variable data
        is_valid, errors = validate_environment_variable(env_data.dict())
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Validation errors: {', '.join(errors)}"
            )
        
        service = EnvironmentVariableService(db)
        env_var = await service.create_env_variable(env_data, current_user.get("user_id"))
        
        return env_var
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create environment variable: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create environment variable"
        )


@router.put("/environment/{env_id}", response_model=EnvironmentVariableResponse)
@rate_limit(limit=10, window=60)
async def update_environment_variable(
    env_id: str,
    env_data: EnvironmentVariableUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """Update environment variable (admin only)"""
    try:
        service = EnvironmentVariableService(db)
        env_var = await service.update_env_variable(
            env_id, env_data, current_user.get("user_id")
        )
        
        return env_var
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to update environment variable {env_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update environment variable"
        )


# Database Connection endpoints
@router.get("/database", response_model=List[DatabaseConnectionResponse])
async def get_database_connections(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """Get database connections (admin only)"""
    try:
        from app.models.settings import DatabaseConnection
        from sqlalchemy import select
        
        query = select(DatabaseConnection)
        result = await db.execute(query)
        connections = result.scalars().all()
        
        return connections
    
    except Exception as e:
        logger.error(f"Failed to get database connections: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve database connections"
        )


@router.post("/database", response_model=DatabaseConnectionResponse)
@rate_limit(limit=3, window=60)
async def create_database_connection(
    connection_data: DatabaseConnectionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """Create database connection (admin only)"""
    try:
        # Validate connection data
        is_valid, errors = validate_database_connection(connection_data.dict())
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Validation errors: {', '.join(errors)}"
            )
        
        service = DatabaseConnectionService(db)
        connection = await service.create_connection(
            connection_data, current_user.get("user_id")
        )
        
        return connection
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create database connection: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create database connection"
        )


@router.post("/database/test", response_model=ConnectionTestResponse)
@rate_limit(limit=10, window=60)
async def test_database_connection(
    test_request: ConnectionTestRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """Test database connection (admin only)"""
    try:
        service = DatabaseConnectionService(db)
        
        if test_request.connection_id:
            # Test existing connection
            connection = await db.get(DatabaseConnection, test_request.connection_id)
            if not connection:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Database connection not found"
                )
            
            # Convert to test format (decrypt values)
            from app.services.encryption import decrypt_value
            connection_data = DatabaseConnectionCreate(
                connection_name=connection.connection_name,
                connection_type=connection.connection_type,
                host=connection.host,
                port=connection.port,
                database_name=connection.database_name,
                username=connection.username,
                password=decrypt_value(connection.password) if connection.password else None,
                connection_string=decrypt_value(connection.connection_string) if connection.connection_string else None,
                connection_params=connection.connection_params,
                is_ssl=connection.is_ssl,
                ssl_config=connection.ssl_config
            )
        else:
            connection_data = test_request.connection_data
        
        if not connection_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Connection data required for testing"
            )
        
        result = await service.test_connection(connection_data)
        
        return ConnectionTestResponse(
            success=result["success"],
            message=result["message"],
            response_time=result["response_time"],
            tested_at=result["tested_at"]
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to test database connection: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to test database connection"
        )


@router.get("/status", response_model=SystemStatusResponse)
async def get_system_status(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """Get system status and configuration overview (admin only)"""
    try:
        from app.models.settings import DatabaseConnection, EnvironmentVariable, SystemConfiguration
        from sqlalchemy import select, func
        
        # Get database connections status
        db_query = select(DatabaseConnection)
        db_result = await db.execute(db_query)
        db_connections = [
            {
                "name": conn.connection_name,
                "type": conn.connection_type,
                "status": conn.test_status or "unknown",
                "last_tested": conn.last_tested
            }
            for conn in db_result.scalars().all()
        ]
        
        # Get environment variables count
        env_query = select(func.count(EnvironmentVariable.id))
        env_result = await db.execute(env_query)
        env_count = env_result.scalar()
        
        # Get system configurations
        config_query = select(SystemConfiguration).where(SystemConfiguration.is_active == True)
        config_result = await db.execute(config_query)
        configurations = [
            {
                "name": config.config_name,
                "schema_version": config.schema_version,
                "priority": config.priority
            }
            for config in config_result.scalars().all()
        ]
        
        return SystemStatusResponse(
            status="healthy",
            timestamp=datetime.utcnow(),
            database_connections=db_connections,
            environment_variables={"count": env_count},
            system_configurations=configurations,
            health_checks={
                "database": "healthy",
                "redis": "healthy",  # Add actual Redis check
                "storage": "healthy"  # Add actual storage check
            }
        )
    
    except Exception as e:
        logger.error(f"Failed to get system status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve system status"
        )
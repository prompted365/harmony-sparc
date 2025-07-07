"""
Settings service for business logic
"""
from typing import List, Optional, Dict, Any, Union
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload
from app.models.settings import (
    Setting, SettingHistory, EnvironmentVariable, 
    SystemConfiguration, DatabaseConnection
)
from app.schemas.settings import (
    SettingCreate, SettingUpdate, EnvironmentVariableCreate,
    EnvironmentVariableUpdate, SystemConfigurationCreate,
    SystemConfigurationUpdate, DatabaseConnectionCreate,
    DatabaseConnectionUpdate
)
from app.services.encryption import encrypt_value, decrypt_value, is_encrypted_value
from app.services.validation import validate_setting_value
from datetime import datetime
import logging
import json
import re

logger = logging.getLogger(__name__)


class SettingsService:
    """Service for managing application settings"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_settings(
        self, 
        category: Optional[str] = None,
        scope: Optional[str] = None,
        user_id: Optional[str] = None,
        brand_id: Optional[str] = None,
        include_sensitive: bool = False
    ) -> List[Setting]:
        """Get settings with optional filtering"""
        query = select(Setting)
        
        conditions = []
        if category:
            conditions.append(Setting.category == category)
        if scope:
            conditions.append(Setting.scope == scope)
        if user_id:
            conditions.append(Setting.user_id == user_id)
        if brand_id:
            conditions.append(Setting.brand_id == brand_id)
        
        if not include_sensitive:
            conditions.append(Setting.is_sensitive == False)
        
        if conditions:
            query = query.where(and_(*conditions))
        
        result = await self.db.execute(query)
        settings = result.scalars().all()
        
        # Decrypt encrypted values
        for setting in settings:
            if setting.is_encrypted and setting.value:
                try:
                    setting.value = decrypt_value(str(setting.value))
                except Exception as e:
                    logger.error(f"Failed to decrypt setting {setting.key}: {e}")
        
        return settings
    
    async def get_setting_by_key(
        self, 
        key: str, 
        user_id: Optional[str] = None,
        brand_id: Optional[str] = None
    ) -> Optional[Setting]:
        """Get setting by key"""
        query = select(Setting).where(Setting.key == key)
        
        if user_id:
            query = query.where(Setting.user_id == user_id)
        elif brand_id:
            query = query.where(Setting.brand_id == brand_id)
        else:
            query = query.where(
                and_(Setting.user_id.is_(None), Setting.brand_id.is_(None))
            )
        
        result = await self.db.execute(query)
        setting = result.scalar_one_or_none()
        
        if setting and setting.is_encrypted and setting.value:
            try:
                setting.value = decrypt_value(str(setting.value))
            except Exception as e:
                logger.error(f"Failed to decrypt setting {setting.key}: {e}")
        
        return setting
    
    async def create_setting(
        self, 
        setting_data: SettingCreate,
        current_user_id: str
    ) -> Setting:
        """Create a new setting"""
        # Validate the setting value
        if setting_data.validation_rules:
            is_valid, errors = validate_setting_value(
                setting_data.value, 
                setting_data.validation_rules
            )
            if not is_valid:
                raise ValueError(f"Validation errors: {', '.join(errors)}")
        
        # Check if setting already exists
        existing = await self.get_setting_by_key(
            setting_data.key, 
            setting_data.user_id, 
            setting_data.brand_id
        )
        if existing:
            raise ValueError(f"Setting '{setting_data.key}' already exists")
        
        # Encrypt value if needed
        value = setting_data.value
        if setting_data.is_encrypted and value:
            value = encrypt_value(str(value))
        
        setting = Setting(
            key=setting_data.key,
            value=value,
            data_type=setting_data.data_type,
            category=setting_data.category,
            scope=setting_data.scope,
            user_id=setting_data.user_id,
            brand_id=setting_data.brand_id,
            description=setting_data.description,
            is_encrypted=setting_data.is_encrypted,
            is_required=setting_data.is_required,
            is_sensitive=setting_data.is_sensitive,
            validation_rules=setting_data.validation_rules,
            default_value=setting_data.default_value,
            created_by=current_user_id,
            updated_by=current_user_id
        )
        
        self.db.add(setting)
        await self.db.commit()
        await self.db.refresh(setting)
        
        return setting
    
    async def update_setting(
        self, 
        setting_id: str,
        setting_data: SettingUpdate,
        current_user_id: str
    ) -> Setting:
        """Update an existing setting"""
        setting = await self.db.get(Setting, setting_id)
        if not setting:
            raise ValueError(f"Setting with id '{setting_id}' not found")
        
        # Store old value for history
        old_value = setting.value
        
        # Validate new value if provided
        if setting_data.value is not None:
            if setting.validation_rules:
                is_valid, errors = validate_setting_value(
                    setting_data.value, 
                    setting.validation_rules
                )
                if not is_valid:
                    raise ValueError(f"Validation errors: {', '.join(errors)}")
        
        # Update fields
        if setting_data.value is not None:
            value = setting_data.value
            if setting.is_encrypted and value:
                value = encrypt_value(str(value))
            setting.value = value
        
        if setting_data.description is not None:
            setting.description = setting_data.description
        if setting_data.is_encrypted is not None:
            setting.is_encrypted = setting_data.is_encrypted
        if setting_data.is_required is not None:
            setting.is_required = setting_data.is_required
        if setting_data.is_sensitive is not None:
            setting.is_sensitive = setting_data.is_sensitive
        if setting_data.validation_rules is not None:
            setting.validation_rules = setting_data.validation_rules
        if setting_data.default_value is not None:
            setting.default_value = setting_data.default_value
        
        setting.updated_by = current_user_id
        setting.updated_at = datetime.utcnow()
        setting.version += 1
        
        # Create history record
        history = SettingHistory(
            setting_id=setting.id,
            old_value=old_value,
            new_value=setting.value,
            changed_by=current_user_id,
            version=setting.version
        )
        self.db.add(history)
        
        await self.db.commit()
        await self.db.refresh(setting)
        
        return setting
    
    async def delete_setting(self, setting_id: str) -> bool:
        """Delete a setting"""
        setting = await self.db.get(Setting, setting_id)
        if not setting:
            return False
        
        await self.db.delete(setting)
        await self.db.commit()
        return True
    
    async def get_setting_history(self, setting_id: str) -> List[SettingHistory]:
        """Get history for a setting"""
        query = select(SettingHistory).where(
            SettingHistory.setting_id == setting_id
        ).order_by(SettingHistory.changed_at.desc())
        
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def bulk_create_settings(
        self, 
        settings_data: List[SettingCreate],
        current_user_id: str
    ) -> List[Setting]:
        """Create multiple settings"""
        created_settings = []
        
        for setting_data in settings_data:
            try:
                setting = await self.create_setting(setting_data, current_user_id)
                created_settings.append(setting)
            except Exception as e:
                logger.error(f"Failed to create setting '{setting_data.key}': {e}")
                # In a real scenario, you might want to collect errors and return them
                continue
        
        return created_settings


class EnvironmentVariableService:
    """Service for managing environment variables"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_env_variables(
        self, 
        category: Optional[str] = None,
        environment: Optional[str] = None,
        include_sensitive: bool = False
    ) -> List[EnvironmentVariable]:
        """Get environment variables"""
        query = select(EnvironmentVariable)
        
        conditions = []
        if category:
            conditions.append(EnvironmentVariable.category == category)
        if environment:
            conditions.append(EnvironmentVariable.environment == environment)
        
        if not include_sensitive:
            conditions.append(EnvironmentVariable.is_sensitive == False)
        
        if conditions:
            query = query.where(and_(*conditions))
        
        result = await self.db.execute(query)
        env_vars = result.scalars().all()
        
        # Decrypt encrypted values
        for env_var in env_vars:
            if env_var.is_encrypted and env_var.value:
                try:
                    env_var.value = decrypt_value(env_var.value)
                except Exception as e:
                    logger.error(f"Failed to decrypt env var {env_var.name}: {e}")
        
        return env_vars
    
    async def create_env_variable(
        self, 
        env_data: EnvironmentVariableCreate,
        current_user_id: str
    ) -> EnvironmentVariable:
        """Create environment variable"""
        # Validate pattern if provided
        if env_data.validation_pattern and env_data.value:
            if not re.match(env_data.validation_pattern, env_data.value):
                raise ValueError(env_data.validation_message or "Validation failed")
        
        # Encrypt value if needed
        value = env_data.value
        if env_data.is_encrypted and value:
            value = encrypt_value(value)
        
        env_var = EnvironmentVariable(
            name=env_data.name,
            value=value,
            description=env_data.description,
            category=env_data.category,
            environment=env_data.environment,
            is_encrypted=env_data.is_encrypted,
            is_sensitive=env_data.is_sensitive,
            is_required=env_data.is_required,
            validation_pattern=env_data.validation_pattern,
            validation_message=env_data.validation_message,
            created_by=current_user_id,
            updated_by=current_user_id
        )
        
        self.db.add(env_var)
        await self.db.commit()
        await self.db.refresh(env_var)
        
        return env_var
    
    async def update_env_variable(
        self, 
        env_id: str,
        env_data: EnvironmentVariableUpdate,
        current_user_id: str
    ) -> EnvironmentVariable:
        """Update environment variable"""
        env_var = await self.db.get(EnvironmentVariable, env_id)
        if not env_var:
            raise ValueError(f"Environment variable with id '{env_id}' not found")
        
        # Update fields
        if env_data.value is not None:
            value = env_data.value
            if env_var.is_encrypted and value:
                value = encrypt_value(value)
            env_var.value = value
        
        if env_data.description is not None:
            env_var.description = env_data.description
        if env_data.is_encrypted is not None:
            env_var.is_encrypted = env_data.is_encrypted
        if env_data.is_sensitive is not None:
            env_var.is_sensitive = env_data.is_sensitive
        if env_data.is_required is not None:
            env_var.is_required = env_data.is_required
        if env_data.validation_pattern is not None:
            env_var.validation_pattern = env_data.validation_pattern
        if env_data.validation_message is not None:
            env_var.validation_message = env_data.validation_message
        
        env_var.updated_by = current_user_id
        env_var.updated_at = datetime.utcnow()
        
        await self.db.commit()
        await self.db.refresh(env_var)
        
        return env_var


class DatabaseConnectionService:
    """Service for managing database connections"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def test_connection(self, connection_data: DatabaseConnectionCreate) -> Dict[str, Any]:
        """Test database connection"""
        try:
            # Import appropriate driver based on connection type
            start_time = datetime.utcnow()
            
            if connection_data.connection_type == "astradb":
                from cassandra.cluster import Cluster
                from cassandra.auth import PlainTextAuthProvider
                
                # Test AstraDB connection
                # Implementation depends on your AstraDB setup
                pass
            
            elif connection_data.connection_type == "postgresql":
                import asyncpg
                
                # Test PostgreSQL connection
                conn = await asyncpg.connect(
                    host=connection_data.host,
                    port=connection_data.port,
                    user=connection_data.username,
                    password=connection_data.password,
                    database=connection_data.database_name
                )
                await conn.close()
            
            elif connection_data.connection_type == "redis":
                import aioredis
                
                # Test Redis connection
                redis = aioredis.from_url(
                    f"redis://{connection_data.host}:{connection_data.port}"
                )
                await redis.ping()
                await redis.close()
            
            end_time = datetime.utcnow()
            response_time = (end_time - start_time).total_seconds()
            
            return {
                "success": True,
                "message": "Connection successful",
                "response_time": response_time,
                "tested_at": end_time
            }
            
        except Exception as e:
            return {
                "success": False,
                "message": f"Connection failed: {str(e)}",
                "response_time": None,
                "tested_at": datetime.utcnow()
            }
    
    async def create_connection(
        self, 
        connection_data: DatabaseConnectionCreate,
        current_user_id: str
    ) -> DatabaseConnection:
        """Create database connection"""
        # Encrypt sensitive data
        password = connection_data.password
        if password:
            password = encrypt_value(password)
        
        connection_string = connection_data.connection_string
        if connection_string:
            connection_string = encrypt_value(connection_string)
        
        connection = DatabaseConnection(
            connection_name=connection_data.connection_name,
            connection_type=connection_data.connection_type,
            connection_string=connection_string,
            host=connection_data.host,
            port=connection_data.port,
            database_name=connection_data.database_name,
            username=connection_data.username,
            password=password,
            connection_params=connection_data.connection_params,
            is_ssl=connection_data.is_ssl,
            ssl_config=connection_data.ssl_config,
            is_active=connection_data.is_active,
            is_default=connection_data.is_default,
            created_by=current_user_id,
            updated_by=current_user_id
        )
        
        self.db.add(connection)
        await self.db.commit()
        await self.db.refresh(connection)
        
        return connection
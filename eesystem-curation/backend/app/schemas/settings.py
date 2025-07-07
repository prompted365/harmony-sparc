"""
Settings API schemas
"""
from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, Any, List, Union
from datetime import datetime
from enum import Enum


class SettingDataType(str, Enum):
    """Setting data types"""
    STRING = "string"
    BOOLEAN = "boolean"
    NUMBER = "number"
    JSON = "json"
    ENCRYPTED = "encrypted"


class SettingCategory(str, Enum):
    """Setting categories"""
    SYSTEM = "system"
    USER = "user"
    DATABASE = "database"
    API = "api"
    SECURITY = "security"
    DEPLOYMENT = "deployment"
    FEATURE = "feature"


class SettingScope(str, Enum):
    """Setting scope"""
    GLOBAL = "global"
    USER_SPECIFIC = "user_specific"
    BRAND_SPECIFIC = "brand_specific"


class EnvironmentType(str, Enum):
    """Environment types"""
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


# Base schemas
class SettingBase(BaseModel):
    """Base setting schema"""
    key: str = Field(..., min_length=1, max_length=255, description="Setting key")
    value: Optional[Union[str, int, float, bool, Dict[str, Any]]] = Field(None, description="Setting value")
    data_type: SettingDataType = Field(..., description="Data type of the setting")
    category: SettingCategory = Field(..., description="Setting category")
    scope: SettingScope = Field(..., description="Setting scope")
    user_id: Optional[str] = Field(None, description="User ID for user-specific settings")
    brand_id: Optional[str] = Field(None, description="Brand ID for brand-specific settings")
    description: Optional[str] = Field(None, description="Setting description")
    is_encrypted: bool = Field(False, description="Whether the value is encrypted")
    is_required: bool = Field(False, description="Whether the setting is required")
    is_sensitive: bool = Field(False, description="Whether the setting is sensitive")
    validation_rules: Optional[Dict[str, Any]] = Field(None, description="Validation rules")
    default_value: Optional[Union[str, int, float, bool, Dict[str, Any]]] = Field(None, description="Default value")


class SettingCreate(SettingBase):
    """Create setting schema"""
    pass


class SettingUpdate(BaseModel):
    """Update setting schema"""
    value: Optional[Union[str, int, float, bool, Dict[str, Any]]] = None
    description: Optional[str] = None
    is_encrypted: Optional[bool] = None
    is_required: Optional[bool] = None
    is_sensitive: Optional[bool] = None
    validation_rules: Optional[Dict[str, Any]] = None
    default_value: Optional[Union[str, int, float, bool, Dict[str, Any]]] = None


class SettingResponse(SettingBase):
    """Setting response schema"""
    id: str
    version: int
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    
    class Config:
        from_attributes = True


class SettingHistoryResponse(BaseModel):
    """Setting history response schema"""
    id: str
    setting_id: str
    old_value: Optional[Dict[str, Any]] = None
    new_value: Optional[Dict[str, Any]] = None
    changed_by: str
    changed_at: datetime
    change_reason: Optional[str] = None
    version: int
    
    class Config:
        from_attributes = True


# Environment Variable schemas
class EnvironmentVariableBase(BaseModel):
    """Base environment variable schema"""
    name: str = Field(..., min_length=1, max_length=255, description="Environment variable name")
    value: Optional[str] = Field(None, description="Environment variable value")
    description: Optional[str] = Field(None, description="Environment variable description")
    category: SettingCategory = Field(..., description="Environment variable category")
    environment: EnvironmentType = Field(..., description="Environment type")
    is_encrypted: bool = Field(False, description="Whether the value is encrypted")
    is_sensitive: bool = Field(False, description="Whether the variable is sensitive")
    is_required: bool = Field(False, description="Whether the variable is required")
    validation_pattern: Optional[str] = Field(None, description="Validation regex pattern")
    validation_message: Optional[str] = Field(None, description="Validation error message")


class EnvironmentVariableCreate(EnvironmentVariableBase):
    """Create environment variable schema"""
    pass


class EnvironmentVariableUpdate(BaseModel):
    """Update environment variable schema"""
    value: Optional[str] = None
    description: Optional[str] = None
    is_encrypted: Optional[bool] = None
    is_sensitive: Optional[bool] = None
    is_required: Optional[bool] = None
    validation_pattern: Optional[str] = None
    validation_message: Optional[str] = None


class EnvironmentVariableResponse(EnvironmentVariableBase):
    """Environment variable response schema"""
    id: str
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    
    class Config:
        from_attributes = True


# System Configuration schemas
class SystemConfigurationBase(BaseModel):
    """Base system configuration schema"""
    config_name: str = Field(..., min_length=1, max_length=255, description="Configuration name")
    config_data: Dict[str, Any] = Field(..., description="Configuration data")
    schema_version: str = Field("1.0", description="Schema version")
    description: Optional[str] = Field(None, description="Configuration description")
    is_active: bool = Field(True, description="Whether the configuration is active")
    priority: int = Field(0, description="Configuration priority")


class SystemConfigurationCreate(SystemConfigurationBase):
    """Create system configuration schema"""
    pass


class SystemConfigurationUpdate(BaseModel):
    """Update system configuration schema"""
    config_data: Optional[Dict[str, Any]] = None
    schema_version: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    priority: Optional[int] = None


class SystemConfigurationResponse(SystemConfigurationBase):
    """System configuration response schema"""
    id: str
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    
    class Config:
        from_attributes = True


# Database Connection schemas
class DatabaseConnectionBase(BaseModel):
    """Base database connection schema"""
    connection_name: str = Field(..., min_length=1, max_length=255, description="Connection name")
    connection_type: str = Field(..., description="Connection type")
    host: Optional[str] = Field(None, description="Database host")
    port: Optional[int] = Field(None, description="Database port")
    database_name: Optional[str] = Field(None, description="Database name")
    username: Optional[str] = Field(None, description="Database username")
    connection_params: Optional[Dict[str, Any]] = Field(None, description="Connection parameters")
    is_ssl: bool = Field(True, description="Whether to use SSL")
    ssl_config: Optional[Dict[str, Any]] = Field(None, description="SSL configuration")
    is_active: bool = Field(True, description="Whether the connection is active")
    is_default: bool = Field(False, description="Whether this is the default connection")


class DatabaseConnectionCreate(DatabaseConnectionBase):
    """Create database connection schema"""
    password: Optional[str] = Field(None, description="Database password")
    connection_string: Optional[str] = Field(None, description="Full connection string")


class DatabaseConnectionUpdate(BaseModel):
    """Update database connection schema"""
    host: Optional[str] = None
    port: Optional[int] = None
    database_name: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    connection_string: Optional[str] = None
    connection_params: Optional[Dict[str, Any]] = None
    is_ssl: Optional[bool] = None
    ssl_config: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None


class DatabaseConnectionResponse(DatabaseConnectionBase):
    """Database connection response schema"""
    id: str
    last_tested: Optional[datetime] = None
    test_status: Optional[str] = None
    test_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    
    class Config:
        from_attributes = True


# Test schemas
class ConnectionTestRequest(BaseModel):
    """Connection test request schema"""
    connection_id: Optional[str] = Field(None, description="Connection ID to test")
    connection_data: Optional[DatabaseConnectionCreate] = Field(None, description="Connection data to test")


class ConnectionTestResponse(BaseModel):
    """Connection test response schema"""
    success: bool
    message: str
    response_time: Optional[float] = None
    tested_at: datetime


# Validation schemas
class ValidationRequest(BaseModel):
    """Validation request schema"""
    value: Any
    validation_rules: Dict[str, Any]


class ValidationResponse(BaseModel):
    """Validation response schema"""
    is_valid: bool
    errors: List[str] = []


# Bulk operations
class BulkSettingsRequest(BaseModel):
    """Bulk settings request schema"""
    settings: List[SettingCreate]


class BulkSettingsResponse(BaseModel):
    """Bulk settings response schema"""
    created: List[SettingResponse]
    errors: List[Dict[str, str]] = []


# System status
class SystemStatusResponse(BaseModel):
    """System status response schema"""
    status: str
    timestamp: datetime
    database_connections: List[Dict[str, Any]]
    environment_variables: Dict[str, Any]
    system_configurations: List[Dict[str, Any]]
    health_checks: Dict[str, Any]


class HealthCheckResponse(BaseModel):
    """Health check response schema"""
    status: str
    service: str
    timestamp: datetime
    components: Dict[str, str]
    uptime: Optional[float] = None
    version: Optional[str] = None
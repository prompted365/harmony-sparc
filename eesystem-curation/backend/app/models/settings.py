"""
Settings data models
"""
from sqlalchemy import Column, String, Boolean, Integer, DateTime, JSON, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
from typing import Optional, Dict, Any
import uuid

Base = declarative_base()


class Setting(Base):
    """Settings model for system-wide and user-specific configurations"""
    __tablename__ = "settings"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    key = Column(String(255), nullable=False, index=True)
    value = Column(JSON, nullable=True)
    data_type = Column(String(50), nullable=False)  # string, boolean, number, json, encrypted
    category = Column(String(100), nullable=False)  # system, user, database, api, security
    scope = Column(String(50), nullable=False)  # global, user_specific, brand_specific
    
    # User/Brand association
    user_id = Column(String(36), ForeignKey('users.id'), nullable=True)
    brand_id = Column(String(36), ForeignKey('brands.id'), nullable=True)
    
    # Metadata
    description = Column(Text, nullable=True)
    is_encrypted = Column(Boolean, default=False)
    is_required = Column(Boolean, default=False)
    is_sensitive = Column(Boolean, default=False)
    validation_rules = Column(JSON, nullable=True)
    default_value = Column(JSON, nullable=True)
    
    # Audit fields
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String(36), ForeignKey('users.id'), nullable=True)
    updated_by = Column(String(36), ForeignKey('users.id'), nullable=True)
    
    # Version control
    version = Column(Integer, default=1)
    
    def __repr__(self):
        return f"<Setting(id={self.id}, key={self.key}, category={self.category})>"


class SettingHistory(Base):
    """History tracking for settings changes"""
    __tablename__ = "setting_history"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    setting_id = Column(String(36), ForeignKey('settings.id'), nullable=False)
    old_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)
    changed_by = Column(String(36), ForeignKey('users.id'), nullable=False)
    changed_at = Column(DateTime, default=datetime.utcnow)
    change_reason = Column(Text, nullable=True)
    version = Column(Integer, nullable=False)
    
    def __repr__(self):
        return f"<SettingHistory(id={self.id}, setting_id={self.setting_id}, version={self.version})>"


class EnvironmentVariable(Base):
    """Environment variables management"""
    __tablename__ = "environment_variables"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False, unique=True, index=True)
    value = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=False)  # database, api, security, deployment
    environment = Column(String(50), nullable=False)  # development, staging, production
    
    # Security
    is_encrypted = Column(Boolean, default=False)
    is_sensitive = Column(Boolean, default=False)
    is_required = Column(Boolean, default=False)
    
    # Validation
    validation_pattern = Column(String(500), nullable=True)
    validation_message = Column(Text, nullable=True)
    
    # Audit fields
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String(36), ForeignKey('users.id'), nullable=True)
    updated_by = Column(String(36), ForeignKey('users.id'), nullable=True)
    
    def __repr__(self):
        return f"<EnvironmentVariable(id={self.id}, name={self.name}, environment={self.environment})>"


class SystemConfiguration(Base):
    """System-wide configuration settings"""
    __tablename__ = "system_configurations"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    config_name = Column(String(255), nullable=False, unique=True)
    config_data = Column(JSON, nullable=False)
    schema_version = Column(String(20), nullable=False, default="1.0")
    
    # Metadata
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    priority = Column(Integer, default=0)
    
    # Audit fields
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String(36), ForeignKey('users.id'), nullable=True)
    updated_by = Column(String(36), ForeignKey('users.id'), nullable=True)
    
    def __repr__(self):
        return f"<SystemConfiguration(id={self.id}, config_name={self.config_name})>"


class DatabaseConnection(Base):
    """Database connection configurations"""
    __tablename__ = "database_connections"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    connection_name = Column(String(255), nullable=False, unique=True)
    connection_type = Column(String(50), nullable=False)  # astradb, postgresql, redis, etc.
    connection_string = Column(Text, nullable=True)  # Encrypted
    host = Column(String(255), nullable=True)
    port = Column(Integer, nullable=True)
    database_name = Column(String(255), nullable=True)
    username = Column(String(255), nullable=True)
    password = Column(Text, nullable=True)  # Encrypted
    
    # Configuration
    connection_params = Column(JSON, nullable=True)
    is_ssl = Column(Boolean, default=True)
    ssl_config = Column(JSON, nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)
    last_tested = Column(DateTime, nullable=True)
    test_status = Column(String(50), nullable=True)  # success, failure, pending
    test_message = Column(Text, nullable=True)
    
    # Audit fields
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String(36), ForeignKey('users.id'), nullable=True)
    updated_by = Column(String(36), ForeignKey('users.id'), nullable=True)
    
    def __repr__(self):
        return f"<DatabaseConnection(id={self.id}, connection_name={self.connection_name})>"
"""
User models for authentication and authorization
"""
from datetime import datetime
from typing import Optional, List
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from enum import Enum

from core.database import Base


class UserRole(str, Enum):
    """User roles"""
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"
    AGENT = "agent"


class User(Base):
    """User model"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    
    # User information
    first_name = Column(String(100))
    last_name = Column(String(100))
    role = Column(String(50), default=UserRole.VIEWER)
    
    # Status
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime)
    
    # API access
    api_key = Column(String(255), unique=True, index=True)
    api_key_created_at = Column(DateTime)
    
    # Relationships
    preferences = relationship("UserPreferences", back_populates="user", uselist=False)
    content = relationship("Content", back_populates="author")
    agents = relationship("Agent", back_populates="owner")
    
    def __repr__(self):
        return f"<User(id={self.id}, email={self.email}, role={self.role})>"
    
    @property
    def full_name(self):
        """Get full name"""
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        return self.username
    
    @property
    def is_admin(self):
        """Check if user is admin"""
        return self.role == UserRole.ADMIN
    
    @property
    def is_editor(self):
        """Check if user can edit content"""
        return self.role in [UserRole.ADMIN, UserRole.EDITOR]


class UserPreferences(Base):
    """User preferences model"""
    __tablename__ = "user_preferences"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # UI Preferences
    theme = Column(String(50), default="light")
    language = Column(String(10), default="en")
    timezone = Column(String(50), default="UTC")
    
    # Notification preferences
    email_notifications = Column(Boolean, default=True)
    push_notifications = Column(Boolean, default=True)
    
    # Content preferences
    default_content_type = Column(String(50))
    auto_save_interval = Column(Integer, default=30)  # seconds
    
    # AI preferences
    preferred_ai_model = Column(String(100))
    ai_assistance_level = Column(String(50), default="medium")
    
    # Additional preferences as JSON
    custom_preferences = Column(JSON)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="preferences")
    
    def __repr__(self):
        return f"<UserPreferences(user_id={self.user_id}, theme={self.theme})>"


class UserSession(Base):
    """User session model"""
    __tablename__ = "user_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_id = Column(String(255), unique=True, index=True, nullable=False)
    
    # Session information
    ip_address = Column(String(45))
    user_agent = Column(Text)
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    last_activity = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)
    
    # Relationships
    user = relationship("User")
    
    def __repr__(self):
        return f"<UserSession(user_id={self.user_id}, session_id={self.session_id})>"


class UserActivity(Base):
    """User activity log model"""
    __tablename__ = "user_activities"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Activity information
    action = Column(String(100), nullable=False)
    resource_type = Column(String(50))
    resource_id = Column(String(100))
    
    # Context
    ip_address = Column(String(45))
    user_agent = Column(Text)
    
    # Additional data
    metadata = Column(JSON)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User")
    
    def __repr__(self):
        return f"<UserActivity(user_id={self.user_id}, action={self.action})>"
"""
Analytics models for performance tracking and reporting
"""
from datetime import datetime
from typing import Optional, List
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, JSON, Float
from sqlalchemy.orm import relationship
from enum import Enum

from core.database import Base


class EventType(str, Enum):
    """Analytics event types"""
    PAGE_VIEW = "page_view"
    CONTENT_VIEW = "content_view"
    CONTENT_CREATED = "content_created"
    CONTENT_UPDATED = "content_updated"
    CONTENT_PUBLISHED = "content_published"
    USER_LOGIN = "user_login"
    USER_LOGOUT = "user_logout"
    SEARCH_QUERY = "search_query"
    DOCUMENT_UPLOAD = "document_upload"
    AGENT_TASK = "agent_task"
    API_CALL = "api_call"
    ERROR = "error"
    CUSTOM = "custom"


class ReportType(str, Enum):
    """Analytics report types"""
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"
    CUSTOM = "custom"


class Analytics(Base):
    """Analytics model for general metrics"""
    __tablename__ = "analytics"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Metric information
    metric_name = Column(String(255), nullable=False)
    metric_type = Column(String(50), nullable=False)
    category = Column(String(100))
    
    # Value
    value = Column(Float)
    string_value = Column(String(255))
    json_value = Column(JSON)
    
    # Dimensions
    dimensions = Column(JSON)
    
    # Context
    entity_type = Column(String(50))
    entity_id = Column(String(100))
    
    # User context
    user_id = Column(Integer, ForeignKey("users.id"))
    session_id = Column(String(255))
    
    # Timestamps
    timestamp = Column(DateTime, default=datetime.utcnow)
    date = Column(DateTime)
    
    # Relationships
    user = relationship("User")
    
    def __repr__(self):
        return f"<Analytics(metric={self.metric_name}, value={self.value})>"


class AnalyticsEvent(Base):
    """Analytics event model"""
    __tablename__ = "analytics_events"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Event information
    event_type = Column(String(50), nullable=False)
    event_name = Column(String(255))
    
    # Event data
    properties = Column(JSON)
    
    # User context
    user_id = Column(Integer, ForeignKey("users.id"))
    session_id = Column(String(255))
    
    # Request context
    ip_address = Column(String(45))
    user_agent = Column(Text)
    referer = Column(String(500))
    
    # Timestamps
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User")
    
    def __repr__(self):
        return f"<AnalyticsEvent(type={self.event_type}, name={self.event_name})>"


class AnalyticsReport(Base):
    """Analytics report model"""
    __tablename__ = "analytics_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Report information
    name = Column(String(255), nullable=False)
    description = Column(Text)
    report_type = Column(String(50), nullable=False)
    
    # Report configuration
    config = Column(JSON)
    filters = Column(JSON)
    metrics = Column(JSON)
    
    # Report data
    data = Column(JSON)
    
    # Time range
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    
    # Generation
    generated_at = Column(DateTime)
    generation_time = Column(Float)
    
    # Ownership
    created_by = Column(Integer, ForeignKey("users.id"))
    
    # Scheduling
    is_scheduled = Column(Boolean, default=False)
    schedule_config = Column(JSON)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    creator = relationship("User")
    
    def __repr__(self):
        return f"<AnalyticsReport(id={self.id}, name={self.name})>"


class ContentAnalytics(Base):
    """Content analytics model"""
    __tablename__ = "content_analytics"
    
    id = Column(Integer, primary_key=True, index=True)
    content_id = Column(Integer, ForeignKey("content.id"), nullable=False)
    
    # View metrics
    views = Column(Integer, default=0)
    unique_views = Column(Integer, default=0)
    
    # Engagement metrics
    likes = Column(Integer, default=0)
    shares = Column(Integer, default=0)
    comments = Column(Integer, default=0)
    saves = Column(Integer, default=0)
    
    # Time metrics
    average_time_on_page = Column(Float)
    bounce_rate = Column(Float)
    
    # Conversion metrics
    conversions = Column(Integer, default=0)
    conversion_rate = Column(Float)
    
    # SEO metrics
    search_impressions = Column(Integer, default=0)
    search_clicks = Column(Integer, default=0)
    average_position = Column(Float)
    
    # Performance scores
    performance_score = Column(Float)
    engagement_score = Column(Float)
    
    # Date
    date = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    content = relationship("Content")
    
    def __repr__(self):
        return f"<ContentAnalytics(content_id={self.content_id}, views={self.views})>"


class UserAnalytics(Base):
    """User analytics model"""
    __tablename__ = "user_analytics"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Activity metrics
    login_count = Column(Integer, default=0)
    session_duration = Column(Float)
    pages_visited = Column(Integer, default=0)
    
    # Content metrics
    content_created = Column(Integer, default=0)
    content_updated = Column(Integer, default=0)
    content_published = Column(Integer, default=0)
    
    # Engagement metrics
    documents_uploaded = Column(Integer, default=0)
    searches_performed = Column(Integer, default=0)
    
    # AI usage
    ai_tasks_created = Column(Integer, default=0)
    ai_tokens_used = Column(Integer, default=0)
    
    # Date
    date = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User")
    
    def __repr__(self):
        return f"<UserAnalytics(user_id={self.user_id}, date={self.date})>"


class SystemAnalytics(Base):
    """System analytics model"""
    __tablename__ = "system_analytics"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # System metrics
    metric_name = Column(String(255), nullable=False)
    value = Column(Float)
    
    # Categories
    category = Column(String(100))
    subcategory = Column(String(100))
    
    # Additional data
    metadata = Column(JSON)
    
    # Timestamps
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f"<SystemAnalytics(metric={self.metric_name}, value={self.value})>"


class PerformanceMetrics(Base):
    """Performance metrics model"""
    __tablename__ = "performance_metrics"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Metric information
    endpoint = Column(String(255))
    method = Column(String(10))
    
    # Performance data
    response_time = Column(Float)
    status_code = Column(Integer)
    
    # Request size
    request_size = Column(Integer)
    response_size = Column(Integer)
    
    # Error information
    error_message = Column(Text)
    
    # Context
    user_id = Column(Integer, ForeignKey("users.id"))
    ip_address = Column(String(45))
    
    # Timestamps
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User")
    
    def __repr__(self):
        return f"<PerformanceMetrics(endpoint={self.endpoint}, response_time={self.response_time})>"
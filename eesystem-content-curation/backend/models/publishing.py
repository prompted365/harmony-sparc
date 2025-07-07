"""
Publishing models for content scheduling and distribution
"""
from datetime import datetime
from typing import Optional, List
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, JSON, Float
from sqlalchemy.orm import relationship
from enum import Enum

from core.database import Base


class PublicationStatus(str, Enum):
    """Publication status"""
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    PUBLISHING = "publishing"
    PUBLISHED = "published"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ChannelType(str, Enum):
    """Publishing channel types"""
    WEBSITE = "website"
    BLOG = "blog"
    SOCIAL_MEDIA = "social_media"
    EMAIL = "email"
    NEWSLETTER = "newsletter"
    RSS = "rss"
    API = "api"
    WEBHOOK = "webhook"
    CUSTOM = "custom"


class Publication(Base):
    """Publication model"""
    __tablename__ = "publications"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Publication information
    title = Column(String(500), nullable=False)
    description = Column(Text)
    
    # Content
    content_id = Column(Integer, ForeignKey("content.id"))
    custom_content = Column(Text)
    
    # Publishing
    status = Column(String(50), default=PublicationStatus.DRAFT)
    publish_date = Column(DateTime)
    published_at = Column(DateTime)
    
    # Channels
    channels = Column(JSON)  # List of channel configurations
    
    # Metadata
    metadata = Column(JSON)
    
    # Results
    publication_results = Column(JSON)
    
    # Error handling
    error_message = Column(Text)
    retry_count = Column(Integer, default=0)
    
    # Ownership
    created_by = Column(Integer, ForeignKey("users.id"))
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    content = relationship("Content")
    creator = relationship("User")
    schedules = relationship("PublishingSchedule", back_populates="publication")
    
    def __repr__(self):
        return f"<Publication(id={self.id}, title={self.title})>"
    
    @property
    def is_published(self):
        """Check if publication is published"""
        return self.status == PublicationStatus.PUBLISHED
    
    @property
    def is_scheduled(self):
        """Check if publication is scheduled"""
        return self.status == PublicationStatus.SCHEDULED


class PublishingSchedule(Base):
    """Publishing schedule model"""
    __tablename__ = "publishing_schedules"
    
    id = Column(Integer, primary_key=True, index=True)
    publication_id = Column(Integer, ForeignKey("publications.id"), nullable=False)
    
    # Schedule information
    name = Column(String(255), nullable=False)
    description = Column(Text)
    
    # Timing
    scheduled_at = Column(DateTime, nullable=False)
    timezone = Column(String(50), default="UTC")
    
    # Recurrence
    is_recurring = Column(Boolean, default=False)
    recurrence_pattern = Column(JSON)
    
    # Status
    status = Column(String(50), default="active")
    
    # Execution
    last_executed = Column(DateTime)
    next_execution = Column(DateTime)
    execution_count = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    publication = relationship("Publication", back_populates="schedules")
    
    def __repr__(self):
        return f"<PublishingSchedule(id={self.id}, name={self.name})>"


class PublishingChannel(Base):
    """Publishing channel model"""
    __tablename__ = "publishing_channels"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Channel information
    name = Column(String(255), nullable=False)
    description = Column(Text)
    channel_type = Column(String(50), nullable=False)
    
    # Configuration
    config = Column(JSON)
    credentials = Column(JSON)
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Performance
    success_rate = Column(Float)
    last_used = Column(DateTime)
    usage_count = Column(Integer, default=0)
    
    # Ownership
    created_by = Column(Integer, ForeignKey("users.id"))
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    creator = relationship("User")
    
    def __repr__(self):
        return f"<PublishingChannel(id={self.id}, name={self.name})>"


class PublishingTemplate(Base):
    """Publishing template model"""
    __tablename__ = "publishing_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Template information
    name = Column(String(255), nullable=False)
    description = Column(Text)
    channel_type = Column(String(50), nullable=False)
    
    # Template content
    template_content = Column(Text)
    variables = Column(JSON)
    
    # Configuration
    default_config = Column(JSON)
    
    # Usage
    usage_count = Column(Integer, default=0)
    
    # Ownership
    created_by = Column(Integer, ForeignKey("users.id"))
    is_public = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    creator = relationship("User")
    
    def __repr__(self):
        return f"<PublishingTemplate(id={self.id}, name={self.name})>"


class PublishingCampaign(Base):
    """Publishing campaign model"""
    __tablename__ = "publishing_campaigns"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Campaign information
    name = Column(String(255), nullable=False)
    description = Column(Text)
    
    # Campaign settings
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    
    # Content
    content_items = Column(JSON)
    
    # Channels
    channels = Column(JSON)
    
    # Status
    status = Column(String(50), default="draft")
    
    # Performance
    total_publications = Column(Integer, default=0)
    successful_publications = Column(Integer, default=0)
    failed_publications = Column(Integer, default=0)
    
    # Ownership
    created_by = Column(Integer, ForeignKey("users.id"))
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    creator = relationship("User")
    
    def __repr__(self):
        return f"<PublishingCampaign(id={self.id}, name={self.name})>"


class PublishingAnalytics(Base):
    """Publishing analytics model"""
    __tablename__ = "publishing_analytics"
    
    id = Column(Integer, primary_key=True, index=True)
    publication_id = Column(Integer, ForeignKey("publications.id"))
    
    # Analytics data
    channel_type = Column(String(50))
    channel_id = Column(String(100))
    
    # Engagement metrics
    views = Column(Integer, default=0)
    clicks = Column(Integer, default=0)
    likes = Column(Integer, default=0)
    shares = Column(Integer, default=0)
    comments = Column(Integer, default=0)
    
    # Conversion metrics
    conversions = Column(Integer, default=0)
    conversion_rate = Column(Float)
    
    # Time-based metrics
    reach = Column(Integer, default=0)
    impressions = Column(Integer, default=0)
    
    # Additional metrics
    custom_metrics = Column(JSON)
    
    # Timestamps
    date = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    publication = relationship("Publication")
    
    def __repr__(self):
        return f"<PublishingAnalytics(publication_id={self.publication_id}, channel={self.channel_type})>"
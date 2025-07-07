"""
Content models for the EESystem Content Curation Platform
"""
from datetime import datetime
from typing import Optional, List
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, JSON, Float
from sqlalchemy.orm import relationship
from enum import Enum

from core.database import Base


class ContentType(str, Enum):
    """Content types"""
    ARTICLE = "article"
    BLOG_POST = "blog_post"
    SOCIAL_MEDIA = "social_media"
    EMAIL = "email"
    NEWSLETTER = "newsletter"
    REPORT = "report"
    PRESENTATION = "presentation"
    VIDEO_SCRIPT = "video_script"
    PODCAST_SCRIPT = "podcast_script"
    MARKETING_COPY = "marketing_copy"
    PRODUCT_DESCRIPTION = "product_description"
    PRESS_RELEASE = "press_release"
    CASE_STUDY = "case_study"
    WHITE_PAPER = "white_paper"
    FAQ = "faq"
    LANDING_PAGE = "landing_page"
    OTHER = "other"


class ContentStatus(str, Enum):
    """Content status"""
    DRAFT = "draft"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    PUBLISHED = "published"
    ARCHIVED = "archived"
    REJECTED = "rejected"


class Content(Base):
    """Content model"""
    __tablename__ = "content"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Basic information
    title = Column(String(500), nullable=False)
    slug = Column(String(200), unique=True, index=True)
    content_type = Column(String(50), nullable=False)
    status = Column(String(50), default=ContentStatus.DRAFT)
    
    # Content
    content_text = Column(Text)
    content_html = Column(Text)
    content_markdown = Column(Text)
    
    # Metadata
    summary = Column(Text)
    keywords = Column(Text)
    meta_description = Column(Text)
    
    # SEO
    seo_title = Column(String(200))
    seo_description = Column(Text)
    seo_keywords = Column(Text)
    
    # Publishing
    publish_date = Column(DateTime)
    expiry_date = Column(DateTime)
    
    # Authorship
    author_id = Column(Integer, ForeignKey("users.id"))
    reviewer_id = Column(Integer, ForeignKey("users.id"))
    
    # AI information
    ai_generated = Column(Boolean, default=False)
    ai_model_used = Column(String(100))
    ai_prompt = Column(Text)
    
    # Quality scores
    readability_score = Column(Float)
    sentiment_score = Column(Float)
    brand_compliance_score = Column(Float)
    
    # Engagement metrics
    views = Column(Integer, default=0)
    likes = Column(Integer, default=0)
    shares = Column(Integer, default=0)
    comments = Column(Integer, default=0)
    
    # Version control
    version = Column(Integer, default=1)
    parent_id = Column(Integer, ForeignKey("content.id"))
    
    # Additional metadata
    custom_fields = Column(JSON)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    author = relationship("User", foreign_keys=[author_id])
    reviewer = relationship("User", foreign_keys=[reviewer_id])
    tags = relationship("ContentTag", back_populates="content")
    versions = relationship("ContentVersion", back_populates="content")
    parent = relationship("Content", remote_side=[id])
    
    def __repr__(self):
        return f"<Content(id={self.id}, title={self.title}, type={self.content_type})>"
    
    @property
    def is_published(self):
        """Check if content is published"""
        return self.status == ContentStatus.PUBLISHED
    
    @property
    def word_count(self):
        """Get word count of content"""
        if self.content_text:
            return len(self.content_text.split())
        return 0
    
    @property
    def reading_time(self):
        """Estimate reading time in minutes"""
        words = self.word_count
        return max(1, round(words / 200))  # 200 words per minute


class ContentTag(Base):
    """Content tag model"""
    __tablename__ = "content_tags"
    
    id = Column(Integer, primary_key=True, index=True)
    content_id = Column(Integer, ForeignKey("content.id"), nullable=False)
    tag_name = Column(String(100), nullable=False)
    tag_type = Column(String(50), default="general")
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    content = relationship("Content", back_populates="tags")
    
    def __repr__(self):
        return f"<ContentTag(content_id={self.content_id}, tag={self.tag_name})>"


class ContentVersion(Base):
    """Content version model"""
    __tablename__ = "content_versions"
    
    id = Column(Integer, primary_key=True, index=True)
    content_id = Column(Integer, ForeignKey("content.id"), nullable=False)
    version_number = Column(Integer, nullable=False)
    
    # Version content
    title = Column(String(500))
    content_text = Column(Text)
    content_html = Column(Text)
    content_markdown = Column(Text)
    
    # Change information
    change_summary = Column(Text)
    changed_by = Column(Integer, ForeignKey("users.id"))
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    content = relationship("Content", back_populates="versions")
    changed_by_user = relationship("User")
    
    def __repr__(self):
        return f"<ContentVersion(content_id={self.content_id}, version={self.version_number})>"


class ContentTemplate(Base):
    """Content template model"""
    __tablename__ = "content_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Template information
    name = Column(String(200), nullable=False)
    description = Column(Text)
    content_type = Column(String(50), nullable=False)
    
    # Template content
    template_text = Column(Text)
    template_html = Column(Text)
    template_markdown = Column(Text)
    
    # Template variables
    variables = Column(JSON)
    
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
        return f"<ContentTemplate(id={self.id}, name={self.name})>"


class ContentCategory(Base):
    """Content category model"""
    __tablename__ = "content_categories"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Category information
    name = Column(String(200), nullable=False, unique=True)
    description = Column(Text)
    slug = Column(String(200), unique=True, index=True)
    
    # Hierarchy
    parent_id = Column(Integer, ForeignKey("content_categories.id"))
    
    # Display
    color = Column(String(7))  # Hex color code
    icon = Column(String(100))
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    parent = relationship("ContentCategory", remote_side=[id])
    
    def __repr__(self):
        return f"<ContentCategory(id={self.id}, name={self.name})>"
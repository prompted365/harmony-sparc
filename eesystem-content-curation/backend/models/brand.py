"""
Brand models for brand profile and compliance management
"""
from datetime import datetime
from typing import Optional, List
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, JSON, Float
from sqlalchemy.orm import relationship
from enum import Enum

from core.database import Base


class BrandProfile(Base):
    """Brand profile model"""
    __tablename__ = "brand_profiles"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Brand information
    name = Column(String(255), nullable=False)
    description = Column(Text)
    tagline = Column(String(500))
    
    # Brand identity
    logo_url = Column(String(500))
    brand_colors = Column(JSON)  # {"primary": "#000000", "secondary": "#ffffff"}
    fonts = Column(JSON)  # {"primary": "Arial", "secondary": "Times"}
    
    # Brand voice
    tone = Column(String(100))
    voice_description = Column(Text)
    personality_traits = Column(JSON)
    
    # Target audience
    target_audience = Column(JSON)
    demographics = Column(JSON)
    
    # Brand values
    mission = Column(Text)
    vision = Column(Text)
    values = Column(JSON)
    
    # Contact information
    website = Column(String(255))
    email = Column(String(255))
    phone = Column(String(50))
    
    # Social media
    social_media_handles = Column(JSON)
    
    # Industry
    industry = Column(String(100))
    categories = Column(JSON)
    
    # Ownership
    created_by = Column(Integer, ForeignKey("users.id"))
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    creator = relationship("User")
    guidelines = relationship("BrandGuidelines", back_populates="brand_profile")
    compliance_checks = relationship("BrandCompliance", back_populates="brand_profile")
    
    def __repr__(self):
        return f"<BrandProfile(id={self.id}, name={self.name})>"


class BrandGuidelines(Base):
    """Brand guidelines model"""
    __tablename__ = "brand_guidelines"
    
    id = Column(Integer, primary_key=True, index=True)
    brand_profile_id = Column(Integer, ForeignKey("brand_profiles.id"), nullable=False)
    
    # Guideline information
    name = Column(String(255), nullable=False)
    description = Column(Text)
    category = Column(String(100))
    
    # Guidelines content
    content = Column(Text, nullable=False)
    
    # Rules
    rules = Column(JSON)
    
    # Examples
    positive_examples = Column(JSON)
    negative_examples = Column(JSON)
    
    # Enforcement
    enforcement_level = Column(String(50), default="warning")  # strict, warning, suggestion
    
    # Usage
    usage_count = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    brand_profile = relationship("BrandProfile", back_populates="guidelines")
    
    def __repr__(self):
        return f"<BrandGuidelines(id={self.id}, name={self.name})>"


class BrandCompliance(Base):
    """Brand compliance check model"""
    __tablename__ = "brand_compliance"
    
    id = Column(Integer, primary_key=True, index=True)
    brand_profile_id = Column(Integer, ForeignKey("brand_profiles.id"), nullable=False)
    
    # Content being checked
    content_id = Column(Integer, ForeignKey("content.id"))
    content_type = Column(String(50))
    content_text = Column(Text)
    
    # Compliance results
    overall_score = Column(Float)
    compliance_status = Column(String(50))  # compliant, non_compliant, warning
    
    # Detailed results
    guideline_scores = Column(JSON)
    violations = Column(JSON)
    suggestions = Column(JSON)
    
    # AI analysis
    ai_analysis = Column(JSON)
    confidence_score = Column(Float)
    
    # Review
    reviewed_by = Column(Integer, ForeignKey("users.id"))
    review_notes = Column(Text)
    reviewed_at = Column(DateTime)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    brand_profile = relationship("BrandProfile", back_populates="compliance_checks")
    content = relationship("Content")
    reviewer = relationship("User")
    
    def __repr__(self):
        return f"<BrandCompliance(id={self.id}, status={self.compliance_status})>"
    
    @property
    def is_compliant(self):
        """Check if content is compliant"""
        return self.compliance_status == "compliant"


class BrandKeyword(Base):
    """Brand keyword model"""
    __tablename__ = "brand_keywords"
    
    id = Column(Integer, primary_key=True, index=True)
    brand_profile_id = Column(Integer, ForeignKey("brand_profiles.id"), nullable=False)
    
    # Keyword information
    keyword = Column(String(255), nullable=False)
    category = Column(String(100))
    
    # Usage preference
    preference = Column(String(50))  # preferred, avoid, neutral
    
    # Context
    context = Column(Text)
    alternatives = Column(JSON)
    
    # Usage tracking
    usage_count = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    brand_profile = relationship("BrandProfile")
    
    def __repr__(self):
        return f"<BrandKeyword(keyword={self.keyword}, preference={self.preference})>"


class BrandTemplate(Base):
    """Brand template model"""
    __tablename__ = "brand_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    brand_profile_id = Column(Integer, ForeignKey("brand_profiles.id"), nullable=False)
    
    # Template information
    name = Column(String(255), nullable=False)
    description = Column(Text)
    template_type = Column(String(50))
    
    # Template content
    template_content = Column(Text)
    variables = Column(JSON)
    
    # Usage
    usage_count = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    brand_profile = relationship("BrandProfile")
    
    def __repr__(self):
        return f"<BrandTemplate(id={self.id}, name={self.name})>"


class BrandAsset(Base):
    """Brand asset model"""
    __tablename__ = "brand_assets"
    
    id = Column(Integer, primary_key=True, index=True)
    brand_profile_id = Column(Integer, ForeignKey("brand_profiles.id"), nullable=False)
    
    # Asset information
    name = Column(String(255), nullable=False)
    description = Column(Text)
    asset_type = Column(String(50))  # logo, image, video, document
    
    # File information
    file_url = Column(String(500))
    file_path = Column(String(500))
    file_size = Column(Integer)
    mime_type = Column(String(100))
    
    # Usage guidelines
    usage_guidelines = Column(Text)
    
    # Access control
    is_public = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    brand_profile = relationship("BrandProfile")
    
    def __repr__(self):
        return f"<BrandAsset(id={self.id}, name={self.name})>"
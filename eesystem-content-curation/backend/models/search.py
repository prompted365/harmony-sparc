"""
Search models for indexing and search functionality
"""
from datetime import datetime
from typing import Optional, List
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, JSON, Float
from sqlalchemy.orm import relationship
from enum import Enum

from core.database import Base


class IndexType(str, Enum):
    """Search index types"""
    CONTENT = "content"
    DOCUMENT = "document"
    USER = "user"
    AGENT = "agent"
    BRAND = "brand"
    KNOWLEDGE = "knowledge"
    FULL_TEXT = "full_text"
    VECTOR = "vector"
    HYBRID = "hybrid"


class SearchIndex(Base):
    """Search index model"""
    __tablename__ = "search_indexes"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Index information
    name = Column(String(255), nullable=False, unique=True)
    description = Column(Text)
    index_type = Column(String(50), nullable=False)
    
    # Index configuration
    config = Column(JSON)
    schema = Column(JSON)
    
    # Status
    status = Column(String(50), default="active")
    is_active = Column(Boolean, default=True)
    
    # Statistics
    document_count = Column(Integer, default=0)
    size_bytes = Column(Integer, default=0)
    last_updated = Column(DateTime)
    
    # Performance
    average_query_time = Column(Float)
    
    # Ownership
    created_by = Column(Integer, ForeignKey("users.id"))
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    creator = relationship("User")
    documents = relationship("SearchDocument", back_populates="index")
    
    def __repr__(self):
        return f"<SearchIndex(id={self.id}, name={self.name})>"


class SearchDocument(Base):
    """Search document model"""
    __tablename__ = "search_documents"
    
    id = Column(Integer, primary_key=True, index=True)
    index_id = Column(Integer, ForeignKey("search_indexes.id"), nullable=False)
    
    # Document identification
    document_id = Column(String(255), nullable=False)
    document_type = Column(String(50))
    
    # Content
    title = Column(String(500))
    content = Column(Text)
    summary = Column(Text)
    
    # Metadata
    metadata = Column(JSON)
    
    # Indexing
    indexed_at = Column(DateTime, default=datetime.utcnow)
    index_version = Column(String(50))
    
    # Vector embedding
    embedding_vector = Column(JSON)
    embedding_model = Column(String(100))
    
    # Source reference
    source_table = Column(String(100))
    source_id = Column(Integer)
    
    # Relationships
    index = relationship("SearchIndex", back_populates="documents")
    
    def __repr__(self):
        return f"<SearchDocument(id={self.id}, document_id={self.document_id})>"


class SearchQuery(Base):
    """Search query model"""
    __tablename__ = "search_queries"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Query information
    query_text = Column(Text, nullable=False)
    query_type = Column(String(50), default="text")
    
    # Query parameters
    filters = Column(JSON)
    sort_by = Column(JSON)
    limit = Column(Integer, default=10)
    offset = Column(Integer, default=0)
    
    # Vector query (if applicable)
    query_vector = Column(JSON)
    similarity_threshold = Column(Float)
    
    # Index
    index_name = Column(String(255))
    
    # Results
    total_results = Column(Integer)
    returned_results = Column(Integer)
    
    # Performance
    execution_time = Column(Float)
    
    # User context
    user_id = Column(Integer, ForeignKey("users.id"))
    session_id = Column(String(255))
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User")
    results = relationship("SearchResult", back_populates="query")
    
    def __repr__(self):
        return f"<SearchQuery(id={self.id}, query={self.query_text[:50]})>"


class SearchResult(Base):
    """Search result model"""
    __tablename__ = "search_results"
    
    id = Column(Integer, primary_key=True, index=True)
    query_id = Column(Integer, ForeignKey("search_queries.id"), nullable=False)
    
    # Result information
    document_id = Column(String(255), nullable=False)
    rank = Column(Integer, nullable=False)
    score = Column(Float)
    
    # Content
    title = Column(String(500))
    snippet = Column(Text)
    
    # Metadata
    metadata = Column(JSON)
    
    # Source
    source_table = Column(String(100))
    source_id = Column(Integer)
    
    # User interaction
    clicked = Column(Boolean, default=False)
    clicked_at = Column(DateTime)
    
    # Relationships
    query = relationship("SearchQuery", back_populates="results")
    
    def __repr__(self):
        return f"<SearchResult(id={self.id}, document_id={self.document_id}, score={self.score})>"


class SearchFacet(Base):
    """Search facet model"""
    __tablename__ = "search_facets"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Facet information
    name = Column(String(255), nullable=False)
    field = Column(String(255), nullable=False)
    facet_type = Column(String(50), default="terms")
    
    # Configuration
    config = Column(JSON)
    
    # Index association
    index_name = Column(String(255))
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<SearchFacet(name={self.name}, field={self.field})>"


class SearchSuggestion(Base):
    """Search suggestion model"""
    __tablename__ = "search_suggestions"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Suggestion information
    suggestion = Column(String(255), nullable=False)
    original_query = Column(String(255))
    
    # Type
    suggestion_type = Column(String(50), default="completion")
    
    # Popularity
    frequency = Column(Integer, default=1)
    
    # Context
    context = Column(JSON)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<SearchSuggestion(suggestion={self.suggestion})>"


class SearchAnalytics(Base):
    """Search analytics model"""
    __tablename__ = "search_analytics"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Query information
    query_text = Column(Text)
    query_hash = Column(String(64), index=True)
    
    # Results
    total_results = Column(Integer)
    clicked_results = Column(Integer, default=0)
    
    # Performance
    execution_time = Column(Float)
    
    # User context
    user_id = Column(Integer, ForeignKey("users.id"))
    session_id = Column(String(255))
    
    # Analytics
    click_through_rate = Column(Float)
    bounce_rate = Column(Float)
    
    # Date
    date = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User")
    
    def __repr__(self):
        return f"<SearchAnalytics(query_hash={self.query_hash}, results={self.total_results})>"


class SavedSearch(Base):
    """Saved search model"""
    __tablename__ = "saved_searches"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Search information
    name = Column(String(255), nullable=False)
    description = Column(Text)
    
    # Query
    query_text = Column(Text, nullable=False)
    filters = Column(JSON)
    
    # Configuration
    config = Column(JSON)
    
    # Notifications
    notify_on_new_results = Column(Boolean, default=False)
    last_notification = Column(DateTime)
    
    # Ownership
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Access
    is_public = Column(Boolean, default=False)
    
    # Usage
    usage_count = Column(Integer, default=0)
    last_used = Column(DateTime)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User")
    
    def __repr__(self):
        return f"<SavedSearch(id={self.id}, name={self.name})>"
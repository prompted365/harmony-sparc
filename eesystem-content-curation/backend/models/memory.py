"""
Memory models for persistent storage and context management
"""
from datetime import datetime
from typing import Optional, List
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, JSON, Float
from sqlalchemy.orm import relationship
from enum import Enum

from core.database import Base


class MemoryType(str, Enum):
    """Memory types"""
    USER_CONTEXT = "user_context"
    CONTENT_CONTEXT = "content_context"
    AGENT_MEMORY = "agent_memory"
    SESSION_STATE = "session_state"
    WORKFLOW_STATE = "workflow_state"
    SYSTEM_STATE = "system_state"
    CONVERSATION = "conversation"
    KNOWLEDGE = "knowledge"
    PREFERENCES = "preferences"
    CACHE = "cache"
    CUSTOM = "custom"


class Memory(Base):
    """Memory model for persistent storage"""
    __tablename__ = "memories"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Memory identification
    key = Column(String(255), nullable=False, index=True)
    memory_type = Column(String(50), nullable=False)
    namespace = Column(String(100), default="default")
    
    # Memory content
    value = Column(JSON)
    text_value = Column(Text)
    binary_value = Column(Text)  # Base64 encoded
    
    # Context
    context = Column(JSON)
    tags = Column(JSON)
    
    # Ownership
    user_id = Column(Integer, ForeignKey("users.id"))
    agent_id = Column(Integer, ForeignKey("agents.id"))
    
    # Access control
    is_public = Column(Boolean, default=False)
    access_level = Column(String(50), default="private")
    
    # Retention
    expires_at = Column(DateTime)
    auto_expire = Column(Boolean, default=False)
    retention_days = Column(Integer)
    
    # Importance and priority
    importance = Column(Integer, default=5)  # 1-10 scale
    priority = Column(Integer, default=5)
    
    # Usage tracking
    access_count = Column(Integer, default=0)
    last_accessed = Column(DateTime)
    
    # Version control
    version = Column(Integer, default=1)
    parent_id = Column(Integer, ForeignKey("memories.id"))
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User")
    agent = relationship("Agent")
    parent = relationship("Memory", remote_side=[id])
    contexts = relationship("MemoryContext", back_populates="memory")
    
    def __repr__(self):
        return f"<Memory(id={self.id}, key={self.key}, type={self.memory_type})>"
    
    @property
    def is_expired(self):
        """Check if memory is expired"""
        if self.expires_at:
            return datetime.utcnow() > self.expires_at
        return False


class MemoryContext(Base):
    """Memory context model for contextual information"""
    __tablename__ = "memory_contexts"
    
    id = Column(Integer, primary_key=True, index=True)
    memory_id = Column(Integer, ForeignKey("memories.id"), nullable=False)
    
    # Context information
    context_type = Column(String(50), nullable=False)
    context_key = Column(String(255), nullable=False)
    context_value = Column(JSON)
    
    # Metadata
    metadata = Column(JSON)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    memory = relationship("Memory", back_populates="contexts")
    
    def __repr__(self):
        return f"<MemoryContext(memory_id={self.memory_id}, type={self.context_type})>"


class ConversationMemory(Base):
    """Conversation memory model"""
    __tablename__ = "conversation_memories"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Conversation identification
    conversation_id = Column(String(255), nullable=False, index=True)
    session_id = Column(String(255))
    
    # Message information
    message_index = Column(Integer, nullable=False)
    role = Column(String(50), nullable=False)  # user, assistant, system
    content = Column(Text, nullable=False)
    
    # Context
    context = Column(JSON)
    metadata = Column(JSON)
    
    # Ownership
    user_id = Column(Integer, ForeignKey("users.id"))
    agent_id = Column(Integer, ForeignKey("agents.id"))
    
    # Timestamps
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User")
    agent = relationship("Agent")
    
    def __repr__(self):
        return f"<ConversationMemory(conversation_id={self.conversation_id}, role={self.role})>"


class KnowledgeBase(Base):
    """Knowledge base model"""
    __tablename__ = "knowledge_base"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Knowledge information
    title = Column(String(500), nullable=False)
    content = Column(Text, nullable=False)
    summary = Column(Text)
    
    # Classification
    category = Column(String(100))
    tags = Column(JSON)
    
    # Source
    source_type = Column(String(50))
    source_url = Column(String(500))
    source_document_id = Column(Integer, ForeignKey("documents.id"))
    
    # Quality
    confidence_score = Column(Float)
    verified = Column(Boolean, default=False)
    verified_by = Column(Integer, ForeignKey("users.id"))
    
    # Usage
    access_count = Column(Integer, default=0)
    last_accessed = Column(DateTime)
    
    # Vector embedding
    embedding_vector = Column(JSON)
    embedding_model = Column(String(100))
    
    # Ownership
    created_by = Column(Integer, ForeignKey("users.id"))
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    source_document = relationship("Document")
    verifier = relationship("User", foreign_keys=[verified_by])
    creator = relationship("User", foreign_keys=[created_by])
    
    def __repr__(self):
        return f"<KnowledgeBase(id={self.id}, title={self.title})>"


class SessionState(Base):
    """Session state model"""
    __tablename__ = "session_states"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Session identification
    session_id = Column(String(255), nullable=False, unique=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    # State data
    state = Column(JSON)
    
    # Metadata
    metadata = Column(JSON)
    
    # Expiration
    expires_at = Column(DateTime)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_accessed = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User")
    
    def __repr__(self):
        return f"<SessionState(session_id={self.session_id})>"


class WorkflowState(Base):
    """Workflow state model"""
    __tablename__ = "workflow_states"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Workflow identification
    workflow_id = Column(String(255), nullable=False, index=True)
    workflow_name = Column(String(255))
    
    # State information
    current_step = Column(String(255))
    step_index = Column(Integer, default=0)
    total_steps = Column(Integer)
    
    # State data
    state_data = Column(JSON)
    
    # Progress
    progress = Column(Float, default=0.0)
    status = Column(String(50), default="running")
    
    # Context
    context = Column(JSON)
    
    # Ownership
    user_id = Column(Integer, ForeignKey("users.id"))
    agent_id = Column(Integer, ForeignKey("agents.id"))
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User")
    agent = relationship("Agent")
    
    def __repr__(self):
        return f"<WorkflowState(workflow_id={self.workflow_id}, step={self.current_step})>"


class CacheEntry(Base):
    """Cache entry model"""
    __tablename__ = "cache_entries"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Cache key
    key = Column(String(255), nullable=False, unique=True, index=True)
    namespace = Column(String(100), default="default")
    
    # Cache data
    value = Column(JSON)
    data_type = Column(String(50))
    
    # Metadata
    metadata = Column(JSON)
    tags = Column(JSON)
    
    # Expiration
    expires_at = Column(DateTime)
    ttl_seconds = Column(Integer)
    
    # Usage
    hit_count = Column(Integer, default=0)
    last_hit = Column(DateTime)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<CacheEntry(key={self.key}, namespace={self.namespace})>"
    
    @property
    def is_expired(self):
        """Check if cache entry is expired"""
        if self.expires_at:
            return datetime.utcnow() > self.expires_at
        return False
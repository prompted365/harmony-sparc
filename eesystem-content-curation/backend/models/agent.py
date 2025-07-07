"""
Agent models for AI agent coordination and task management
"""
from datetime import datetime
from typing import Optional, List
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, JSON, Float
from sqlalchemy.orm import relationship
from enum import Enum

from core.database import Base


class AgentType(str, Enum):
    """AI agent types"""
    CONTENT_GENERATOR = "content_generator"
    CONTENT_EDITOR = "content_editor"
    RESEARCHER = "researcher"
    FACT_CHECKER = "fact_checker"
    SEO_OPTIMIZER = "seo_optimizer"
    BRAND_COMPLIANCE = "brand_compliance"
    SOCIAL_MEDIA = "social_media"
    TRANSLATOR = "translator"
    SUMMARIZER = "summarizer"
    ANALYST = "analyst"
    SCHEDULER = "scheduler"
    COORDINATOR = "coordinator"
    CUSTOM = "custom"


class AgentStatus(str, Enum):
    """Agent status"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    BUSY = "busy"
    ERROR = "error"
    MAINTENANCE = "maintenance"


class TaskStatus(str, Enum):
    """Task status"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    PAUSED = "paused"


class Agent(Base):
    """AI agent model"""
    __tablename__ = "agents"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Agent information
    name = Column(String(255), nullable=False)
    description = Column(Text)
    agent_type = Column(String(50), nullable=False)
    status = Column(String(50), default=AgentStatus.ACTIVE)
    
    # AI model configuration
    model_name = Column(String(100))
    model_version = Column(String(50))
    provider = Column(String(50))
    
    # Configuration
    config = Column(JSON)
    system_prompt = Column(Text)
    temperature = Column(Float, default=0.7)
    max_tokens = Column(Integer, default=2048)
    
    # Capabilities
    capabilities = Column(JSON)
    supported_formats = Column(JSON)
    
    # Performance metrics
    tasks_completed = Column(Integer, default=0)
    average_response_time = Column(Float)
    success_rate = Column(Float)
    
    # Ownership and access
    owner_id = Column(Integer, ForeignKey("users.id"))
    is_public = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_active = Column(DateTime)
    
    # Relationships
    owner = relationship("User", back_populates="agents")
    tasks = relationship("AgentTask", back_populates="agent")
    capabilities_rel = relationship("AgentCapability", back_populates="agent")
    memories = relationship("AgentMemory", back_populates="agent")
    
    def __repr__(self):
        return f"<Agent(id={self.id}, name={self.name}, type={self.agent_type})>"
    
    @property
    def is_available(self):
        """Check if agent is available for tasks"""
        return self.status == AgentStatus.ACTIVE
    
    @property
    def current_tasks(self):
        """Get current running tasks"""
        return [task for task in self.tasks if task.status == TaskStatus.RUNNING]


class AgentTask(Base):
    """Agent task model"""
    __tablename__ = "agent_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False)
    
    # Task information
    task_type = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    status = Column(String(50), default=TaskStatus.PENDING)
    
    # Task data
    input_data = Column(JSON)
    output_data = Column(JSON)
    
    # Execution
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    execution_time = Column(Float)
    
    # Error handling
    error_message = Column(Text)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    
    # Priority and scheduling
    priority = Column(Integer, default=5)
    scheduled_at = Column(DateTime)
    
    # Context
    context = Column(JSON)
    parent_task_id = Column(Integer, ForeignKey("agent_tasks.id"))
    
    # Ownership
    created_by = Column(Integer, ForeignKey("users.id"))
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    agent = relationship("Agent", back_populates="tasks")
    creator = relationship("User")
    parent_task = relationship("AgentTask", remote_side=[id])
    
    def __repr__(self):
        return f"<AgentTask(id={self.id}, agent_id={self.agent_id}, type={self.task_type})>"
    
    @property
    def is_completed(self):
        """Check if task is completed"""
        return self.status == TaskStatus.COMPLETED
    
    @property
    def is_running(self):
        """Check if task is running"""
        return self.status == TaskStatus.RUNNING


class AgentCapability(Base):
    """Agent capability model"""
    __tablename__ = "agent_capabilities"
    
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False)
    
    # Capability information
    name = Column(String(100), nullable=False)
    description = Column(Text)
    capability_type = Column(String(50))
    
    # Configuration
    parameters = Column(JSON)
    
    # Performance
    usage_count = Column(Integer, default=0)
    success_rate = Column(Float)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    agent = relationship("Agent", back_populates="capabilities_rel")
    
    def __repr__(self):
        return f"<AgentCapability(agent_id={self.agent_id}, name={self.name})>"


class AgentMemory(Base):
    """Agent memory model"""
    __tablename__ = "agent_memories"
    
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False)
    
    # Memory information
    memory_type = Column(String(50), nullable=False)
    key = Column(String(255), nullable=False)
    value = Column(JSON)
    
    # Context
    context = Column(JSON)
    tags = Column(JSON)
    
    # Retention
    expires_at = Column(DateTime)
    importance = Column(Integer, default=5)
    
    # Usage
    access_count = Column(Integer, default=0)
    last_accessed = Column(DateTime)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    agent = relationship("Agent", back_populates="memories")
    
    def __repr__(self):
        return f"<AgentMemory(agent_id={self.agent_id}, key={self.key})>"


class AgentWorkflow(Base):
    """Agent workflow model"""
    __tablename__ = "agent_workflows"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Workflow information
    name = Column(String(255), nullable=False)
    description = Column(Text)
    version = Column(String(50), default="1.0")
    
    # Workflow definition
    workflow_definition = Column(JSON)
    
    # Agents involved
    agents = Column(JSON)
    
    # Execution
    is_active = Column(Boolean, default=True)
    
    # Ownership
    created_by = Column(Integer, ForeignKey("users.id"))
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    creator = relationship("User")
    
    def __repr__(self):
        return f"<AgentWorkflow(id={self.id}, name={self.name})>"


class AgentCoordination(Base):
    """Agent coordination model"""
    __tablename__ = "agent_coordinations"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Coordination information
    name = Column(String(255), nullable=False)
    description = Column(Text)
    coordination_type = Column(String(50))
    
    # Participating agents
    agents = Column(JSON)
    
    # Coordination rules
    rules = Column(JSON)
    
    # Status
    status = Column(String(50), default="active")
    
    # Performance
    success_rate = Column(Float)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<AgentCoordination(id={self.id}, name={self.name})>"
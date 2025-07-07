"""
Document models for file management and processing
"""
from datetime import datetime
from typing import Optional, List
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, JSON, Float, LargeBinary
from sqlalchemy.orm import relationship
from enum import Enum

from core.database import Base


class DocumentType(str, Enum):
    """Document types"""
    PDF = "pdf"
    DOCX = "docx"
    TXT = "txt"
    MD = "md"
    HTML = "html"
    JSON = "json"
    CSV = "csv"
    XML = "xml"
    XLSX = "xlsx"
    PPTX = "pptx"
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    OTHER = "other"


class ProcessingStatus(str, Enum):
    """Document processing status"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class Document(Base):
    """Document model"""
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # File information
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(100), nullable=False)
    document_type = Column(String(50), nullable=False)
    
    # File hash for deduplication
    file_hash = Column(String(64), index=True)
    
    # Processing
    processing_status = Column(String(50), default=ProcessingStatus.PENDING)
    processing_error = Column(Text)
    processing_started_at = Column(DateTime)
    processing_completed_at = Column(DateTime)
    
    # Content extraction
    extracted_text = Column(Text)
    extracted_metadata = Column(JSON)
    
    # AI analysis
    ai_summary = Column(Text)
    ai_keywords = Column(Text)
    ai_topics = Column(JSON)
    sentiment_analysis = Column(JSON)
    
    # Vector embeddings
    embedding_model = Column(String(100))
    embedding_dimension = Column(Integer)
    
    # Ownership
    uploaded_by = Column(Integer, ForeignKey("users.id"))
    
    # Access control
    is_public = Column(Boolean, default=False)
    access_level = Column(String(50), default="private")
    
    # Version control
    version = Column(Integer, default=1)
    parent_id = Column(Integer, ForeignKey("documents.id"))
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    uploader = relationship("User")
    metadata = relationship("DocumentMetadata", back_populates="document")
    chunks = relationship("DocumentChunk", back_populates="document")
    parent = relationship("Document", remote_side=[id])
    
    def __repr__(self):
        return f"<Document(id={self.id}, filename={self.filename})>"
    
    @property
    def file_size_mb(self):
        """Get file size in MB"""
        return round(self.file_size / (1024 * 1024), 2)
    
    @property
    def is_processed(self):
        """Check if document is processed"""
        return self.processing_status == ProcessingStatus.COMPLETED
    
    @property
    def is_text_document(self):
        """Check if document contains text"""
        return self.document_type in [DocumentType.PDF, DocumentType.DOCX, DocumentType.TXT, DocumentType.MD, DocumentType.HTML]


class DocumentMetadata(Base):
    """Document metadata model"""
    __tablename__ = "document_metadata"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    
    # Document properties
    title = Column(String(500))
    author = Column(String(255))
    subject = Column(String(500))
    creator = Column(String(255))
    producer = Column(String(255))
    creation_date = Column(DateTime)
    modification_date = Column(DateTime)
    
    # Content analysis
    page_count = Column(Integer)
    word_count = Column(Integer)
    character_count = Column(Integer)
    language = Column(String(10))
    
    # AI-generated metadata
    ai_title = Column(String(500))
    ai_description = Column(Text)
    ai_category = Column(String(100))
    ai_confidence = Column(Float)
    
    # Custom metadata
    custom_fields = Column(JSON)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    document = relationship("Document", back_populates="metadata")
    
    def __repr__(self):
        return f"<DocumentMetadata(document_id={self.document_id})>"


class DocumentChunk(Base):
    """Document chunk model for vector search"""
    __tablename__ = "document_chunks"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    
    # Chunk information
    chunk_index = Column(Integer, nullable=False)
    chunk_text = Column(Text, nullable=False)
    chunk_size = Column(Integer, nullable=False)
    
    # Position in document
    start_position = Column(Integer)
    end_position = Column(Integer)
    page_number = Column(Integer)
    
    # Vector embedding
    embedding_vector = Column(JSON)  # Stored as JSON array
    embedding_model = Column(String(100))
    
    # Metadata
    chunk_type = Column(String(50), default="text")
    metadata = Column(JSON)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    document = relationship("Document", back_populates="chunks")
    
    def __repr__(self):
        return f"<DocumentChunk(document_id={self.document_id}, index={self.chunk_index})>"
    
    @property
    def word_count(self):
        """Get word count of chunk"""
        return len(self.chunk_text.split())


class DocumentCollection(Base):
    """Document collection model"""
    __tablename__ = "document_collections"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Collection information
    name = Column(String(255), nullable=False)
    description = Column(Text)
    
    # Ownership
    created_by = Column(Integer, ForeignKey("users.id"))
    
    # Access control
    is_public = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    creator = relationship("User")
    
    def __repr__(self):
        return f"<DocumentCollection(id={self.id}, name={self.name})>"


class DocumentCollectionItem(Base):
    """Document collection item model"""
    __tablename__ = "document_collection_items"
    
    id = Column(Integer, primary_key=True, index=True)
    collection_id = Column(Integer, ForeignKey("document_collections.id"), nullable=False)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    
    # Item metadata
    added_by = Column(Integer, ForeignKey("users.id"))
    notes = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    collection = relationship("DocumentCollection")
    document = relationship("Document")
    added_by_user = relationship("User")
    
    def __repr__(self):
        return f"<DocumentCollectionItem(collection_id={self.collection_id}, document_id={self.document_id})>"


class DocumentProcessingJob(Base):
    """Document processing job model"""
    __tablename__ = "document_processing_jobs"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    
    # Job information
    job_type = Column(String(50), nullable=False)
    status = Column(String(50), default=ProcessingStatus.PENDING)
    
    # Progress
    progress = Column(Float, default=0.0)
    current_step = Column(String(100))
    total_steps = Column(Integer)
    
    # Results
    result = Column(JSON)
    error_message = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    
    # Relationships
    document = relationship("Document")
    
    def __repr__(self):
        return f"<DocumentProcessingJob(id={self.id}, document_id={self.document_id}, type={self.job_type})>"
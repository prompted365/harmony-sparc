"""
Document management API routes
"""
import os
import hashlib
from datetime import datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, or_
from pydantic import BaseModel
import aiofiles
import structlog

from core.database import get_db
from core.security import get_current_user_payload, require_permission, Permission
from core.exceptions import NotFoundError, ValidationError, FileUploadError
from core.config import settings
from models.document import Document, DocumentType, ProcessingStatus, DocumentMetadata

logger = structlog.get_logger(__name__)

router = APIRouter()


# Response models
class DocumentResponse(BaseModel):
    id: int
    filename: str
    original_filename: str
    file_size: int
    mime_type: str
    document_type: str
    processing_status: str
    uploaded_by: Optional[int]
    created_at: datetime
    
    class Config:
        from_attributes = True


class DocumentDetailResponse(DocumentResponse):
    extracted_text: Optional[str]
    ai_summary: Optional[str]
    ai_keywords: Optional[str]
    sentiment_analysis: Optional[Dict[str, Any]]
    processing_error: Optional[str]


@router.post("/documents/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(require_permission(Permission.WRITE_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> DocumentResponse:
    """
    Upload a document
    """
    try:
        user_id = int(current_user["sub"])
        
        # Validate file
        if not file.filename:
            raise FileUploadError("No file provided")
        
        # Check file size
        content = await file.read()
        if len(content) > settings.MAX_FILE_SIZE:
            raise FileUploadError(f"File too large. Maximum size: {settings.MAX_FILE_SIZE / (1024*1024):.1f}MB")
        
        # Check file type
        file_extension = file.filename.split('.')[-1].lower()
        if file_extension not in settings.ALLOWED_FILE_TYPES:
            raise FileUploadError(f"File type not allowed. Allowed types: {', '.join(settings.ALLOWED_FILE_TYPES)}")
        
        # Generate file hash for deduplication
        file_hash = hashlib.sha256(content).hexdigest()
        
        # Check if file already exists
        result = await db.execute(select(Document).where(Document.file_hash == file_hash))
        existing_doc = result.scalar_one_or_none()
        
        if existing_doc:
            return DocumentResponse.from_orm(existing_doc)
        
        # Create upload directory if it doesn't exist
        upload_dir = settings.UPLOAD_DIR
        os.makedirs(upload_dir, exist_ok=True)
        
        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_filename = f"{timestamp}_{file.filename}"
        file_path = os.path.join(upload_dir, safe_filename)
        
        # Save file
        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(content)
        
        # Create document record
        document = Document(
            filename=safe_filename,
            original_filename=file.filename,
            file_path=file_path,
            file_size=len(content),
            mime_type=file.content_type or "application/octet-stream",
            document_type=file_extension,
            file_hash=file_hash,
            uploaded_by=user_id,
            processing_status=ProcessingStatus.PENDING
        )
        
        db.add(document)
        await db.commit()
        await db.refresh(document)
        
        # TODO: Trigger background processing task
        # await process_document_task.delay(document.id)
        
        logger.info(f"Document uploaded: {document.id} by user {user_id}")
        
        return DocumentResponse.from_orm(document)
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Document upload failed: {e}")
        raise


@router.get("/documents", response_model=List[DocumentResponse])
async def list_documents(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    document_type: Optional[str] = None,
    processing_status: Optional[str] = None,
    uploaded_by: Optional[int] = None,
    search: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.READ_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> List[DocumentResponse]:
    """
    List documents with filters
    """
    try:
        query = select(Document)
        
        # Apply filters
        filters = []
        
        if document_type:
            filters.append(Document.document_type == document_type)
        
        if processing_status:
            filters.append(Document.processing_status == processing_status)
        
        if uploaded_by:
            filters.append(Document.uploaded_by == uploaded_by)
        
        if search:
            search_filter = or_(
                Document.original_filename.ilike(f"%{search}%"),
                Document.extracted_text.ilike(f"%{search}%"),
                Document.ai_summary.ilike(f"%{search}%")
            )
            filters.append(search_filter)
        
        if filters:
            query = query.where(and_(*filters))
        
        # Apply pagination
        query = query.offset(skip).limit(limit).order_by(Document.created_at.desc())
        
        result = await db.execute(query)
        documents = result.scalars().all()
        
        return [DocumentResponse.from_orm(doc) for doc in documents]
        
    except Exception as e:
        logger.error(f"Document listing failed: {e}")
        raise


@router.get("/documents/{document_id}", response_model=DocumentDetailResponse)
async def get_document(
    document_id: int,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.READ_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> DocumentDetailResponse:
    """
    Get document by ID
    """
    try:
        result = await db.execute(select(Document).where(Document.id == document_id))
        document = result.scalar_one_or_none()
        
        if not document:
            raise NotFoundError("Document not found")
        
        return DocumentDetailResponse.from_orm(document)
        
    except Exception as e:
        logger.error(f"Get document failed: {e}")
        raise


@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: int,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.DELETE_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, str]:
    """
    Delete document
    """
    try:
        user_id = int(current_user["sub"])
        
        # Get document
        result = await db.execute(select(Document).where(Document.id == document_id))
        document = result.scalar_one_or_none()
        
        if not document:
            raise NotFoundError("Document not found")
        
        # Check permissions (uploader or admin can delete)
        if document.uploaded_by != user_id and current_user.get("role") != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete this document"
            )
        
        # Delete file from filesystem
        try:
            if os.path.exists(document.file_path):
                os.remove(document.file_path)
        except Exception as e:
            logger.warning(f"Failed to delete file {document.file_path}: {e}")
        
        # Delete database record
        await db.execute(delete(Document).where(Document.id == document_id))
        await db.commit()
        
        logger.info(f"Document deleted: {document_id} by user {user_id}")
        
        return {"message": "Document deleted successfully"}
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Document deletion failed: {e}")
        raise


@router.post("/documents/{document_id}/process")
async def process_document(
    document_id: int,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.WRITE_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, str]:
    """
    Trigger document processing
    """
    try:
        result = await db.execute(select(Document).where(Document.id == document_id))
        document = result.scalar_one_or_none()
        
        if not document:
            raise NotFoundError("Document not found")
        
        if document.processing_status == ProcessingStatus.PROCESSING:
            return {"message": "Document is already being processed"}
        
        # Update status
        document.processing_status = ProcessingStatus.PROCESSING
        document.processing_started_at = datetime.utcnow()
        
        await db.commit()
        
        # TODO: Trigger background processing task
        # await process_document_task.delay(document_id)
        
        return {"message": "Document processing started"}
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Document processing trigger failed: {e}")
        raise


@router.get("/documents/{document_id}/download")
async def download_document(
    document_id: int,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.READ_CONTENT)),
    db: AsyncSession = Depends(get_db)
):
    """
    Download document file
    """
    try:
        result = await db.execute(select(Document).where(Document.id == document_id))
        document = result.scalar_one_or_none()
        
        if not document:
            raise NotFoundError("Document not found")
        
        if not os.path.exists(document.file_path):
            raise NotFoundError("Document file not found on disk")
        
        from fastapi.responses import FileResponse
        
        return FileResponse(
            path=document.file_path,
            filename=document.original_filename,
            media_type=document.mime_type
        )
        
    except Exception as e:
        logger.error(f"Document download failed: {e}")
        raise
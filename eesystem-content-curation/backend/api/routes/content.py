"""
Content management API routes
"""
from datetime import datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, or_
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
import structlog

from core.database import get_db
from core.security import get_current_user_payload, require_permission, Permission
from core.exceptions import NotFoundError, ValidationError, AuthorizationError
from models.content import Content, ContentType, ContentStatus, ContentTag, ContentVersion

logger = structlog.get_logger(__name__)

router = APIRouter()


# Request/Response models
class ContentCreate(BaseModel):
    title: str
    content_type: ContentType
    content_text: Optional[str] = None
    content_html: Optional[str] = None
    content_markdown: Optional[str] = None
    summary: Optional[str] = None
    keywords: Optional[str] = None
    meta_description: Optional[str] = None
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    seo_keywords: Optional[str] = None
    tags: Optional[List[str]] = []
    custom_fields: Optional[Dict[str, Any]] = {}


class ContentUpdate(BaseModel):
    title: Optional[str] = None
    content_text: Optional[str] = None
    content_html: Optional[str] = None
    content_markdown: Optional[str] = None
    summary: Optional[str] = None
    keywords: Optional[str] = None
    meta_description: Optional[str] = None
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    seo_keywords: Optional[str] = None
    status: Optional[ContentStatus] = None
    tags: Optional[List[str]] = None
    custom_fields: Optional[Dict[str, Any]] = None


class ContentResponse(BaseModel):
    id: int
    title: str
    slug: Optional[str]
    content_type: str
    status: str
    summary: Optional[str]
    keywords: Optional[str]
    author_id: Optional[int]
    ai_generated: bool
    views: int
    likes: int
    shares: int
    version: int
    created_at: datetime
    updated_at: datetime
    publish_date: Optional[datetime]
    
    class Config:
        from_attributes = True


class ContentDetailResponse(ContentResponse):
    content_text: Optional[str]
    content_html: Optional[str]
    content_markdown: Optional[str]
    meta_description: Optional[str]
    seo_title: Optional[str]
    seo_description: Optional[str]
    seo_keywords: Optional[str]
    readability_score: Optional[float]
    sentiment_score: Optional[float]
    brand_compliance_score: Optional[float]
    ai_model_used: Optional[str]
    ai_prompt: Optional[str]
    custom_fields: Optional[Dict[str, Any]]
    tags: List[str] = []


@router.post("/content", response_model=ContentResponse)
async def create_content(
    content_data: ContentCreate,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.WRITE_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> ContentResponse:
    """
    Create new content
    """
    try:
        user_id = int(current_user["sub"])
        
        # Generate slug from title
        slug = content_data.title.lower().replace(" ", "-").replace("'", "")
        
        # Create content
        new_content = Content(
            title=content_data.title,
            slug=slug,
            content_type=content_data.content_type,
            content_text=content_data.content_text,
            content_html=content_data.content_html,
            content_markdown=content_data.content_markdown,
            summary=content_data.summary,
            keywords=content_data.keywords,
            meta_description=content_data.meta_description,
            seo_title=content_data.seo_title,
            seo_description=content_data.seo_description,
            seo_keywords=content_data.seo_keywords,
            author_id=user_id,
            custom_fields=content_data.custom_fields
        )
        
        db.add(new_content)
        await db.flush()  # Get the ID
        
        # Add tags
        if content_data.tags:
            for tag_name in content_data.tags:
                tag = ContentTag(
                    content_id=new_content.id,
                    tag_name=tag_name
                )
                db.add(tag)
        
        await db.commit()
        await db.refresh(new_content)
        
        logger.info(f"Content created: {new_content.id} by user {user_id}")
        
        return ContentResponse.from_orm(new_content)
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Content creation failed: {e}")
        raise


@router.get("/content", response_model=List[ContentResponse])
async def list_content(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    content_type: Optional[ContentType] = None,
    status: Optional[ContentStatus] = None,
    author_id: Optional[int] = None,
    search: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.READ_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> List[ContentResponse]:
    """
    List content with filters
    """
    try:
        query = select(Content)
        
        # Apply filters
        filters = []
        
        if content_type:
            filters.append(Content.content_type == content_type)
        
        if status:
            filters.append(Content.status == status)
        
        if author_id:
            filters.append(Content.author_id == author_id)
        
        if search:
            search_filter = or_(
                Content.title.ilike(f"%{search}%"),
                Content.content_text.ilike(f"%{search}%"),
                Content.summary.ilike(f"%{search}%")
            )
            filters.append(search_filter)
        
        if filters:
            query = query.where(and_(*filters))
        
        # Apply pagination
        query = query.offset(skip).limit(limit).order_by(Content.created_at.desc())
        
        result = await db.execute(query)
        content_list = result.scalars().all()
        
        return [ContentResponse.from_orm(content) for content in content_list]
        
    except Exception as e:
        logger.error(f"Content listing failed: {e}")
        raise


@router.get("/content/{content_id}", response_model=ContentDetailResponse)
async def get_content(
    content_id: int,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.READ_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> ContentDetailResponse:
    """
    Get content by ID
    """
    try:
        # Get content with tags
        result = await db.execute(
            select(Content)
            .options(selectinload(Content.tags))
            .where(Content.id == content_id)
        )
        content = result.scalar_one_or_none()
        
        if not content:
            raise NotFoundError("Content not found")
        
        # Increment view count
        content.views += 1
        await db.commit()
        
        # Format response
        response_data = ContentDetailResponse.from_orm(content)
        response_data.tags = [tag.tag_name for tag in content.tags]
        
        return response_data
        
    except Exception as e:
        logger.error(f"Get content failed: {e}")
        raise


@router.put("/content/{content_id}", response_model=ContentResponse)
async def update_content(
    content_id: int,
    content_data: ContentUpdate,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.WRITE_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> ContentResponse:
    """
    Update content
    """
    try:
        user_id = int(current_user["sub"])
        
        # Get existing content
        result = await db.execute(select(Content).where(Content.id == content_id))
        content = result.scalar_one_or_none()
        
        if not content:
            raise NotFoundError("Content not found")
        
        # Check permissions (author or admin can edit)
        if content.author_id != user_id and current_user.get("role") != "admin":
            raise AuthorizationError("Not authorized to edit this content")
        
        # Create version before updating
        version = ContentVersion(
            content_id=content.id,
            version_number=content.version,
            title=content.title,
            content_text=content.content_text,
            content_html=content.content_html,
            content_markdown=content.content_markdown,
            changed_by=user_id
        )
        db.add(version)
        
        # Update content
        update_data = content_data.model_dump(exclude_unset=True)
        
        if "tags" in update_data:
            # Update tags
            # First, remove existing tags
            await db.execute(delete(ContentTag).where(ContentTag.content_id == content_id))
            
            # Add new tags
            tags = update_data.pop("tags")
            for tag_name in tags:
                tag = ContentTag(
                    content_id=content_id,
                    tag_name=tag_name
                )
                db.add(tag)
        
        # Update other fields
        for field, value in update_data.items():
            setattr(content, field, value)
        
        # Increment version
        content.version += 1
        content.updated_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(content)
        
        logger.info(f"Content updated: {content_id} by user {user_id}")
        
        return ContentResponse.from_orm(content)
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Content update failed: {e}")
        raise


@router.delete("/content/{content_id}")
async def delete_content(
    content_id: int,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.DELETE_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, str]:
    """
    Delete content
    """
    try:
        user_id = int(current_user["sub"])
        
        # Get existing content
        result = await db.execute(select(Content).where(Content.id == content_id))
        content = result.scalar_one_or_none()
        
        if not content:
            raise NotFoundError("Content not found")
        
        # Check permissions (author or admin can delete)
        if content.author_id != user_id and current_user.get("role") != "admin":
            raise AuthorizationError("Not authorized to delete this content")
        
        # Delete content (cascade will handle tags and versions)
        await db.execute(delete(Content).where(Content.id == content_id))
        await db.commit()
        
        logger.info(f"Content deleted: {content_id} by user {user_id}")
        
        return {"message": "Content deleted successfully"}
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Content deletion failed: {e}")
        raise


@router.post("/content/{content_id}/publish")
async def publish_content(
    content_id: int,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.PUBLISH_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, str]:
    """
    Publish content
    """
    try:
        user_id = int(current_user["sub"])
        
        # Get content
        result = await db.execute(select(Content).where(Content.id == content_id))
        content = result.scalar_one_or_none()
        
        if not content:
            raise NotFoundError("Content not found")
        
        # Update status
        content.status = ContentStatus.PUBLISHED
        content.publish_date = datetime.utcnow()
        
        await db.commit()
        
        logger.info(f"Content published: {content_id} by user {user_id}")
        
        return {"message": "Content published successfully"}
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Content publication failed: {e}")
        raise


@router.get("/content/{content_id}/versions", response_model=List[Dict[str, Any]])
async def get_content_versions(
    content_id: int,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.READ_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> List[Dict[str, Any]]:
    """
    Get content version history
    """
    try:
        # Get versions
        result = await db.execute(
            select(ContentVersion)
            .where(ContentVersion.content_id == content_id)
            .order_by(ContentVersion.version_number.desc())
        )
        versions = result.scalars().all()
        
        return [
            {
                "id": version.id,
                "version_number": version.version_number,
                "title": version.title,
                "change_summary": version.change_summary,
                "changed_by": version.changed_by,
                "created_at": version.created_at
            }
            for version in versions
        ]
        
    except Exception as e:
        logger.error(f"Get content versions failed: {e}")
        raise
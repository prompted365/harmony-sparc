"""
Publishing and scheduling API routes
"""
from datetime import datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from pydantic import BaseModel
import structlog

from core.database import get_db
from core.security import get_current_user_payload, require_permission, Permission
from core.exceptions import NotFoundError, ValidationError, PublishingError
from models.publishing import Publication, PublicationStatus, PublishingSchedule, PublishingChannel
from models.content import Content

logger = structlog.get_logger(__name__)

router = APIRouter()


# Request/Response models
class PublicationCreate(BaseModel):
    title: str
    description: Optional[str] = None
    content_id: Optional[int] = None
    custom_content: Optional[str] = None
    channels: List[Dict[str, Any]]
    publish_date: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = {}


class PublicationUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[PublicationStatus] = None
    publish_date: Optional[datetime] = None
    channels: Optional[List[Dict[str, Any]]] = None
    metadata: Optional[Dict[str, Any]] = None


class PublicationResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    content_id: Optional[int]
    status: str
    publish_date: Optional[datetime]
    published_at: Optional[datetime]
    created_by: Optional[int]
    created_at: datetime
    
    class Config:
        from_attributes = True


class ChannelCreate(BaseModel):
    name: str
    description: Optional[str] = None
    channel_type: str
    config: Dict[str, Any]
    credentials: Optional[Dict[str, Any]] = {}


class ChannelResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    channel_type: str
    is_active: bool
    success_rate: Optional[float]
    usage_count: int
    created_at: datetime
    
    class Config:
        from_attributes = True


@router.post("/publishing/publications", response_model=PublicationResponse)
async def create_publication(
    publication_data: PublicationCreate,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.PUBLISH_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> PublicationResponse:
    """
    Create a new publication
    """
    try:
        user_id = int(current_user["sub"])
        
        # Validate content if provided
        if publication_data.content_id:
            result = await db.execute(select(Content).where(Content.id == publication_data.content_id))
            content = result.scalar_one_or_none()
            
            if not content:
                raise NotFoundError("Content not found")
        
        # Create publication
        publication = Publication(
            title=publication_data.title,
            description=publication_data.description,
            content_id=publication_data.content_id,
            custom_content=publication_data.custom_content,
            channels=publication_data.channels,
            publish_date=publication_data.publish_date,
            metadata=publication_data.metadata,
            created_by=user_id
        )
        
        # Set status based on publish_date
        if publication_data.publish_date and publication_data.publish_date > datetime.utcnow():
            publication.status = PublicationStatus.SCHEDULED
        
        db.add(publication)
        await db.commit()
        await db.refresh(publication)
        
        # Create schedule if needed
        if publication.status == PublicationStatus.SCHEDULED:
            schedule = PublishingSchedule(
                publication_id=publication.id,
                name=f"Schedule for {publication.title}",
                scheduled_at=publication_data.publish_date,
                next_execution=publication_data.publish_date
            )
            db.add(schedule)
            await db.commit()
        
        logger.info(f"Publication created: {publication.id} by user {user_id}")
        
        return PublicationResponse.from_orm(publication)
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Publication creation failed: {e}")
        raise


@router.get("/publishing/publications", response_model=List[PublicationResponse])
async def list_publications(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    status: Optional[PublicationStatus] = None,
    content_id: Optional[int] = None,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.READ_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> List[PublicationResponse]:
    """
    List publications with filters
    """
    try:
        query = select(Publication)
        
        # Apply filters
        filters = []
        
        if status:
            filters.append(Publication.status == status)
        
        if content_id:
            filters.append(Publication.content_id == content_id)
        
        # Show only user's publications unless admin
        if current_user.get("role") != "admin":
            user_id = int(current_user["sub"])
            filters.append(Publication.created_by == user_id)
        
        if filters:
            query = query.where(and_(*filters))
        
        # Apply pagination
        query = query.offset(skip).limit(limit).order_by(Publication.created_at.desc())
        
        result = await db.execute(query)
        publications = result.scalars().all()
        
        return [PublicationResponse.from_orm(pub) for pub in publications]
        
    except Exception as e:
        logger.error(f"Publication listing failed: {e}")
        raise


@router.get("/publishing/publications/{publication_id}", response_model=Dict[str, Any])
async def get_publication(
    publication_id: int,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.READ_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get publication details
    """
    try:
        result = await db.execute(select(Publication).where(Publication.id == publication_id))
        publication = result.scalar_one_or_none()
        
        if not publication:
            raise NotFoundError("Publication not found")
        
        # Check permissions
        if (current_user.get("role") != "admin" and 
            publication.created_by != int(current_user["sub"])):
            raise ValidationError("Not authorized to access this publication")
        
        return {
            "id": publication.id,
            "title": publication.title,
            "description": publication.description,
            "content_id": publication.content_id,
            "custom_content": publication.custom_content,
            "status": publication.status,
            "channels": publication.channels,
            "publish_date": publication.publish_date,
            "published_at": publication.published_at,
            "metadata": publication.metadata,
            "publication_results": publication.publication_results,
            "error_message": publication.error_message,
            "created_by": publication.created_by,
            "created_at": publication.created_at,
            "updated_at": publication.updated_at
        }
        
    except Exception as e:
        logger.error(f"Get publication failed: {e}")
        raise


@router.put("/publishing/publications/{publication_id}", response_model=PublicationResponse)
async def update_publication(
    publication_id: int,
    publication_data: PublicationUpdate,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.PUBLISH_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> PublicationResponse:
    """
    Update publication
    """
    try:
        user_id = int(current_user["sub"])
        
        # Get publication
        result = await db.execute(select(Publication).where(Publication.id == publication_id))
        publication = result.scalar_one_or_none()
        
        if not publication:
            raise NotFoundError("Publication not found")
        
        # Check permissions
        if (current_user.get("role") != "admin" and 
            publication.created_by != user_id):
            raise ValidationError("Not authorized to update this publication")
        
        # Update fields
        update_data = publication_data.model_dump(exclude_unset=True)
        
        for field, value in update_data.items():
            setattr(publication, field, value)
        
        publication.updated_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(publication)
        
        logger.info(f"Publication updated: {publication_id} by user {user_id}")
        
        return PublicationResponse.from_orm(publication)
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Publication update failed: {e}")
        raise


@router.post("/publishing/publications/{publication_id}/publish")
async def publish_now(
    publication_id: int,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.PUBLISH_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, str]:
    """
    Publish content immediately
    """
    try:
        user_id = int(current_user["sub"])
        
        # Get publication
        result = await db.execute(select(Publication).where(Publication.id == publication_id))
        publication = result.scalar_one_or_none()
        
        if not publication:
            raise NotFoundError("Publication not found")
        
        # Check permissions
        if (current_user.get("role") != "admin" and 
            publication.created_by != user_id):
            raise ValidationError("Not authorized to publish this content")
        
        if publication.status == PublicationStatus.PUBLISHED:
            return {"message": "Content already published"}
        
        # Update status
        publication.status = PublicationStatus.PUBLISHING
        await db.commit()
        
        # TODO: Trigger publishing task
        # await publish_content_task.delay(publication_id)
        
        logger.info(f"Publication triggered: {publication_id} by user {user_id}")
        
        return {"message": "Publishing started"}
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Publication trigger failed: {e}")
        raise


@router.post("/publishing/channels", response_model=ChannelResponse)
async def create_channel(
    channel_data: ChannelCreate,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.MANAGE_SYSTEM)),
    db: AsyncSession = Depends(get_db)
) -> ChannelResponse:
    """
    Create a new publishing channel
    """
    try:
        user_id = int(current_user["sub"])
        
        # Create channel
        channel = PublishingChannel(
            name=channel_data.name,
            description=channel_data.description,
            channel_type=channel_data.channel_type,
            config=channel_data.config,
            credentials=channel_data.credentials,
            created_by=user_id
        )
        
        db.add(channel)
        await db.commit()
        await db.refresh(channel)
        
        logger.info(f"Publishing channel created: {channel.id} by user {user_id}")
        
        return ChannelResponse.from_orm(channel)
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Channel creation failed: {e}")
        raise


@router.get("/publishing/channels", response_model=List[ChannelResponse])
async def list_channels(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    channel_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.READ_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> List[ChannelResponse]:
    """
    List publishing channels
    """
    try:
        query = select(PublishingChannel)
        
        # Apply filters
        filters = []
        
        if channel_type:
            filters.append(PublishingChannel.channel_type == channel_type)
        
        if is_active is not None:
            filters.append(PublishingChannel.is_active == is_active)
        
        if filters:
            query = query.where(and_(*filters))
        
        # Apply pagination
        query = query.offset(skip).limit(limit).order_by(PublishingChannel.created_at.desc())
        
        result = await db.execute(query)
        channels = result.scalars().all()
        
        return [ChannelResponse.from_orm(channel) for channel in channels]
        
    except Exception as e:
        logger.error(f"Channel listing failed: {e}")
        raise


@router.delete("/publishing/channels/{channel_id}")
async def delete_channel(
    channel_id: int,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.MANAGE_SYSTEM)),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, str]:
    """
    Delete publishing channel
    """
    try:
        user_id = int(current_user["sub"])
        
        # Get channel
        result = await db.execute(select(PublishingChannel).where(PublishingChannel.id == channel_id))
        channel = result.scalar_one_or_none()
        
        if not channel:
            raise NotFoundError("Channel not found")
        
        # Delete channel
        await db.delete(channel)
        await db.commit()
        
        logger.info(f"Publishing channel deleted: {channel_id} by user {user_id}")
        
        return {"message": "Channel deleted successfully"}
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Channel deletion failed: {e}")
        raise


@router.get("/publishing/analytics/{publication_id}")
async def get_publication_analytics(
    publication_id: int,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.VIEW_ANALYTICS)),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get publication analytics
    """
    try:
        # Get publication
        result = await db.execute(select(Publication).where(Publication.id == publication_id))
        publication = result.scalar_one_or_none()
        
        if not publication:
            raise NotFoundError("Publication not found")
        
        # TODO: Implement analytics collection from publishing channels
        # This would aggregate data from different channels
        
        analytics = {
            "publication_id": publication_id,
            "title": publication.title,
            "status": publication.status,
            "published_at": publication.published_at,
            "channels": len(publication.channels or []),
            "metrics": {
                "views": 0,
                "clicks": 0,
                "shares": 0,
                "engagement_rate": 0.0
            },
            "channel_performance": []
        }
        
        return analytics
        
    except Exception as e:
        logger.error(f"Publication analytics failed: {e}")
        raise